from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from backend.app.db.session import get_db
from backend.app.services.github_service import GitHubService
from backend.app.schemas.github import GitHubAnalyzeRequest, GitHubAnalysisResponse

router = APIRouter(prefix="/github", tags=["GitHub Career Analyzer"])


@router.post("/analyze", response_model=GitHubAnalysisResponse)
async def analyze_github_profile(
    payload: GitHubAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Analyzes permitted GitHub repository information for a username:
    - Repositories, languages, READMEs, topics, deployment links
    - Generates profile summary
    - Compares evidence against target roles
    - Shows skills demonstrated, skills missing evidence, relevant projects,
      potential resume bullet points, and recommended profile improvements.
    - Strictly avoids fabricating claims or accessing private repos without user authorization.
    """
    try:
        return await GitHubService.analyze_github(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GitHub analysis failed: {str(e)}",
        )


@router.get("/latest", response_model=Optional[GitHubAnalysisResponse])
async def get_latest_github_analysis(
    username: Optional[str] = Query(None),
    candidate_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves the most recent GitHub Career Analysis.
    """
    return await GitHubService.get_latest_analysis(db, username=username, candidate_id=candidate_id)
