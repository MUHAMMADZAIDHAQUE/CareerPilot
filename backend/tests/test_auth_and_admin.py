import pytest
from httpx import AsyncClient
from backend.app.services.job_discovery.sources.url_source import UrlJobSource


@pytest.mark.asyncio
async def test_auth_registration_and_login(async_client: AsyncClient):
    # 1. Register candidate user
    reg_payload = {
        "email": "candidate.test@example.com",
        "password": "SecurePassword123!",
        "full_name": "Test Candidate",
    }
    response = await async_client.post("/api/v1/auth/register", json=reg_payload)
    assert response.status_code == 201, response.text
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "CANDIDATE"

    token = data["access_token"]

    # 2. Get /me with Bearer token
    me_resp = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "candidate.test@example.com"

    # 3. Log in with credentials
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "candidate.test@example.com", "password": "SecurePassword123!"}
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()


@pytest.mark.asyncio
async def test_auth_invalid_credentials(async_client: AsyncClient):
    # Try logging in with non-existent user
    resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@example.com", "password": "wrongpassword"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_admin_rbac_isolation(async_client: AsyncClient):
    # Seed default accounts (admin + candidate)
    seed_resp = await async_client.post("/api/v1/auth/seed")
    assert seed_resp.status_code == 200

    # 1. Login as Candidate
    cand_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "alex.chen@example.com", "password": "Candidate@2026!"}
    )
    assert cand_login.status_code == 200
    cand_token = cand_login.json()["access_token"]

    # Candidate attempts to access Admin Dashboard -> 403 Forbidden
    cand_admin_resp = await async_client.get(
        "/api/v1/admin/dashboard",
        headers={"Authorization": f"Bearer {cand_token}"}
    )
    assert cand_admin_resp.status_code == 403

    # 2. Login as Admin
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@careerpilot.ai", "password": "Admin@CareerPilot2026!"}
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]

    # Admin accesses Admin Dashboard -> 200 OK
    admin_dash_resp = await async_client.get(
        "/api/v1/admin/dashboard",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert admin_dash_resp.status_code == 200
    dash_data = admin_dash_resp.json()
    assert "total_users" in dash_data
    assert "system_status" in dash_data

    # Admin lists users
    users_resp = await async_client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert users_resp.status_code == 200
    users = users_resp.json()
    assert len(users) >= 2


@pytest.mark.asyncio
async def test_ssrf_blocking_in_url_source():
    source = UrlJobSource()

    # Loopback IP
    with pytest.raises(ValueError, match="is forbidden"):
        await source.fetch_jobs(url="http://127.0.0.1:8000/secret")

    # Localhost
    with pytest.raises(ValueError, match="is forbidden"):
        await source.fetch_jobs(url="http://localhost/admin")

    # AWS/Cloud Metadata IP
    with pytest.raises(ValueError, match="is forbidden"):
        await source.fetch_jobs(url="http://169.254.169.254/latest/meta-data/")

    # Private Subnet
    with pytest.raises(ValueError, match="is forbidden"):
        await source.fetch_jobs(url="http://192.168.1.1/router")

    with pytest.raises(ValueError, match="is forbidden"):
        await source.fetch_jobs(url="http://10.0.0.1/internal")
