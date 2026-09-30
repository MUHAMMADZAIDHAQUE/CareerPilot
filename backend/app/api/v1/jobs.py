from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional

from backend.app.db.session import get_db
from backend.app.schemas.job import (
    JobAnalyzeRequest,
    JobResponse,
    JobUrlImportRequest,
    JobUrlImportResponse,
    JobBulkImportRequest,
    JobBulkImportResponse,
    RecommendedJobsResponse,
    JobDiscoveryRequest,
    JobAlertItem,
    JobDiscoveryResponse,
    JobSearchFilterRequest,
    JobSearchFilterResponse,
    SourceCapabilityResponse,
    JobSaveRequest,
    JobIgnoreRequest,
    JobAlertCreate,
    JobAlertUpdate,
    JobAlertResponse,
)
from backend.app.schemas.matching import (
    MatchRequest,
    MatchResponse,
)
from backend.app.models.job import Job, MatchResult
from backend.app.services.job_analyzer_service import JobAnalyzerService
from backend.app.services.matching_service import MatchingService
from backend.app.services.job_discovery import JobDiscoveryService
from backend.app.core.logging import logger

router = APIRouter(tags=["Jobs & Discovery Engine"])


# -----------------------------------------------------------------------------
# Phase 16B: Multi-Source Discovery & Sourcing Endpoints
# -----------------------------------------------------------------------------

@router.post(
    "/jobs/discover",
    response_model=JobDiscoveryResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger modular multi-source job discovery and matching",
    description="Runs multi-source discovery (LinkedIn, FreshersHunt, Careers, Indeed), normalizes, deduplicates, extracts requirements, matches against candidate, and formats alerts.",
)
async def discover_jobs(
    payload: Optional[JobDiscoveryRequest] = None,
    session: AsyncSession = Depends(get_db),
):
    req = payload or JobDiscoveryRequest()
    try:
        return await JobDiscoveryService.discover_multi_source(
            session=session,
            sources=req.sources,
            candidate_id=req.candidate_id,
            min_match_score=req.min_match_score,
            batch_limit=req.batch_limit,
        )
    except Exception as e:
        logger.error(f"Error in multi-source job discovery: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Job discovery failed: {str(e)}",
        )


@router.get(
    "/jobs/sources/status",
    summary="Get operational status of all modular job source adapters",
    description="Returns status, health diagnostics, and enablement configuration for each source.",
)
async def get_source_adapters_status():
    return await JobDiscoveryService.get_source_adapters_status()


# -----------------------------------------------------------------------------
# Phase 8: Discovery & Ingestion Endpoints
# -----------------------------------------------------------------------------

@router.post(
    "/jobs/import-url",
    response_model=JobUrlImportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Import and analyze a job posting from a URL",
    description="Fetches, canonicalizes, deduplicates, and analyzes a job from a user-provided URL.",
)
async def import_job_from_url(
    payload: JobUrlImportRequest,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await JobDiscoveryService.import_job_from_url(
            session=session,
            request=payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error importing job from URL '{payload.url}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import job from URL: {str(e)}",
        )


@router.post(
    "/jobs/import",
    response_model=JobBulkImportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Batch import jobs from public feeds, career portals, or custom sources",
    description="Batch ingests jobs into the common schema with deduplication and expiration checks.",
)
async def import_jobs_bulk(
    payload: JobBulkImportRequest,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await JobDiscoveryService.import_bulk_jobs(
            session=session,
            request=payload,
        )
    except Exception as e:
        logger.error(f"Error in batch job import: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch import failure: {str(e)}",
        )


@router.get(
    "/jobs/recommended",
    response_model=RecommendedJobsResponse,
    summary="Get candidate-tailored job recommendations",
    description="Ranks discovered jobs by candidate match score with skill gaps and justification.",
)
async def get_recommended_jobs(
    candidate_id: Optional[str] = Query(None, description="Candidate ID to score against"),
    min_score: float = Query(0.0, ge=0.0, le=100.0, description="Minimum overall match score filter"),
    limit: int = Query(30, ge=1, le=100, description="Max recommendations to return"),
    session: AsyncSession = Depends(get_db),
):
    try:
        return await JobDiscoveryService.get_recommended_jobs(
            session=session,
            candidate_id=candidate_id,
            min_score=min_score,
            limit=limit,
        )
    except Exception as e:
        logger.error(f"Error retrieving recommended jobs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get recommendations: {str(e)}",
        )


# -----------------------------------------------------------------------------
# Existing Analyzer & Matching Endpoints
# -----------------------------------------------------------------------------

@router.post(
    "/jobs/analyze",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Analyze and parse a job description",
    description="Extracts structured company, role, requirements, skills (required vs preferred vs inferred), and metadata."
)
async def analyze_job(
    payload: JobAnalyzeRequest,
    session: AsyncSession = Depends(get_db),
):
    try:
        job = await JobAnalyzerService.analyze_and_store_job(
            session=session,
            job_description=payload.job_description,
            job_url=payload.job_url,
            company=payload.company,
            role=payload.role,
        )
        return job
    except Exception as e:
        logger.error(f"Error analyzing job description: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze job description: {str(e)}"
        )


@router.post(
    "/jobs/{job_id}/match",
    response_model=MatchResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate candidate match against an analyzed job",
    description="Calculates deterministic match scores, skill coverage, pgvector semantic similarity, and grounded evidence."
)
async def match_job(
    job_id: str,
    payload: Optional[MatchRequest] = None,
    session: AsyncSession = Depends(get_db),
):
    try:
        cand_id = payload.candidate_id if payload else None
        weights = payload.weights if payload else None
        match_result = await MatchingService.match_candidate_to_job(
            session=session,
            job_id=job_id,
            candidate_id=cand_id,
            weights=weights,
        )
        return match_result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error matching candidate to job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Matching calculation failed: {str(e)}"
        )


@router.get(
    "/jobs/{job_id}/match",
    response_model=MatchResponse,
    summary="Get latest candidate match evaluation for a job"
)
async def get_latest_match(
    job_id: str,
    candidate_id: Optional[str] = None,
    session: AsyncSession = Depends(get_db),
):
    query = select(MatchResult).where(MatchResult.job_id == job_id).order_by(desc(MatchResult.created_at))
    if candidate_id:
        query = query.where(MatchResult.candidate_id == candidate_id)

    res = await session.execute(query)
    existing = res.scalars().first()
    if existing:
        return existing

    try:
        return await MatchingService.match_candidate_to_job(
            session=session,
            job_id=job_id,
            candidate_id=candidate_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error in get_latest_match: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# -----------------------------------------------------------------------------
# Phase 20: India Fresher Portal, Advanced Filters, and Alerts Endpoints
# -----------------------------------------------------------------------------

@router.post(
    "/jobs/search",
    response_model=JobSearchFilterResponse,
    summary="Advanced faceted job search for India Freshers & Tech roles",
    description="Filters across 11 sources, Fresher Mode, India cities, experience, work mode, and match score thresholding.",
)
async def search_jobs(
    payload: JobSearchFilterRequest,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await JobDiscoveryService.search_jobs_with_filters(
            session=session,
            filter_req=payload,
        )
    except Exception as e:
        logger.exception("Error executing advanced job search")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute job search: {str(e)}",
        )


@router.get(
    "/jobs/sources",
    response_model=List[SourceCapabilityResponse],
    summary="List all registered job sources and their capabilities",
    description="Returns capability matrices for LinkedIn, Naukri, Internshala, Freshersworld, Indeed, Company Careers, Wellfound, Foundit, Glassdoor, etc.",
)
async def get_job_sources():
    try:
        return JobDiscoveryService.get_all_source_capabilities()
    except Exception as e:
        logger.error(f"Error fetching source capabilities: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve job sources: {str(e)}",
        )


@router.get(
    "/jobs/sources/status",
    summary="Operational health diagnostics for all source adapters",
)
async def get_source_adapters_status():
    try:
        return await JobDiscoveryService.get_source_adapters_status()
    except Exception as e:
        logger.error(f"Error checking source adapter health: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check source adapters: {str(e)}",
        )


@router.post(
    "/jobs/save",
    summary="Save a discovered job to Application CRM with SAVED status",
)
async def save_job(
    payload: JobSaveRequest,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await JobDiscoveryService.save_job(session=session, req=payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error saving job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save job: {str(e)}",
        )


@router.post(
    "/jobs/ignore",
    summary="Ignore a discovered job opportunity",
)
async def ignore_job(
    payload: JobIgnoreRequest,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await JobDiscoveryService.ignore_job(session=session, req=payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error ignoring job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ignore job: {str(e)}",
        )


@router.get(
    "/job-alerts",
    response_model=List[JobAlertResponse],
    summary="List configured job search alerts",
)
async def list_job_alerts(
    candidate_id: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db),
):
    return await JobDiscoveryService.list_job_alerts(session=session, candidate_id=candidate_id)


@router.post(
    "/job-alerts",
    response_model=JobAlertResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new automated job search alert",
)
async def create_job_alert(
    payload: JobAlertCreate,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await JobDiscoveryService.create_job_alert(session=session, alert_in=payload)
    except Exception as e:
        logger.error(f"Error creating job alert: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create job alert: {str(e)}",
        )


@router.patch(
    "/job-alerts/{alert_id}",
    response_model=JobAlertResponse,
    summary="Update an existing job alert",
)
async def update_job_alert(
    alert_id: str,
    payload: JobAlertUpdate,
    session: AsyncSession = Depends(get_db),
):
    updated = await JobDiscoveryService.update_job_alert(session=session, alert_id=alert_id, alert_up=payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job alert '{alert_id}' not found.")
    return updated


@router.delete(
    "/job-alerts/{alert_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a job alert",
)
async def delete_job_alert(
    alert_id: str,
    session: AsyncSession = Depends(get_db),
):
    success = await JobDiscoveryService.delete_job_alert(session=session, alert_id=alert_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job alert '{alert_id}' not found.")
    return None


@router.get(
    "/jobs/{job_id}",
    response_model=JobResponse,
    summary="Get analyzed job by ID"
)
async def get_job(
    job_id: str,
    session: AsyncSession = Depends(get_db),
):
    stmt = select(Job).where(Job.id == job_id)
    result = await session.execute(stmt)
    job = result.scalars().first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with ID '{job_id}' not found."
        )
    return JobDiscoveryService._job_model_to_response(job)


@router.get(
    "/jobs",
    response_model=List[JobResponse],
    summary="List, search, and filter job opportunities"
)
async def list_jobs(
    role: Optional[str] = Query(None, description="Role title substring filter"),
    company: Optional[str] = Query(None, description="Company name substring filter"),
    location: Optional[str] = Query(None, description="Location substring filter"),
    skills: Optional[str] = Query(None, description="Comma-separated skill names filter"),
    source: Optional[str] = Query(None, description="Source type or name filter"),
    is_active: Optional[bool] = Query(None, description="Active status filter"),
    min_match_score: Optional[float] = Query(None, ge=0.0, le=100.0, description="Minimum candidate match score"),
    candidate_id: Optional[str] = Query(None, description="Candidate ID for scoring"),
    limit: int = Query(50, ge=1, le=100, description="Page size limit"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    session: AsyncSession = Depends(get_db),
):
    return await JobDiscoveryService.list_jobs(
        session=session,
        role=role,
        company=company,
        location=location,
        skills=skills,
        source=source,
        is_active=is_active,
        min_match_score=min_match_score,
        candidate_id=candidate_id,
        limit=limit,
        offset=offset,
    )

