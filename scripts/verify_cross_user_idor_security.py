"""
Comprehensive Cross-User IDOR and RBAC Security Verification Gate.
Tests multi-user data isolation across applications, contacts, resumes,
admin endpoints, and unauthenticated ingress against the live production backend.
"""

import sys
import uuid
import httpx

BACKEND_URL = "http://127.0.0.1:8000"

def log_check(step_num: int, name: str, passed: bool, detail: str = ""):
    icon = "✅ PASS" if passed else "❌ FAIL"
    print(f"[{icon}] Test {step_num}: {name}")
    if detail:
        print(f"        {detail}")

def run_multiuser_idor_gate():
    print("\n" + "="*70)
    print("CAREERPILOT MULTI-USER IDOR & RBAC SECURITY VERIFICATION GATE")
    print("="*70 + "\n")

    results = []

    with httpx.Client(base_url=BACKEND_URL, timeout=30.0) as client:
        # 1. Register User Alpha
        alpha_email = f"alpha_{uuid.uuid4().hex[:6]}@pilot-test.net"
        alpha_pass = "AlphaPass#Secure2026!"
        r_alpha = client.post("/api/v1/auth/register", json={
            "email": alpha_email,
            "password": alpha_pass,
            "full_name": "Alpha Candidate",
            "headline": "Full-Stack Python Engineer"
        })
        alpha_ok = (r_alpha.status_code == 201)
        data_alpha = r_alpha.json() if alpha_ok else {}
        alpha_token = data_alpha.get("access_token")
        alpha_cand_id = data_alpha.get("user", {}).get("candidate_id")
        log_check(1, "Register User Alpha", alpha_ok, f"CandID: {alpha_cand_id}")
        results.append(alpha_ok)

        # 2. Register User Beta
        beta_email = f"beta_{uuid.uuid4().hex[:6]}@pilot-test.net"
        beta_pass = "BetaPass#Secure2026!"
        r_beta = client.post("/api/v1/auth/register", json={
            "email": beta_email,
            "password": beta_pass,
            "full_name": "Beta Candidate",
            "headline": "Systems Reliability Engineer"
        })
        beta_ok = (r_beta.status_code == 201)
        data_beta = r_beta.json() if beta_ok else {}
        beta_token = data_beta.get("access_token")
        beta_cand_id = data_beta.get("user", {}).get("candidate_id")
        log_check(2, "Register User Beta", beta_ok, f"CandID: {beta_cand_id}")
        results.append(beta_ok)

        # 3. Resolve Target Job ID
        target_job_id = "9e8cacde-2b85-45e6-bafc-ca45bf757be0"
        jobs_res = client.get("/api/v1/jobs?limit=1")
        if jobs_res.status_code == 200 and len(jobs_res.json()) > 0:
            target_job_id = jobs_res.json()[0]["id"]

        # Create Resource under Alpha: Application
        r_app = client.post("/api/v1/applications", json={
            "job_id": target_job_id,
            "candidate_id": alpha_cand_id,
            "status": "APPLIED",
            "notes": "Alpha confidential application"
        })
        app_created = (r_app.status_code == 201)
        alpha_app_id = r_app.json().get("id") if app_created else None
        log_check(3, "Create Application under User Alpha", app_created,
                  f"App ID: {alpha_app_id}" if app_created else f"Status {r_app.status_code}: {r_app.text[:100]}")
        results.append(app_created)

        # 4. Create Resource under Alpha: Contact
        r_contact = client.post("/api/v1/contacts", json={
            "candidate_id": alpha_cand_id,
            "name": "Sarah Connor",
            "company": "Cyberdyne Systems",
            "role": "Director of Security",
            "notes": "Alpha direct referral connection"
        })
        contact_created = (r_contact.status_code == 201)
        alpha_contact_id = r_contact.json().get("id") if contact_created else None
        log_check(4, "Create Contact under User Alpha", contact_created, f"Contact ID: {alpha_contact_id}")
        results.append(contact_created)

        # 5. IDOR Check: User Beta attempts to GET Alpha's Application Detail
        r_idor_app = client.get(
            f"/api/v1/applications/{alpha_app_id}/detail",
            headers={"Authorization": f"Bearer {beta_token}"}
        )
        idor_app_blocked = (r_idor_app.status_code == 403)
        log_check(5, "IDOR Guard: User Beta GET Alpha Application Detail -> 403 Forbidden",
                  idor_app_blocked, f"Status: {r_idor_app.status_code}")
        results.append(idor_app_blocked)

        # 6. IDOR Check: User Beta attempts to GET Alpha's Application
        r_idor_app_get = client.get(
            f"/api/v1/applications/{alpha_app_id}",
            headers={"Authorization": f"Bearer {beta_token}"}
        )
        idor_app_get_blocked = (r_idor_app_get.status_code == 403)
        log_check(6, "IDOR Guard: User Beta GET Alpha Application -> 403 Forbidden",
                  idor_app_get_blocked, f"Status: {r_idor_app_get.status_code}")
        results.append(idor_app_get_blocked)

        # 7. IDOR Check: User Beta attempts to UPDATE Alpha's Application
        r_idor_app_put = client.put(
            f"/api/v1/applications/{alpha_app_id}",
            json={"status": "REJECTED"},
            headers={"Authorization": f"Bearer {beta_token}"}
        )
        idor_app_put_blocked = (r_idor_app_put.status_code == 403)
        log_check(7, "IDOR Guard: User Beta PUT Alpha Application -> 403 Forbidden",
                  idor_app_put_blocked, f"Status: {r_idor_app_put.status_code}")
        results.append(idor_app_put_blocked)

        # 8. IDOR Check: User Beta attempts to GET Alpha's Contact
        r_idor_contact = client.get(
            f"/api/v1/contacts/{alpha_contact_id}",
            headers={"Authorization": f"Bearer {beta_token}"}
        )
        idor_contact_blocked = (r_idor_contact.status_code == 403)
        log_check(8, "IDOR Guard: User Beta GET Alpha Contact -> 403 Forbidden",
                  idor_contact_blocked, f"Status: {r_idor_contact.status_code}")
        results.append(idor_contact_blocked)

        # 9. IDOR Check: User Beta attempts to DELETE Alpha's Contact
        r_idor_contact_del = client.delete(
            f"/api/v1/contacts/{alpha_contact_id}",
            headers={"Authorization": f"Bearer {beta_token}"}
        )
        idor_contact_del_blocked = (r_idor_contact_del.status_code == 403)
        log_check(9, "IDOR Guard: User Beta DELETE Alpha Contact -> 403 Forbidden",
                  idor_contact_del_blocked, f"Status: {r_idor_contact_del.status_code}")
        results.append(idor_contact_del_blocked)

        # 10. Legitimate Owner Access: User Alpha accesses own Application Detail
        r_owner_app = client.get(
            f"/api/v1/applications/{alpha_app_id}/detail",
            headers={"Authorization": f"Bearer {alpha_token}"}
        )
        owner_app_ok = (r_owner_app.status_code == 200)
        log_check(10, "Owner Access: User Alpha GET Own Application Detail -> 200 OK",
                  owner_app_ok, f"Status: {r_owner_app.status_code}")
        results.append(owner_app_ok)

        # 11. Legitimate Owner Access: User Alpha accesses own Contact
        r_owner_contact = client.get(
            f"/api/v1/contacts/{alpha_contact_id}",
            headers={"Authorization": f"Bearer {alpha_token}"}
        )
        owner_contact_ok = (r_owner_contact.status_code == 200)
        log_check(11, "Owner Access: User Alpha GET Own Contact -> 200 OK",
                  owner_contact_ok, f"Status: {r_owner_contact.status_code}")
        results.append(owner_contact_ok)

        # 12. RBAC Check: User Alpha (Candidate) attempts to access Admin Dashboard
        r_cand_admin = client.get(
            "/api/v1/admin/dashboard",
            headers={"Authorization": f"Bearer {alpha_token}"}
        )
        cand_admin_blocked = (r_cand_admin.status_code == 403)
        log_check(12, "RBAC Guard: Candidate GET /admin/dashboard -> 403 Forbidden",
                  cand_admin_blocked, f"Status: {r_cand_admin.status_code}")
        results.append(cand_admin_blocked)

        # 13. RBAC Check: User Alpha (Candidate) attempts to access Admin Users List
        r_cand_users = client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {alpha_token}"}
        )
        cand_users_blocked = (r_cand_users.status_code == 403)
        log_check(13, "RBAC Guard: Candidate GET /admin/users -> 403 Forbidden",
                  cand_users_blocked, f"Status: {r_cand_users.status_code}")
        results.append(cand_users_blocked)

        # 14. Anonymous Check: Unauthenticated access to Admin Dashboard
        r_anon_admin = client.get("/api/v1/admin/dashboard")
        anon_blocked = (r_anon_admin.status_code == 401)
        log_check(14, "Security Guard: Anonymous GET /admin/dashboard -> 401 Unauthorized",
                  anon_blocked, f"Status: {r_anon_admin.status_code}")
        results.append(anon_blocked)

        # 15. Admin Check: Admin logs in and accesses Admin Dashboard
        admin_login = client.post("/api/v1/auth/login", json={
            "email": "admin@careerpilot.ai",
            "password": "Admin@CareerPilot2026!"
        })
        admin_login_ok = (admin_login.status_code == 200)
        admin_token = admin_login.json().get("access_token") if admin_login_ok else None

        r_admin_dash = client.get(
            "/api/v1/admin/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        admin_dash_ok = (r_admin_dash.status_code == 200)
        log_check(15, "Admin Access: Authenticated Admin GET /admin/dashboard -> 200 OK",
                  admin_dash_ok, f"Status: {r_admin_dash.status_code}")
        results.append(admin_dash_ok)

        # 16. Admin Check: Admin accesses User Management List
        r_admin_users = client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        admin_users_ok = (r_admin_users.status_code == 200)
        log_check(16, "Admin Access: Authenticated Admin GET /admin/users -> 200 OK",
                  admin_users_ok, f"Total Accounts: {len(r_admin_users.json()) if admin_users_ok else 0}")
        results.append(admin_users_ok)

    print("\n" + "="*70)
    passed_cnt = sum(1 for r in results if r)
    total_cnt = len(results)
    print(f"MULTI-USER SECURITY GATE: {passed_cnt}/{total_cnt} PASSED ({(passed_cnt/total_cnt)*100:.1f}%)")
    print("="*70 + "\n")
    return passed_cnt == total_cnt

if __name__ == "__main__":
    success = run_multiuser_idor_gate()
    sys.exit(0 if success else 1)
