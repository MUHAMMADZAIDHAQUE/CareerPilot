#!/usr/bin/env python3
"""
CareerPilot Phase 17 E2E Verification Script.
Executes the full pipeline:
Job -> JD Analysis -> Resume Tailoring -> LaTeX -> PDF -> Categorized Diff -> User Approval.
"""
import sys
import hashlib
import httpx
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"
MASTER_RESUME_PATH = Path("resume/master/sample_master_resume.tex")

def main():
    print("=" * 60)
    print("CAREERPILOT PHASE 17 — END-TO-END VERIFICATION")
    print("=" * 60)

    client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    # Step 1: Verify health & Master Resume before
    print("\n[Step 1] Verifying System Health & Master Resume Immutability Baseline...")
    health_res = client.get("/health")
    assert health_res.status_code == 200, f"Health check failed: {health_res.text}"
    print("  ✓ Backend health status: ONLINE")

    assert MASTER_RESUME_PATH.exists(), f"Master resume not found at {MASTER_RESUME_PATH}"
    master_before = MASTER_RESUME_PATH.read_text(encoding="utf-8")
    hash_before = hashlib.sha256(master_before.encode("utf-8")).hexdigest()
    print(f"  ✓ Master resume SHA-256 before: {hash_before}")

    # Step 2: Fetch discovered job from Phase 16B
    print("\n[Step 2] Fetching Discovered Job from Phase 16B...")
    jobs_res = client.get("/api/v1/jobs")
    assert jobs_res.status_code == 200, f"Fetch jobs failed: {jobs_res.text}"
    jobs = jobs_res.json()
    assert len(jobs) > 0, "No jobs found in database."
    selected_job = jobs[0]
    job_id = selected_job["id"]
    print(f"  ✓ Selected Job: '{selected_job['role']}' at '{selected_job['company']}' (ID: {job_id})")

    # Step 3 & 4: Trigger PREPARE RESUME (Tailoring Pipeline)
    print("\n[Step 3 & 4] Executing POST /api/v1/resumes/tailor (PREPARE RESUME)...")
    tailor_res = client.post("/api/v1/resumes/tailor", json={"job_id": job_id})
    assert tailor_res.status_code in [200, 201], f"Tailoring failed: {tailor_res.text}"
    tailor_data = tailor_res.json()
    version = tailor_data["version"]
    version_id = version["id"]
    print(f"  ✓ Tailored Resume Created: v{version['version_number']} (ID: {version_id})")
    print(f"  ✓ Initial Status: {version['status']}")
    assert version["status"] == "REVIEW_REQUIRED", f"Expected REVIEW_REQUIRED, got {version['status']}"
    print(f"  ✓ ATS Keyword Coverage: {version['ats_score']}%")

    ats_details = version.get("ats_details", {})
    evidence_count = len(ats_details.get("evidence_chain", []))
    gaps_count = len(ats_details.get("potential_gaps", []))
    print(f"  ✓ ATS Evidence Chain items: {evidence_count}")
    print(f"  ✓ Potential Gaps flagged: {gaps_count}")

    # Step 5 & 6: Verify LaTeX & PDF Compilation
    print("\n[Step 5 & 6] Verifying PDF Compilation & Download Stream...")
    compile_res = client.post(f"/api/v1/resumes/tailored/{version_id}/compile", json={"force_recompile": True})
    assert compile_res.status_code == 200, f"Compilation failed: {compile_res.text}"
    comp_data = compile_res.json()
    print(f"  ✓ Compilation Status: {comp_data['compilation_status']}")
    print(f"  ✓ Compiler Engine: {comp_data['compiler_used']}")
    print(f"  ✓ Compile Duration: {comp_data['compile_duration_ms']}ms")
    print(f"  ✓ Output File Size: {comp_data['file_size_bytes']} bytes")

    pdf_res = client.get(f"/api/v1/resumes/tailored/{version_id}/pdf")
    assert pdf_res.status_code == 200, f"PDF fetch failed: {pdf_res.text}"
    assert "application/pdf" in pdf_res.headers.get("content-type", ""), "Content-Type is not application/pdf"
    print(f"  ✓ PDF Stream verified ({len(pdf_res.content)} bytes received)")

    # Step 7: View Categorized Diff
    print("\n[Step 7] Verifying Categorized Diff (GET /api/v1/resumes/tailored/{id}/diff)...")
    diff_res = client.get(f"/api/v1/resumes/tailored/{version_id}/diff")
    assert diff_res.status_code == 200, f"Diff fetch failed: {diff_res.text}"
    diff_data = diff_res.json()
    print(f"  ✓ Total Changes: {diff_data['total_changes']}")
    for cat, items in diff_data["categories"].items():
        print(f"    • {cat}: {len(items)} items")

    # Step 8: Manual LaTeX Edit
    print("\n[Step 8] Testing Manual LaTeX Edit & Truth Audit (PATCH /api/v1/resumes/tailored/{id}/latex)...")
    latex_current = version["latex_content"]
    # Safely append a comment and format
    edited_latex = latex_current.replace("\\begin{document}", "% Manual user polish\n\\begin{document}")
    patch_res = client.patch(
        f"/api/v1/resumes/tailored/{version_id}/latex",
        json={"latex_content": edited_latex},
    )
    assert patch_res.status_code == 200, f"PATCH latex failed: {patch_res.text}"
    print("  ✓ Manual edit saved and audited against candidate profile.")

    # Step 9: Re-verify Master Resume Immutability
    print("\n[Step 9] Re-verifying Master Resume Immutability...")
    master_after = MASTER_RESUME_PATH.read_text(encoding="utf-8")
    hash_after = hashlib.sha256(master_after.encode("utf-8")).hexdigest()
    assert hash_before == hash_after, "FATAL ERROR: Master resume file was altered during tailoring pipeline!"
    print("  ✓ MASTER RESUME BEFORE == MASTER RESUME AFTER (Hash exact match: 100% verified)")

    # Step 10 & 11: Explicit User Approval
    print("\n[Step 10 & 11] Executing Explicit User Approval (POST /api/v1/resumes/tailored/{id}/approve)...")
    app_count_before = len(client.get("/api/v1/applications").json())
    
    approve_res = client.post(
        f"/api/v1/resumes/tailored/{version_id}/approve",
        json={"notes": "E2E automated verification approval."},
    )
    assert approve_res.status_code == 200, f"Approve failed: {approve_res.text}"
    app_data = approve_res.json()
    print(f"  ✓ Status Transitioned: {app_data['status']}")
    assert app_data["status"] == "APPROVED"
    assert app_data["ready_for_application"] is True
    assert app_data["auto_applied"] is False, "Violation: application was auto applied!"
    print("  ✓ Human Approval Invariant Verified: auto_applied == False")

    # Verify no automatic CRM application submission occurred
    app_count_after = len(client.get("/api/v1/applications").json())
    assert app_count_before == app_count_after, "Violation: an application was created automatically!"
    print("  ✓ Application Count Unchanged (0 applications submitted automatically)")

    print("\n" + "=" * 60)
    print("PHASE 17 E2E VERIFICATION COMPLETED WITH 100% SUCCESS")
    print("=" * 60)

if __name__ == "__main__":
    main()
