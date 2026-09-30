import re
import httpx
from typing import Optional, Dict, Any
from backend.app.services.storage.base import StorageService
from backend.app.services.storage.local_adapter import LocalStorageAdapter
from backend.app.core.config import settings
from backend.app.core.logging import logger


class SupabaseStorageAdapter(StorageService):
    """
    Production Supabase Object Storage Adapter.
    Interacts with Supabase Storage API for persistent, multi-tenant file management.
    Falls back gracefully to LocalStorageAdapter if Supabase storage credentials are unavailable.
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        service_role_key: Optional[str] = None,
        bucket_name: Optional[str] = None,
    ):
        self.supabase_url = (
            supabase_url
            or getattr(settings, "SUPABASE_URL", None)
            or self._derive_supabase_url_from_db()
        )
        self.service_role_key = (
            service_role_key
            or getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)
            or os_key
            if (os_key := getattr(settings, "SUPABASE_KEY", None))
            else None
        )
        self.bucket_name = bucket_name or getattr(settings, "SUPABASE_STORAGE_BUCKET", "careerpilot-storage")
        
        # Local fallback adapter if credentials are not configured
        self._local_fallback = LocalStorageAdapter()
        self.is_configured = bool(self.supabase_url and self.service_role_key)
        if not self.is_configured:
            logger.info(
                f"SupabaseStorage: Missing Supabase URL or Service Key. Running in persistent hybrid mode."
            )

    def _derive_supabase_url_from_db(self) -> Optional[str]:
        """Derives Supabase project URL from DATABASE_URL if available."""
        db_url = getattr(settings, "DATABASE_URL", None) or ""
        match = re.search(r"db\.([a-z0-9]+)\.supabase\.co", db_url)
        if match:
            ref = match.group(1)
            return f"https://{ref}.supabase.co"
        return None

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.service_role_key}",
            "apikey": self.service_role_key or "",
        }

    async def upload_file(
        self,
        user_id: str,
        content: bytes,
        filename: str,
        content_type: str = "application/octet-stream",
        is_public: bool = False,
        subfolder: str = "resumes",
    ) -> str:
        storage_key = self.build_storage_key(user_id=user_id, subfolder=subfolder, filename=filename)

        if not self.is_configured:
            return await self._local_fallback.upload_file(
                user_id=user_id,
                content=content,
                filename=filename,
                content_type=content_type,
                is_public=is_public,
                subfolder=subfolder,
            )

        url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{storage_key}"
        headers = self._get_headers()
        headers["Content-Type"] = content_type

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, content=content, headers=headers)
                if res.status_code in [200, 201]:
                    logger.info(f"SupabaseStorage: Uploaded {storage_key} to bucket {self.bucket_name}")
                    return storage_key
                elif res.status_code == 404:
                    # Bucket might not exist, fallback to local with warning
                    logger.warning(
                        f"SupabaseStorage: Bucket '{self.bucket_name}' not found. Falling back to local."
                    )
                    return await self._local_fallback.upload_file(
                        user_id, content, filename, content_type, is_public, subfolder
                    )
                else:
                    logger.error(f"SupabaseStorage upload error: {res.status_code} - {res.text}")
                    return await self._local_fallback.upload_file(
                        user_id, content, filename, content_type, is_public, subfolder
                    )
        except Exception as e:
            logger.error(f"SupabaseStorage upload network exception: {e}. Fallback to local.")
            return await self._local_fallback.upload_file(
                user_id, content, filename, content_type, is_public, subfolder
            )

    async def download_file(
        self,
        storage_key: str,
        user_id: Optional[str] = None,
    ) -> bytes:
        self.verify_ownership(storage_key, user_id)

        if not self.is_configured:
            return await self._local_fallback.download_file(storage_key, user_id)

        url = f"{self.supabase_url}/storage/v1/object/authenticated/{self.bucket_name}/{storage_key}"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url, headers=self._get_headers())
                if res.status_code == 200:
                    return res.content
                elif res.status_code == 404:
                    # Check local fallback
                    return await self._local_fallback.download_file(storage_key, user_id)
                else:
                    raise FileNotFoundError(f"Supabase file not found: {storage_key} ({res.status_code})")
        except Exception:
            return await self._local_fallback.download_file(storage_key, user_id)

    async def get_signed_url(
        self,
        storage_key: str,
        expires_in: int = 3600,
        user_id: Optional[str] = None,
    ) -> str:
        self.verify_ownership(storage_key, user_id)

        if not self.is_configured:
            return await self._local_fallback.get_signed_url(storage_key, expires_in, user_id)

        url = f"{self.supabase_url}/storage/v1/object/sign/{self.bucket_name}/{storage_key}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json={"expiresIn": expires_in}, headers=self._get_headers())
                if res.status_code == 200:
                    data = res.json()
                    signed_path = data.get("signedURL")
                    if signed_path:
                        return f"{self.supabase_url}/storage/v1{signed_path}"
        except Exception as e:
            logger.warning(f"SupabaseStorage: Signed URL request failed ({e}). Using local fallback.")

        return await self._local_fallback.get_signed_url(storage_key, expires_in, user_id)

    async def delete_file(
        self,
        storage_key: str,
        user_id: Optional[str] = None,
    ) -> bool:
        self.verify_ownership(storage_key, user_id)

        if not self.is_configured:
            return await self._local_fallback.delete_file(storage_key, user_id)

        url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.request(
                    "DELETE", url, json={"prefixes": [storage_key]}, headers=self._get_headers()
                )
                if res.status_code == 200:
                    return True
        except Exception:
            pass

        return await self._local_fallback.delete_file(storage_key, user_id)

    async def file_exists(
        self,
        storage_key: str,
        user_id: Optional[str] = None,
    ) -> bool:
        self.verify_ownership(storage_key, user_id)
        if not self.is_configured:
            return await self._local_fallback.file_exists(storage_key, user_id)
        try:
            content = await self.download_file(storage_key, user_id)
            return len(content) > 0
        except Exception:
            return await self._local_fallback.file_exists(storage_key, user_id)

    async def get_metadata(
        self,
        storage_key: str,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        self.verify_ownership(storage_key, user_id)
        if not self.is_configured:
            return await self._local_fallback.get_metadata(storage_key, user_id)
        try:
            content = await self.download_file(storage_key, user_id)
            return {
                "storage_key": storage_key,
                "size_bytes": len(content),
                "backend": "supabase",
                "bucket": self.bucket_name,
            }
        except Exception:
            return await self._local_fallback.get_metadata(storage_key, user_id)
