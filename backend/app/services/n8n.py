import httpx
import logging
from typing import Dict, Any, Optional
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# Strict safety constant: Actions strictly prohibited from autonomous execution
HITL_PROTECTED_ACTIONS = {
    "submit_job_application",
    "send_linkedin_message",
    "send_referral_message",
    "send_email",
    "dispatch_outreach",
}


class N8nService:
    """
    Client service for local self-hosted n8n Community Edition orchestration.
    Maintains FastAPI as the single source of truth and enforces strict Human-in-the-Loop (HITL) guards.
    """

    @classmethod
    def is_enabled(cls) -> bool:
        return bool(settings.N8N_ENABLED)

    @classmethod
    async def check_health(cls) -> Dict[str, Any]:
        """Checks whether the local n8n instance is reachable and healthy."""
        if not cls.is_enabled():
            return {
                "enabled": False,
                "status": "disabled",
                "message": "n8n integration is disabled in settings.",
                "url": settings.N8N_BASE_URL,
            }

        url = f"{settings.N8N_BASE_URL.rstrip('/')}/healthz"
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    data = {}
                    try:
                        data = res.json()
                    except Exception:
                        data = {"text": res.text}
                    return {
                        "enabled": True,
                        "status": "healthy",
                        "http_code": 200,
                        "url": settings.N8N_BASE_URL,
                        "data": data,
                    }
                else:
                    return {
                        "enabled": True,
                        "status": "unhealthy",
                        "http_code": res.status_code,
                        "url": settings.N8N_BASE_URL,
                    }
        except httpx.ConnectError:
            return {
                "enabled": True,
                "status": "offline",
                "message": f"Could not connect to local n8n at {settings.N8N_BASE_URL}. Service is not running.",
                "url": settings.N8N_BASE_URL,
            }
        except Exception as e:
            logger.warning(f"Error checking n8n health: {str(e)}")
            return {
                "enabled": True,
                "status": "error",
                "message": str(e),
                "url": settings.N8N_BASE_URL,
            }

    @classmethod
    def verify_webhook_secret(cls, header_secret: Optional[str]) -> bool:
        """Validates incoming webhook secret against configured environment secret."""
        if not settings.N8N_WEBHOOK_SECRET:
            return True
        return header_secret == settings.N8N_WEBHOOK_SECRET

    @classmethod
    def enforce_hitl_guardrail(
        cls,
        action: str,
        human_approved: bool = False,
        approver_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Enforces Rule 11: n8n must NEVER autonomously submit job applications,
        send LinkedIn messages, referral messages, or emails without explicit human approval.
        """
        action_normalized = action.lower().strip()
        if action_normalized in HITL_PROTECTED_ACTIONS and not human_approved:
            logger.warning(
                f"[GUARDRAIL TRIGGERED] Autonomous execution of '{action}' rejected. "
                "Explicit human approval required."
            )
            return {
                "allowed": False,
                "action": action,
                "status": "REJECTED_HITL_REQUIRED",
                "reason": (
                    f"Action '{action}' is protected under zero-hallucination HITL policy. "
                    "n8n workflows may only prepare drafts and notify the candidate for approval."
                ),
            }

        return {
            "allowed": True,
            "action": action,
            "status": "APPROVED",
            "approver_id": approver_id,
        }

    @classmethod
    async def dispatch_event(
        cls,
        event_name: str,
        payload: Dict[str, Any],
        webhook_path: Optional[str] = None,
        target_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Dispatches an event payload from CareerPilot FastAPI to an n8n webhook.
        """
        if not cls.is_enabled():
            return {
                "success": False,
                "error": "n8n is disabled",
            }

        resolved_path = target_path or webhook_path or event_name
        url = f"{settings.N8N_WEBHOOK_BASE_URL.rstrip('/')}/{resolved_path.lstrip('/')}"

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "CareerPilot-FastAPI/1.0",
            "X-CareerPilot-Event": event_name,
        }
        if settings.N8N_WEBHOOK_SECRET:
            headers["X-N8N-Webhook-Secret"] = settings.N8N_WEBHOOK_SECRET

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                try:
                    res_data = res.json()
                except Exception:
                    res_data = res.text

                return {
                    "success": res.status_code in (200, 201),
                    "status_code": res.status_code,
                    "url": url,
                    "response": res_data,
                }
        except httpx.ConnectError:
            return {
                "success": False,
                "error": f"Cannot connect to n8n webhook at {url}. Ensure n8n is running.",
            }
        except Exception as e:
            logger.error(f"Failed to dispatch event to n8n: {str(e)}")
            return {
                "success": False,
                "error": str(e),
            }
