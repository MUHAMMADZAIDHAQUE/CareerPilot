from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any

from backend.app.db.session import get_db
from backend.app.api.deps import get_optional_current_user, verify_resource_ownership
from backend.app.models.user import User, UserRole
from backend.app.schemas.application import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse,
    KanbanBoardResponse,
    InboundResponseCreate,
    InboundResponseResponse,
    AssessmentResponse,
    DeadlineResponse,
    InterviewEventCreate,
    InterviewEventResponse,
    NotificationResponse,
    ConnectedProviderResponse,
    ApplicationDetailResponse,
)
from backend.app.services.application_service import ApplicationService
from backend.app.services.response_monitoring_service import ResponseMonitoringService
from backend.app.core.logging import logger

router = APIRouter(tags=["Application CRM & Pipeline"])


# -----------------------------------------------------------------------------
# Application CRM Core Routes
# -----------------------------------------------------------------------------

@router.post(
    "/applications",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or track an application",
    description="Tracks an opportunity in the Application CRM with status, tailored resume, and referral metadata.",
)
async def create_application(
    payload: ApplicationCreate,
    session: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    try:
        if not payload.candidate_id and isinstance(current_user, User) and current_user.candidate:
            payload.candidate_id = current_user.candidate.id
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
    "/applications",
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
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    try:
        # Multi-user isolation: Candidate can only list their own applications
        if isinstance(current_user, User) and current_user.role != UserRole.ADMIN and current_user.candidate:
            candidate_id = current_user.candidate.id
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
    "/applications/kanban",
    response_model=KanbanBoardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Kanban board grouped applications",
    description="Returns applications grouped across Kanban columns across full 16-stage lifecycle.",
)
async def get_kanban_board(
    candidate_id: Optional[str] = Query(None, description="Filter by candidate ID"),
    search: Optional[str] = Query(None, description="Search by company or role"),
    session: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    try:
        # Multi-user isolation: Candidate can only see their own Kanban board
        if isinstance(current_user, User) and current_user.role != UserRole.ADMIN and current_user.candidate:
            candidate_id = current_user.candidate.id
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
    "/applications/{application_id}/detail",
    response_model=ApplicationDetailResponse,
    summary="Get complete application detail view with timeline, assessments, and interviews",
)
async def get_application_detail(
    application_id: str,
    session: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    detail = await ApplicationService.get_application_detail(session=session, application_id=application_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with ID '{application_id}' not found.",
        )
    verify_resource_ownership(detail.application.candidate_id, current_user)
    return detail


@router.get(
    "/applications/{application_id}",
    response_model=ApplicationResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single application",
)
async def get_application(
    application_id: str,
    session: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    app = await ApplicationService.get_application(session=session, application_id=application_id)
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with ID '{application_id}' not found.",
        )
    verify_resource_ownership(app.candidate_id, current_user)
    return app


@router.put(
    "/applications/{application_id}",
    response_model=ApplicationResponse,
    status_code=status.HTTP_200_OK,
    summary="Update application stage or details",
)
async def update_application(
    application_id: str,
    payload: ApplicationUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    existing = await ApplicationService.get_application(session=session, application_id=application_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with ID '{application_id}' not found.",
        )
    verify_resource_ownership(existing.candidate_id, current_user)
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


@router.patch(
    "/applications/{application_id}",
    response_model=ApplicationResponse,
    status_code=status.HTTP_200_OK,
    summary="Patch application stage or details",
)
async def patch_application(
    application_id: str,
    payload: ApplicationUpdate,
    session: AsyncSession = Depends(get_db),
):
    return await update_application(application_id=application_id, payload=payload, session=session)


@router.delete(
    "/applications/{application_id}",
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


# -----------------------------------------------------------------------------
# Inbound Responses & Communications
# -----------------------------------------------------------------------------

@router.get(
    "/responses",
    response_model=List[InboundResponseResponse],
    summary="List ingested communication responses",
)
async def list_responses(
    candidate_id: Optional[str] = Query(None),
    job_id: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db),
):
    return await ResponseMonitoringService.list_responses(session=session, candidate_id=candidate_id, job_id=job_id)


@router.post(
    "/responses",
    response_model=InboundResponseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest inbound communication response",
    description="Ingests response, runs classification, extracts assessment/interview/deadline signals, and links to Application CRM.",
)
async def ingest_response(
    payload: InboundResponseCreate,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ResponseMonitoringService.ingest_inbound_response(session=session, req=payload)
    except Exception as e:
        logger.error(f"Error ingesting response: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest response: {str(e)}",
        )


@router.get(
    "/responses/{response_id}",
    response_model=InboundResponseResponse,
    summary="Get single inbound response",
)
async def get_response(
    response_id: str,
    session: AsyncSession = Depends(get_db),
):
    item = await ResponseMonitoringService.get_response(session=session, response_id=response_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Response '{response_id}' not found.")
    return item


@router.post(
    "/responses/{response_id}/classify",
    response_model=InboundResponseResponse,
    summary="Re-evaluate classification on an inbound response",
)
async def reclassify_response(
    response_id: str,
    session: AsyncSession = Depends(get_db),
):
    item = await ResponseMonitoringService.get_response(session=session, response_id=response_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Response '{response_id}' not found.")
    return item


# -----------------------------------------------------------------------------
# Assessments & Tests
# -----------------------------------------------------------------------------

@router.get(
    "/assessments",
    response_model=List[AssessmentResponse],
    summary="List detected coding assessments and technical assignments",
)
async def list_assessments(
    candidate_id: Optional[str] = Query(None),
    application_id: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db),
):
    return await ResponseMonitoringService.list_assessments(session=session, candidate_id=candidate_id, application_id=application_id)


@router.get(
    "/assessments/{assessment_id}",
    response_model=AssessmentResponse,
    summary="Get assessment details",
)
async def get_assessment(
    assessment_id: str,
    session: AsyncSession = Depends(get_db),
):
    items = await ResponseMonitoringService.list_assessments(session=session)
    for a in items:
        if a.id == assessment_id:
            return a
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Assessment '{assessment_id}' not found.")


# -----------------------------------------------------------------------------
# Deadlines
# -----------------------------------------------------------------------------

@router.get(
    "/deadlines",
    response_model=List[DeadlineResponse],
    summary="List actionable deadlines",
)
async def list_deadlines(
    candidate_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db),
):
    return await ResponseMonitoringService.list_deadlines(session=session, candidate_id=candidate_id, status_filter=status)


# -----------------------------------------------------------------------------
# Interviews
# -----------------------------------------------------------------------------

@router.get(
    "/interviews",
    response_model=List[InterviewEventResponse],
    summary="List scheduled and requested interviews",
)
async def list_interviews(
    candidate_id: Optional[str] = Query(None),
    application_id: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db),
):
    return await ResponseMonitoringService.list_interviews(session=session, candidate_id=candidate_id, application_id=application_id)


@router.post(
    "/interviews",
    response_model=InterviewEventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule an interview event on an application",
)
async def create_interview(
    payload: InterviewEventCreate,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ResponseMonitoringService.create_interview(session=session, req=payload)
    except Exception as e:
        logger.error(f"Error creating interview: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create interview: {str(e)}",
        )


# -----------------------------------------------------------------------------
# Notifications
# -----------------------------------------------------------------------------

@router.get(
    "/notifications",
    response_model=List[NotificationResponse],
    summary="List in-app notifications",
)
async def list_notifications(
    candidate_id: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db),
):
    return await ApplicationService.list_notifications(session=session, candidate_id=candidate_id)


@router.post(
    "/notifications/{notification_id}/read",
    summary="Mark notification as read",
)
async def mark_notification_read(
    notification_id: str,
    session: AsyncSession = Depends(get_db),
):
    success = await ApplicationService.mark_notification_read(session=session, notification_id=notification_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    return {"success": True, "notification_id": notification_id}


# -----------------------------------------------------------------------------
# Connected Providers
# -----------------------------------------------------------------------------

@router.get(
    "/providers",
    response_model=List[ConnectedProviderResponse],
    summary="List connected email/dispatch providers",
)
async def list_providers(
    candidate_id: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db),
):
    return await ApplicationService.list_connected_providers(session=session, candidate_id=candidate_id)


@router.post(
    "/providers/{provider}/connect",
    response_model=ConnectedProviderResponse,
    summary="Connect an authorized email provider (Gmail, Outlook)",
)
async def connect_provider(
    provider: str,
    email_address: str = Body(..., embed=True),
    candidate_id: Optional[str] = Body(None, embed=True),
    session: AsyncSession = Depends(get_db),
):
    prov_upper = provider.upper()
    if prov_upper not in {"GMAIL", "OUTLOOK"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider '{provider}' is not supported. Supported: Gmail, Outlook.",
        )
    return await ApplicationService.connect_provider(
        session=session,
        provider_type=prov_upper,
        email_address=email_address,
        candidate_id=candidate_id,
    )


@router.delete(
    "/providers/{provider}",
    summary="Disconnect an authorized provider and revoke local tokens",
)
async def disconnect_provider(
    provider: str,
    candidate_id: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db),
):
    success = await ApplicationService.disconnect_provider(
        session=session,
        provider_type=provider.upper(),
        candidate_id=candidate_id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider '{provider}' was not connected.",
        )
    return {"success": True, "message": f"Provider '{provider}' disconnected."}
