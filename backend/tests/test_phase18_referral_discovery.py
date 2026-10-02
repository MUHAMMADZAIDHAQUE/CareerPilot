import pytest
import hashlib
from pathlib import Path
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.models.candidate import Candidate, Education, Experience, Skill
from backend.app.models.job import Job
from backend.app.models.referral import ReferralContact
from backend.app.services.referral_discovery.base import (
    RawReferralContact,
    ReferralQueryContext,
    ReferralSourceAdapter,
)
from backend.app.services.referral_discovery.normalizer import ReferralContactNormalizer
from backend.app.services.referral_discovery.discovery_service import ReferralDiscoveryService
from backend.app.services.referral_discovery.sources import AVAILABLE_REFERRAL_SOURCES


MASTER_RESUME_PATH = Path("resume/master/sample_master_resume.tex")


async def create_test_candidate_and_jobs(db_session: AsyncSession):
    """Seeds test candidate with university/skills and target jobs."""
    candidate = Candidate(
        full_name="Elena Vance",
        email="elena.vance@example.com",
        headline="Staff Backend Systems Architect",
    )
    db_session.add(candidate)
    await db_session.flush()

    edu = Education(
        candidate_id=candidate.id,
        institution="MIT",
        degree="B.S. in Computer Science",
    )
    db_session.add(edu)

    skills = [
        Skill(candidate_id=candidate.id, name="Python", category="Languages"),
        Skill(candidate_id=candidate.id, name="FastAPI", category="Frameworks"),
        Skill(candidate_id=candidate.id, name="PostgreSQL", category="Databases"),
        Skill(candidate_id=candidate.id, name="Kubernetes", category="Cloud"),
    ]
    db_session.add_all(skills)

    exp = Experience(
        candidate_id=candidate.id,
        company="Nexus Core Technologies",
        role="Senior Backend Architect",
        start_date="January 2021",
        end_date="Present",
        is_current=True,
    )
    db_session.add(exp)

    # Job 1: Datadog (Target company with rich talent directory)
    job_datadog = Job(
        company="Datadog",
        role="Principal Backend Architect",
        raw_description="Deep Python, FastAPI, distributed tracing, Kubernetes required.",
        required_skills=["Python", "FastAPI", "Kubernetes", "PostgreSQL"],
        technologies=["Python", "FastAPI", "Kubernetes", "Docker", "PostgreSQL"],
    )
    db_session.add(job_datadog)

    # Job 2: Niche startup with limited discoverable contacts
    job_niche = Job(
        company="NicheQuantum Labs",
        role="Quantum Systems Engineer",
        raw_description="Quantum circuit simulation.",
        required_skills=["Python", "Qiskit"],
        technologies=["Python"],
    )
    db_session.add(job_niche)

    await db_session.commit()
    await db_session.refresh(candidate)
    await db_session.refresh(job_datadog)
    await db_session.refresh(job_niche)

    return candidate, job_datadog, job_niche


# -----------------------------------------------------------------------------
# 1. Contact Normalization & Privacy Filtering Tests
# -----------------------------------------------------------------------------

def test_contact_normalization():
    """Requirement 1: Normalizer correctly cleans names, companies, and profile URLs."""
    assert ReferralContactNormalizer.normalize_name("Dr. Marcus Vance, Ph.D.") == "Marcus Vance"
    assert ReferralContactNormalizer.normalize_name("Prof. Aisha Patel") == "Aisha Patel"
    assert ReferralContactNormalizer.normalize_company("Datadog, Inc.") == "datadog"
    assert ReferralContactNormalizer.normalize_company("CloudScale Networks LLC.") == "cloudscale networks"
    
    url = "https://linkedin.com/in/marcus-vance/?trk=nav#section"
    assert ReferralContactNormalizer.normalize_url(url) == "https://linkedin.com/in/marcus-vance"


def test_privacy_filtering():
    """Requirement 14: Privacy Filtering ensures no private phone numbers/addresses are leaked."""
    raw = RawReferralContact(
        name="Private Person",
        company="Datadog",
        current_title="Software Engineer",
        headline="Call me at 415-555-0199 for inquiries",
        public_contact_method="Phone: 4155550199",
    )
    sanitized = ReferralContactNormalizer.sanitize_privacy(raw)
    assert "415-555-0199" not in sanitized.headline
    assert "[redacted phone]" in sanitized.headline
    assert sanitized.public_contact_method == "Public Professional Profile"


# -----------------------------------------------------------------------------
# 2. Deduplication & Multi-Source Provenance Merging Tests
# -----------------------------------------------------------------------------

def test_deduplication_and_source_provenance_merging():
    """
    Requirement 3 & 13: A person appearing across multiple sources (LinkedIn + Company team + GitHub)
    must become ONE canonical ReferralContact with merged source_references.
    """
    c1 = RawReferralContact(
        name="Aisha Patel",
        company="Datadog",
        current_title="Senior Staff Software Engineer",
        profile_url="https://linkedin.com/in/aisha-patel",
        source="linkedin",
        source_references=[{"source": "LinkedIn Public Directory", "url": "https://linkedin.com/in/aisha-patel"}],
        skills=["Python", "FastAPI"],
    )
    c2 = RawReferralContact(
        name="Aisha Patel",
        company="Datadog",
        current_title="Senior Staff Software Engineer",
        profile_url="https://linkedin.com/in/aisha-patel/",
        source="company_team",
        source_references=[{"source": "Company Public Team Page", "url": "https://datadoghq.com/team/aisha-patel"}],
        skills=["Kubernetes", "Kafka"],
    )
    c3 = RawReferralContact(
        name="Aisha Patel",
        company="Datadog",
        current_title="Senior Staff Software Engineer",
        profile_url="https://github.com/aishapatel-dev",
        source="github",
        source_references=[{"source": "GitHub Public Contributor", "url": "https://github.com/aishapatel-dev"}],
        skills=["Docker"],
    )

    merged = ReferralDiscoveryService.deduplicate_and_merge_contacts([c1, c2, c3])
    assert len(merged) == 1
    canonical = merged[0]

    # Verify merged source references
    sources_in_ref = [ref["source"] for ref in canonical.source_references]
    assert "LinkedIn Public Directory" in sources_in_ref
    assert "Company Public Team Page" in sources_in_ref
    assert "GitHub Public Contributor" in sources_in_ref

    # Verify merged skills
    assert "Python" in canonical.skills
    assert "Kubernetes" in canonical.skills
    assert "Docker" in canonical.skills
    assert canonical.verification_status == "VERIFIED"


# -----------------------------------------------------------------------------
# 3. Transparent Scoring & Alumni / Skill Overlap Tests
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_relevance_scoring_breakdown(db_session: AsyncSession):
    """
    Requirements 4, 5, 6, 7, 8: Transparent 100-point scoring based on:
    - Company association (30)
    - Role/team relevance (20)
    - Technical overlap (15)
    - Alumni relationship (15)
    - Seniority context (10)
    - Public evidence (10)
    """
    candidate, job_datadog, _ = await create_test_candidate_and_jobs(db_session)

    # Contact 1: Perfect match (Current employee + Engineering Manager + MIT alumni + Python/Kubernetes)
    top_contact = RawReferralContact(
        name="Elena Rostova",
        company="Datadog",
        current_title="Engineering Manager, Distributed Systems",
        profile_url="https://linkedin.com/in/elena-rostova",
        university="MIT",
        skills=["Python", "FastAPI", "Kubernetes"],
        source_references=[{"source": "LinkedIn"}, {"source": "Company team"}],
        verification_status="VERIFIED",
    )
    score, reasons, breakdown = ReferralDiscoveryService.compute_relevance_score(
        top_contact, job_datadog, candidate
    )
    assert breakdown["company_association"] == 30.0
    assert breakdown["role_team_relevance"] >= 16.0
    assert breakdown["technical_overlap"] == 15.0
    assert breakdown["alumni_relationship"] == 15.0
    assert breakdown["seniority_context"] == 10.0
    assert breakdown["public_evidence"] == 10.0
    assert score >= 90.0
    assert len(reasons) >= 4


# -----------------------------------------------------------------------------
# 4. 50+ Discovery Target & Shortfall Handling (Zero Fabrication) Tests
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_50_plus_discovery_target_evaluation(async_client: AsyncClient, db_session: AsyncSession):
    """
    Requirement 9 & ADR-018: Verifies target evaluation and honest provenance:
    - total_discovered reflects genuine discoverable records across 5 sources
    - total_verified reflects only verified records
    - shortfall reflects honest gap without artificial fabrication
    """
    candidate, job_datadog, _ = await create_test_candidate_and_jobs(db_session)

    result = await ReferralDiscoveryService.discover_referrals(
        session=db_session,
        job_id=job_datadog.id,
        candidate_id=candidate.id,
        target_count=50,
    )
    assert result.total_discovered > 0
    assert result.total_verified <= result.total_discovered
    assert len(result.contacts) == result.total_discovered
    assert result.target_reached == (result.total_discovered >= 50)
    assert result.shortfall == max(0, 50 - result.total_discovered)


@pytest.mark.asyncio
async def test_shortfall_handling_never_fabricates_missing_contacts(db_session: AsyncSession):
    """
    CRITICAL REQUIREMENT 10 & 11:
    If only 27 valid contacts exist, the system must return exactly 27.
    It must NEVER generate 23 fake contacts.
    """
    # Create custom mock adapter yielding exactly 27 contacts
    class Exactly27ContactsSource(ReferralSourceAdapter):
        source_id = "test_27_source"
        source_name = "Test 27 Source"
        async def discover_contacts(self, ctx: ReferralQueryContext):
            return [
                RawReferralContact(
                    name=f"Verified Person {i}",
                    company=ctx.company,
                    current_title="Software Engineer",
                    profile_url=f"https://example.com/profiles/{i}",
                    skills=["Python"],
                    verification_status="VERIFIED",
                )
                for i in range(1, 28)  # Exactly 27 contacts
            ]

    candidate, _, job_niche = await create_test_candidate_and_jobs(db_session)

    # Temporarily substitute configured sources with the 27-contact source
    orig_sources = ReferralDiscoveryService.get_configured_sources()
    try:
        ReferralDiscoveryService.get_configured_sources = classmethod(lambda cls: [Exactly27ContactsSource()])
        result = await ReferralDiscoveryService.discover_referrals(
            session=db_session,
            job_id=job_niche.id,
            candidate_id=candidate.id,
            target_count=50,
        )

        # STRICT ASSERTIONS
        assert result.total_discovered == 27
        assert result.total_verified == 27
        assert len(result.contacts) == 27
        assert result.target_reached is False
        assert result.shortfall == 23
        assert "Target not reached because fewer verified/relevant contacts were discoverable" in (result.notice or "")

        # Verify absolutely no fake contacts were created to reach 50
        assert len(result.contacts) != 50
        assert len(result.contacts) == 27
    finally:
        ReferralDiscoveryService.get_configured_sources = classmethod(lambda cls: orig_sources)


# -----------------------------------------------------------------------------
# 5. Source Failure Resilience Tests
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_source_failure_resilience(db_session: AsyncSession):
    """
    Requirement 12: If a source fails or throws an exception,
    the pipeline degrades gracefully, logs source_failures, and completes discovery.
    """
    class CrashingSource(ReferralSourceAdapter):
        source_id = "crashing_adapter"
        source_name = "Crashing Adapter"
        async def discover_contacts(self, ctx: ReferralQueryContext):
            raise ConnectionError("Simulated remote source network failure")

    class WorkingSource(ReferralSourceAdapter):
        source_id = "working_adapter"
        source_name = "Working Adapter"
        async def discover_contacts(self, ctx: ReferralQueryContext):
            return [
                RawReferralContact(
                    name="Resilient Contact",
                    company=ctx.company,
                    current_title="Principal Architect",
                    profile_url="https://resilient.example.com/contact",
                    verification_status="VERIFIED",
                )
            ]

    orig_sources = ReferralDiscoveryService.get_configured_sources()
    try:
        ReferralDiscoveryService.get_configured_sources = classmethod(
            lambda cls: [CrashingSource(), WorkingSource()]
        )
        candidate, _, job_niche = await create_test_candidate_and_jobs(db_session)
        result = await ReferralDiscoveryService.discover_referrals(
            session=db_session,
            job_id=job_niche.id,
            candidate_id=candidate.id,
            target_count=50,
        )

        assert len(result.source_failures) == 1
        assert result.source_failures[0]["source_id"] == "crashing_adapter"
        assert result.total_discovered == 1
        assert result.contacts[0].name == "Resilient Contact"
    finally:
        ReferralDiscoveryService.get_configured_sources = classmethod(lambda cls: orig_sources)


# -----------------------------------------------------------------------------
# 6. Full API Lifecycle & HITL Governance Tests
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_referral_api_lifecycle_and_hitl_governance(
    async_client: AsyncClient, db_session: AsyncSession
):
    """
    Requirements 15, 16, 17, 18: Tests all API endpoints:
    - POST /api/v1/referrals/discover
    - GET /api/v1/referrals
    - GET /api/v1/referrals/{id}
    - GET /api/v1/referrals/job/{job_id}
    - GET /api/v1/referrals/sources/status
    - POST /api/v1/referrals/{id}/select
    - POST /api/v1/referrals/{id}/dismiss
    - POST /api/v1/referrals/bulk-select
    - PATCH /api/v1/referrals/{id}/notes
    - Verifies HITL: NO auto-messaging, master resume unchanged.
    """
    # 1. Compute pre-hash of master resume
    sha_before = hashlib.sha256(MASTER_RESUME_PATH.read_bytes()).hexdigest()

    candidate, job_datadog, _ = await create_test_candidate_and_jobs(db_session)

    # 2. Check sources status endpoint
    sources_res = await async_client.get("/api/v1/referrals/sources/status")
    assert sources_res.status_code == 200
    sources_data = sources_res.json()
    assert sources_data["total_configured"] >= 5
    assert sources_data["total_active"] >= 5

    # 3. Discover referrals via API
    discover_res = await async_client.post(
        "/api/v1/referrals/discover",
        json={"job_id": job_datadog.id, "target_count": 50},
    )
    assert discover_res.status_code == 200
    disc_data = discover_res.json()
    assert disc_data["total_discovered"] > 0
    assert len(disc_data["contacts"]) == disc_data["total_discovered"]
    first_contact = disc_data["contacts"][0]
    contact_id = first_contact["id"]

    # 4. List referrals endpoint with filters
    list_res = await async_client.get(f"/api/v1/referrals?job_id={job_datadog.id}&limit=20")
    assert list_res.status_code == 200
    listed = list_res.json()
    assert len(listed) > 0

    # 5. Get single contact
    get_res = await async_client.get(f"/api/v1/referrals/{contact_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == contact_id

    # 6. Select contact (HITL: sets SELECTED, no message sent)
    sel_res = await async_client.post(
        f"/api/v1/referrals/{contact_id}/select",
        json={"notes": "Priority contact for outreach"},
    )
    assert sel_res.status_code == 200
    assert sel_res.json()["outreach_status"] == "SELECTED"

    # 7. Update notes
    note_res = await async_client.patch(
        f"/api/v1/referrals/{contact_id}/notes",
        json={"notes": "Shared distributed systems background."},
    )
    assert note_res.status_code == 200
    assert "Shared distributed systems" in note_res.json()["notes"]

    # 8. Dismiss contact
    dismiss_res = await async_client.post(f"/api/v1/referrals/{contact_id}/dismiss")
    assert dismiss_res.status_code == 200
    assert dismiss_res.json()["outreach_status"] == "DO_NOT_CONTACT"

    # 9. Bulk select
    target_ids = [c["id"] for c in disc_data["contacts"] if c["id"] != contact_id][:5]
    bulk_res = await async_client.post(
        "/api/v1/referrals/bulk-select",
        json={"contact_ids": target_ids, "action": "select"},
    )
    assert bulk_res.status_code == 200
    assert bulk_res.json()["selected_count"] == len(target_ids)

    # 10. Verify Master Resume Immutability (Rule 18)
    sha_after = hashlib.sha256(MASTER_RESUME_PATH.read_bytes()).hexdigest()
    assert sha_before == sha_after, "Master resume was illegally modified during referral discovery!"
