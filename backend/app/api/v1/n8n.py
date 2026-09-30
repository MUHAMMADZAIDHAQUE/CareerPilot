from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from backend.app.services.n8n import N8nService
from backend.app.core.config import settings

router = APIRouter(prefix="/n8n", tags=["n8n Orchestration"])


class N8nTestPayload(BaseModel):
    event: str = Field(default="careerpilot_test", description="Event name identifier")
    message: str = Field(
        default="CareerPilot connected to n8n",
        description="Event payload message",
    )
    metadata: Optional[Dict[str, Any]] = None


class N8nIncomingWebhook(BaseModel):
    action: str = Field(..., description="Action requested by n8n workflow")
    candidate_id: Optional[str] = None
    job_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    human_approved: bool = Field(
        default=False,
        description="Whether human has explicitly approved this action",
    )
    approver_id: Optional[str] = None


@router.get("/status")
async def get_n8n_status():
    """
    Returns the operational status of the local n8n Community Edition integration,
    including configuration, health check against n8n, and HITL safety policies.
    """
    health_result = await N8nService.check_health()
    return {
        "integration": "n8n Community Edition (Self-Hosted)",
        "enabled": settings.N8N_ENABLED,
        "n8n_base_url": settings.N8N_BASE_URL,
        "webhook_base_url": settings.N8N_WEBHOOK_BASE_URL,
        "health": health_result,
        "source_of_truth": "FastAPI (CareerPilot)",
        "hitl_guardrails_active": True,
        "autonomous_dispatch_allowed": False,
    }


@router.post("/dispatch-test")
async def dispatch_n8n_test(payload: Optional[N8nTestPayload] = None):
    """
    Triggers a test webhook from CareerPilot FastAPI to the local n8n instance.
    Standard payload: {"event": "careerpilot_test", "message": "CareerPilot connected to n8n"}.
    """
    data = payload or N8nTestPayload()
    webhook_path = data.event.replace("_", "-")
    result = await N8nService.dispatch_event(
        event_name=data.event,
        payload=data.model_dump(),
        webhook_path=webhook_path,
    )
    return {
        "dispatched_event": data.event,
        "payload": data.model_dump(),
        "n8n_result": result,
    }


@router.post("/webhook/incoming")
async def handle_incoming_n8n_webhook(
    payload: N8nIncomingWebhook,
    x_n8n_webhook_secret: Optional[str] = Header(None, alias="X-N8N-Webhook-Secret"),
):
    """
    Receives incoming webhook callbacks from n8n workflows.
    Enforces webhook secret authentication and strict Human-in-the-Loop policy.
    """
    # 1. Verify Secret
    if not N8nService.verify_webhook_secret(x_n8n_webhook_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-N8N-Webhook-Secret header",
        )

    # 2. Enforce HITL Guardrails
    guard_check = N8nService.enforce_hitl_guardrail(
        action=payload.action,
        human_approved=payload.human_approved,
        approver_id=payload.approver_id,
    )
    if not guard_check["allowed"]:
        return {
            "status": "BLOCKED_BY_GUARDRAIL",
            "message": guard_check["reason"],
            "action": payload.action,
            "requires_human_approval": True,
        }

    return {
        "status": "ACCEPTED",
        "action": payload.action,
        "candidate_id": payload.candidate_id,
        "human_approved": payload.human_approved,
        "message": f"Action '{payload.action}' accepted by CareerPilot gateway.",
    }
