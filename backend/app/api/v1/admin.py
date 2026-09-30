from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional, Dict, Any

from backend.app.api.deps import get_db, get_current_admin
from backend.app.models.user import User, UserRole
from backend.app.models.candidate import Candidate
from backend.app.models.job import Job
from backend.app.models.application import Application
from backend.app.models.outreach import OutreachDraft, OutreachAuditEvent
from backend.app.schemas.user import UserRead, UserStatusUpdateRequest, AdminDashboardKPI
from backend.app.services.n8n import N8nService
from backend.app.core.config import settings
from backend.app.core.logging import logger

router = APIRouter(prefix="/admin", tags=["Admin Panel & Governance"])


@router.get(
    "/dashboard",
    response_model=AdminDashboardKPI,
    summary="Admin System KPI Dashboard",
    description="Returns high-level operator metrics: total users, jobs, applications, and automation status.",
)
async def get_admin_dashboard(
    current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> AdminDashboardKPI:
    # 1. User metrics
    total_users_q = await session.execute(select(func.count(User.id)))
    total_users = total_users_q.scalar() or 0

    active_users_q = await session.execute(select(func.count(User.id)).where(User.is_active == True))
    active_users = active_users_q.scalar() or 0

    # 2. Candidate profiles
    total_cand_q = await session.execute(select(func.count(Candidate.id)))
    total_candidates = total_cand_q.scalar() or 0

    # 3. Discovered jobs
    total_jobs_q = await session.execute(select(func.count(Job.id)))
    total_jobs = total_jobs_q.scalar() or 0

    # 4. Applications tracked
    total_apps_q = await session.execute(select(func.count(Application.id)))
    total_applications = total_apps_q.scalar() or 0

    # 5. Outreach drafts
    total_outreach_q = await session.execute(select(func.count(OutreachDraft.id)))
    total_outreach = total_outreach_q.scalar() or 0

    # 6. n8n status
    n8n_ok = N8nService.is_enabled()

    return AdminDashboardKPI(
        total_users=total_users,
        active_users=active_users,
        total_candidates=total_candidates,
        total_jobs=total_jobs,
        total_applications=total_applications,
        total_outreach_drafts=total_outreach,
        n8n_connected=n8n_ok,
        system_status="OPERATIONAL",
        environment=settings.ENVIRONMENT,
    )


@router.get(
    "/users",
    response_model=List[UserRead],
    summary="List and Filter Users",
    description="Allows administrators to search and filter registered users by email or role.",
)
async def list_users(
    search: Optional[str] = Query(None, description="Search user email"),
    role: Optional[str] = Query(None, description="Filter by role: CANDIDATE | ADMIN"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> List[UserRead]:
    stmt = select(User).order_by(desc(User.created_at)).offset(offset).limit(limit)
    if search:
        stmt = stmt.where(User.email.ilike(f"%{search.strip()}%"))
    if role:
        stmt = stmt.where(User.role == role.upper())

    res = await session.execute(stmt)
    users = res.scalars().all()

    return [
        UserRead(
            id=u.id,
            email=u.email,
            role=u.role,
            is_active=u.is_active,
            is_verified=u.is_verified,
            candidate_id=u.candidate.id if u.candidate else None,
            created_at=u.created_at,
        )
        for u in users
    ]


@router.patch(
    "/users/{user_id}/status",
    response_model=UserRead,
    summary="Update User Account Status or Role",
    description="Enables administrator to activate/deactivate an account or adjust roles.",
)
async def update_user_status(
    user_id: str,
    payload: UserStatusUpdateRequest,
    current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> UserRead:
    stmt = select(User).where(User.id == user_id)
    res = await session.execute(stmt)
    target_user = res.scalars().first()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found.",
        )

    # Protect against self-deactivation by the only admin
    if target_user.id == current_admin.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own active account.",
        )

    if payload.is_active is not None:
        target_user.is_active = payload.is_active
    if payload.role is not None:
        if payload.role.upper() not in UserRole.ALL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role. Allowed roles: {', '.join(UserRole.ALL)}",
            )
        target_user.role = payload.role.upper()

    session.add(target_user)
    await session.commit()
    await session.refresh(target_user)

    return UserRead(
        id=target_user.id,
        email=target_user.email,
        role=target_user.role,
        is_active=target_user.is_active,
        is_verified=target_user.is_verified,
        candidate_id=target_user.candidate.id if target_user.candidate else None,
        created_at=target_user.created_at,
    )


@router.get(
    "/audit-logs",
    summary="Query System Audit Logs",
    description="Retrieves security, outreach, and user governance audit events.",
)
async def list_audit_logs(
    limit: int = Query(50, ge=1, le=100),
    current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    stmt = select(OutreachAuditEvent).order_by(desc(OutreachAuditEvent.created_at)).limit(limit)
    res = await session.execute(stmt)
    events = res.scalars().all()

    return [
        {
            "id": e.id,
            "event_type": e.event_type,
            "actor": e.actor,
            "draft_id": e.draft_id,
            "candidate_id": e.candidate_id,
            "payload": e.payload,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]


@router.get(
    "/system-health",
    summary="Detailed Operator System Health",
    description="Returns detailed infrastructure status, database connectivity, and automation queue health.",
)
async def get_system_health(
    current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    from backend.app.db.session import check_db_health
    db_health = await check_db_health()
    return {
        "status": "HEALTHY" if db_health.get("status") == "connected" else "DEGRADED",
        "database": db_health,
        "n8n": {
            "enabled": N8nService.is_enabled(),
            "base_url": settings.N8N_BASE_URL,
        },
        "environment": settings.ENVIRONMENT,
        "version": settings.VERSION,
    }
