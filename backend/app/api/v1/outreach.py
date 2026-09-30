from fastapi import APIRouter, Depends, HTTPException, status, Query, Body, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any, Union

from backend.app.db.session import get_db
from backend.app.api.deps import get_optional_current_user, verify_resource_ownership
from backend.app.models.user import User, UserRole
from backend.app.schemas.outreach import (
    # Legacy Schemas
    OutreachGenerateRequest,
    OutreachResponse,
    OutreachBatchResponse,
    OutreachUpdate,
    OutreachActionResponse,
    # Phase 19 Schemas
    OutreachDraftCreate,
    OutreachDraftGenerateRequest,
    OutreachDraftBulkGenerateRequest,
    OutreachDraftEditRequest,
    OutreachDraftApproveRequest,
    OutreachDraftRejectRequest,
    OutreachDraftRegenerateRequest,
    OutreachDraftResponse,
    OutreachDraftBulkGenerateResponse,
    # Phase 20 Schemas
    OutreachDispatchRequest,
    OutreachBulkDispatchRequest,
    OutreachDispatchResponse,
)
from backend.app.services.outreach_service import OutreachService as LegacyOutreachService
from backend.app.services.outreach.outreach_service import Phase19OutreachService
from backend.app.services.outreach.dispatch_service import DispatchService
from backend.app.core.logging import logger

router = APIRouter(prefix="/outreach", tags=["Outreach Agent"])


# -----------------------------------------------------------------------------
# Phase 19 Specific Static & Collection Routes (Precedence over dynamic IDs)
# -----------------------------------------------------------------------------

@router.post(
    "/drafts",
    response_model=OutreachDraftResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create outreach draft for a selected referral contact",
    description="Generates an evidence-grounded, truth-verified outreach draft for a selected referral contact.",
)
async def create_outreach_draft(
    payload: OutreachDraftCreate,
    session: AsyncSession = Depends(get_db),
):
    try:
        draft = await Phase19OutreachService.create_draft(session=session, payload=payload)
        return await Phase19OutreachService.enrich_draft_response(session, draft)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating outreach draft: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create outreach draft: {str(e)}",
        )


@router.post(
    "/bulk-generate",
    response_model=OutreachDraftBulkGenerateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Bulk generate personalized outreach drafts for selected contacts",
    description="Prepares, personalizes, and validates drafts for multiple selected referral contacts. Never dispatches messages.",
)
async def bulk_generate_outreach_drafts(
    payload: OutreachDraftBulkGenerateRequest,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await Phase19OutreachService.bulk_generate(session=session, payload=payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error bulk generating outreach drafts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk generate outreach drafts: {str(e)}",
        )


# -----------------------------------------------------------------------------
# Phase 20: Authorized Outreach Dispatch & Idempotency Endpoints
# -----------------------------------------------------------------------------

@router.post(
    "/bulk-send",
    summary="Bulk dispatch multiple selected approved outreach drafts",
    description="Requires explicit double confirmation ('confirm_send': true). Automatically blocks any drafts not in APPROVED_FOR_DISPATCH.",
)
async def bulk_send_outreach(
    payload: OutreachBulkDispatchRequest,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await DispatchService.bulk_dispatch(session=session, request=payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error in bulk dispatch: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk dispatch failed: {str(e)}",
        )


@router.get(
    "/dispatch/{dispatch_id}",
    response_model=OutreachDispatchResponse,
    summary="Get outreach dispatch record by ID",
)
async def get_outreach_dispatch(
    dispatch_id: str,
    session: AsyncSession = Depends(get_db),
):
    dispatch = await DispatchService.get_dispatch(session=session, dispatch_id=dispatch_id)
    if not dispatch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dispatch record '{dispatch_id}' not found.",
        )
    return dispatch


@router.get(
    "/job/{job_id}",
    response_model=List[OutreachDraftResponse],
    status_code=status.HTTP_200_OK,
    summary="Get outreach drafts for a specific job",
)
async def get_outreach_drafts_for_job(
    job_id: str,
    channel: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    risk_level: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db),
):
    try:
        return await Phase19OutreachService.list_drafts(
            session=session,
            job_id=job_id,
            channel=channel,
            status=status_filter,
            risk_level=risk_level,
        )
    except Exception as e:
        logger.error(f"Error fetching drafts for job {job_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/contact/{contact_id}",
    response_model=List[OutreachDraftResponse],
    status_code=status.HTTP_200_OK,
    summary="Get outreach drafts for a specific referral contact",
)
async def get_outreach_drafts_for_contact(
    contact_id: str,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await Phase19OutreachService.list_drafts(
            session=session,
            referral_contact_id=contact_id,
        )
    except Exception as e:
        logger.error(f"Error fetching drafts for contact {contact_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/generate",
    status_code=status.HTTP_201_CREATED,
    summary="Generate personalized referral outreach draft(s)",
    description="Supports both Phase 19 single draft generation and legacy batch generation.",
)
async def generate_outreach_handler(
    payload: Dict[str, Any] = Body(...),
    session: AsyncSession = Depends(get_db),
):
    try:
        # Check if Phase 19 request (has referral_contact_id)
        if "referral_contact_id" in payload:
            req = OutreachDraftGenerateRequest(**payload)
            draft = await Phase19OutreachService.generate_draft(session=session, payload=req)
            return await Phase19OutreachService.enrich_draft_response(session, draft)
        else:
            # Fall back to legacy generator
            legacy_req = OutreachGenerateRequest(**payload)
            return await LegacyOutreachService.generate_outreach_drafts(
                session=session,
                payload=legacy_req,
            )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error in generate_outreach_handler: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate outreach: {str(e)}",
        )


# -----------------------------------------------------------------------------
# Collection Listing Route
# -----------------------------------------------------------------------------

@router.get(
    "",
    status_code=status.HTTP_200_OK,
    summary="List outreach drafts with comprehensive filters",
)
async def list_outreach_messages(
    job_id: Optional[str] = Query(None, description="Filter by Job ID"),
    contact_id: Optional[str] = Query(None, description="Filter by Contact ID"),
    channel: Optional[str] = Query(None, description="Filter by channel: email | linkedin"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: DRAFT, REVIEW_REQUIRED, APPROVED, etc."),
    risk_level: Optional[str] = Query(None, description="Filter by risk level: LOW, MEDIUM, HIGH, BLOCKED"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_db),
):
    try:
        # Try Phase 19 drafts first
        phase19_drafts = await Phase19OutreachService.list_drafts(
            session=session,
            job_id=job_id,
            referral_contact_id=contact_id,
            channel=channel,
            status=status_filter,
            risk_level=risk_level,
            limit=limit,
            offset=offset,
        )
        if phase19_drafts:
            return phase19_drafts

        # Fall back to legacy outreach if no Phase 19 drafts
        return await LegacyOutreachService.list_outreach(
            session=session,
            job_id=job_id,
            contact_id=contact_id,
            channel=channel,
            status=status_filter,
            limit=limit,
            offset=offset,
        )
    except Exception as e:
        logger.error(f"Error listing outreach drafts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list outreach drafts: {str(e)}",
        )


# -----------------------------------------------------------------------------
# Dynamic ID Routes (Phase 19 & Legacy Unified)
# -----------------------------------------------------------------------------

@router.get(
    "/{outreach_id}",
    status_code=status.HTTP_200_OK,
    summary="Get single outreach draft or legacy record",
)
async def get_outreach_message(
    outreach_id: str,
    session: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    # Try Phase 19 draft
    draft = await Phase19OutreachService.get_draft(session=session, draft_id=outreach_id)
    if draft:
        verify_resource_ownership(draft.candidate_id, current_user)
        return draft

    # Fall back to legacy
    legacy = await LegacyOutreachService.get_outreach(session=session, outreach_id=outreach_id)
    if legacy:
        verify_resource_ownership(legacy.candidate_id, current_user)
        return legacy

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Outreach record with ID '{outreach_id}' not found.",
    )


@router.post(
    "/{outreach_id}/validate",
    response_model=OutreachDraftResponse,
    status_code=status.HTTP_200_OK,
    summary="Run 12-point truth, safety, and privacy validation",
)
async def validate_outreach_draft(
    outreach_id: str,
    session: AsyncSession = Depends(get_db),
):
    try:
        draft = await Phase19OutreachService.validate_draft(session=session, draft_id=outreach_id)
        return await Phase19OutreachService.enrich_draft_response(session, draft)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error validating outreach draft: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.patch(
    "/{outreach_id}",
    response_model=OutreachDraftResponse,
    status_code=status.HTTP_200_OK,
    summary="Edit outreach draft subject and/or body with audit tracking",
)
async def patch_outreach_draft(
    outreach_id: str,
    payload: OutreachDraftEditRequest,
    session: AsyncSession = Depends(get_db),
):
    try:
        draft = await Phase19OutreachService.edit_draft(
            session=session,
            draft_id=outreach_id,
            payload=payload,
        )
        return await Phase19OutreachService.enrich_draft_response(session, draft)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error editing outreach draft: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put(
    "/{outreach_id}",
    status_code=status.HTTP_200_OK,
    summary="Edit outreach draft (supports both Phase 19 and legacy)",
)
async def edit_outreach_draft(
    outreach_id: str,
    payload: Dict[str, Any] = Body(...),
    session: AsyncSession = Depends(get_db),
):
    # Try Phase 19 draft
    draft_check = await Phase19OutreachService.get_draft(session=session, draft_id=outreach_id)
    if draft_check:
        edit_req = OutreachDraftEditRequest(
            subject=payload.get("subject"),
            body=payload.get("body", ""),
            editor=payload.get("editor", "user"),
            change_summary=payload.get("change_summary", "Manual edit"),
        )
        draft = await Phase19OutreachService.edit_draft(session=session, draft_id=outreach_id, payload=edit_req)
        return await Phase19OutreachService.enrich_draft_response(session, draft)

    # Fall back to legacy
    legacy_update = OutreachUpdate(**payload)
    return await LegacyOutreachService.edit_outreach(session=session, outreach_id=outreach_id, payload=legacy_update)


@router.post(
    "/{outreach_id}/approve",
    status_code=status.HTTP_200_OK,
    summary="Approve outreach draft for future dispatch",
    description="Human-in-the-loop approval: marks the message as APPROVED_FOR_DISPATCH. APPROVE != SEND.",
)
async def approve_outreach_draft(
    outreach_id: str,
    payload: Optional[OutreachDraftApproveRequest] = None,
    session: AsyncSession = Depends(get_db),
):
    req = payload or OutreachDraftApproveRequest()
    # Check if Phase 19 draft
    draft_check = await Phase19OutreachService.get_draft(session=session, draft_id=outreach_id)
    if draft_check:
        try:
            draft = await Phase19OutreachService.approve_draft(session=session, draft_id=outreach_id, payload=req)
            return await Phase19OutreachService.enrich_draft_response(session, draft)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except RuntimeError as e:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        except Exception as e:
            logger.error(f"Error approving Phase 19 draft: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    # Fall back to legacy approval
    try:
        return await LegacyOutreachService.approve_outreach(session=session, outreach_id=outreach_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/{outreach_id}/send",
    response_model=OutreachDispatchResponse,
    status_code=status.HTTP_200_OK,
    summary="Authorize and execute outreach dispatch",
    description="Explicit consequential send action. Strictly requires APPROVED_FOR_DISPATCH status and double confirmation ('confirm_send': true). Idempotent.",
)
async def send_outreach_draft(
    outreach_id: str,
    payload: OutreachDispatchRequest,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await DispatchService.dispatch_outreach(
            session=session,
            draft_id=outreach_id,
            request=payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error dispatching outreach draft {outreach_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Outreach dispatch failed: {str(e)}",
        )


@router.post(
    "/{outreach_id}/reject",
    status_code=status.HTTP_200_OK,
    summary="Reject outreach draft",
)
async def reject_outreach_draft(
    outreach_id: str,
    payload: Optional[OutreachDraftRejectRequest] = None,
    session: AsyncSession = Depends(get_db),
):
    req = payload or OutreachDraftRejectRequest()
    draft_check = await Phase19OutreachService.get_draft(session=session, draft_id=outreach_id)
    if draft_check:
        try:
            draft = await Phase19OutreachService.reject_draft(session=session, draft_id=outreach_id, payload=req)
            return await Phase19OutreachService.enrich_draft_response(session, draft)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Fall back to legacy rejection
    try:
        return await LegacyOutreachService.reject_outreach(session=session, outreach_id=outreach_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/{outreach_id}/regenerate",
    response_model=OutreachDraftResponse,
    status_code=status.HTTP_200_OK,
    summary="Regenerate outreach draft with updated instructions",
)
async def regenerate_outreach_draft(
    outreach_id: str,
    payload: Optional[OutreachDraftRegenerateRequest] = None,
    session: AsyncSession = Depends(get_db),
):
    req = payload or OutreachDraftRegenerateRequest()
    try:
        draft = await Phase19OutreachService.regenerate_draft(session=session, draft_id=outreach_id, payload=req)
        return await Phase19OutreachService.enrich_draft_response(session, draft)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error regenerating draft: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# Legacy sent and delete endpoints
@router.post(
    "/{outreach_id}/sent",
    response_model=OutreachActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark outreach message as sent (Legacy manual sending only)",
)
async def mark_outreach_sent(
    outreach_id: str,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await LegacyOutreachService.mark_as_sent(
            session=session,
            outreach_id=outreach_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete(
    "/{outreach_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete outreach message",
)
async def delete_outreach_message(
    outreach_id: str,
    session: AsyncSession = Depends(get_db),
):
    deleted = await LegacyOutreachService.delete_outreach(
        session=session,
        outreach_id=outreach_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Outreach record with ID '{outreach_id}' not found.",
        )
    return {"success": True, "message": "Outreach record deleted."}
