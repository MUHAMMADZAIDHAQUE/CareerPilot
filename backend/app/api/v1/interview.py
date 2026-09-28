from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from backend.app.db.session import get_db
from backend.app.services.interview_service import InterviewService
from backend.app.schemas.interview import (
    InterviewPrepGenerateRequest,
    InterviewPreparationResponse,
    InterviewSessionStartRequest,
    InterviewAnswerSubmitRequest,
    InterviewSessionResponse,
    InterviewTurnResponse,
)

router = APIRouter(prefix="/interview", tags=["Interview Preparation & Simulation"])


def _serialize_session(s) -> InterviewSessionResponse:
    turns_sorted = sorted(s.turns, key=lambda t: t.turn_index) if s.turns else []
    current_turn = None
    # Active turn is the first one without candidate_answer
    for t in turns_sorted:
        if not t.candidate_answer:
            current_turn = t
            break

    turn_models = [
        InterviewTurnResponse(
            id=t.id,
            session_id=t.session_id,
            turn_index=t.turn_index,
            category=t.category,
            question=t.question,
            context_source=t.context_source,
            candidate_answer=t.candidate_answer,
            answered_at=t.answered_at,
            evaluation=t.evaluation,
            follow_up_question=t.follow_up_question,
            is_follow_up=t.is_follow_up,
            created_at=t.created_at,
        )
        for t in turns_sorted
    ]

    current_turn_model = (
        InterviewTurnResponse(
            id=current_turn.id,
            session_id=current_turn.session_id,
            turn_index=current_turn.turn_index,
            category=current_turn.category,
            question=current_turn.question,
            context_source=current_turn.context_source,
            candidate_answer=current_turn.candidate_answer,
            answered_at=current_turn.answered_at,
            evaluation=current_turn.evaluation,
            follow_up_question=current_turn.follow_up_question,
            is_follow_up=current_turn.is_follow_up,
            created_at=current_turn.created_at,
        )
        if current_turn
        else None
    )

    company_name = getattr(s.job, "company", None) if hasattr(s, "job") and s.job else s.metadata_json.get("company_name")
    role = getattr(s.job, "role", None) if hasattr(s, "job") and s.job else s.metadata_json.get("role")

    return InterviewSessionResponse(
        id=s.id,
        job_id=s.job_id,
        candidate_id=s.candidate_id,
        resume_version_id=s.resume_version_id,
        company_name=company_name,
        role=role,
        status=s.status,
        current_turn_index=s.current_turn_index,
        total_target_questions=s.total_target_questions,
        weak_areas=s.weak_areas or [],
        final_feedback=s.final_feedback,
        started_at=s.started_at,
        completed_at=s.completed_at,
        current_turn=current_turn_model,
        turns=turn_models,
    )


@router.post("/prep/{job_id}", response_model=InterviewPreparationResponse)
async def generate_interview_prep(
    job_id: str,
    candidate_id: Optional[str] = Query(None),
    resume_version_id: Optional[str] = Query(None),
    force_regenerate: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """
    Generates or refreshes a comprehensive, evidence-grounded interview preparation kit
    for a specific job, candidate, and tailored resume version.
    """
    try:
        prep = await InterviewService.get_or_create_prep_kit(
            session=db,
            job_id=job_id,
            candidate_id=candidate_id,
            resume_version_id=resume_version_id,
            force_regenerate=force_regenerate,
        )
        return prep
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to generate prep kit: {str(e)}")


@router.get("/prep/{job_id}", response_model=InterviewPreparationResponse)
async def get_interview_prep(
    job_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves the interview preparation kit for a job (creates one if not already generated).
    """
    try:
        prep = await InterviewService.get_or_create_prep_kit(
            session=db,
            job_id=job_id,
            force_regenerate=False,
        )
        return prep
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/sessions", response_model=InterviewSessionResponse, status_code=status.HTTP_201_CREATED)
async def start_interview_session(
    payload: InterviewSessionStartRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Starts an interactive mock interview session for a job.
    Initializes turn 0 with the first targeted question.
    """
    try:
        interview_session = await InterviewService.start_session(db, payload)
        return _serialize_session(interview_session)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to start session: {str(e)}")


@router.get("/sessions", response_model=List[InterviewSessionResponse])
async def list_interview_sessions(
    job_id: Optional[str] = Query(None),
    candidate_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists recent mock interview sessions.
    """
    sessions = await InterviewService.list_sessions(db, job_id=job_id, candidate_id=candidate_id, limit=limit)
    return [_serialize_session(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=InterviewSessionResponse)
async def get_interview_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves a single interview session with all turns and evaluation progress.
    """
    s = await InterviewService.get_session(db, session_id)
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session with ID '{session_id}' not found.")
    return _serialize_session(s)


@router.post("/sessions/{session_id}/answer", response_model=InterviewSessionResponse)
async def submit_interview_answer(
    session_id: str,
    payload: InterviewAnswerSubmitRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Submits candidate answer for the current question.
    Evaluates answer across the 6 dimensions:
    - Technical accuracy
    - Relevance
    - Clarity
    - Structure
    - Evidence
    - Communication
    Tracks weak areas, generates contextual follow-up, and advances to the next question or final feedback.
    """
    try:
        s = await InterviewService.submit_answer(db, session_id, payload)
        return _serialize_session(s)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to submit answer: {str(e)}")


@router.post("/sessions/{session_id}/finish", response_model=InterviewSessionResponse)
async def finish_interview_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Completes an interview session early and computes final performance feedback.
    """
    try:
        s = await InterviewService.finish_session_early(db, session_id)
        return _serialize_session(s)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to finish session: {str(e)}")
