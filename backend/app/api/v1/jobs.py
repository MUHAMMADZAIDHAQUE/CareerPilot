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
