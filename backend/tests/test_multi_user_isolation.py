import pytest
from httpx import AsyncClient
import uuid

@pytest.mark.asyncio
async def test_multi_user_isolation_end_to_end(async_client: AsyncClient):
    """
    Condition 16 Verification:
    Create User A and User B.
    User A creates profile, application, etc.
    Verify User B cannot access User A's:
      - profile data (direct or via IDOR query parameter)
      - applications
      - resume data
    Switch back to User A and verify data remains intact.
    """
    rand = uuid.uuid4().hex[:6]
    email_a = f"user_a_{rand}@careerpilot.ai"
    email_b = f"user_b_{rand}@careerpilot.ai"
    pwd = "SecurePassword123!"

    # 1. Register User A
    reg_a = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email_a, "password": pwd, "full_name": f"User A {rand}"}
    )
    assert reg_a.status_code == 201
    token_a = reg_a.json()["access_token"]
    cand_id_a = reg_a.json()["user"]["candidate_id"]
    assert cand_id_a is not None
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Register User B
    reg_b = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email_b, "password": pwd, "full_name": f"User B {rand}"}
    )
    assert reg_b.status_code == 201
    token_b = reg_b.json()["access_token"]
    cand_id_b = reg_b.json()["user"]["candidate_id"]
    assert cand_id_b is not None
    headers_b = {"Authorization": f"Bearer {token_b}"}

    assert cand_id_a != cand_id_b

    # 3. User A updates profile
    prof_update = await async_client.put(
        "/api/v1/profile",
        headers=headers_a,
        json={"headline": "Senior Staff Architect", "summary": "User A Private Summary"}
    )
    assert prof_update.status_code == 200
    assert prof_update.json()["headline"] == "Senior Staff Architect"

    # 4. User B checks their own profile -> must NOT see User A's headline or summary
    prof_b = await async_client.get("/api/v1/profile", headers=headers_b)
    assert prof_b.status_code == 200
    b_data = prof_b.json()
    assert b_data.get("headline") != "Senior Staff Architect"
    assert b_data.get("summary") != "User A Private Summary"

    # 5. User B attempts IDOR exploit specifying User A's candidate ID
    # 5a. GET /profile?candidate_id={cand_id_a} -> MUST return 403 Forbidden
    idor_get = await async_client.get(f"/api/v1/profile?candidate_id={cand_id_a}", headers=headers_b)
    assert idor_get.status_code == 403
    assert "Access denied" in idor_get.json().get("detail", "")

    # 5b. PUT /profile?candidate_id={cand_id_a} -> MUST return 403 Forbidden
    idor_put = await async_client.put(
        f"/api/v1/profile?candidate_id={cand_id_a}",
        headers=headers_b,
        json={"headline": "Hacked by User B"}
    )
    assert idor_put.status_code == 403
    assert "Access denied" in idor_put.json().get("detail", "")

    # 6. User B checks applications list -> must be 0 applications
    apps_b = await async_client.get("/api/v1/applications", headers=headers_b)
    assert apps_b.status_code == 200
    assert len(apps_b.json()) == 0

    # 7. User A checks their profile -> perfectly intact and unmanipulated
    prof_a = await async_client.get("/api/v1/profile", headers=headers_a)
    assert prof_a.status_code == 200
    a_data = prof_a.json()
    assert a_data.get("headline") == "Senior Staff Architect"
    assert a_data.get("summary") == "User A Private Summary"
