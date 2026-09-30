"""
CareerPilot Phase 20: Inbound Response Monitoring & Assessment/Deadline Extraction Tests.
Validates requirements 33 to 38:
33. response ingestion
34. classification
35. assessment detection
36. interview detection
37. deadline extraction
38. unsupported deadline rejection
"""
import pytest
from datetime import datetime
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.models.application import (
    Application,
    ApplicationStatus,
    InboundResponse,
    Assessment,
    Deadline,
    InterviewEvent,
)
from backend.app.services.response_monitoring_service import ResponseMonitoringService, parse_explicit_date


def test_explicit_date_parsing_and_no_hallucination():
    """Test 37 & 38: Accurately parses explicit dates and strictly refuses to fabricate missing dates."""
    # Explicit ISO date
    d1 = parse_explicit_date("Please finish by 2026-10-05 before midnight.")
    assert d1 is not None
    assert d1.year == 2026 and d1.month == 10 and d1.day == 5

    # Explicit Month DD
    d2 = parse_explicit_date("Submit your test by October 15.")
    assert d2 is not None
    assert d2.month == 10 and d2.day == 15

    # No date mentioned - MUST BE NONE, never hallucinated!
    d3 = parse_explicit_date("Thanks for reaching out! Let us know if you have any questions.")
    assert d3 is None

    d4 = parse_explicit_date("We are considering applicants on a rolling basis.")
    assert d4 is None


@pytest.mark.asyncio
async def test_response_ingestion_and_classification(db_session: AsyncSession, async_client: AsyncClient):
    """Test 33 & 34: Ingests response and classifies accurately based on evidence."""
    payload = {
        "sender": "recruiter@datadog.com",
        "subject": "Excited to connect!",
        "body": "Hi, we reviewed your GitHub and are very impressed with your background. Would love to discuss our distributed tracing team.",
        "channel": "EMAIL",
    }
    res = await async_client.post("/api/v1/responses", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["classification"] in {"POSITIVE", "INTERESTED"}
    assert data["action_required"] is True


@pytest.mark.asyncio
async def test_assessment_detection_and_deadline_creation(db_session: AsyncSession, async_client: AsyncClient):
    """Test 35 & 37: Detects HackerRank/CodeSignal test link and creates assessment record."""
    # Seed an application
    app = Application(
        id="app_asmt_001",
        job_id="job_001",
        status=ApplicationStatus.OUTREACH_SENT,
    )
    db_session.add(app)
    await db_session.commit()

    payload = {
        "application_id": app.id,
        "sender": "hiring@razorpay.com",
        "subject": "Razorpay Online Technical Assessment",
        "body": (
            "Congratulations! You have been invited to complete the HackerRank coding assessment for our Software Engineer position. "
            "Assessment URL: https://hackerrank.com/test/razorpay_swe_2026. "
            "Please complete this test by 2026-10-12."
        ),
        "channel": "EMAIL",
    }
    res = await async_client.post("/api/v1/responses", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["classification"] == "ASSESSMENT"
    assert data["assessment_detected"] is True

    # Verify Assessment record created
    asmt_res = await db_session.execute(select(Assessment).where(Assessment.application_id == app.id))
    asmt = asmt_res.scalars().first()
    assert asmt is not None
    assert asmt.platform == "HACKERRANK"
    assert "https://hackerrank.com/test/razorpay_swe_2026" in asmt.url
    assert asmt.deadline is not None
    assert asmt.deadline.day == 12

    # Verify Application stage automatically transitioned to ASSESSMENT
    await db_session.refresh(app)
    assert app.status == ApplicationStatus.ASSESSMENT


@pytest.mark.asyncio
async def test_interview_detection_and_tracking(db_session: AsyncSession, async_client: AsyncClient):
    """Test 36: Detects interview invitation with video link and creates interview record."""
    app = Application(
        id="app_iv_001",
        job_id="job_002",
        status=ApplicationStatus.ASSESSMENT,
    )
    db_session.add(app)
    await db_session.commit()

    payload = {
        "application_id": app.id,
        "sender": "recruiter@postman.com",
        "subject": "Postman Technical Interview Invitation",
        "body": (
            "We would like to invite you for a 45-minute technical screening interview. "
            "Please join the meeting link: https://meet.google.com/abc-defg-hij. "
            "The interview is scheduled for October 20."
        ),
        "channel": "EMAIL",
    }
    res = await async_client.post("/api/v1/responses", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["classification"] == "INTERVIEW"
    assert data["interview_detected"] is True

    # Verify InterviewEvent record created
    iv_res = await db_session.execute(select(InterviewEvent).where(InterviewEvent.application_id == app.id))
    iv = iv_res.scalars().first()
    assert iv is not None
    assert "meet.google.com" in iv.meeting_url
    assert iv.interview_type in {"TECHNICAL", "HR"}

    # Verify Application stage transitioned to INTERVIEW
    await db_session.refresh(app)
    assert app.status == ApplicationStatus.INTERVIEW


@pytest.mark.asyncio
async def test_referral_offer_detection(db_session: AsyncSession, async_client: AsyncClient):
    """Test Referral offer response updates referral status."""
    app = Application(
        id="app_ref_001",
        job_id="job_003",
        status=ApplicationStatus.OUTREACH_SENT,
        referral_status="contact_reached",
    )
    db_session.add(app)
    await db_session.commit()

    payload = {
        "application_id": app.id,
        "sender": "engineer@google.com",
        "subject": "Re: Quick referral question",
        "body": "Hi Zaid, I took a look at your projects and was happy to refer you internally. You should receive a confirmation email shortly.",
        "channel": "EMAIL",
    }
    res = await async_client.post("/api/v1/responses", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["classification"] == "REFERRAL_OFFER"

    await db_session.refresh(app)
    assert app.referral_status == "referred"
    assert app.status == ApplicationStatus.APPLICATION_READY
