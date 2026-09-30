import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.models.candidate import Candidate, Skill, Project, Education
from backend.app.models.job import Job, MatchResult
from backend.app.services.job_discovery.normalizer import (
    normalize_job_title,
    classify_fresher_and_experience,
    normalize_location,
    extract_truthful_salary,
    extract_truthful_deadline,
)
from backend.app.services.job_discovery.discovery_service import JobDiscoveryService
from backend.app.services.job_discovery.sources.linkedin_source import LinkedInJobSourceAdapter
from backend.app.services.job_discovery.sources.freshershunt_source import FreshersHuntJobSourceAdapter
from backend.app.services.job_discovery.sources.indeed_source import IndeedJobSourceAdapter
from backend.app.services.matching_service import MatchingService
from backend.app.schemas.job import JobDiscoveryRequest


def test_job_title_normalization():
    """
    Prompt Section 5 Requirement:
    Normalizes different source formats into one canonical CareerPilot title
    while preserving the original.
    """
    cases = [
        ("Graduate Software Engineer", "Software Engineer"),
        ("Software Engineer - Entry Level", "Software Engineer"),
        ("Junior Software Developer", "Software Engineer"),
        ("Associate Backend Engineer", "Backend Engineer"),
        ("Junior Data Analyst - Analytics", "Data Analyst"),
        ("Machine Learning Engineer (Remote)", "Machine Learning Engineer"),
    ]
    for raw, expected_norm in cases:
        orig, norm = normalize_job_title(raw)
        assert orig == raw
        assert norm == expected_norm


def test_fresher_and_experience_classification():
    """
    Prompt Section 7 & 19 Requirement:
    - Recognizes fresher signals (0-1 years, fresher, new grad, junior).
    - CRITICAL RULE: A job requiring 5 years experience MUST NOT be classified as fresher-eligible
      simply because the title says 'Software Engineer'.
    """
    # 1. True fresher job
    fresher_title = "Software Engineer"
    fresher_desc = "Open to freshers and 2025 graduates. 0-1 years experience in Python and SQL."
    is_fresher, reason, level = classify_fresher_and_experience(fresher_title, fresher_desc)
    assert is_fresher is True
    assert level == "Entry-Level"
    assert "fresher" in reason.lower() or "0" in reason

    # 2. Senior job disguised with 'Software Engineer' title
    senior_title = "Software Engineer"
    senior_desc = "We require at least 5+ years of experience in distributed systems and cloud architecture."
    is_fresher_sr, reason_sr, level_sr = classify_fresher_and_experience(senior_title, senior_desc)
    assert is_fresher_sr is False
    assert level_sr in ("Senior", "Mid-Level")
    assert "ineligible" in reason_sr.lower() or "requires 5+" in reason_sr.lower()

    # 3. Explicit Senior title
    explicit_sr = "Senior Backend Architect"
    explicit_desc = "Lead the team. 6 years experience required."
    is_fresher_exp, _, level_exp = classify_fresher_and_experience(explicit_sr, explicit_desc)
    assert is_fresher_exp is False
    assert level_exp == "Senior"


def test_truthful_missing_information_preservation():
    """
    Prompt Section 4 & 19 Requirement:
    Unknown information must remain null / unknown. NEVER invent missing information.
    - Missing salary must remain None.
    - Missing deadline must remain None.
    """
    desc_no_salary_no_deadline = (
        "Join our engineering team to build scalable APIs using Python and FastAPI. "
        "Standard healthcare and equity package provided."
    )
    sal = extract_truthful_salary(None, desc_no_salary_no_deadline)
    assert sal is None

    dl = extract_truthful_deadline(None, desc_no_salary_no_deadline)
    assert dl is None

    # Truthful salary extraction when present
    desc_with_sal = "Base compensation is $140,000 - $170,000 USD per year."
    sal_found = extract_truthful_salary(None, desc_with_sal)
    assert sal_found is not None
    assert "$140,000" in sal_found


@pytest.mark.asyncio
async def test_cross_source_deduplication(db_session: AsyncSession):
    """
    Prompt Section 6 & 19 Requirement:
    The same job appearing across multiple sources (LinkedIn, FreshersHunt, Indeed)
    MUST become ONE canonical job record with multiple source references.
    """
    # Run multi-source discovery querying LinkedIn, FreshersHunt, Indeed
    response = await JobDiscoveryService.discover_multi_source(
        session=db_session,
        sources=["linkedin", "indeed"],
        batch_limit=5,
    )

    # In our sample data, "Datadog" "Software Engineer - Distributed Tracing" is present in both LinkedIn and Indeed
    stmt = select(Job).where(Job.company == "Datadog")
    res = await db_session.execute(stmt)
    datadog_jobs = res.scalars().all()

    # Exactly ONE canonical record should exist
    assert len(datadog_jobs) == 1
    canonical = datadog_jobs[0]

    # Verify multiple source references attached
    assert len(canonical.source_references) >= 2
    sources_recorded = [r.get("source") for r in canonical.source_references]
    assert "LinkedIn Jobs" in sources_recorded
    assert "Indeed Jobs" in sources_recorded
    assert canonical.last_verified_at is not None


@pytest.mark.asyncio
async def test_match_categories_and_transparent_explanation(
    async_client: AsyncClient, db_session: AsyncSession
):
    """
    Prompt Section 9, 10 & 13 Requirement:
    - Categories: HIGH_MATCH, GOOD_MATCH, POSSIBLE_MATCH, LOW_MATCH, INELIGIBLE.
    - Transparent reasons why it matches and potential gaps.
    """
    # Create candidate
    candidate = Candidate(
        full_name="Aarav Sharma",
        email="aarav.sharma.test@example.com",
        summary="Entry level software engineer with strong Python, SQL, PostgreSQL, and FastAPI skills.",
    )
    db_session.add(candidate)
    await db_session.flush()

    # Add candidate skills & project
    db_session.add_all([
        Skill(candidate_id=candidate.id, name="Python", category="Language"),
        Skill(candidate_id=candidate.id, name="SQL", category="Database"),
        Skill(candidate_id=candidate.id, name="PostgreSQL", category="Database"),
        Skill(candidate_id=candidate.id, name="FastAPI", category="Framework"),
        Project(
            candidate_id=candidate.id,
            title="E-Commerce Analytics Engine",
            description="Built real-time telemetry analytics using Python, PostgreSQL, and FastAPI.",
            technologies=["Python", "PostgreSQL", "FastAPI"],
        ),
    ])
    await db_session.commit()

    # Create matching job
    job = Job(
        company="Razorpay",
        role="Associate Software Engineer - Fintech Platform",
        normalized_title="Software Engineer",
        raw_description="Looking for entry level engineer with Python, FastAPI, and PostgreSQL. Fresher eligible.",
        required_skills=["Python", "FastAPI", "PostgreSQL"],
        preferred_skills=["Docker", "Kafka"],
        is_fresher_eligible=True,
    )
    db_session.add(job)
    await db_session.commit()

    # Evaluate match
    match_res = await MatchingService.match_candidate_to_job(
        session=db_session,
        job_id=job.id,
        candidate_id=candidate.id,
    )

    assert match_res.overall_match_score >= 65.0
    assert match_res.match_category in ("HIGH_MATCH", "GOOD_MATCH")
    assert match_res.eligibility_status == "ELIGIBLE"
    assert match_res.fresher_eligible is True
    assert len(match_res.why_it_matches) > 0
    assert any("Python" in r for r in match_res.why_it_matches)


@pytest.mark.asyncio
async def test_source_failure_resilience(db_session: AsyncSession):
    """
    Prompt Section 17 Requirement:
    A single source failure must NOT stop the complete discovery run.
    Record source, error, timestamp, and status.
    """
    # Query with a non-existent or faulty source name along with valid ones
    response = await JobDiscoveryService.discover_multi_source(
        session=db_session,
        sources=["linkedin", "non_existent_source_xyz"],
        batch_limit=3,
    )

    assert response.total_discovered > 0
    assert "non_existent_source_xyz" in response.diagnostics
    assert response.diagnostics["non_existent_source_xyz"]["status"] == "skipped"
    assert "linkedin" in response.diagnostics
    assert response.diagnostics["linkedin"]["status"] == "success"


@pytest.mark.asyncio
async def test_discover_jobs_api_endpoint(async_client: AsyncClient):
    """
    Tests POST /api/v1/jobs/discover:
    - Triggers multi-source discovery.
    - Returns structured outcome with alerts and diagnostics.
    """
    res = await async_client.post(
        "/api/v1/jobs/discover",
        json={"sources": ["freshershunt", "linkedin"], "min_match_score": 50.0},
    )
    assert res.status_code == 200
    data = res.json()

    assert "total_discovered" in data
    assert "imported_count" in data
    assert "duplicate_merged_count" in data
    assert "alerts" in data
    assert "jobs" in data
    assert data["total_discovered"] > 0


@pytest.mark.asyncio
async def test_sources_status_api_endpoint(async_client: AsyncClient):
    """
    Tests GET /api/v1/jobs/sources/status:
    - Returns operational diagnostics across all source adapters.
    """
    res = await async_client.get("/api/v1/jobs/sources/status")
    assert res.status_code == 200
    data = res.json()

    assert data["total_adapters"] >= 4
    assert "linkedin" in data["adapters"]
    assert "freshershunt" in data["adapters"]
    assert "company_careers" in data["adapters"]
    assert "indeed" in data["adapters"]
    assert data["adapters"]["freshershunt"]["enabled"] is True
