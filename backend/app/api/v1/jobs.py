from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional

from backend.app.db.session import get_db
from backend.app.schemas.job import (
    JobAnalyzeRequest,
    JobResponse,
)
from backend.app.schemas.matching import (
    MatchRequest,
    MatchResponse,
)
from backend.app.models.job import Job, MatchResult
from backend.app.services.job_analyzer_service import JobAnalyzerService
from backend.app.services.matching_service import MatchingService
from backend.app.core.logging import logger

router = APIRouter(tags=["Jobs & Matching Engine"])


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
    """
    Parses a pasted job description into verified structured data:
    - Company, role, location, employment type
    - Experience & education requirements
    - Required vs preferred skills
    - Inferred concepts
    - Responsibilities, qualifications, and technologies
    - Salary and application deadline (if explicitly stated)
    """
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
    """
    Evaluates candidate against job:
    - Overall match score (weighted composite)
    - Required skill coverage & missing required skills
    - Preferred skill coverage & missing preferred skills
    - Experience & education compatibility
    - Project relevance ranking
    - Verifiable grounded evidence citations
    """
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
    """Retrieves the latest match result or calculates one if none exists."""
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
    """Fetches previously analyzed job with all itemized requirements."""
    stmt = select(Job).where(Job.id == job_id)
    result = await session.execute(stmt)
    job = result.scalars().first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with ID '{job_id}' not found."
        )
    return job


@router.get(
    "/jobs",
    response_model=List[JobResponse],
    summary="List recently analyzed jobs"
)
async def list_jobs(
    limit: int = 20,
    session: AsyncSession = Depends(get_db),
):
    """Lists recently analyzed job descriptions."""
    stmt = select(Job).order_by(desc(Job.created_at)).limit(limit)
    result = await session.execute(stmt)
    return result.scalars().all()
