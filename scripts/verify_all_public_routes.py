import httpx
import uuid
import sys
import time

FRONTEND_URL = "https://proudly-knowledge-still-carl.trycloudflare.com"
BACKEND_URL = "https://mardi-contacts-linked-terrain.trycloudflare.com"

print("="*75)
print("TESTING ALL PUBLIC FRONTEND ROUTES & API BACKEND INTEGRATIONS")
print(f"Frontend: {FRONTEND_URL}")
print(f"Backend:  {BACKEND_URL}")
print("="*75)

results = []

def report(name, passed, detail=""):
    icon = "✅ PASS" if passed else "❌ FAIL"
    print(f"[{icon}] {name}")
    if detail:
        print(f"        {detail}")
    results.append(passed)

with httpx.Client(timeout=45.0, follow_redirects=True) as client:
    # 1. Landing Page
    try:
        r = client.get(FRONTEND_URL)
        passed = (r.status_code == 200 and "CareerPilot" in r.text)
        report("1. Landing Page (/) ", passed, f"HTTP {r.status_code}, Length: {len(r.text)} bytes")
    except Exception as e:
        report("1. Landing Page (/) ", False, str(e))

    # 2. Register Page & API
    try:
        r_page = client.get(f"{FRONTEND_URL}/register")
        test_email = f"user_{uuid.uuid4().hex[:6]}@careerpilot-live.io"
        test_pass = "SecurePass#2026!"
        r_api = client.post(f"{FRONTEND_URL}/api/v1/auth/register", json={
            "email": test_email,
            "password": test_pass,
            "full_name": "Test User",
            "headline": "Full-Stack Engineer"
        })
        auth_data = r_api.json() if r_api.status_code == 201 else {}
        token = auth_data.get("access_token")
        cand_id = auth_data.get("user", {}).get("candidate_id")
        passed = (r_page.status_code == 200 and r_api.status_code == 201 and token is not None)
        report("2. Register Page (/register) & API Registration", passed,
               f"Page: HTTP {r_page.status_code}, API: HTTP {r_api.status_code}, Candidate: {cand_id}")
    except Exception as e:
        report("2. Register Page (/register) & API Registration", False, str(e))
        token = None
        cand_id = None

    # 3. Login Page & API
    try:
        r_page = client.get(f"{FRONTEND_URL}/login")
        r_api = client.post(f"{FRONTEND_URL}/api/v1/auth/login", json={
            "email": test_email,
            "password": test_pass
        })
        passed = (r_page.status_code == 200 and r_api.status_code == 200)
        report("3. Login Page (/login) & API Login", passed,
               f"Page: HTTP {r_page.status_code}, API: HTTP {r_api.status_code}")
    except Exception as e:
        report("3. Login Page (/login) & API Login", False, str(e))

    # 4. Dashboard Page & API
    try:
        r_page = client.get(f"{FRONTEND_URL}/")
        r_api = client.get(f"{FRONTEND_URL}/api/dashboard?candidate_id={cand_id}")
        data = r_api.json() if r_api.status_code == 200 else {}
        has_counts = "pipeline_counts" in data
        passed = (r_page.status_code == 200 and r_api.status_code == 200 and has_counts)
        report("4. Dashboard Page & API (/api/dashboard)", passed,
               f"API: HTTP {r_api.status_code}, Pipeline: {data.get('pipeline_counts')}")
    except Exception as e:
        report("4. Dashboard Page & API (/api/dashboard)", False, str(e))

    # 5. Jobs Page & API
    first_job_id = None
    try:
        r_page = client.get(f"{FRONTEND_URL}/jobs")
        r_api = client.get(f"{FRONTEND_URL}/api/jobs?limit=5")
        jobs_data = r_api.json() if r_api.status_code == 200 else {}
        jobs = jobs_data if isinstance(jobs_data, list) else jobs_data.get("items", [])
        if jobs and len(jobs) > 0:
            first_job_id = jobs[0].get("id")
        passed = (r_page.status_code == 200 and r_api.status_code == 200 and len(jobs) > 0)
        report("5. Jobs Discovery Page (/jobs) & Search API", passed,
               f"Page: HTTP {r_page.status_code}, Found {len(jobs)} jobs, First ID: {first_job_id}")
    except Exception as e:
        report("5. Jobs Discovery Page (/jobs) & Search API", False, str(e))

    # 6. Job Detail Page & API
    try:
        if first_job_id:
            r_page = client.get(f"{FRONTEND_URL}/jobs/{first_job_id}")
            r_api = client.get(f"{FRONTEND_URL}/api/jobs/{first_job_id}")
            passed = (r_page.status_code == 200 and r_api.status_code == 200)
            report("6. Job Detail Page (/jobs/[id]) & API", passed,
                   f"Page: HTTP {r_page.status_code}, API: HTTP {r_api.status_code}")
        else:
            report("6. Job Detail Page (/jobs/[id]) & API", True, "Skipped (no job id)")
    except Exception as e:
        report("6. Job Detail Page (/jobs/[id]) & API", False, str(e))

    # 7. Resumes Page & API
    try:
        r_page = client.get(f"{FRONTEND_URL}/resumes")
        r_api = client.get(f"{FRONTEND_URL}/api/resumes/versions?candidate_id={cand_id}")
        passed = (r_page.status_code == 200 and r_api.status_code == 200)
        report("7. Resumes Page (/resumes) & API", passed,
               f"Page: HTTP {r_page.status_code}, API: HTTP {r_api.status_code}")
    except Exception as e:
        report("7. Resumes Page (/resumes) & API", False, str(e))

    # 8. Referrals Page & API
    try:
        r_page = client.get(f"{FRONTEND_URL}/referrals")
        r_api = client.get(f"{FRONTEND_URL}/api/referrals?candidate_id={cand_id}")
        passed = (r_page.status_code == 200 and r_api.status_code == 200)
        report("8. Referrals Page (/referrals) & API", passed,
               f"Page: HTTP {r_page.status_code}, API: HTTP {r_api.status_code}")
    except Exception as e:
        report("8. Referrals Page (/referrals) & API", False, str(e))

    # 9. Applications Page & API
    try:
        r_page = client.get(f"{FRONTEND_URL}/applications")
        r_api = client.get(f"{FRONTEND_URL}/api/applications?candidate_id={cand_id}")
        passed = (r_page.status_code == 200 and r_api.status_code == 200)
        report("9. Applications Page (/applications) & API", passed,
               f"Page: HTTP {r_page.status_code}, API: HTTP {r_api.status_code}")
    except Exception as e:
        report("9. Applications Page (/applications) & API", False, str(e))

    # 10. Interview Page & API
    try:
        r_page = client.get(f"{FRONTEND_URL}/interview")
        r_api = client.get(f"{FRONTEND_URL}/api/interview/sessions")
        passed = (r_page.status_code == 200 and r_api.status_code == 200)
        report("10. Interview Page (/interview) & Sessions API", passed,
               f"Page: HTTP {r_page.status_code}, API: HTTP {r_api.status_code}")
    except Exception as e:
        report("10. Interview Page (/interview) & Sessions API", False, str(e))

    # 11. Insights Page & API
    try:
        r_page = client.get(f"{FRONTEND_URL}/insights")
        r_api = client.get(f"{FRONTEND_URL}/api/career/skill-gaps?candidate_id={cand_id}")
        passed = (r_page.status_code == 200 and r_api.status_code == 200)
        report("11. Insights Page (/insights) & Skill Gaps API", passed,
               f"Page: HTTP {r_page.status_code}, API: HTTP {r_api.status_code}")
    except Exception as e:
        report("11. Insights Page (/insights) & Skill Gaps API", False, str(e))

    # 12. Settings Page
    try:
        r_page = client.get(f"{FRONTEND_URL}/settings")
        passed = (r_page.status_code == 200)
        report("12. Settings Page (/settings)", passed, f"Page: HTTP {r_page.status_code}")
    except Exception as e:
        report("12. Settings Page (/settings)", False, str(e))

    # 13. Admin Page & Protected API (RBAC)
    try:
        r_page = client.get(f"{FRONTEND_URL}/admin")
        # Candidate token should be blocked with 403
        r_cand_block = client.get(
            f"{FRONTEND_URL}/api/v1/admin/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        passed = (r_page.status_code == 200 and r_cand_block.status_code == 403)
        report("13. Admin Page (/admin) & RBAC Guard", passed,
               f"Page: HTTP {r_page.status_code}, Candidate Blocked: HTTP {r_cand_block.status_code} (Expected 403)")
    except Exception as e:
        report("13. Admin Page (/admin) & RBAC Guard", False, str(e))

total_passed = sum(1 for p in results if p)
total_tests = len(results)
print("="*75)
print(f"VERIFICATION SUMMARY: {total_passed}/{total_tests} PASSED ({total_passed/total_tests*100:.1f}%)")
print("="*75)

if total_passed == total_tests:
    sys.exit(0)
else:
    sys.exit(1)
