import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.candidate import Candidate, Education, Experience, Project, Skill
from backend.app.models.job import Job
from backend.app.models.referral import Contact, Referral
from backend.app.models.outreach import OutreachStatus
from backend.app.agents.outreach_agent import OutreachAgent


@pytest.mark.asyncio
async def test_generate_outreach_drafts_truthful_and_grounded(
    async_client: AsyncClient, db_session: AsyncSession
):
    """
    Tests generating both Email and LinkedIn outreach drafts.
    Verifies that the generated messages are concise, personalized, truthful,
    non-spammy, and strictly grounded in real candidate project and alumni data.
    """
    # 1. Setup Candidate with Education and Real Project
    candidate = Candidate(
        full_name="Maya Lin",
        email="maya.lin@example.com",
    )
    db_session.add(candidate)
    await db_session.flush()

    edu = Education(
        candidate_id=candidate.id,
        institution="Carnegie Mellon University",
        degree="M.S. in Software Engineering",
        field_of_study="Software Engineering",
    )
    project = Project(
        candidate_id=candidate.id,
        title="Distributed Raft Consensus Engine",
        description="Implemented a fault-tolerant Raft distributed key-value store with log compaction and snapshotting.",
        technologies=["Go", "Raft", "gRPC", "Docker"],
    )
    skill = Skill(candidate_id=candidate.id, name="Go")
    db_session.add_all([edu, project, skill])
    await db_session.flush()

    # 2. Setup Target Job
    job = Job(
        company="Stripe",
        role="Distributed Systems Engineer",
        raw_description="Looking for an engineer to build highly resilient distributed transaction systems...",
        required_skills=["Go", "Distributed Systems", "gRPC"],
        technologies=["Go", "Docker", "AWS"],
    )
    db_session.add(job)
    await db_session.flush()

    # 3. Setup Contact (Alumni & Current Employee at Stripe)
    contact = Contact(
        candidate_id=candidate.id,
        name="Marcus Vance",
        company="Stripe",
        role="Staff Infrastructure Engineer",
        department="Core Infrastructure",
        university="Carnegie Mellon University",
        email="marcus.vance@stripe.example.com",
        source="university_alumni",
    )
    db_session.add(contact)
    await db_session.flush()

    referral = Referral(
        job_id=job.id,
        contact_id=contact.id,
        candidate_id=candidate.id,
        relationship_type="university alumni",
        relevance_score=95.0,
        relevance_reason="Marcus Vance is a Staff Engineer at Stripe and shares CMU alumni background.",
        status="suggested",
    )
    db_session.add(referral)
    await db_session.commit()

    # 4. Request Outreach Generation (all channels)
    generate_payload = {
        "job_id": job.id,
        "contact_id": contact.id,
        "candidate_id": candidate.id,
        "referral_id": referral.id,
        "relevant_project_id": project.id,
        "channel": "all",
    }
    res = await async_client.post("/api/outreach/generate", json=generate_payload)
    assert res.status_code == 201
    data = res.json()

    assert data["job_id"] == job.id
    assert data["contact_id"] == contact.id
    assert len(data["messages"]) == 2
    assert "Human-in-the-loop Protocol" in data["ethical_protocol_notice"]

    # Verify Email Draft
    email_draft = next(m for m in data["messages"] if m["channel"] == "email")
    assert email_draft["status"] == OutreachStatus.NEEDS_REVIEW
    assert email_draft["subject"] is not None
    assert "Carnegie Mellon" in email_draft["subject"] or "Stripe" in email_draft["subject"]
    assert "Distributed Systems Engineer" in email_draft["subject"]
    assert "Hi Marcus" in email_draft["body"]
    assert "Distributed Raft Consensus Engine" in email_draft["body"]
    assert "Stripe" in email_draft["body"]
    assert "Maya Lin" in email_draft["body"]
    assert email_draft["approved_at"] is None
    assert email_draft["sent_at"] is None

    # Verify LinkedIn Draft
    linkedin_draft = next(m for m in data["messages"] if m["channel"] == "linkedin")
    assert linkedin_draft["status"] == OutreachStatus.NEEDS_REVIEW
    assert "Hi Marcus" in linkedin_draft["body"]
    assert "Carnegie Mellon" in linkedin_draft["body"] or "Stripe" in linkedin_draft["body"]
    # Concise: LinkedIn draft should be under 800 chars
    assert len(linkedin_draft["body"]) < 800
    assert linkedin_draft["metadata_json"]["manual_sending_only"] is True


@pytest.mark.asyncio
async def test_human_in_the_loop_approval_lifecycle(
    async_client: AsyncClient, db_session: AsyncSession
):
    """
    Tests human-in-the-loop review actions:
    1. Edit draft
    2. Approve draft (NEEDS_REVIEW -> APPROVED)
    3. Reject draft (NEEDS_REVIEW -> REJECTED)
    4. Mark as sent (APPROVED -> SENT)
    """
    job = Job(
        company="Datadog",
        role="Cloud Platform Engineer",
        raw_description="Scaling cloud platform infrastructure...",
    )
    contact = Contact(
        name="Nadia Petrova",
        company="Datadog",
        role="Senior SRE",
        email="nadia@datadog.example.com",
    )
    candidate = Candidate(full_name="Sam Fisher", email="sam@example.com")
    db_session.add_all([job, contact, candidate])
    await db_session.commit()

    # Generate draft
    gen_res = await async_client.post(
        "/api/outreach/generate",
        json={"job_id": job.id, "contact_id": contact.id, "candidate_id": candidate.id, "channel": "email"},
    )
    assert gen_res.status_code == 201
    messages = gen_res.json()["messages"]
    outreach_id = messages[0]["id"]

    # 1. Edit Draft
    edited_subject = "Personalized Inquiry: Cloud Platform Engineer at Datadog"
    edited_body = "Hi Nadia, I am reaching out regarding the Cloud Platform Engineer opening..."
    edit_res = await async_client.put(
        f"/api/outreach/{outreach_id}",
        json={"subject": edited_subject, "body": edited_body},
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["subject"] == edited_subject
    assert edit_res.json()["body"] == edited_body

    # 2. Approve Draft
    approve_res = await async_client.post(f"/api/outreach/{outreach_id}/approve")
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == OutreachStatus.APPROVED
    assert approve_res.json()["approved_at"] is not None

    # 3. Mark as Sent
    sent_res = await async_client.post(f"/api/outreach/{outreach_id}/sent")
    assert sent_res.status_code == 200
    assert sent_res.json()["status"] == OutreachStatus.SENT
    assert sent_res.json()["sent_at"] is not None

    # 4. Test Reject on a new message
    gen_res_2 = await async_client.post(
        "/api/outreach/generate",
        json={"job_id": job.id, "contact_id": contact.id, "candidate_id": candidate.id, "channel": "linkedin"},
    )
    outreach_id_2 = gen_res_2.json()["messages"][0]["id"]
    reject_res = await async_client.post(f"/api/outreach/{outreach_id_2}/reject")
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == OutreachStatus.REJECTED


@pytest.mark.asyncio
async def test_outreach_list_and_delete(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Tests listing with filters and deletion."""
    job = Job(company="Figma", role="Product Designer", raw_description="Design modern UX...")
    contact = Contact(name="Chloe Zhao", company="Figma", role="Design Director")
    candidate = Candidate(full_name="Liam Davis", email="liam@example.com")
    db_session.add_all([job, contact, candidate])
    await db_session.commit()

    # Generate
    await async_client.post(
        "/api/outreach/generate",
        json={"job_id": job.id, "contact_id": contact.id, "candidate_id": candidate.id},
    )

    # List all
    list_res = await async_client.get("/api/outreach")
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) >= 2

    # Filter by channel
    email_res = await async_client.get("/api/outreach?channel=email")
    assert email_res.status_code == 200
    for itm in email_res.json():
        assert itm["channel"] == "email"

    # Delete an item
    target_id = items[0]["id"]
    del_res = await async_client.delete(f"/api/outreach/{target_id}")
    assert del_res.status_code == 200

    # Verify 404 on get
    get_res = await async_client.get(f"/api/outreach/{target_id}")
    assert get_res.status_code == 404


def test_guardrails_prevent_unsupported_guarantee_claims():
    """Tests that OutreachAgent rejects forbidden guarantee or aggressive claims."""
    with pytest.raises(ValueError, match="prohibited phrasing"):
        OutreachAgent._verify_guardrails(
            text="You must refer me because we were college roommates and you owe me a referral guarantee.",
            candidate_data={},
            job_data={},
            contact_data={},
        )
