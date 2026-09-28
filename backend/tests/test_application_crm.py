import pytest
import datetime
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.candidate import Candidate
from backend.app.models.job import Job, MatchResult
from backend.app.models.resume import ResumeVersion
from backend.app.models.application import ApplicationStatus


@pytest.mark.asyncio
async def test_application_crm_lifecycle(
    async_client: AsyncClient, db_session: AsyncSession
):
    """
    Tests complete Application CRM lifecycle:
    1. Create application in SAVED stage
    2. Move to READY_TO_APPLY
    3. Move to APPLIED (verifying applied_at timestamp)
    4. Move to INTERVIEW with interview_stage and next_action
    5. Move to OFFER
    """
    # 1. Create Job and Candidate
    job = Job(
        company="Anthropic",
        role="Research Engineer - Alignment",
        raw_description="Building safe and reliable AI systems...",
        required_skills=["Python", "PyTorch"],
    )
    candidate = Candidate(
        full_name="Elena Rostova",
        email="elena.rostova@example.com",
    )
    db_session.add_all([job, candidate])
    await db_session.commit()

    # 2. POST /api/applications (Create as SAVED)
    create_payload = {
        "job_id": job.id,
        "candidate_id": candidate.id,
        "status": ApplicationStatus.SAVED,
        "source": "referral",
        "notes": "Targeting alignment research role",
        "next_action": "Reach out to internal connection for referral",
    }
    create_res = await async_client.post("/api/applications", json=create_payload)
    assert create_res.status_code == 201
    app_data = create_res.json()
    app_id = app_data["id"]
    assert app_data["status"] == ApplicationStatus.SAVED
    assert app_data["job"]["company"] == "Anthropic"
    assert app_data["job"]["role"] == "Research Engineer - Alignment"
    assert app_data["applied_at"] is None

    # 3. PUT /api/applications/{id} -> READY_TO_APPLY
    ready_res = await async_client.put(
        f"/api/applications/{app_id}",
        json={"status": ApplicationStatus.READY_TO_APPLY, "next_action": "Submit via career portal"},
    )
    assert ready_res.status_code == 200
    assert ready_res.json()["status"] == ApplicationStatus.READY_TO_APPLY
    assert ready_res.json()["next_action"] == "Submit via career portal"

    # 4. PUT /api/applications/{id} -> APPLIED (verify applied_at is auto-set)
    apply_res = await async_client.put(
        f"/api/applications/{app_id}",
        json={"status": ApplicationStatus.APPLIED, "notes": "Submitted with tailored resume v1"},
    )
    assert apply_res.status_code == 200
    applied_data = apply_res.json()
    assert applied_data["status"] == ApplicationStatus.APPLIED
    assert applied_data["applied_at"] is not None

    # 5. PUT /api/applications/{id} -> INTERVIEW with interview_stage and followup
    followup_time = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=3)).isoformat()
    interview_res = await async_client.put(
        f"/api/applications/{app_id}",
        json={
            "status": ApplicationStatus.INTERVIEW,
            "interview_stage": "Technical Screen",
            "next_action": "Prepare system design diagrams",
            "next_followup_date": followup_time,
        },
    )
    assert interview_res.status_code == 200
    interview_data = interview_res.json()
    assert interview_data["status"] == ApplicationStatus.INTERVIEW
    assert interview_data["interview_stage"] == "Technical Screen"
    assert interview_data["next_followup_date"] is not None

    # 6. PUT /api/applications/{id} -> OFFER
    offer_res = await async_client.put(
        f"/api/applications/{app_id}",
        json={"status": ApplicationStatus.OFFER, "notes": "Formal offer extended!"},
    )
    assert offer_res.status_code == 200
    assert offer_res.json()["status"] == ApplicationStatus.OFFER


@pytest.mark.asyncio
async def test_kanban_board_grouping(
    async_client: AsyncClient, db_session: AsyncSession
):
    """
    Tests GET /api/applications/kanban returns applications organized into
    the 7 primary columns: Saved, Ready, Applied, Screening, Interview, Offer, Rejected.
    """
    job1 = Job(company="Google", role="SRE", raw_description="Scale systems...")
    job2 = Job(company="Stripe", role="SWE", raw_description="Payments infrastructure...")
    job3 = Job(company="OpenAI", role="Research Scientist", raw_description="Frontier models...")
    db_session.add_all([job1, job2, job3])
    await db_session.commit()

    # Create applications in different stages
    await async_client.post("/api/applications", json={"job_id": job1.id, "status": "SAVED"})
    await async_client.post("/api/applications", json={"job_id": job2.id, "status": "APPLIED"})
    await async_client.post("/api/applications", json={"job_id": job3.id, "status": "TECHNICAL"})

    kanban_res = await async_client.get("/api/applications/kanban")
    assert kanban_res.status_code == 200
    kb = kanban_res.json()

    assert "Saved" in kb["columns"]
    assert "Ready" in kb["columns"]
    assert "Applied" in kb["columns"]
    assert "Screening" in kb["columns"]
    assert "Interview" in kb["columns"]
    assert "Offer" in kb["columns"]
    assert "Rejected" in kb["columns"]

    assert any(a["job"]["company"] == "Google" for a in kb["columns"]["Saved"])
    assert any(a["job"]["company"] == "Stripe" for a in kb["columns"]["Applied"])
    # TECHNICAL falls under Interview column
    assert any(a["job"]["company"] == "OpenAI" for a in kb["columns"]["Interview"])
    assert kb["total_applications"] >= 3


@pytest.mark.asyncio
async def test_application_validation_and_deletion(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Tests invalid status validation and application deletion."""
    job = Job(company="Meta", role="Infra Engineer", raw_description="Building infra...")
    db_session.add(job)
    await db_session.commit()

    # 1. Invalid status on create
    invalid_create = await async_client.post(
        "/api/applications",
        json={"job_id": job.id, "status": "INVALID_STAGE_XYZ"},
    )
    assert invalid_create.status_code == 400

    # 2. Valid create
    created = await async_client.post(
        "/api/applications",
        json={"job_id": job.id, "status": "SAVED"},
    )
    assert created.status_code == 201
    app_id = created.json()["id"]

    # 3. Invalid status on update
    invalid_update = await async_client.put(
        f"/api/applications/{app_id}",
        json={"status": "FAKE_STATUS"},
    )
    assert invalid_update.status_code == 400

    # 4. Delete application
    del_res = await async_client.delete(f"/api/applications/{app_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 5. Verify 404
    get_res = await async_client.get(f"/api/applications/{app_id}")
    assert get_res.status_code == 404
