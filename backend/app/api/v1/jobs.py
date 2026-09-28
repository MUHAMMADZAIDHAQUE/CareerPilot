from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List

from backend.app.db.session import get_db
from backend.app.schemas.job import (
    JobAnalyzeRequest,
    JobResponse,
)
from backend.app.models.job import Job
from backend.app.services.job_analyzer_service import JobAnalyzerService
from backend.app.core.logging import logger

router = APIRouter(tags=["Jobs & JD Analyzer"])


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
