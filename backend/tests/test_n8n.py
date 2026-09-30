import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.services.n8n import N8nService, HITL_PROTECTED_ACTIONS
from backend.app.core.config import settings


@pytest.mark.asyncio
async def test_n8n_status_endpoint():
    """Verify n8n status endpoint returns configuration and HITL policy metadata."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.get("/api/v1/n8n/status")
        assert res.status_code == 200
        data = res.json()
        assert data["enabled"] is True
        assert data["source_of_truth"] == "FastAPI (CareerPilot)"
        assert data["hitl_guardrails_active"] is True
        assert data["autonomous_dispatch_allowed"] is False
        assert data["n8n_base_url"] == settings.N8N_BASE_URL


@pytest.mark.asyncio
async def test_n8n_hitl_guardrail_blocks_autonomous_actions():
    """
    Enforce Rule 11: n8n must NEVER autonomously submit job applications,
    send LinkedIn messages, referral messages, or emails without explicit human approval.
    """
    for action in HITL_PROTECTED_ACTIONS:
        guard = N8nService.enforce_hitl_guardrail(
            action=action, human_approved=False
        )
        assert guard["allowed"] is False
        assert guard["status"] == "REJECTED_HITL_REQUIRED"
        assert "zero-hallucination HITL policy" in guard["reason"]


@pytest.mark.asyncio
async def test_n8n_hitl_guardrail_permits_approved_actions():
    """Verifies that human-approved actions are accepted."""
    guard = N8nService.enforce_hitl_guardrail(
        action="submit_job_application",
        human_approved=True,
        approver_id="candidate-alex",
    )
    assert guard["allowed"] is True
    assert guard["status"] == "APPROVED"
    assert guard["approver_id"] == "candidate-alex"


@pytest.mark.asyncio
async def test_n8n_incoming_webhook_auth_and_guardrail():
    """Tests incoming webhook endpoint with secret verification and guardrail enforcement."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # 1. Test missing or invalid secret
        unauth_res = await client.post(
            "/api/v1/n8n/webhook/incoming",
            json={"action": "prepare_draft"},
            headers={"X-N8N-Webhook-Secret": "invalid-secret"},
        )
        assert unauth_res.status_code == 401

        # 2. Test valid secret with unapproved dangerous action
        blocked_res = await client.post(
            "/api/v1/n8n/webhook/incoming",
            json={"action": "submit_job_application", "human_approved": False},
            headers={"X-N8N-Webhook-Secret": settings.N8N_WEBHOOK_SECRET},
        )
        assert blocked_res.status_code == 200
        blocked_data = blocked_res.json()
        assert blocked_data["status"] == "BLOCKED_BY_GUARDRAIL"
        assert blocked_data["requires_human_approval"] is True

        # 3. Test valid secret with non-dangerous preparation action
        ok_res = await client.post(
            "/api/v1/n8n/webhook/incoming",
            json={"action": "prepare_interview_questions", "human_approved": True},
            headers={"X-N8N-Webhook-Secret": settings.N8N_WEBHOOK_SECRET},
        )
        assert ok_res.status_code == 200
        ok_data = ok_res.json()
        assert ok_data["status"] == "ACCEPTED"


@pytest.mark.asyncio
async def test_n8n_dispatch_test_endpoint():
    """Tests triggering a test webhook to n8n from FastAPI."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.post(
            "/api/v1/n8n/dispatch-test",
            json={
                "event": "careerpilot_test",
                "message": "CareerPilot connected to n8n",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["dispatched_event"] == "careerpilot_test"
        assert data["payload"]["message"] == "CareerPilot connected to n8n"
