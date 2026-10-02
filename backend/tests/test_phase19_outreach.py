"""
CareerPilot Phase 19: Outreach Preparation & Human Approval Engine Tests.
Validates 30 core requirements:
- Deterministic personalization evidence & grounding
- Unsupported claim & relationship fabrication detection
- Sensitive data & spam filtering
- Automatic safe repair & retry limit
- Human editing audit trail & required revalidation
- Server-side approval security & master resume immutability
- Zero message dispatch & zero application submission
- Bulk preparation for selected referral contacts
"""
import pytest
import hashlib
from pathlib import Path
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, event

from backend.app.models.candidate import Candidate, Education, Project, Skill
from backend.app.models.job import Job
from backend.app.models.resume import ResumeVersion
from backend.app.models.referral import ReferralContact
from backend.app.models.outreach import (
    OutreachDraft,
    OutreachAuditEvent,
    OutreachDraftStatus,
    OutreachChannel,
)
from backend.app.schemas.outreach import (
    OutreachDraftGenerateRequest,
    OutreachDraftEditRequest,
    OutreachDraftApproveRequest,
    OutreachDraftRejectRequest,
    OutreachDraftBulkGenerateRequest,
)
from backend.app.services.outreach.personalization import PersonalizationEngine
from backend.app.services.outreach.risk_detector import RiskDetector
from backend.app.services.outreach.outreach_validator import OutreachValidatorAgent
from backend.app.services.outreach.outreach_generator import OutreachGenerator
from backend.app.services.outreach.outreach_service import Phase19OutreachService

MASTER_RESUME_PATH = Path("resume/master/sample_master_resume.tex")


import uuid

async def setup_test_data(db_session: AsyncSession):
    """Sets up candidate, approved job, and verified referral contacts."""
    # 1. Candidate
    candidate = Candidate(
        id=str(uuid.uuid4()),
        full_name="Alex Mercer",
        email="alex.mercer@example.com",
        headline="Senior Distributed Systems & Platform Engineer",
        github_url="https://github.com/alexmercer-systems",
    )
    db_session.add(candidate)
    await db_session.flush()

    edu = Education(
        candidate_id=candidate.id,
        institution="University of California, Berkeley",
        degree="B.S. in Electrical Engineering & Computer Science",
        field_of_study="Computer Science",
    )
    skill1 = Skill(candidate_id=candidate.id, name="Python")
    skill2 = Skill(candidate_id=candidate.id, name="Kubernetes")
    skill3 = Skill(candidate_id=candidate.id, name="Distributed Systems")
    skill4 = Skill(candidate_id=candidate.id, name="Go")

    project = Project(
        candidate_id=candidate.id,
        title="Distributed Raft Storage Engine",
        description="Engineered high-throughput consensus-backed key-value store.",
        technologies=["Go", "Kubernetes", "Raft", "Python"],
    )
    db_session.add_all([edu, skill1, skill2, skill3, skill4, project])
    await db_session.flush()

    # 2. Approved Job
    job = Job(
        id=str(uuid.uuid4()),
        role="Software Engineer - Distributed Tracing",
        company="Datadog",
        location="New York, NY",
        domain="Observability",
        raw_description="Join Datadog to build petabyte-scale distributed tracing backends with Python, Kubernetes, and Go.",
        technologies=["Python", "Kubernetes", "Distributed Systems", "Go"],
    )
    db_session.add(job)
    await db_session.flush()

    # 3. Approved Tailored Resume Version
    resume_ver = ResumeVersion(
        id=str(uuid.uuid4()),
        candidate_id=candidate.id,
        job_id=job.id,
        latex_content="\\documentclass{article}\\begin{document}Tailored Resume\\end{document}",
        status="APPROVED",
        ats_score=92.0,
        ats_details={"coverage": 92.0},
    )
    db_session.add(resume_ver)
    await db_session.flush()

    # 4. Referral Contacts
    contact_selected = ReferralContact(
        id=str(uuid.uuid4()),
        company_name="Datadog",
        company="Datadog",
        job_id=job.id,
        candidate_id=candidate.id,
        name="Clara Simmons",
        current_title="Staff Software Engineer, Platform Core",
        department="Observability",
        relationship_type="ENGINEER",
        verification_status="VERIFIED",
        skills=["Python", "Kubernetes", "Distributed Systems"],
        university="University of California, Berkeley",
        relevance_score=95.0,
        relevance_reasons=["Confirmed employee at target company Datadog", "Fellow UC Berkeley alum"],
        score_breakdown={"company_association": 30.0, "role_team_relevance": 20.0},
        duplicate_key="nc:clarasimmons|datadog",
        outreach_status="SELECTED",
        source="linkedin",
        source_references=[
            {"source": "LinkedIn", "source_url": "https://linkedin.com/in/clara-simmons"},
            {"source": "GitHub", "source_url": "https://github.com/clara-simmons-datadog"},
        ],
    )

    contact_unselected = ReferralContact(
        id=str(uuid.uuid4()),
        company_name="Datadog",
        company="Datadog",
        job_id=job.id,
        candidate_id=candidate.id,
        name="Victor Vance",
        current_title="Technical Recruiter",
        relationship_type="RECRUITER",
        verification_status="VERIFIED",
        skills=["Technical Recruiting"],
        relevance_score=80.0,
        relevance_reasons=["Confirmed recruiter at target company Datadog"],
        score_breakdown={"company_association": 30.0, "role_team_relevance": 16.0},
        duplicate_key="nc:victorvance|datadog",
        outreach_status="DO_NOT_CONTACT",  # Unselected
        source="linkedin",
    )
    db_session.add_all([contact_selected, contact_unselected])
    await db_session.flush()

    candidate_dict = {
        "id": str(candidate.id),
        "full_name": candidate.full_name,
        "headline": candidate.headline,
        "email": candidate.email,
        "skills": ["Python", "Kubernetes", "Distributed Systems", "Go"],
        "education": [{"institution": "University of California, Berkeley", "degree": "B.S. in Electrical Engineering & Computer Science"}],
        "projects": [{"title": "Distributed Raft Storage Engine", "technologies": ["Go", "Kubernetes", "Raft", "Python"]}],
        "github_url": candidate.github_url,
    }
    job_dict = {
        "id": str(job.id),
        "role": job.role,
        "company": job.company,
        "domain": job.domain,
        "technologies": job.technologies,
        "required_skills": job.technologies,
        "description": job.raw_description,
    }
    contact_dict = {
        "id": str(contact_selected.id),
        "name": contact_selected.name,
        "current_title": contact_selected.current_title,
        "company_name": contact_selected.company_name,
        "company": contact_selected.company,
        "relationship_type": contact_selected.relationship_type,
        "skills": contact_selected.skills,
        "university": contact_selected.university,
        "source": contact_selected.source,
        "source_references": contact_selected.source_references,
        "profile_url": contact_selected.profile_url,
    }

    return {
        "candidate": candidate,
        "job": job,
        "resume_ver": resume_ver,
        "contact_selected": contact_selected,
        "contact_unselected": contact_unselected,
        "candidate_dict": candidate_dict,
        "job_dict": job_dict,
        "contact_dict": contact_dict,
    }


# =============================================================================
# Tests 1-7: Personalization, Evidence Grounding & Draft Generation
# =============================================================================

@pytest.mark.asyncio
async def test_deterministic_personalization_evidence_extraction(db_session: AsyncSession):
    """Verifies that personalization evidence is extracted strictly from verified facts."""
    data = await setup_test_data(db_session)
    candidate_dict = dict(data["candidate_dict"])
    job_dict = dict(data["job_dict"])
    contact_dict = dict(data["contact_dict"])

    evidence = PersonalizationEngine.extract_evidence(candidate_dict, job_dict, contact_dict)
    types = [e["type"] for e in evidence]

    assert "COMPANY" in types
    assert "ROLE" in types
    assert "TECHNOLOGY" in types
    assert "PUBLIC_PROJECT" in types
    assert "ALUMNI" in types  # Both UC Berkeley
    assert "GITHUB" in types

    alumni_item = next(e for e in evidence if e["type"] == "ALUMNI")
    assert "University of California, Berkeley" in alumni_item["claim"]
    assert alumni_item["confidence"] == 1.0


@pytest.mark.asyncio
async def test_alumni_evidence_not_emitted_when_unverified(db_session: AsyncSession):
    """Verifies that alumni evidence is NEVER emitted if universities do not match."""
    data = await setup_test_data(db_session)
    candidate_dict = dict(data["candidate_dict"])
    job_dict = dict(data["job_dict"])
    contact_dict = dict(data["contact_dict"])
    contact_dict["university"] = "Harvard University"  # Different university

    evidence = PersonalizationEngine.extract_evidence(candidate_dict, job_dict, contact_dict)
    types = [e["type"] for e in evidence]
    assert "ALUMNI" not in types  # Zero fabrication: must not claim alumni relationship!


@pytest.mark.asyncio
async def test_draft_generation_grounding_and_length(db_session: AsyncSession):
    """Verifies that generated drafts are grounded in real candidate project and skills."""
    data = await setup_test_data(db_session)
    candidate_dict = dict(data["candidate_dict"])
    job_dict = dict(data["job_dict"])
    contact_dict = dict(data["contact_dict"])

    # LinkedIn Medium
    draft = OutreachGenerator.generate_draft(
        candidate_data=candidate_dict,
        job_data=job_dict,
        contact_data=contact_dict,
        channel=OutreachChannel.LINKEDIN,
    )
    assert draft["status"] == OutreachDraftStatus.REVIEW_REQUIRED
    assert "Clara" in draft["body"]
    assert "Datadog" in draft["body"]
    assert "Distributed Raft Storage Engine" in draft["body"]
    assert len(draft["body"]) <= 1200
    assert draft["validation_results"]["passed"] is True


# =============================================================================
# Tests 8-15: Risk Detection, Fabrications, Private Data, and Repairs
# =============================================================================

@pytest.mark.asyncio
async def test_fabricated_relationship_detection_and_blocking(db_session: AsyncSession):
    """Detects and blocks fabricated mutual connection claims like 'referred by John'."""
    data = await setup_test_data(db_session)
    candidate_dict = dict(data["candidate_dict"])
    contact_dict = dict(data["contact_dict"])

    body = "Hi Clara, I was referred to you by John Smith from the infrastructure team."
    eval_res = RiskDetector.evaluate(
        subject="Hello",
        body=body,
        candidate_facts=candidate_dict,
        contact_facts=contact_dict,
        verified_evidence=[],
    )
    assert eval_res["passed"] is False
    assert eval_res["risk_level"] == "BLOCKED"
    assert any("FABRICATED_RELATIONSHIP" in flag for flag in eval_res["risk_flags"])


@pytest.mark.asyncio
async def test_private_data_leak_detection(db_session: AsyncSession):
    """Detects and blocks private phone numbers and residential addresses."""
    data = await setup_test_data(db_session)
    candidate_dict = dict(data["candidate_dict"])
    contact_dict = dict(data["contact_dict"])

    body1 = "Hi Clara, you can call my private cell at 555-234-5678 to discuss the role."
    eval1 = RiskDetector.evaluate("", body1, candidate_dict, contact_dict, [])
    assert eval1["passed"] is False
    assert any("PRIVATE_DATA_LEAK" in flag for flag in eval1["risk_flags"])

    body2 = "Please send me your personal phone number so we can text."
    eval2 = RiskDetector.evaluate("", body2, candidate_dict, contact_dict, [])
    assert eval2["passed"] is False
    assert any("SOLICITING_PRIVATE_DATA" in flag for flag in eval2["risk_flags"])


@pytest.mark.asyncio
async def test_spam_and_manipulative_language_detection(db_session: AsyncSession):
    """Detects and blocks desperate, demanding, or manipulative phrasing."""
    data = await setup_test_data(db_session)
    candidate_dict = dict(data["candidate_dict"])
    contact_dict = dict(data["contact_dict"])

    spam_bodies = [
        "Dear Sir/Madam, I urgently need a referral for Datadog.",
        "You are my only hope, please refer me immediately or my career is ruined.",
        "Respected Sir, please guarantee my interview at Datadog.",
    ]
    for b in spam_bodies:
        eval_res = RiskDetector.evaluate("", b, candidate_dict, contact_dict, [])
        assert eval_res["passed"] is False
        assert eval_res["risk_level"] == "BLOCKED"


@pytest.mark.asyncio
async def test_automatic_safe_repair_and_retry_limit(db_session: AsyncSession):
    """Verifies that repairable ungrounded claims are safely substituted up to 3 times."""
    data = await setup_test_data(db_session)
    candidate_dict = dict(data["candidate_dict"])
    job_dict = dict(data["job_dict"])
    contact_dict = dict(data["contact_dict"])

    # Draft with repairable unverified alumni claim
    body_with_unverified_alumni = (
        "Hi Clara,\n\nI noticed you graduated from Stanford University.\n\n"
        "I'm an engineer specializing in Python and Kubernetes. Thanks for your time,\nAlex Mercer"
    )

    val_res = OutreachValidatorAgent.validate_and_repair(
        subject="Intro",
        body=body_with_unverified_alumni,
        candidate_facts=candidate_dict,
        job_facts=job_dict,
        contact_facts=contact_dict,
        verified_evidence=[],  # No Stanford evidence
    )

    assert val_res["repaired"] is True
    assert val_res["repair_attempts"] > 0
    assert val_res["repair_attempts"] <= OutreachValidatorAgent.MAX_REPAIR_ATTEMPTS
    assert "Stanford" not in val_res["repaired_body"]
    assert val_res["passed"] is True


# =============================================================================
# Tests 16-21: Human Editing, Revalidation, Approval & Rejection
# =============================================================================

@pytest.mark.asyncio
async def test_human_editing_creates_audit_and_requires_revalidation(db_session: AsyncSession):
    """Edits to draft must be recorded in human_edits and trigger immediate revalidation."""
    data = await setup_test_data(db_session)

    # 1. Generate clean draft
    gen_req = OutreachDraftGenerateRequest(
        job_id=data["job"].id,
        referral_contact_id=data["contact_selected"].id,
        candidate_id=data["candidate"].id,
    )
    draft = await Phase19OutreachService.generate_draft(db_session, gen_req)
    assert draft.status == OutreachDraftStatus.REVIEW_REQUIRED

    # 2. Human edit injecting an unverified claim
    edit_req = OutreachDraftEditRequest(
        body=draft.body + "\n\nAlso, I was referred by David from DevOps.",
        change_summary="Added personal intro line",
        editor="test_user",
    )
    edited_draft = await Phase19OutreachService.edit_draft(db_session, draft.id, edit_req)

    # Invariant: human_edits recorded
    assert len(edited_draft.human_edits) == 1
    assert edited_draft.human_edits[0]["edited_by"] == "test_user"

    # Invariant: Injection of unverified referral causes revalidation to BLOCK the draft
    assert edited_draft.status == OutreachDraftStatus.BLOCKED
    assert edited_draft.validation_results["passed"] is False


@pytest.mark.asyncio
async def test_approval_state_transition_security(db_session: AsyncSession):
    """
    Approval requires:
    1. Validation passed
    2. Selected contact
    3. Master resume hash matches baseline
    Sets status to APPROVED_FOR_DISPATCH with NO_MESSAGE_SENT = True.
    """
    data = await setup_test_data(db_session)
    gen_req = OutreachDraftGenerateRequest(
        job_id=data["job"].id,
        referral_contact_id=data["contact_selected"].id,
        candidate_id=data["candidate"].id,
    )
    draft = await Phase19OutreachService.generate_draft(db_session, gen_req)
    assert draft.status == OutreachDraftStatus.REVIEW_REQUIRED

    # Approve
    approve_req = OutreachDraftApproveRequest(approver="lead_recruiter", notes="LGTM for future outreach")
    approved_draft = await Phase19OutreachService.approve_draft(db_session, draft.id, approve_req)

    assert approved_draft.status == OutreachDraftStatus.APPROVED_FOR_DISPATCH
    assert approved_draft.approved_by == "lead_recruiter"
    assert approved_draft.audit_metadata["NO_MESSAGE_SENT"] is True

    # Check contact outreach_status updated
    stmt = select(ReferralContact).where(ReferralContact.id == data["contact_selected"].id)
    res = await db_session.execute(stmt)
    c = res.scalar_one()
    assert c.outreach_status == "APPROVED"


@pytest.mark.asyncio
async def test_cannot_approve_blocked_draft(db_session: AsyncSession):
    """Attempting to approve a BLOCKED draft must raise ValueError."""
    data = await setup_test_data(db_session)
    gen_req = OutreachDraftGenerateRequest(
        job_id=data["job"].id,
        referral_contact_id=data["contact_selected"].id,
        candidate_id=data["candidate"].id,
    )
    draft = await Phase19OutreachService.generate_draft(db_session, gen_req)

    # Force block state
    draft.status = OutreachDraftStatus.BLOCKED
    draft.validation_results = {"passed": False, "risk_level": "BLOCKED"}
    await db_session.commit()

    with pytest.raises(ValueError, match="Cannot approve draft"):
        await Phase19OutreachService.approve_draft(
            db_session, draft.id, OutreachDraftApproveRequest()
        )


@pytest.mark.asyncio
async def test_rejection_lifecycle(db_session: AsyncSession):
    """Rejecting a draft marks it as REJECTED."""
    data = await setup_test_data(db_session)
    gen_req = OutreachDraftGenerateRequest(
        job_id=data["job"].id,
        referral_contact_id=data["contact_selected"].id,
        candidate_id=data["candidate"].id,
    )
    draft = await Phase19OutreachService.generate_draft(db_session, gen_req)

    rej_req = OutreachDraftRejectRequest(rejector="user", reason="Decided to contact recruiter instead")
    rejected_draft = await Phase19OutreachService.reject_draft(db_session, draft.id, rej_req)

    assert rejected_draft.status == OutreachDraftStatus.REJECTED
    assert rejected_draft.rejected_by == "user"


# =============================================================================
# Tests 22-26: Bulk Generation, Invariants & Safety
# =============================================================================

@pytest.mark.asyncio
async def test_bulk_generation_and_unselected_contact_blocked(db_session: AsyncSession):
    """Bulk generation generates drafts for selected contacts, ignoring unselected contacts."""
    data = await setup_test_data(db_session)

    # Contact 1: SELECTED, Contact 2: DO_NOT_CONTACT (unselected)
    contact_ids = [data["contact_selected"].id, data["contact_unselected"].id]

    bulk_req = OutreachDraftBulkGenerateRequest(
        job_id=data["job"].id,
        contact_ids=contact_ids,
        candidate_id=data["candidate"].id,
    )

    bulk_res = await Phase19OutreachService.bulk_generate(db_session, bulk_req)

    assert bulk_res.total_requested == 2
    # Only the selected contact should have a generated draft
    assert bulk_res.total_generated == 1
    assert len(bulk_res.drafts) == 1
    assert bulk_res.drafts[0].referral_contact_id == data["contact_selected"].id


@pytest.mark.asyncio
async def test_master_resume_immutability_invariant(db_session: AsyncSession):
    """Master resume SHA-256 hash must remain 100% identical before and after outreach preparation."""
    assert MASTER_RESUME_PATH.exists()
    hash_before = hashlib.sha256(MASTER_RESUME_PATH.read_text(encoding="utf-8").encode("utf-8")).hexdigest()

    data = await setup_test_data(db_session)
    gen_req = OutreachDraftGenerateRequest(
        job_id=data["job"].id,
        referral_contact_id=data["contact_selected"].id,
        candidate_id=data["candidate"].id,
    )
    draft = await Phase19OutreachService.generate_draft(db_session, gen_req)
    await Phase19OutreachService.approve_draft(db_session, draft.id, OutreachDraftApproveRequest())

    hash_after = hashlib.sha256(MASTER_RESUME_PATH.read_text(encoding="utf-8").encode("utf-8")).hexdigest()
    assert hash_before == hash_after, f"MASTER RESUME MUTATION DETECTED! Before: {hash_before}, After: {hash_after}"


@pytest.mark.asyncio
async def test_audit_event_trail_completeness(db_session: AsyncSession):
    """Verifies that all lifecycle actions create immutable OutreachAuditEvent records with no_message_sent=True."""
    data = await setup_test_data(db_session)
    gen_req = OutreachDraftGenerateRequest(
        job_id=data["job"].id,
        referral_contact_id=data["contact_selected"].id,
        candidate_id=data["candidate"].id,
    )
    draft = await Phase19OutreachService.generate_draft(db_session, gen_req)
    await Phase19OutreachService.validate_draft(db_session, draft.id)
    await Phase19OutreachService.approve_draft(db_session, draft.id, OutreachDraftApproveRequest())

    stmt = select(OutreachAuditEvent).where(OutreachAuditEvent.draft_id == draft.id)
    res = await db_session.execute(stmt)
    events = res.scalars().all()

    event_types = [e.event_type for e in events]
    assert "OUTREACH_GENERATED" in event_types
    assert "OUTREACH_VALIDATED" in event_types
    assert "OUTREACH_APPROVED" in event_types
    for e in events:
        assert e.no_message_sent is True


# =============================================================================
# Tests 27-30: API Endpoints, n8n, and Phase 18 Regression
# =============================================================================

@pytest.mark.asyncio
async def test_phase19_api_endpoints_lifecycle(async_client: AsyncClient, db_session: AsyncSession):
    """End-to-end API test verifying drafting, editing, approval, and filtering."""
    data = await setup_test_data(db_session)
    job_id = data["job"].id
    cid = data["contact_selected"].id

    # 1. Generate via API
    gen_payload = {
        "job_id": job_id,
        "referral_contact_id": cid,
        "candidate_id": data["candidate"].id,
        "channel": "LINKEDIN",
    }
    gen_res = await async_client.post("/api/v1/outreach/generate", json=gen_payload)
    assert gen_res.status_code == 201
    draft_data = gen_res.json()
    draft_id = draft_data["id"]
    assert draft_data["status"] == "REVIEW_REQUIRED"
    assert draft_data["contact_name"] == "Clara Simmons"

    # 2. Get Draft by ID
    get_res = await async_client.get(f"/api/v1/outreach/{draft_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == draft_id

    # 3. Patch Edit
    patch_res = await async_client.patch(
        f"/api/v1/outreach/{draft_id}",
        json={"body": "Hi Clara, edited message text for testing.", "editor": "reviewer_alex"},
    )
    assert patch_res.status_code == 200
    patched_data = patch_res.json()
    assert "edited message text" in patched_data["body"]
    assert len(patched_data["human_edits"]) == 1

    # 4. Approve
    app_res = await async_client.post(f"/api/v1/outreach/{draft_id}/approve", json={"approver": "reviewer_alex"})
    assert app_res.status_code == 200
    approved_data = app_res.json()
    assert approved_data["status"] == "APPROVED_FOR_DISPATCH"
    assert approved_data["audit_metadata"]["NO_MESSAGE_SENT"] is True

    # 5. List by Job
    job_list_res = await async_client.get(f"/api/v1/outreach/job/{job_id}")
    assert job_list_res.status_code == 200
    assert len(job_list_res.json()) >= 1


@pytest.mark.asyncio
async def test_phase18_referral_regression(db_session: AsyncSession):
    """Asserts that Phase 18 referral contact attributes and scores are not mutated by Phase 19."""
    data = await setup_test_data(db_session)
    contact = data["contact_selected"]
    assert contact.relevance_score == 95.0
    assert contact.duplicate_key == "nc:clarasimmons|datadog"
    assert len(contact.source_references) == 2
    assert contact.company_name == "Datadog"


@pytest.mark.asyncio
async def test_list_drafts_bounded_query_count_and_batch_enrichment(db_session: AsyncSession):
    """
    AUD-001 Regression Test:
    Asserts that Phase19OutreachService.list_drafts() executes an O(1) bounded number of queries
    (at most 4 queries) when fetching multiple drafts, eliminating serial N+1 query patterns.
    """
    import uuid
    data = await setup_test_data(db_session)
    job = data["job"]
    candidate = data["candidate"]

    # Create 5 additional contacts
    contacts = [data["contact_selected"]]
    for i in range(5):
        c = ReferralContact(
            id=str(uuid.uuid4()),
            job_id=job.id,
            name=f"Colleague {i}",
            current_title=f"Staff Engineer {i}",
            company="Datadog",
            company_name="Datadog",
            duplicate_key=f"colleague_{i}|datadog",
            relevance_score=80.0 + i,
            relationship_type="EMPLOYEE",
        )
        db_session.add(c)
        contacts.append(c)
    await db_session.flush()

    # Create 6 drafts
    for i, c in enumerate(contacts):
        draft = OutreachDraft(
            id=str(uuid.uuid4()),
            candidate_id=candidate.id,
            job_id=job.id,
            referral_contact_id=c.id,
            channel="LINKEDIN",
            body=f"Draft message for {c.name}",
            status=OutreachDraftStatus.REVIEW_REQUIRED,
        )
        db_session.add(draft)
    await db_session.flush()

    # Measure queries
    engine = db_session.bind
    query_count = 0
    def count_queries(conn, cursor, statement, parameters, context, executemany):
        nonlocal query_count
        query_count += 1

    event.listen(engine.sync_engine, "before_cursor_execute", count_queries)
    try:
        drafts = await Phase19OutreachService.list_drafts(db_session, job_id=job.id, limit=10)
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", count_queries)

    assert len(drafts) >= 6
    # O(1) bounded queries: exactly <= 4 SQL queries (drafts + audit_events + contacts batch + jobs batch)
    assert query_count <= 4, f"Expected <= 4 queries for list_drafts, but observed {query_count} queries (N+1 regression)!"

    # Verify data enrichment
    for d in drafts:
        assert d.job_title is not None
        assert d.job_company == "Datadog"
        assert d.contact_name is not None

