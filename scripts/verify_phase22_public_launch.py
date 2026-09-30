"""
CareerPilot Phase 22 - Live Public Launch End-to-End Verification Script
Tests all public HTTPS endpoints, Candidate & Admin authentication, RBAC isolation,
and core user workflows over real internet edge tunnels.
"""

import httpx
import uuid
import sys
import json
import time

BACKEND_PUBLIC_URL = "https://times-stan-mortgage-aquatic.trycloudflare.com"
FRONTEND_PUBLIC_URL = "https://submitted-observation-motels-sing.trycloudflare.com"

def log_test(step_num: int, name: str, passed: bool, detail: str = ""):
    icon = "✅ PASS" if passed else "❌ FAIL"
    print(f"[{icon}] Step {step_num}: {name}")
    if detail:
        print(f"        {detail}")

def run_tests():
    print("\n" + "="*70)
    print("CAREERPILOT PHASE 22: LIVE PUBLIC LAUNCH END-TO-END VERIFICATION")
    print("="*70)
    print(f"Backend Public Edge:  {BACKEND_PUBLIC_URL}")
    print(f"Frontend Public Edge: {FRONTEND_PUBLIC_URL}")
    print("="*70 + "\n")

    results = []

    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        # Step 1: Public Backend Health & Supabase Postgres check
        try:
            r = client.get(f"{BACKEND_PUBLIC_URL}/api/health")
            data = r.json()
            is_healthy = (
                r.status_code == 200
                and data.get("status") == "healthy"
                and data.get("database", {}).get("status") == "connected"
                and data.get("database", {}).get("pgvector_enabled") is True
            )
            log_test(1, "Public Backend Health & Supabase pgvector Verification", is_healthy,
                     f"Status: {data.get('status')}, DB: {data.get('database')}")
            results.append(is_healthy)
        except Exception as e:
            log_test(1, "Public Backend Health & Supabase pgvector Verification", False, str(e))
            results.append(False)

        # Step 2: Public OpenAPI Docs Check
        try:
            r = client.get(f"{BACKEND_PUBLIC_URL}/api/docs")
            is_docs = (r.status_code == 200 and "swagger" in r.text.lower())
            log_test(2, "Public OpenAPI Documentation Endpoint", is_docs, f"HTTP {r.status_code}")
            results.append(is_docs)
        except Exception as e:
            log_test(2, "Public OpenAPI Documentation Endpoint", False, str(e))
            results.append(False)

        # Step 3: Frontend Homepage Check
        try:
            r = client.get(FRONTEND_PUBLIC_URL)
            is_fe = (r.status_code == 200 and "CareerPilot" in r.text)
            log_test(3, "Public Frontend Homepage Landing Verification", is_fe, f"HTTP {r.status_code}")
            results.append(is_fe)
        except Exception as e:
            log_test(3, "Public Frontend Homepage Landing Verification", False, str(e))
            results.append(False)

        # Step 4: Frontend API Proxy Integration
        try:
            r = client.get(f"{FRONTEND_PUBLIC_URL}/api/health")
            data = r.json()
            is_proxy = (r.status_code == 200 and data.get("status") == "healthy")
            log_test(4, "Public Frontend -> Backend API Proxy Tunnel", is_proxy, f"HTTP {r.status_code}")
            results.append(is_proxy)
        except Exception as e:
            log_test(4, "Public Frontend -> Backend API Proxy Tunnel", False, str(e))
            results.append(False)

        # Step 5: Candidate Registration over Public Edge
        cand_email = f"prod_candidate_{uuid.uuid4().hex[:6]}@careerpilot-live.io"
        cand_pass = "Candidate#Secure2026!"
        cand_token = None
        cand_id = None
        try:
            r = client.post(
                f"{BACKEND_PUBLIC_URL}/api/v1/auth/register",
                json={
                    "email": cand_email,
                    "password": cand_pass,
                    "full_name": "Devin Torres",
                    "headline": "Senior Cloud Infrastructure Engineer"
                }
            )
            reg_ok = (r.status_code == 201)
            if reg_ok:
                resp_json = r.json()
                cand_token = resp_json.get("access_token")
                cand_id = resp_json.get("user", {}).get("candidate_id")
            log_test(5, "New Candidate Registration via Public API", reg_ok,
                     f"User: {cand_email}, Candidate ID: {cand_id}")
            results.append(reg_ok)
        except Exception as e:
            log_test(5, "New Candidate Registration via Public API", False, str(e))
            results.append(False)

        # Step 6: Candidate Login over Public Edge
        try:
            r = client.post(
                f"{BACKEND_PUBLIC_URL}/api/v1/auth/login",
                json={"email": cand_email, "password": cand_pass}
            )
            login_ok = (r.status_code == 200 and "access_token" in r.json())
            log_test(6, "Candidate Login & Signed JWT Issuance", login_ok, f"HTTP {r.status_code}")
            results.append(login_ok)
        except Exception as e:
            log_test(6, "Candidate Login & Signed JWT Issuance", False, str(e))
            results.append(False)

        # Step 7: Candidate Authenticated Identity (/auth/me)
        try:
            r = client.get(
                f"{BACKEND_PUBLIC_URL}/api/v1/auth/me",
                headers={"Authorization": f"Bearer {cand_token}"}
            )
            me_ok = (r.status_code == 200 and r.json().get("email") == cand_email)
            log_test(7, "Candidate Authenticated Session (/api/v1/auth/me)", me_ok,
                     f"Email: {r.json().get('email')}, Role: {r.json().get('role')}")
            results.append(me_ok)
        except Exception as e:
            log_test(7, "Candidate Authenticated Session (/api/v1/auth/me)", False, str(e))
            results.append(False)

        # Step 8: Multi-User RBAC Security Gate - Candidate BLOCKED from Admin
        try:
            r = client.get(
                f"{BACKEND_PUBLIC_URL}/api/v1/admin/dashboard",
                headers={"Authorization": f"Bearer {cand_token}"}
            )
            rbac_block = (r.status_code == 403)
            log_test(8, "RBAC Security Gate: Candidate Access to /admin -> 403 Forbidden", rbac_block,
                     f"Status: {r.status_code} ({r.json().get('detail')})")
            results.append(rbac_block)
        except Exception as e:
            log_test(8, "RBAC Security Gate: Candidate Access to /admin -> 403 Forbidden", False, str(e))
            results.append(False)

        # Step 9: Anonymous Security Gate - Unauthenticated BLOCKED from Admin
        try:
            r = client.get(f"{BACKEND_PUBLIC_URL}/api/v1/admin/dashboard")
            anon_block = (r.status_code == 401)
            log_test(9, "Security Gate: Unauthenticated Access to /admin -> 401 Unauthorized", anon_block,
                     f"Status: {r.status_code}")
            results.append(anon_block)
        except Exception as e:
            log_test(9, "Security Gate: Unauthenticated Access to /admin -> 401 Unauthorized", False, str(e))
            results.append(False)

        # Step 10: Admin Authentication over Public Edge
        admin_token = None
        try:
            r = client.post(
                f"{BACKEND_PUBLIC_URL}/api/v1/auth/login",
                json={"email": "admin@careerpilot.ai", "password": "Admin@CareerPilot2026!"}
            )
            admin_ok = (r.status_code == 200 and "access_token" in r.json())
            if admin_ok:
                admin_token = r.json().get("access_token")
            log_test(10, "Administrator Login via Public Edge", admin_ok, f"HTTP {r.status_code}")
            results.append(admin_ok)
        except Exception as e:
            log_test(10, "Administrator Login via Public Edge", False, str(e))
            results.append(False)

        # Step 11: Admin Dashboard over Public Edge
        try:
            r = client.get(
                f"{BACKEND_PUBLIC_URL}/api/v1/admin/dashboard",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            dash_data = r.json() if r.status_code == 200 else {}
            dash_ok = (r.status_code == 200 and "total_users" in dash_data)
            log_test(11, "Administrator Dashboard API Access", dash_ok,
                     f"Total Users: {dash_data.get('total_users')}, System: {dash_data.get('system_status')}")
            results.append(dash_ok)
        except Exception as e:
            log_test(11, "Administrator Dashboard API Access", False, str(e))
            results.append(False)

        # Step 12: Admin User Management List
        try:
            r = client.get(
                f"{BACKEND_PUBLIC_URL}/api/v1/admin/users",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            users_list = r.json() if r.status_code == 200 else []
            users_ok = (r.status_code == 200 and len(users_list) > 0)
            log_test(12, "Administrator User Management API Access", users_ok,
                     f"Retrieved {len(users_list)} registered user accounts")
            results.append(users_ok)
        except Exception as e:
            log_test(12, "Administrator User Management API Access", False, str(e))
            results.append(False)

        # Step 13: Job Discovery & Listing API Check
        try:
            r = client.get(f"{BACKEND_PUBLIC_URL}/api/v1/jobs?limit=5")
            jobs_ok = (r.status_code == 200)
            log_test(13, "Job Search & Discovery API (GET /api/v1/jobs)", jobs_ok, f"HTTP {r.status_code}")
            results.append(jobs_ok)
        except Exception as e:
            log_test(13, "Job Search & Discovery API (GET /api/v1/jobs)", False, str(e))
            results.append(False)

        # Step 14: Core Frontend Application Routes Check
        routes = [
            "/login",
            "/register",
            "/admin",
            "/jobs",
            "/applications",
            "/interview",
            "/career/skill-gaps",
            "/resumes",
            "/referrals",
            "/outreach",
            "/insights",
            "/health",
            "/profile"
        ]
        all_routes_ok = True
        failed_routes = []
        for route in routes:
            try:
                r = client.get(f"{FRONTEND_PUBLIC_URL}{route}")
                if r.status_code != 200:
                    all_routes_ok = False
                    failed_routes.append(f"{route} (HTTP {r.status_code})")
            except Exception as e:
                all_routes_ok = False
                failed_routes.append(f"{route} (Error: {e})")

        log_test(14, f"Public Frontend Key Routes ({len(routes)} Routes Checked)", all_routes_ok,
                 f"All {len(routes)} routes returned HTTP 200" if all_routes_ok else f"Failures: {', '.join(failed_routes)}")
        results.append(all_routes_ok)

    print("\n" + "="*70)
    passed_count = sum(1 for r in results if r)
    total_count = len(results)
    success_rate = (passed_count / total_count) * 100
    print(f"FINAL RESULT: {passed_count}/{total_count} PASSED ({success_rate:.1f}%)")
    print("="*70 + "\n")

    return passed_count == total_count

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
