import pytest
from httpx import AsyncClient
from backend.app.services.storage.local_adapter import LocalStorageAdapter
from backend.app.services.storage.supabase_adapter import SupabaseStorageAdapter
from backend.app.services.storage.service import get_storage_service, reset_storage_service


@pytest.mark.asyncio
async def test_local_storage_upload_and_download(tmp_path):
    adapter = LocalStorageAdapter(root_dir=str(tmp_path))
    content = b"%PDF-1.4 Test PDF binary content"
    key = await adapter.upload_file(
        user_id="user_123",
        content=content,
        filename="resume.pdf",
        content_type="application/pdf",
        subfolder="resumes",
    )

    assert key.startswith("users/user_123/resumes/")
    assert "resume.pdf" in key

    # Download with correct owner
    downloaded = await adapter.download_file(storage_key=key, user_id="user_123")
    assert downloaded == content

    # Exists check
    assert await adapter.file_exists(key, user_id="user_123") is True

    # Metadata check
    meta = await adapter.get_metadata(key, user_id="user_123")
    assert meta["size_bytes"] == len(content)
    assert meta["backend"] == "local"


@pytest.mark.asyncio
async def test_storage_tenant_isolation_blocks_cross_user(tmp_path):
    adapter = LocalStorageAdapter(root_dir=str(tmp_path))
    content = b"Confidential Resume of User Alice"
    key = await adapter.upload_file(
        user_id="alice_uuid",
        content=content,
        filename="secret.pdf",
    )

    # Bob attempts to download Alice's file -> PermissionError
    with pytest.raises(PermissionError) as exc_info:
        await adapter.download_file(storage_key=key, user_id="bob_uuid")
    assert "Unauthorized storage access" in str(exc_info.value)

    # Bob attempts to get metadata
    with pytest.raises(PermissionError):
        await adapter.get_metadata(storage_key=key, user_id="bob_uuid")

    # Bob attempts to delete
    with pytest.raises(PermissionError):
        await adapter.delete_file(storage_key=key, user_id="bob_uuid")


@pytest.mark.asyncio
async def test_storage_anti_directory_traversal(tmp_path):
    adapter = LocalStorageAdapter(root_dir=str(tmp_path))
    malicious_key = "users/alice/../../etc/passwd"

    with pytest.raises(PermissionError):
        await adapter.download_file(storage_key=malicious_key, user_id="alice")


@pytest.mark.asyncio
async def test_storage_missing_file_raises(tmp_path):
    adapter = LocalStorageAdapter(root_dir=str(tmp_path))
    missing_key = "users/user_xyz/resumes/non_existent.pdf"

    with pytest.raises(FileNotFoundError):
        await adapter.download_file(storage_key=missing_key, user_id="user_xyz")


@pytest.mark.asyncio
async def test_signed_url_token_verification(tmp_path):
    adapter = LocalStorageAdapter(root_dir=str(tmp_path))
    content = b"Sample signed doc"
    key = await adapter.upload_file(user_id="user_sign", content=content, filename="doc.txt")

    signed_url = await adapter.get_signed_url(storage_key=key, expires_in=60, user_id="user_sign")
    assert "/storage/stream?key=" in signed_url
    assert "sig=" in signed_url
    assert "expires=" in signed_url


@pytest.mark.asyncio
async def test_supabase_adapter_fallback_when_unconfigured(tmp_path):
    adapter = SupabaseStorageAdapter(supabase_url=None, service_role_key=None)
    content = b"Supabase hybrid content"
    key = await adapter.upload_file(user_id="supa_user", content=content, filename="supa.pdf")

    assert key.startswith("users/supa_user/")
    downloaded = await adapter.download_file(key, user_id="supa_user")
    assert downloaded == content


@pytest.mark.asyncio
async def test_storage_status_api_endpoint(async_client: AsyncClient):
    res = await async_client.get("/api/v1/storage/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "operational"
    assert data["isolation_model"] == "tenant_scoped"
    assert "backend" in data
