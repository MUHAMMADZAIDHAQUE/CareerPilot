from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from backend.app.db.session import get_db
from backend.app.schemas.application import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse,
    KanbanBoardResponse,
)
from backend.app.services.application_service import ApplicationService
from backend.app.core.logging import logger

router = APIRouter(prefix="/applications", tags=["Application CRM"])


@router.post(
    "",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or track an application",
    description="Tracks an opportunity in the Application CRM with status, tailored resume, and referral metadata.",
)
async def create_application(
    payload: ApplicationCreate,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ApplicationService.create_application(
            session=session,
            payload=payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating application: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create application: {str(e)}",
        )


@router.get(
    "",
    response_model=List[ApplicationResponse],
    status_code=status.HTTP_200_OK,
    summary="List applications",
    description="Lists all tracked job applications with optional stage/status filtering.",
)
async def list_applications(
    candidate_id: Optional[str] = Query(None, description="Filter by candidate ID"),
    job_id: Optional[str] = Query(None, description="Filter by job ID"),
    status: Optional[str] = Query(None, description="Filter by status (SAVED, APPLIED, INTERVIEW, etc.)"),
    search: Optional[str] = Query(None, description="Search company, role, or notes"),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ApplicationService.list_applications(
            session=session,
            candidate_id=candidate_id,
            job_id=job_id,
            status=status,
            search=search,
            limit=limit,
            offset=offset,
        )
    except Exception as e:
        logger.error(f"Error listing applications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list applications: {str(e)}",
        )


@router.get(
    "/kanban",
    response_model=KanbanBoardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Kanban board grouped applications",
    description="Returns applications grouped into the 7 primary Kanban columns: Saved, Ready, Applied, Screening, Interview, Offer, Rejected.",
)
async def get_kanban_board(
    candidate_id: Optional[str] = Query(None, description="Filter by candidate ID"),
    search: Optional[str] = Query(None, description="Search by company or role"),
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ApplicationService.get_kanban_board(
            session=session,
            candidate_id=candidate_id,
            search=search,
        )
    except Exception as e:
        logger.error(f"Error fetching Kanban board: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch Kanban board: {str(e)}",
        )


@router.get(
    "/{application_id}",
    response_model=ApplicationResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single application",
)
async def get_application(
    application_id: str,
    session: AsyncSession = Depends(get_db),
):
    app = await ApplicationService.get_application(session=session, application_id=application_id)
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with ID '{application_id}' not found.",
        )
    return app


@router.put(
    "/{application_id}",
    response_model=ApplicationResponse,
    status_code=status.HTTP_200_OK,
    summary="Update application stage or details",
    description="Updates application status, next action, follow-up date, or interview stage.",
)
async def update_application(
    application_id: str,
    payload: ApplicationUpdate,
    session: AsyncSession = Depends(get_db),
):
    try:
        updated = await ApplicationService.update_application(
            session=session,
            application_id=application_id,
            payload=payload,
        )
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Application with ID '{application_id}' not found.",
            )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating application {application_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update application: {str(e)}",
        )


@router.delete(
    "/{application_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete application",
)
async def delete_application(
    application_id: str,
    session: AsyncSession = Depends(get_db),
):
    deleted = await ApplicationService.delete_application(
        session=session,
        application_id=application_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with ID '{application_id}' not found.",
        )
    return {"success": True, "message": "Application deleted from CRM."}
