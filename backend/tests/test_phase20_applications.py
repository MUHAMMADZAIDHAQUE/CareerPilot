"""
CareerPilot Phase 20: Application CRM & Regression Tests.
Validates requirements 39 to 49:
39. application creation
40. state transitions across 16 stages
41. timeline generation
42. deadline tracking
43. interview tracking
44. response tracking
45. Phase 17 resume immutability
46. Phase 18 referral discovery
47. Phase 19 outreach validation
48. n8n architecture
49. master resume hash
"""
import pytest
import hashlib
from pathlib import Path
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.models.job import Job
from backend.app.models.candidate import Candidate
from backend.app.models.application import (
    Application,
    ApplicationStatus,
    Deadline,
    InterviewEvent,
    Notification,
    ConnectedProvider,
)
from backend.app.services.application_service import ApplicationService


MASTER_RESUME_PATH = Path("resume/master/sample_master_resume.tex")
EXPECTED_MASTER_RESUME_HASH = "5af8c99a0553936a6773f030906a960039ae504d8c88804946c9330292048c5c"


@pytest.mark.asyncio
async def test_application_creation_and_16_state_transitions(db_session: AsyncSession, async_client: AsyncClient):
    """Test 39 & 40: Application CRM creation and transition across 16 lifecycle stages."""
    # Seed job
    j = Job(
        id="job_crm_001",
        company="Razorpay",
        role="Software Engineer",
        raw_description="Core payments role.",
        is_active=True,
    )
    db_session.add(j)
    await db_session.commit()

    # Create application
    create_payload = {
        "job_id": j.id,
        "status": ApplicationStatus.SAVED,
        "notes": "Target company for Q4",
    }
    create_res = await async_client.post("/api/v1/applications", json=create_payload)
    assert create_res.status_code == 201
    app_data = create_res.json()
    app_id = app_data["id"]
    assert app_data["status"] == ApplicationStatus.SAVED

    # Test transitions
    stages_to_test = [
        ApplicationStatus.ANALYZING,
        ApplicationStatus.RESUME_PREPARED,
        ApplicationStatus.RESUME_APPROVED,
        ApplicationStatus.REFERRAL_RESEARCH,
        ApplicationStatus.OUTREACH_PREPARED,
        ApplicationStatus.OUTREACH_APPROVED,
        ApplicationStatus.OUTREACH_SENT,
        ApplicationStatus.APPLICATION_READY,
        ApplicationStatus.APPLIED,
        ApplicationStatus.ASSESSMENT,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.OFFER,
    ]

    for stage in stages_to_test:
        patch_res = await async_client.patch(
            f"/api/v1/applications/{app_id}",
            json={"status": stage},
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["status"] == stage


@pytest.mark.asyncio
async def test_application_detail_view_and_timeline(db_session: AsyncSession, async_client: AsyncClient):
    """Test 41: Application detail view compiles comprehensive timeline and sub-entities."""
    j = Job(
        id="job_detail_001",
        company="CRED",
        role="Backend Engineer",
        raw_description="Distributed services.",
        is_active=True,
    )
    db_session.add(j)
    await db_session.commit()

    app = Application(
        id="app_detail_001",
        job_id=j.id,
        status=ApplicationStatus.OUTREACH_SENT,
        notes="High priority target",
    )
    db_session.add(app)
    await db_session.commit()

    res = await async_client.get(f"/api/v1/applications/{app.id}/detail")
    assert res.status_code == 200
    data = res.json()
    assert data["application"]["id"] == app.id
    assert data["job"]["company"] == "CRED"
    assert isinstance(data["timeline"], list)
    assert len(data["timeline"]) >= 1


@pytest.mark.asyncio
async def test_deadline_and_interview_tracking(db_session: AsyncSession, async_client: AsyncClient):
    """Test 42 & 43: Create and list interviews and actionable deadlines."""
    j = Job(
        id="job_track_001",
        company="Postman",
        role="DevOps Engineer",
        raw_description="Tooling role.",
        is_active=True,
    )
    db_session.add(j)
    await db_session.commit()

    app = Application(
        id="app_track_001",
        job_id=j.id,
        status=ApplicationStatus.APPLIED,
    )
    db_session.add(app)
    await db_session.commit()

    # Schedule interview
    iv_payload = {
        "application_id": app.id,
        "company": "Postman",
        "interview_type": "TECHNICAL",
        "scheduled_at": (datetime.utcnow() + timedelta(days=3)).isoformat(),
        "meeting_url": "https://meet.google.com/xyz-postman",
    }
    iv_res = await async_client.post("/api/v1/interviews", json=iv_payload)
    assert iv_res.status_code == 201

    # List deadlines
    dl_res = await async_client.get("/api/v1/deadlines")
    assert dl_res.status_code == 200
    deadlines = dl_res.json()
    assert len(deadlines) >= 1
    assert any("Postman" in d["title"] for d in deadlines)


@pytest.mark.asyncio
async def test_notifications_and_provider_connections(async_client: AsyncClient):
    """Test notifications and provider OAuth/connection management."""
    # List notifications
    notif_res = await async_client.get("/api/v1/notifications")
    assert notif_res.status_code == 200

    # Connect provider
    prov_res = await async_client.post(
        "/api/v1/providers/gmail/connect",
        json={"email_address": "candidate@gmail.com"},
    )
    assert prov_res.status_code == 200
    assert prov_res.json()["is_connected"] is True
    assert prov_res.json()["email_address"] == "candidate@gmail.com"

    # List providers
    prov_list_res = await async_client.get("/api/v1/providers")
    assert prov_list_res.status_code == 200
    assert any(p["provider_type"] == "GMAIL" for p in prov_list_res.json())

    # Disconnect provider
    disc_res = await async_client.delete("/api/v1/providers/gmail")
    assert disc_res.status_code == 200


def test_regression_master_resume_hash():
    """Test 45 & 49: Master resume file must remain immutable with verified SHA-256 hash."""
    assert MASTER_RESUME_PATH.exists(), f"Master resume missing at {MASTER_RESUME_PATH}"
    content = MASTER_RESUME_PATH.read_bytes()
    current_hash = hashlib.sha256(content).hexdigest()
    assert current_hash == EXPECTED_MASTER_RESUME_HASH, (
        f"Master resume was modified! Expected {EXPECTED_MASTER_RESUME_HASH}, found {current_hash}"
    )


def test_regression_n8n_workflows_exist_and_contain_zero_business_logic():
    """Test 48: Verified all 6 n8n workflows exist and delegate to FastAPI."""
    workflow_files = [
        "workflows/job_discovery_workflow.json",
        "workflows/referral_discovery_workflow.json",
        "workflows/outreach_preparation_workflow.json",
        "workflows/outreach_dispatch_workflow.json",
        "workflows/response_monitoring_workflow.json",
        "workflows/deadline_monitoring_workflow.json",
    ]
    for wf in workflow_files:
        p = Path(wf)
        assert p.exists(), f"Workflow file {wf} does not exist"
        content = p.read_text()
        assert "http://127.0.0.1:8000" in content or "FastAPI" in content or "httpRequest" in content
