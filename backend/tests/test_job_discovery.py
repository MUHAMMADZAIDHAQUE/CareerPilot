import pytest
import os
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.models.candidate import Candidate, Skill
from backend.app.models.job import Job, JobRequirement
from backend.app.schemas.job import JobImportItem
from backend.app.services.job_discovery.url_normalizer import (
    normalize_job_url,
    generate_job_dedup_hash,
    is_job_expired,
)
from backend.app.services.job_discovery.base import JobSource
from backend.app.services.job_discovery.sources import (
    UrlJobSource,
    PublicFeedJobSource,
    CompanyCareerSource,
    UserConfiguredSource,
)


def test_url_normalization():
    """Test cleaning and canonicalization of job URLs."""
    raw_url = "https://Acme.com/jobs/senior-dev/?utm_source=linkedin&ref=job_board&utm_medium=cpc#apply"
    canonical = normalize_job_url(raw_url)
    assert canonical == "https://acme.com/jobs/senior-dev"
    assert "utm_source" not in canonical
    assert "ref=" not in canonical
    assert "#apply" not in canonical

    # Trailing slash handling
    slash_url = "https://jobs.lever.co/stripe/software-engineer/"
    assert normalize_job_url(slash_url) == "https://jobs.lever.co/stripe/software-engineer"


def test_job_dedup_hash():
    """Test deterministic deduplication hashing across casing and punctuation."""
    hash1 = generate_job_dedup_hash("Stripe, Inc.", "Senior Software Engineer", "San Francisco, CA")
    hash2 = generate_job_dedup_hash("stripe", "senior software engineer", "san francisco ca")
    assert hash1 == hash2


def test_expired_job_detection():
    """Test detection of expired postings via past dates and closure text."""
    # Past deadline
    assert is_job_expired(deadline_str="2020-01-01") is True
    # Future deadline
    assert is_job_expired(deadline_str="2099-12-31") is False

    # Closed phrase
    closed_text = "Thank you for your interest. This position has been filled."
    assert is_job_expired(text_content=closed_text) is True

    # Active text
    active_text = "We are actively hiring for our distributed systems team."
    assert is_job_expired(text_content=active_text) is False


def test_job_source_interface_contract():
    """Verify that all job source implementations satisfy the JobSource abstract contract."""
    sources = [
        UrlJobSource(),
        PublicFeedJobSource(),
        CompanyCareerSource(),
        UserConfiguredSource(),
    ]
    for s in sources:
        assert isinstance(s, JobSource)
        assert hasattr(s, "fetch_jobs")
        assert hasattr(s, "normalize_job")
        assert hasattr(s, "deduplicate_job")
        assert s.source_type
        assert s.source_name


@pytest.mark.asyncio
async def test_bulk_import_jobs(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test POST /api/jobs/import:
    - Imports batch items into common Job schema.
    - Re-importing identical items detects duplicates and skips them.
    - Expiration is tracked accurately.
    """
    payload = {
        "source_type": "user_configured",
        "source_name": "Test Partner Feed",
        "jobs": [
            {
                "company": "CloudTech Systems",
                "role": "Lead Infrastructure Architect",
                "description": "Designing high-scale distributed Kubernetes clusters on AWS with Python and Terraform.",
                "location": "San Francisco, CA",
                "salary": "$200k - $250k",
                "deadline": "2099-01-01",
                "required_skills": ["Python", "Kubernetes", "AWS", "Terraform"],
                "preferred_skills": ["Docker", "Kafka"],
            },
            {
                "company": "Legacy Software Corp",
                "role": "Cobol Maintainer",
                "description": "Applications are closed for this role.",
                "location": "Remote",
                "deadline": "2021-01-01",
                "required_skills": ["Cobol"],
            },
        ],
    }

    # 1. First Import
    res1 = await async_client.post("/api/jobs/import", json=payload)
    assert res1.status_code == 201
    data1 = res1.json()
    assert data1["imported_count"] == 2
    assert data1["duplicate_count"] == 0
    assert data1["expired_count"] == 1  # Legacy Software Corp has expired deadline & closure text

    # Verify saved into common schema in database
    stmt = select(Job).where(Job.company == "CloudTech Systems")
    job = (await db_session.execute(stmt)).scalars().first()
    assert job is not None
    assert job.role == "Lead Infrastructure Architect"
    assert job.source_type == "user_configured"
    assert job.source_name == "Test Partner Feed"
    assert "Python" in job.required_skills

    # 2. Re-import identical payload to test deduplication
    res2 = await async_client.post("/api/jobs/import", json=payload)
    assert res2.status_code == 201
    data2 = res2.json()
    assert data2["imported_count"] == 0
    assert data2["duplicate_count"] == 2
    for r in data2["results"]:
        assert r["is_duplicate"] is True


@pytest.mark.asyncio
async def test_job_search_and_filters(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test GET /api/jobs with multi-field search and filtering:
    - role
    - company
    - location
    - skills
    - source
    """
    # Seed distinct jobs
    j1 = Job(
        company="Alpha Robotics",
        role="Perception Systems Engineer",
        location="Boston, MA",
        raw_description="ROS2, C++, Python, Computer Vision",
        source_type="career_page",
        source_name="Company Careers",
        required_skills=["C++", "ROS2", "Python"],
    )
    j2 = Job(
        company="Beta Cloud",
        role="Frontend Platform Lead",
        location="New York, NY",
        raw_description="Next.js, React, TypeScript, Tailwind",
        source_type="public_feed",
        source_name="RemoteOK",
        required_skills=["TypeScript", "React", "Next.js"],
    )
    db_session.add_all([j1, j2])
    await db_session.commit()

    # Filter by role
    res = await async_client.get("/api/jobs?role=Perception")
    assert res.status_code == 200
    jobs = res.json()
    assert len(jobs) == 1
    assert jobs[0]["company"] == "Alpha Robotics"

    # Filter by company
    res = await async_client.get("/api/jobs?company=Beta")
    assert res.status_code == 200
    jobs = res.json()
    assert len(jobs) == 1
    assert jobs[0]["company"] == "Beta Cloud"

    # Filter by skills
    res = await async_client.get("/api/jobs?skills=ROS2")
    assert res.status_code == 200
    jobs = res.json()
    assert len(jobs) == 1
    assert jobs[0]["company"] == "Alpha Robotics"

    # Filter by source
    res = await async_client.get("/api/jobs?source=RemoteOK")
    assert res.status_code == 200
    jobs = res.json()
    assert len(jobs) == 1
    assert jobs[0]["company"] == "Beta Cloud"


@pytest.mark.asyncio
async def test_recommended_jobs(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test GET /api/jobs/recommended:
    - Scores candidate against active jobs.
    - Returns match scores, matched skills, missing skills, and justification.
    """
    # Create candidate with verified skills
    candidate = Candidate(
        full_name="Alex Mercer",
        email="alex.mercer.discovery@example.com",
    )
    db_session.add(candidate)
    await db_session.flush()

    skills = [
        Skill(candidate_id=candidate.id, name="Python", category="Languages"),
        Skill(candidate_id=candidate.id, name="FastAPI", category="Frameworks & Libraries"),
        Skill(candidate_id=candidate.id, name="PostgreSQL", category="Databases & Storage"),
        Skill(candidate_id=candidate.id, name="Docker", category="Cloud & DevOps"),
    ]
    db_session.add_all(skills)

    # Job A: High match for Alex
    job_a = Job(
        company="VectorFlow AI",
        role="Senior Backend Engineer",
        location="Remote",
        raw_description="High scale FastAPI APIs and PostgreSQL data pipelines with Python and Docker.",
        required_skills=["Python", "FastAPI", "PostgreSQL"],
        preferred_skills=["Docker"],
        is_active=True,
    )
    # Job B: Low match for Alex
    job_b = Job(
        company="BioTech Embedded",
        role="Firmware Engineer",
        location="Austin, TX",
        raw_description="Bare metal C and ARM assembly firmware development.",
        required_skills=["C", "ARM Assembly", "RTOS"],
        is_active=True,
    )
    db_session.add_all([job_a, job_b])
    await db_session.commit()

    # Call GET /api/jobs/recommended
    res = await async_client.get(f"/api/jobs/recommended?candidate_id={candidate.id}")
    assert res.status_code == 200
    data = res.json()

    assert data["candidate_id"] == candidate.id
    assert len(data["recommendations"]) >= 2

    # Top recommendation should be VectorFlow AI
    top_rec = data["recommendations"][0]
    assert top_rec["job"]["company"] == "VectorFlow AI"
    assert top_rec["overall_match_score"] > 60.0
    assert "Python" in top_rec["matched_skills"]
    assert len(top_rec["recommendation_reason"]) > 0
