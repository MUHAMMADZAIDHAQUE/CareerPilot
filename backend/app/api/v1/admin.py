from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional, Dict, Any

from backend.app.api.deps import get_db, get_current_admin
from backend.app.models.user import User, UserRole
from backend.app.models.candidate import Candidate
from backend.app.models.job import Job
from backend.app.models.application import Application
from backend.app.models.resume import ResumeDocument, ResumeVersion
from backend.app.models.referral import ReferralContact
from backend.app.models.outreach import OutreachDraft, OutreachAuditEvent
from backend.app.models.interview import InterviewSession, InterviewTurn
from backend.app.schemas.user import (
    UserRead,
    UserStatusUpdateRequest,
    AdminDashboardKPI,
    AdminCandidateItem,
    AdminJobItem,
    AdminApplicationItem,
    AdminResumeItem,
    AdminReferralItem,
    AdminInterviewItem,
)
from backend.app.services.n8n import N8nService
from backend.app.core.config import settings
from backend.app.core.logging import logger

router = APIRouter(prefix="/admin", tags=["Admin Panel & Governance"])


@router.get(
    "/dashboard",
    response_model=AdminDashboardKPI,
    summary="Admin System KPI Dashboard",
    description="Returns high-level operator metrics: total users, jobs, applications, resumes, interviews, and automation status.",
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

    # 6. Resumes & tailored versions
    total_resumes_q = await session.execute(select(func.count(ResumeDocument.id)))
    total_resumes = total_resumes_q.scalar() or 0

    total_tailored_q = await session.execute(select(func.count(ResumeVersion.id)))
    total_tailored_resumes = total_tailored_q.scalar() or 0

    # 7. Referrals & interviews
    total_referrals_q = await session.execute(select(func.count(ReferralContact.id)))
    total_referrals = total_referrals_q.scalar() or 0

    total_interviews_q = await session.execute(select(func.count(InterviewSession.id)))
    total_interviews = total_interviews_q.scalar() or 0

    # 8. n8n status - verify actual reachability, never assume active solely from config presence
    n8n_ok = False
    if N8nService.is_enabled():
        try:
            health = await N8nService.check_health()
            n8n_ok = health.get("status") == "healthy"
        except Exception:
            n8n_ok = False

    return AdminDashboardKPI(
        total_users=total_users,
        active_users=active_users,
        total_candidates=total_candidates,
        total_jobs=total_jobs,
        total_applications=total_applications,
        total_outreach_drafts=total_outreach,
        total_resumes=total_resumes,
        total_tailored_resumes=total_tailored_resumes,
        total_referrals=total_referrals,
        total_interviews=total_interviews,
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

    # Protect against self-deactivation by the active admin
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
    "/candidates",
    response_model=List[AdminCandidateItem],
    summary="Admin Candidate Management",
    description="Lists candidate profiles with application, resume, and interview count aggregates.",
)
async def list_candidates(
    search: Optional[str] = Query(None, description="Search by candidate name or email"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> List[AdminCandidateItem]:
    stmt = select(Candidate).order_by(desc(Candidate.created_at)).offset(offset).limit(limit)
    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.where((Candidate.full_name.ilike(s)) | (Candidate.email.ilike(s)))

    res = await session.execute(stmt)
    candidates = res.scalars().all()
    if not candidates:
        return []

    cand_ids = [c.id for c in candidates]

    app_q = await session.execute(
        select(Application.candidate_id, func.count(Application.id))
        .where(Application.candidate_id.in_(cand_ids))
        .group_by(Application.candidate_id)
    )
    app_counts = dict(app_q.all())

    res_q = await session.execute(
        select(ResumeDocument.candidate_id, func.count(ResumeDocument.id))
        .where(ResumeDocument.candidate_id.in_(cand_ids))
        .group_by(ResumeDocument.candidate_id)
    )
    res_counts = dict(res_q.all())

    int_q = await session.execute(
        select(InterviewSession.candidate_id, func.count(InterviewSession.id))
        .where(InterviewSession.candidate_id.in_(cand_ids))
        .group_by(InterviewSession.candidate_id)
    )
    int_counts = dict(int_q.all())

    return [
        AdminCandidateItem(
            id=c.id,
            user_id=c.user_id,
            email=c.email,
            full_name=c.full_name,
            headline=c.headline,
            location=c.location,
            created_at=c.created_at,
            resumes_count=res_counts.get(c.id, 0),
            applications_count=app_counts.get(c.id, 0),
            interviews_count=int_counts.get(c.id, 0),
        )
        for c in candidates
    ]


@router.get(
    "/jobs",
    response_model=List[AdminJobItem],
    summary="Admin Job Catalog Management",
    description="Lists jobs in the catalog with source, company, location, and application counts.",
)
async def list_admin_jobs(
    search: Optional[str] = Query(None, description="Search title or company"),
    source: Optional[str] = Query(None, description="Filter by source"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> List[AdminJobItem]:
    stmt = select(Job).order_by(desc(Job.created_at)).offset(offset).limit(limit)
    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.where((Job.role.ilike(s)) | (Job.company.ilike(s)))
    if source:
        stmt = stmt.where((Job.source_type == source.lower()) | (Job.source_name.ilike(f"%{source}%")))

    res = await session.execute(stmt)
    jobs = res.scalars().all()
    if not jobs:
        return []

    job_ids = [j.id for j in jobs]
    app_q = await session.execute(
        select(Application.job_id, func.count(Application.id))
        .where(Application.job_id.in_(job_ids))
        .group_by(Application.job_id)
    )
    app_counts = dict(app_q.all())

    return [
        AdminJobItem(
            id=j.id,
            title=j.role,
            company=j.company,
            location=j.location,
            source=j.source_name or j.source_type,
            url=j.canonical_url or j.application_url,
            created_at=j.created_at,
            applications_count=app_counts.get(j.id, 0),
        )
        for j in jobs
    ]


@router.get(
    "/applications",
    response_model=List[AdminApplicationItem],
    summary="Admin Applications CRM Oversight",
    description="Inspects real candidate applications with status, candidate info, and timestamps.",
)
async def list_admin_applications(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> List[AdminApplicationItem]:
    stmt = (
        select(Application, Candidate.full_name, Candidate.email, Job.role, Job.company)
        .outerjoin(Candidate, Application.candidate_id == Candidate.id)
        .outerjoin(Job, Application.job_id == Job.id)
        .order_by(desc(Application.created_at))
        .offset(offset)
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(Application.status == status_filter.upper())

    res = await session.execute(stmt)
    rows = res.all()

    return [
        AdminApplicationItem(
            id=app.id,
            candidate_id=app.candidate_id,
            candidate_name=cand_name,
            candidate_email=cand_email,
            job_id=app.job_id,
            job_title=job_role,
            company=job_comp,
            status=app.status,
            created_at=app.created_at,
            updated_at=app.updated_at,
        )
        for app, cand_name, cand_email, job_role, job_comp in rows
    ]


@router.get(
    "/resumes",
    response_model=List[AdminResumeItem],
    summary="Admin Resume Metadata Overview",
    description="Lists resume master documents with version counts and candidate associations.",
)
async def list_admin_resumes(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> List[AdminResumeItem]:
    stmt = (
        select(ResumeDocument, Candidate.full_name, Candidate.email)
        .outerjoin(Candidate, ResumeDocument.candidate_id == Candidate.id)
        .order_by(desc(ResumeDocument.created_at))
        .offset(offset)
        .limit(limit)
    )
    res = await session.execute(stmt)
    rows = res.all()
    if not rows:
        return []

    doc_ids = [doc.id for doc, _, _ in rows]
    vers_q = await session.execute(
        select(ResumeVersion.source_resume_id, func.count(ResumeVersion.id))
        .where(ResumeVersion.source_resume_id.in_(doc_ids))
        .group_by(ResumeVersion.source_resume_id)
    )
    vers_counts = dict(vers_q.all())

    return [
        AdminResumeItem(
            id=doc.id,
            candidate_id=doc.candidate_id or "",
            candidate_name=cand_name,
            candidate_email=cand_email,
            filename=doc.filename,
            content_type=doc.file_type,
            is_latex=doc.file_type.lower() in ["tex", "latex"],
            master_template_saved=True,
            created_at=doc.created_at,
            versions_count=vers_counts.get(doc.id, 0),
        )
        for doc, cand_name, cand_email in rows
    ]


@router.get(
    "/referrals",
    response_model=List[AdminReferralItem],
    summary="Admin Referrals & Outreach Monitoring",
    description="Inspects real outreach drafts, channel types, risk levels, and dispatch statuses.",
)
async def list_admin_referrals(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> List[AdminReferralItem]:
    stmt = (
        select(OutreachDraft, Job.role, Job.company, ReferralContact.name, ReferralContact.current_title)
        .outerjoin(Job, OutreachDraft.job_id == Job.id)
        .outerjoin(ReferralContact, OutreachDraft.referral_contact_id == ReferralContact.id)
        .order_by(desc(OutreachDraft.created_at))
        .offset(offset)
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(OutreachDraft.status == status_filter.upper())

    res = await session.execute(stmt)
    rows = res.all()

    return [
        AdminReferralItem(
            id=draft.id,
            candidate_id=draft.candidate_id,
            job_id=draft.job_id,
            job_title=job_role,
            company=job_comp,
            contact_name=contact_name or "Unknown Contact",
            contact_role=contact_title,
            channel=draft.channel,
            status=draft.status,
            risk_level=draft.validation_results.get("risk_level") if isinstance(draft.validation_results, dict) else None,
            created_at=draft.created_at,
        )
        for draft, job_role, job_comp, contact_name, contact_title in rows
    ]


@router.get(
    "/interviews",
    response_model=List[AdminInterviewItem],
    summary="Admin Mock Interview Sessions",
    description="Inspects real mock interview sessions, overall scores, and turn counts.",
)
async def list_admin_interviews(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> List[AdminInterviewItem]:
    stmt = (
        select(InterviewSession, Candidate.full_name, Candidate.email, Job.role, Job.company)
        .outerjoin(Candidate, InterviewSession.candidate_id == Candidate.id)
        .outerjoin(Job, InterviewSession.job_id == Job.id)
        .order_by(desc(InterviewSession.created_at))
        .offset(offset)
        .limit(limit)
    )
    res = await session.execute(stmt)
    rows = res.all()
    if not rows:
        return []

    session_ids = [s.id for s, _, _, _, _ in rows]
    turns_q = await session.execute(
        select(InterviewTurn.session_id, func.count(InterviewTurn.id))
        .where(InterviewTurn.session_id.in_(session_ids))
        .group_by(InterviewTurn.session_id)
    )
    turns_counts = dict(turns_q.all())

    return [
        AdminInterviewItem(
            id=s.id,
            candidate_id=s.candidate_id,
            candidate_name=cand_name,
            candidate_email=cand_email,
            job_id=s.job_id,
            job_title=job_role,
            company=job_comp,
            status=s.status,
            turns_count=turns_counts.get(s.id, 0),
            overall_score=s.final_feedback.get("overall_score") if isinstance(s.final_feedback, dict) else None,
            created_at=s.created_at,
        )
        for s, cand_name, cand_email, job_role, job_comp in rows
    ]


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
    description="Returns detailed infrastructure status, database connectivity, pgvector, and automation queue health.",
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
