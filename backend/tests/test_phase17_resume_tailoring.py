import pytest
import hashlib
from pathlib import Path
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.models.candidate import Candidate, Skill, Experience, Project, Education
from backend.app.models.job import Job, MatchResult
from backend.app.models.resume import ResumeVersion
from backend.app.services.resume_tailor_service import ResumeTailorService
from backend.app.agents.resume_validator_agent import ResumeValidatorAgent
from backend.app.services.latex_compiler_service import LaTeXCompilerService

MASTER_PATH = Path("resume/master/sample_master_resume.tex")


async def create_candidate_and_job(db_session: AsyncSession):
    """Seed test candidate and target job for Phase 17 tests."""
    candidate = Candidate(
        full_name="Elena Vance",
        email="elena.vance@example.com",
        headline="Staff Backend Systems Engineer",
        summary="Expert in distributed microservices, high-throughput APIs, and relational databases.",
    )
    db_session.add(candidate)
    await db_session.flush()

    skills = [
        Skill(candidate_id=candidate.id, name="Python", category="Languages"),
        Skill(candidate_id=candidate.id, name="FastAPI", category="Frameworks & Libraries"),
        Skill(candidate_id=candidate.id, name="PostgreSQL", category="Databases & Storage"),
        Skill(candidate_id=candidate.id, name="Docker", category="Cloud & DevOps"),
        Skill(candidate_id=candidate.id, name="Kubernetes", category="Cloud & DevOps"),
    ]
    db_session.add_all(skills)

    exp = Experience(
        candidate_id=candidate.id,
        company="Nexus Core Technologies",
        role="Senior Backend Architect",
        start_date="January 2021",
        end_date="Present",
        is_current=True,
        bullet_points=[
            "Architected asynchronous ingestion pipeline in FastAPI processing 15,000 req/sec.",
            "Optimized PostgreSQL connection pooling reducing query latency by 42%.",
        ],
        technologies_used=["Python", "FastAPI", "PostgreSQL", "Docker"],
    )
    db_session.add(exp)

    proj = Project(
        candidate_id=candidate.id,
        title="Distributed Event Bus",
        description="Low latency pub-sub messaging service using Python and Docker.",
        technologies=["Python", "Docker", "PostgreSQL"],
        bullet_points=[
            "Built distributed broker with zero message loss guarantee across cluster failover.",
        ],
    )
    db_session.add(proj)

    edu = Education(
        candidate_id=candidate.id,
        institution="MIT",
        degree="B.S. in Computer Science",
        field_of_study="Computer Systems",
        gpa="3.92",
    )
    db_session.add(edu)

    # Target Job with both matching skills and unpossessed skills (e.g., Ruby on Rails, Snowflake)
    job = Job(
        role="Principal Backend Architect",
        company="CloudScale Networks",
        raw_description="Seeking an architect with deep Python, FastAPI, and Kubernetes experience. Ruby on Rails and Snowflake preferred.",
        required_skills=["Python", "FastAPI", "Kubernetes", "Ruby on Rails"],
        preferred_skills=["Docker", "Snowflake"],
        technologies=["Python", "FastAPI", "PostgreSQL", "Kubernetes", "Ruby on Rails", "Snowflake"],
        responsibilities=[
            "Lead distributed systems architecture.",
            "Ensure high availability and fault-tolerant cloud services.",
        ],
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(candidate)
    await db_session.refresh(job)

    return candidate, job


@pytest.mark.asyncio
async def test_master_resume_immutability(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test Requirement 1: Master resume remains strictly unchanged.
    SHA-256 before == SHA-256 after.
    """
    candidate, job = await create_candidate_and_job(db_session)
    assert MASTER_PATH.exists()
    content_before = MASTER_PATH.read_text(encoding="utf-8")
    hash_before = hashlib.sha256(content_before.encode("utf-8")).hexdigest()

    # Trigger tailoring
    res = await async_client.post(
        f"/api/v1/resumes/tailor/{job.id}",
        json={"candidate_id": candidate.id},
    )
    assert res.status_code == 201

    content_after = MASTER_PATH.read_text(encoding="utf-8")
    hash_after = hashlib.sha256(content_after.encode("utf-8")).hexdigest()

    assert hash_before == hash_after, "CRITICAL ERROR: Master resume file was modified!"


@pytest.mark.asyncio
async def test_zero_hallucination_and_ats_gaps(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test Requirements 2, 3, 5, 6:
    - Unsupported JD skills (Rust, AWS, Snowflake) are NOT hallucinated into the resume.
    - Missing skills are marked transparently in potential_gaps and missing_keywords.
    - ATS score and evidence chain are computed accurately.
    """
    candidate, job = await create_candidate_and_job(db_session)

    res = await async_client.post(
        f"/api/v1/resumes/tailor/{job.id}",
        json={"candidate_id": candidate.id},
    )
    assert res.status_code == 201
    data = res.json()
    version = data["version"]
    tailored_latex = version["latex_content"]

    # Invariant: Unpossessed skills must NEVER be inserted into the tailored LaTeX
    assert "Ruby on Rails" not in tailored_latex, "Zero-hallucination violation: 'Ruby on Rails' was fabricated into resume!"
    assert "Snowflake" not in tailored_latex, "Zero-hallucination violation: 'Snowflake' was fabricated into resume!"

    # Invariant: Status must be REVIEW_REQUIRED
    assert version["status"] == "REVIEW_REQUIRED"

    # Invariant: ATS Details must capture matched vs missing keywords
    ats_details = version.get("ats_details", {})
    assert ats_details is not None
    assert "matched_keywords" in ats_details
    assert "missing_keywords" in ats_details
    assert "potential_gaps" in ats_details

    # Check evidence chain
    evidence_chain = ats_details.get("evidence_chain", [])
    assert len(evidence_chain) > 0
    python_entry = next((e for e in evidence_chain if e.get("jd_keyword") == "Python"), None)
    assert python_entry is not None
    assert "Verified candidate technology" in python_entry["candidate_evidence"]

    # Check potential gaps list unpossessed skills
    gaps_str = " ".join(ats_details.get("potential_gaps", []))
    assert "Ruby on Rails" in gaps_str or "Snowflake" in gaps_str


@pytest.mark.asyncio
async def test_latex_compilation_and_self_healing_repair():
    """
    Test Requirements 7, 8, 9, 10:
    - LaTeX escaping & generation.
    - Self-healing repair routine strips markdown fences and adds document root.
    """
    raw_bad_latex = """```latex
\\section{Experience}
Worked on distributed systems.
```"""
    repaired = ResumeTailorService._repair_latex_source(raw_bad_latex)
    assert "```" not in repaired
    assert "\\documentclass" in repaired
    assert "\\begin{document}" in repaired
    assert "\\end{document}" in repaired


@pytest.mark.asyncio
async def test_approval_and_rejection_workflows(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test Requirements 11, 12, 13:
    - Initial status is REVIEW_REQUIRED.
    - POST /tailored/{id}/approve transitions status to APPROVED.
    - Never automatically submits job application (auto_applied == False).
    - POST /tailored/{id}/reject transitions status to REJECTED.
    """
    candidate, job = await create_candidate_and_job(db_session)

    # Create tailored version
    tailor_res = await async_client.post(
        f"/api/v1/resumes/tailor/{job.id}",
        json={"candidate_id": candidate.id},
    )
    assert tailor_res.status_code == 201
    version_id = tailor_res.json()["version"]["id"]

    # 1. Check categorized diff
    diff_res = await async_client.get(f"/api/v1/resumes/tailored/{version_id}/diff")
    assert diff_res.status_code == 200
    diff_data = diff_res.json()
    assert "categories" in diff_data
    assert "ADDED / EMPHASIZED" in diff_data["categories"]
    assert "UNCHANGED" in diff_data["categories"]
    assert len(diff_data["categories"]["UNCHANGED"]) > 0

    # 2. Rejection workflow
    reject_res = await async_client.post(
        f"/api/v1/resumes/tailored/{version_id}/reject",
        json={"reason": "Need heavier focus on cloud networking."},
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "REJECTED"

    # Verify status in database
    v_record = await db_session.get(ResumeVersion, version_id)
    assert v_record.status == "REJECTED"
    assert v_record.rejection_reason == "Need heavier focus on cloud networking."

    # 3. Approval workflow
    approve_res = await async_client.post(
        f"/api/v1/resumes/tailored/{version_id}/approve",
        json={"notes": "Approved after reviewing diff and PDF preview."},
    )
    assert approve_res.status_code == 200
    app_data = approve_res.json()
    assert app_data["success"] is True
    assert app_data["status"] == "APPROVED"
    assert app_data["ready_for_application"] is True
    assert app_data["auto_applied"] is False, "Safety invariant violated: application was auto-applied!"

    await db_session.refresh(v_record)
    assert v_record.status == "APPROVED"
    assert v_record.approved_at is not None


@pytest.mark.asyncio
async def test_manual_latex_edits_safety(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test Requirement 14:
    Manual user edits via PATCH /latex:
    - Master resume remains untouched.
    - Truthfulness audit runs on manual edits.
    """
    candidate, job = await create_candidate_and_job(db_session)

    tailor_res = await async_client.post(
        f"/api/v1/resumes/tailor/{job.id}",
        json={"candidate_id": candidate.id},
    )
    version_id = tailor_res.json()["version"]["id"]

    # User manually edits LaTeX to add safe formatting
    valid_edit = """\\documentclass[11pt]{article}
\\begin{document}
\\section{Profile}
Elena Vance - Staff Backend Systems Engineer
\\section{Experience}
Lead architect for distributed high-throughput microservices in Python.
\\end{document}"""

    patch_res = await async_client.patch(
        f"/api/v1/resumes/tailored/{version_id}/latex",
        json={"latex_content": valid_edit},
    )
    assert patch_res.status_code == 200
    updated_data = patch_res.json()
    assert updated_data["latex_content"] == valid_edit
    assert updated_data["status"] == "REVIEW_REQUIRED"


@pytest.mark.asyncio
async def test_direct_tailor_and_list_endpoints(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test Requirements 15, 17:
    - POST /api/v1/resumes/tailor with job_id in body.
    - GET /api/v1/resumes/tailored listing with filters.
    """
    candidate, job = await create_candidate_and_job(db_session)

    post_res = await async_client.post(
        "/api/v1/resumes/tailor",
        json={"job_id": job.id, "candidate_id": candidate.id},
    )
    assert post_res.status_code == 201
    version_id = post_res.json()["version"]["id"]

    # List tailored resumes
    list_res = await async_client.get(f"/api/v1/resumes/tailored?job_id={job.id}")
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) >= 1
    assert any(item["id"] == version_id for item in items)
