"""
Phase 23 – Job Ingestion Pipeline API
Provides endpoints to:
  - Trigger a source run (ingesting from a specific registered source)
  - List and manage ApplicationQueue items (human-in-the-loop application workflow)
  - Monitor source run history and health metrics

Human-approval constraint:
  All consequential actions (mark-applied, bulk-submit) require an explicit
  user_confirmation flag to be True before state is advanced.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update, func
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime

from backend.app.db.session import get_db
from backend.app.models.job import JobSource, JobSourceRun, Job
from backend.app.models.application import ApplicationQueueItem
from backend.app.services.job_discovery.registry import JobSourceRegistry
from backend.app.core.logging import logger

router = APIRouter(tags=["Job Ingestion & Application Queue"])

# ---------------------------------------------------------------------------
# Schema helpers (inline Pydantic to avoid circular imports)
# ---------------------------------------------------------------------------
from pydantic import BaseModel, Field


class SourceRunTriggerRequest(BaseModel):
    source_id: str = Field(..., description="Catalogue source ID e.g. 'greenhouse_razorpay'")
    max_jobs: int = Field(50, ge=1, le=500, description="Maximum jobs to fetch in this run")
    dry_run: bool = Field(False, description="If true, fetch and normalise but do NOT persist to DB")


class SourceRunResponse(BaseModel):
    run_id: str
    source_id: str
    status: str
    jobs_fetched: int
    jobs_accepted: int
    jobs_rejected: int
    duplicates_count: int
    duration_ms: int
    started_at: str
    finished_at: str
    error_details: Optional[str] = None


class QueueItemCreate(BaseModel):
    candidate_id: str
    job_id: str
    priority: str = Field("MEDIUM", pattern="^(HIGH|MEDIUM|LOW)$")
    application_url: Optional[str] = None
    notes: Optional[str] = None


class QueueItemUpdate(BaseModel):
    priority: Optional[str] = Field(None, pattern="^(HIGH|MEDIUM|LOW)$")
    status: Optional[str] = None
    next_action: Optional[str] = None
    resume_version_id: Optional[str] = None
    referral_status: Optional[str] = None
    outreach_status: Optional[str] = None
    application_url: Optional[str] = None
    notes: Optional[str] = None
    user_confirmation: Optional[bool] = None  # Human-in-the-loop approval gate


class QueueItemConfirmApply(BaseModel):
    """Explicit confirmation endpoint – enforces human-in-the-loop requirement."""
    queue_item_id: str
    user_confirmed: bool = Field(
        ...,
        description="Must be True – the candidate explicitly confirms submission intent",
    )


class QueueItemResponse(BaseModel):
    id: str
    candidate_id: str
    job_id: str
    priority: str
    status: str
    next_action: str
    resume_version_id: Optional[str]
    referral_status: Optional[str]
    outreach_status: Optional[str]
    application_url: Optional[str]
    application_method: str
    deadline: Optional[str]
    user_confirmation: bool
    confirmed_at: Optional[str]
    notes: Optional[str]
    created_at: str
    updated_at: str
    # Denormalised job fields for UI convenience
    job_company: Optional[str] = None
    job_role: Optional[str] = None
    job_location: Optional[str] = None
    job_india_relevance: Optional[str] = None
    job_is_fresher_eligible: Optional[bool] = None

    model_config = {"from_attributes": True}


class IngestSourceStatusResponse(BaseModel):
    source_id: str
    name: str
    source_type: str
    status: str
    last_run_at: Optional[str]
    last_success_at: Optional[str]
    jobs_fetched_total: int
    jobs_accepted_total: int
    duplicates_found_total: int
    avg_ingestion_time_ms: int
    error_message: Optional[str]


# ---------------------------------------------------------------------------
# Source Run Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/ingestion/run",
    response_model=SourceRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger a source ingestion run",
    description=(
        "Fetches, normalises, deduplicates and (optionally) persists jobs from a registered "
        "catalogue source.  Set dry_run=true to preview results without writing to the DB."
    ),
)
async def trigger_source_run(
    req: SourceRunTriggerRequest,
    session: AsyncSession = Depends(get_db),
):
    """Run an ingestion cycle for a specific registered source."""
    import time

    start_ts = time.monotonic()

    # Resolve adapter
    adapter = await JobSourceRegistry.get_adapter(req.source_id)
    if adapter is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No adapter found for source_id '{req.source_id}'. "
                   "Check CATALOG_100_SOURCES in the registry.",
        )

    jobs_fetched = 0
    jobs_accepted = 0
    jobs_rejected = 0
    duplicates_count = 0
    error_detail: Optional[str] = None
    run_status = "SUCCESS"

    try:
        # Fetch raw normalized job dicts from the adapter
        raw_jobs: List[Dict[str, Any]] = await adapter.fetch_jobs(
            query="", location="India", max_results=req.max_jobs
        )
        jobs_fetched = len(raw_jobs)

        if not req.dry_run and raw_jobs:
            from backend.app.services.job_discovery.normalizer import JobNormalizer
            from sqlalchemy import select as sa_select

            normalizer = JobNormalizer()

            for raw in raw_jobs:
                try:
                    normalized = normalizer.normalize(raw)
                    content_hash = normalized.get("content_hash") or normalized.get("dedup_hash")

                    if content_hash:
                        dup_stmt = sa_select(Job.id).where(Job.content_hash == content_hash)
                        dup_result = await session.execute(dup_stmt)
                        if dup_result.scalars().first():
                            duplicates_count += 1
                            continue

                    job = Job(
                        id=f"job_{uuid.uuid4().hex[:16]}",
                        company=normalized.get("company", "Unknown"),
                        role=normalized.get("role", normalized.get("title", "Unknown")),
                        location=normalized.get("location", "India"),
                        raw_description=normalized.get("raw_description", normalized.get("description", "")),
                        source_type=normalized.get("source_type", req.source_id),
                        source_name=normalized.get("source_name", req.source_id),
                        canonical_url=normalized.get("canonical_url"),
                        external_id=normalized.get("external_id"),
                        india_relevance=normalized.get("india_relevance", "INDIA_POSSIBLE"),
                        india_relevance_score=normalized.get("india_relevance_score", 0.5),
                        india_location=normalized.get("india_location"),
                        india_location_type=normalized.get("india_location_type"),
                        remote_india=normalized.get("remote_india", False),
                        country=normalized.get("country", "India"),
                        experience_min=normalized.get("experience_min"),
                        experience_max=normalized.get("experience_max"),
                        experience_category=normalized.get("experience_category"),
                        entry_level_score=normalized.get("entry_level_score", 0.0),
                        is_fresher_eligible=normalized.get("is_fresher_eligible", False),
                        fresher_eligibility_reason=normalized.get("fresher_eligibility_reason"),
                        content_hash=content_hash,
                        scam_score=normalized.get("scam_score", 0.0),
                        scam_risk_level=normalized.get("scam_risk_level", "LOW"),
                        has_safety_warnings=normalized.get("has_safety_warnings", False),
                        safety_warnings=normalized.get("safety_warnings", []),
                        is_active=True,
                    )
                    session.add(job)
                    jobs_accepted += 1
                except Exception as job_err:
                    logger.warning(f"Skipping malformed job from {req.source_id}: {job_err}")
                    jobs_rejected += 1

            await session.commit()

    except Exception as exc:
        logger.exception(f"Ingestion run failed for source '{req.source_id}'")
        run_status = "FAILED"
        error_detail = str(exc)
        jobs_rejected = jobs_fetched

    duration_ms = int((time.monotonic() - start_ts) * 1000)
    now = datetime.utcnow().isoformat()

    # Persist run record (skip for dry-runs)
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    if not req.dry_run:
        try:
            await JobSourceRegistry.record_run(
                session=session,
                source_id=req.source_id,
                status=run_status,
                jobs_fetched=jobs_fetched,
                jobs_accepted=jobs_accepted,
                jobs_rejected=jobs_rejected,
                duplicates_count=duplicates_count,
                duration_ms=duration_ms,
                error_details=error_detail,
            )
        except Exception as rec_err:
            logger.warning(f"Failed to record run metrics: {rec_err}")

    return SourceRunResponse(
        run_id=run_id,
        source_id=req.source_id,
        status=run_status,
        jobs_fetched=jobs_fetched,
        jobs_accepted=jobs_accepted,
        jobs_rejected=jobs_rejected,
        duplicates_count=duplicates_count,
        duration_ms=duration_ms,
        started_at=now,
        finished_at=datetime.utcnow().isoformat(),
        error_details=error_detail,
    )


@router.get(
    "/ingestion/sources",
    summary="List all registered catalogue sources and their health status",
)
async def list_sources(
    source_type: Optional[str] = Query(None, description="Filter by type: GREENHOUSE, LEVER, INDIA_BOARD"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: ACTIVE, PAUSED, ERROR"),
    limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_db),
):
    sources = await JobSourceRegistry.list_sources(
        session=session,
        status=status_filter,
        source_type=source_type,
        limit=limit,
    )
    return [
        {
            "source_id": s.source_id,
            "name": s.name,
            "source_type": s.source_type,
            "status": s.status,
            "last_run_at": s.last_run_at.isoformat() if s.last_run_at else None,
            "last_success_at": s.last_success_at.isoformat() if s.last_success_at else None,
            "jobs_fetched_total": s.jobs_fetched_total,
            "jobs_accepted_total": s.jobs_accepted_total,
            "duplicates_found_total": s.duplicates_found_total,
            "avg_ingestion_time_ms": s.avg_ingestion_time_ms,
            "error_message": s.error_message,
        }
        for s in sources
    ]


@router.get(
    "/ingestion/metrics",
    summary="Global ingestion pipeline health metrics for Admin dashboard",
)
async def get_ingestion_metrics(session: AsyncSession = Depends(get_db)):
    return await JobSourceRegistry.get_metrics(session=session)


@router.get(
    "/ingestion/runs",
    summary="List recent source ingestion run history",
)
async def list_source_runs(
    source_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
):
    stmt = select(JobSourceRun).order_by(desc(JobSourceRun.started_at)).limit(limit)
    if source_id:
        stmt = stmt.where(JobSourceRun.source_id == source_id)
    result = await session.execute(stmt)
    runs = result.scalars().all()
    return [
        {
            "run_id": r.id,
            "source_id": r.source_id,
            "status": r.status,
            "jobs_fetched": r.jobs_fetched,
            "jobs_accepted": r.jobs_accepted,
            "jobs_rejected": r.jobs_rejected,
            "duplicates_count": r.duplicates_count,
            "duration_ms": r.duration_ms,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "error_details": r.error_details,
        }
        for r in runs
    ]


# ---------------------------------------------------------------------------
# Application Queue Endpoints
# ---------------------------------------------------------------------------


def _queue_item_to_response(q: ApplicationQueueItem) -> QueueItemResponse:
    job: Optional[Job] = getattr(q, "job", None)
    return QueueItemResponse(
        id=q.id,
        candidate_id=q.candidate_id,
        job_id=q.job_id,
        priority=q.priority,
        status=q.status,
        next_action=q.next_action,
        resume_version_id=q.resume_version_id,
        referral_status=q.referral_status,
        outreach_status=q.outreach_status,
        application_url=q.application_url,
        application_method=q.application_method,
        deadline=q.deadline.isoformat() if q.deadline else None,
        user_confirmation=q.user_confirmation,
        confirmed_at=q.confirmed_at.isoformat() if q.confirmed_at else None,
        notes=q.notes,
        created_at=q.created_at.isoformat(),
        updated_at=q.updated_at.isoformat(),
        job_company=job.company if job else None,
        job_role=job.role if job else None,
        job_location=job.location if job else None,
        job_india_relevance=job.india_relevance if job else None,
        job_is_fresher_eligible=job.is_fresher_eligible if job else None,
    )


@router.post(
    "/ingestion/queue",
    response_model=QueueItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a job to the high-throughput application preparation queue",
)
async def enqueue_job(
    req: QueueItemCreate,
    session: AsyncSession = Depends(get_db),
):
    # Validate job exists
    job = await session.get(Job, req.job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{req.job_id}' not found")

    item = ApplicationQueueItem(
        id=f"aq_{uuid.uuid4().hex[:16]}",
        candidate_id=req.candidate_id,
        job_id=req.job_id,
        priority=req.priority,
        status="READY",
        next_action="Review Job Requirements",
        application_url=req.application_url or job.application_url,
        notes=req.notes,
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return _queue_item_to_response(item)


@router.get(
    "/ingestion/queue",
    response_model=List[QueueItemResponse],
    summary="List application queue items for a candidate",
)
async def list_queue(
    candidate_id: str = Query(..., description="Candidate UUID"),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_db),
):
    stmt = (
        select(ApplicationQueueItem)
        .where(ApplicationQueueItem.candidate_id == candidate_id)
        .order_by(
            # HIGH priority first, then by creation date
            desc(ApplicationQueueItem.priority == "HIGH"),
            desc(ApplicationQueueItem.created_at),
        )
        .limit(limit)
        .offset(offset)
    )
    if status_filter:
        stmt = stmt.where(ApplicationQueueItem.status == status_filter.upper())
    if priority:
        stmt = stmt.where(ApplicationQueueItem.priority == priority.upper())

    result = await session.execute(stmt)
    return [_queue_item_to_response(q) for q in result.scalars().all()]


@router.get(
    "/ingestion/queue/{queue_item_id}",
    response_model=QueueItemResponse,
    summary="Get a single queue item",
)
async def get_queue_item(
    queue_item_id: str,
    session: AsyncSession = Depends(get_db),
):
    item = await session.get(ApplicationQueueItem, queue_item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Queue item '{queue_item_id}' not found")
    return _queue_item_to_response(item)


@router.patch(
    "/ingestion/queue/{queue_item_id}",
    response_model=QueueItemResponse,
    summary="Update queue item status, resume, referral, or notes",
)
async def update_queue_item(
    queue_item_id: str,
    req: QueueItemUpdate,
    session: AsyncSession = Depends(get_db),
):
    item = await session.get(ApplicationQueueItem, queue_item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Queue item '{queue_item_id}' not found")

    # Guard: block status advancement to APPLIED without explicit confirmation
    if req.status == "MANUAL_SUBMIT" or req.status == "APPLIED":
        if not (req.user_confirmation or item.user_confirmation):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Human confirmation required before advancing to APPLIED. "
                       "Use the /confirm-apply endpoint or set user_confirmation=true.",
            )

    updates = req.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(item, field, value)

    if req.user_confirmation and not item.confirmed_at:
        item.confirmed_at = datetime.utcnow()

    await session.commit()
    await session.refresh(item)
    return _queue_item_to_response(item)


@router.post(
    "/ingestion/queue/confirm-apply",
    response_model=QueueItemResponse,
    summary="Explicit human confirmation gate – mark queue item ready for final submission",
    description=(
        "Human-in-the-loop confirmation step. The candidate must explicitly call "
        "this endpoint to advance the queue item to MANUAL_SUBMIT status. "
        "The system NEVER auto-submits applications."
    ),
)
async def confirm_apply(
    req: QueueItemConfirmApply,
    session: AsyncSession = Depends(get_db),
):
    if not req.user_confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_confirmed must be True. CareerPilot requires explicit human approval before application submission.",
        )

    item = await session.get(ApplicationQueueItem, req.queue_item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Queue item '{req.queue_item_id}' not found")

    item.user_confirmation = True
    item.confirmed_at = datetime.utcnow()
    item.status = "MANUAL_SUBMIT"
    item.next_action = "Open application URL and submit manually"
    await session.commit()
    await session.refresh(item)
    return _queue_item_to_response(item)


@router.delete(
    "/ingestion/queue/{queue_item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a job from the application queue",
)
async def remove_from_queue(
    queue_item_id: str,
    session: AsyncSession = Depends(get_db),
):
    item = await session.get(ApplicationQueueItem, queue_item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Queue item '{queue_item_id}' not found")
    await session.delete(item)
    await session.commit()


@router.get(
    "/ingestion/queue/stats/summary",
    summary="Application queue summary stats for a candidate",
)
async def queue_stats(
    candidate_id: str = Query(...),
    session: AsyncSession = Depends(get_db),
):
    stmt = (
        select(ApplicationQueueItem.status, func.count(ApplicationQueueItem.id))
        .where(ApplicationQueueItem.candidate_id == candidate_id)
        .group_by(ApplicationQueueItem.status)
    )
    result = await session.execute(stmt)
    rows = result.all()
    counts = {row[0]: row[1] for row in rows}
    total = sum(counts.values())
    return {
        "total": total,
        "by_status": counts,
        "confirmed": sum(v for k, v in counts.items() if k in ("MANUAL_SUBMIT", "APPLIED")),
        "pending_review": counts.get("READY", 0) + counts.get("NEEDS_REVIEW", 0),
        "needs_resume": counts.get("NEEDS_RESUME", 0),
        "needs_referral": counts.get("NEEDS_REFERRAL", 0),
    }
