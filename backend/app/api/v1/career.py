from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from backend.app.db.session import get_db
from backend.app.services.career_service import CareerService
from backend.app.schemas.career import SkillGapAnalysisResponse

router = APIRouter(prefix="/career", tags=["Career Skill Gap Agent"])


@router.get("/skill-gaps", response_model=SkillGapAnalysisResponse)
async def get_career_skill_gaps(
    candidate_id: Optional[str] = Query(None, description="Candidate ID (defaults to primary profile)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Analyzes candidate profile against saved jobs, applied jobs, rejected requirements,
    and target market roles to identify recurring skill gaps.
    For each skill gap, computes:
    - Frequency across target jobs
    - Candidate evidence (grounded; never claims a skill is missing if it exists in profile)
    - Current strength (Strong, Medium, Weak)
    - Priority (CRITICAL, HIGH, MEDIUM, LOW)
    - Recommended learning path
    - Recommended portfolio project
    Synthesizes a 3-phase learning roadmap.
    """
    try:
        return await CareerService.get_career_skill_gaps(db, candidate_id=candidate_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze career skill gaps: {str(e)}"
        )
