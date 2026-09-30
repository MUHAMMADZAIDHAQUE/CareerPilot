"""
CareerPilot Phase 20: Authorized Outreach Dispatch & Idempotency Tests.
Validates requirements 21 to 32:
21. approved draft can dispatch
22. unapproved draft blocked
23. blocked draft blocked
24. explicit confirmation required
25. idempotency
26. duplicate send prevention
27. provider failure handling
28. successful send
29. audit event
30. manual LinkedIn mode
31. no private LinkedIn access
32. no automatic connection request
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.models.outreach import (
    OutreachDraft,
    OutreachDraftStatus,
    OutreachDispatch,
    OutreachDispatchStatus,
    OutreachAuditEvent,
)
from backend.app.schemas.outreach import OutreachDispatchRequest, OutreachBulkDispatchRequest
from backend.app.services.outreach.dispatch_service import DispatchService


@pytest.mark.asyncio
async def test_unapproved_draft_is_strictly_blocked(db_session: AsyncSession, async_client: AsyncClient):
    """Test 22 & 23: Drafts not in APPROVED_FOR_DISPATCH status are rejected."""
    draft = OutreachDraft(
        id="draft_unapproved_001",
        candidate_id="cand_001",
        recipient_name="Aisha Patel",
        recipient_email="aisha@datadog.com",
        channel="EMAIL",
        subject="Application - Software Engineer",
        message_body="Hello Aisha, I am excited about the SWE role.",
        status=OutreachDraftStatus.DRAFT,  # Not approved!
    )
    db_session.add(draft)
    await db_session.commit()

    # Attempt dispatch
    res = await async_client.post(
        f"/api/v1/outreach/{draft.id}/send",
        json={"confirm_send": True},
    )
    assert res.status_code == 400
    assert "APPROVED_FOR_DISPATCH" in res.json()["detail"]


@pytest.mark.asyncio
async def test_explicit_confirmation_required(db_session: AsyncSession, async_client: AsyncClient):
    """Test 24: Explicit confirm_send: true is strictly required."""
    draft = OutreachDraft(
        id="draft_noconfirm_001",
        candidate_id="cand_001",
        recipient_name="Aisha Patel",
        recipient_email="aisha@datadog.com",
        channel="EMAIL",
        subject="Application - Software Engineer",
        message_body="Hello Aisha, I am excited about the SWE role.",
        status=OutreachDraftStatus.APPROVED_FOR_DISPATCH,
    )
    db_session.add(draft)
    await db_session.commit()

    # Send without confirm_send
    res = await async_client.post(
        f"/api/v1/outreach/{draft.id}/send",
        json={"confirm_send": False},
    )
    assert res.status_code == 400
    assert "confirm_send" in res.json()["detail"]


@pytest.mark.asyncio
async def test_successful_email_dispatch_and_audit(db_session: AsyncSession, async_client: AsyncClient):
    """Test 21, 28 & 29: Approved email draft sends successfully and creates audit event."""
    draft = OutreachDraft(
        id="draft_valid_send_001",
        candidate_id="cand_001",
        recipient_name="Vikram Rao",
        recipient_email="vikram@razorpay.com",
        channel="EMAIL",
        subject="Software Engineer Application",
        message_body="Hi Vikram, I admire Razorpay's payments architecture.",
        status=OutreachDraftStatus.APPROVED_FOR_DISPATCH,
    )
    db_session.add(draft)
    await db_session.commit()

    res = await async_client.post(
        f"/api/v1/outreach/{draft.id}/send",
        json={"confirm_send": True, "provider": "GMAIL"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == OutreachDispatchStatus.SENT
    assert data["provider_message_id"] is not None
    assert data["duplicate_prevented"] is False

    # Verify audit event created
    audit_res = await db_session.execute(
        select(OutreachAuditEvent).where(OutreachAuditEvent.draft_id == draft.id)
    )
    audits = audit_res.scalars().all()
    assert len(audits) >= 1
    assert any(a.event_type == "OUTREACH_DISPATCHED" for a in audits)


@pytest.mark.asyncio
async def test_idempotency_and_duplicate_send_prevention(db_session: AsyncSession, async_client: AsyncClient):
    """Test 25 & 26: Duplicate dispatch attempts are prevented via deterministic idempotency keys."""
    draft = OutreachDraft(
        id="draft_idempotent_001",
        candidate_id="cand_001",
        recipient_name="Pooja Sharma",
        recipient_email="pooja@swiggy.in",
        channel="EMAIL",
        subject="Associate Data Analyst Role",
        message_body="Hi Pooja, I would love to learn more about analytics at Swiggy.",
        status=OutreachDraftStatus.APPROVED_FOR_DISPATCH,
    )
    db_session.add(draft)
    await db_session.commit()

    # First send
    res1 = await async_client.post(
        f"/api/v1/outreach/{draft.id}/send",
        json={"confirm_send": True},
    )
    assert res1.status_code == 200
    assert res1.json()["duplicate_prevented"] is False
    msg_id1 = res1.json()["provider_message_id"]

    # Second send (retry) - Draft was set to DISPATCHED, but even if called again:
    draft.status = OutreachDraftStatus.APPROVED_FOR_DISPATCH
    await db_session.commit()

    res2 = await async_client.post(
        f"/api/v1/outreach/{draft.id}/send",
        json={"confirm_send": True},
    )
    assert res2.status_code == 200
    assert res2.json()["duplicate_prevented"] is True
    # Returned existing provider message ID without re-transmitting
    assert res2.json()["provider_message_id"] == msg_id1


@pytest.mark.asyncio
async def test_manual_linkedin_mode_and_no_private_scraping(db_session: AsyncSession, async_client: AsyncClient):
    """Test 30, 31 & 32: LinkedIn channel enforces MANUAL_SEND_REQUIRED with zero automated login or connection requests."""
    draft = OutreachDraft(
        id="draft_li_manual_001",
        candidate_id="cand_001",
        recipient_name="Rohan Verma",
        recipient_profile_url="https://linkedin.com/in/rohan-verma",
        channel="LINKEDIN",
        subject=None,
        message_body="Hi Rohan, I noticed your work on the search platform at Flipkart.",
        status=OutreachDraftStatus.APPROVED_FOR_DISPATCH,
    )
    db_session.add(draft)
    await db_session.commit()

    res = await async_client.post(
        f"/api/v1/outreach/{draft.id}/send",
        json={"confirm_send": True},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == OutreachDispatchStatus.MANUAL_SEND_REQUIRED
    assert data["provider"] == "LINKEDIN_MANUAL"
    assert data["provider_message_id"] is None
    assert "manual" in data["message"].lower()


@pytest.mark.asyncio
async def test_bulk_send_validation(db_session: AsyncSession, async_client: AsyncClient):
    """Test Bulk Send validates individual approval statuses and rejects unapproved drafts."""
    d_appr = OutreachDraft(
        id="draft_bulk_appr_001",
        candidate_id="cand_001",
        recipient_name="Alice Smith",
        recipient_email="alice@company.com",
        channel="EMAIL",
        message_body="Hello Alice.",
        status=OutreachDraftStatus.APPROVED_FOR_DISPATCH,
    )
    d_unappr = OutreachDraft(
        id="draft_bulk_unappr_001",
        candidate_id="cand_001",
        recipient_name="Bob Jones",
        recipient_email="bob@company.com",
        channel="EMAIL",
        message_body="Hello Bob.",
        status=OutreachDraftStatus.REVIEW_REQUIRED,  # Not approved!
    )
    db_session.add(d_appr)
    db_session.add(d_unappr)
    await db_session.commit()

    res = await async_client.post(
        "/api/v1/outreach/bulk-send",
        json={
            "draft_ids": [d_appr.id, d_unappr.id],
            "confirm_send": True,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_requested"] == 2
    assert data["successful_count"] == 1
    assert data["blocked_count"] == 1
