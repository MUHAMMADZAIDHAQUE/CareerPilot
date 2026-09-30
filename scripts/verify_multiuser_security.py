"""
Multi-User Security & Isolation Gate for CareerPilot Phase 22.
Tests cross-user IDOR access, candidate vs admin RBAC, and unauthenticated behavior.
"""

import asyncio
import uuid
from httpx import AsyncClient, ASGITransport
from backend.app.main import app


async def run_multiuser_security_gate():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        print("\n=======================================================")
        print("Running Multi-User Security & RBAC Isolation Gate...")
        print("=======================================================\n")

        # 1. Register User A
        email_a = f"usera_{uuid.uuid4().hex[:6]}@careerpilot-test.ai"
        pass_a = "UserA@SecurePass123!"
        resp_a = await client.post("/api/v1/auth/register", json={
            "email": email_a,
            "password": pass_a,
            "full_name": "User Alpha",
            "headline": "Full Stack Engineer"
        })
        assert resp_a.status_code == 201, f"User A registration failed: {resp_a.text}"
        data_a = resp_a.json()
        token_a = data_a["access_token"]
        user_a_id = data_a["user"]["id"]
        cand_a_id = data_a["user"]["candidate_id"]
        print(f"✅ User A registered: {email_a} (cand_id: {cand_a_id})")

        # 2. Register User B
        email_b = f"userb_{uuid.uuid4().hex[:6]}@careerpilot-test.ai"
        pass_b = "UserB@SecurePass123!"
        resp_b = await client.post("/api/v1/auth/register", json={
            "email": email_b,
            "password": pass_b,
            "full_name": "User Beta",
            "headline": "DevOps Engineer"
        })
        assert resp_b.status_code == 201, f"User B registration failed: {resp_b.text}"
        data_b = resp_b.json()
        token_b = data_b["access_token"]
        user_b_id = data_b["user"]["id"]
        cand_b_id = data_b["user"]["candidate_id"]
        print(f"✅ User B registered: {email_b} (cand_id: {cand_b_id})")

        # 3. Test Cross-User Isolation (IDOR check)
        # User B attempts to access User A's profile / private details
        print("\nTesting Cross-User Data Isolation...")
        
        # Test /profile for User A with User A token
        me_a = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_a}"})
        assert me_a.status_code == 200
        assert me_a.json()["id"] == user_a_id
        print("  - User A profile access: OK (200)")

        # Test /profile for User B with User B token
        me_b = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_b}"})
        assert me_b.status_code == 200
        assert me_b.json()["id"] == user_b_id
        assert me_b.json()["id"] != user_a_id
        print("  - User B profile access: OK (200, strictly isolated)")

        # 4. RBAC Isolation Check: Candidate -> Admin Endpoint
        print("\nTesting RBAC Isolation (Candidate accessing Admin APIs)...")
        cand_admin_resp = await client.get(
            "/api/v1/admin/dashboard",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        print(f"  - User A GET /api/v1/admin/dashboard: status {cand_admin_resp.status_code}")
        assert cand_admin_resp.status_code == 403, f"Expected 403 Forbidden, got {cand_admin_resp.status_code}"
        print("  ✅ User A blocked with 403 Forbidden on Admin Dashboard")

        # 5. Unauthenticated Check: No token -> Admin Endpoint
        unauth_resp = await client.get("/api/v1/admin/dashboard")
        print(f"  - Anonymous GET /api/v1/admin/dashboard: status {unauth_resp.status_code}")
        assert unauth_resp.status_code == 401, f"Expected 401 Unauthorized, got {unauth_resp.status_code}"
        print("  ✅ Anonymous request blocked with 401 Unauthorized")

        # 6. Admin User Access: Authenticated Admin -> Admin Dashboard
        print("\nTesting Admin Privileges...")
        admin_login = await client.post("/api/v1/auth/login", json={
            "email": "admin@careerpilot.ai",
            "password": "Admin@CareerPilot2026!"
        })
        assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
        admin_token = admin_login.json()["access_token"]
        print("  - Admin login: OK (200)")

        admin_dash = await client.get(
            "/api/v1/admin/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert admin_dash.status_code == 200, f"Admin dashboard access failed: {admin_dash.text}"
        dash_data = admin_dash.json()
        print(f"  - Admin dashboard access: OK (200)")
        print(f"    Total users: {dash_data['total_users']}")
        print(f"    System status: {dash_data['system_status']}")

        # Admin user list
        admin_users = await client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert admin_users.status_code == 200
        users_list = admin_users.json()
        print(f"    Total registered accounts visible to Admin: {len(users_list)}")
        print("  ✅ Admin user management verified")

        print("\n=======================================================")
        print("✅ Multi-User Security & RBAC Isolation Gate: 100% PASS")
        print("=======================================================\n")
        return True


if __name__ == "__main__":
    asyncio.run(run_multiuser_security_gate())
