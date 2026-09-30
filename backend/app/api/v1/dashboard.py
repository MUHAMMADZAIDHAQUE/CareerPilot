from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from backend.app.db.session import get_db
from backend.app.services.dashboard_service import DashboardService
from backend.app.schemas.dashboard import DashboardSummaryResponse

from backend.app.api.deps import get_optional_current_user
from backend.app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["Main Dashboard"])


@router.get("", response_model=DashboardSummaryResponse)
@router.get("/", response_model=DashboardSummaryResponse)
@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    candidate_id: Optional[str] = Query(None, description="Optional candidate ID"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Returns the comprehensive CareerPilot main dashboard summary:
    1. Profile completion
    2. Jobs discovered
    3. Strong job matches
    4. Applications (CRM)
    5. Referral opportunities
    6. Outreach requiring approval
    7. Interviews
    8. Skill gaps
    9. Recommended projects
    10. Follow-ups
    Along with full pipeline counts for the 10-step career progression workflow.
    """
    resolved_candidate_id = candidate_id
    if not resolved_candidate_id and current_user and current_user.candidate:
        resolved_candidate_id = current_user.candidate.id

    return await DashboardService.get_dashboard_summary(db, candidate_id=resolved_candidate_id)

