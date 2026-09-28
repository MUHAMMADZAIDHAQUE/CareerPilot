from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from backend.app.db.session import get_db
from backend.app.schemas.outreach import (
    OutreachGenerateRequest,
    OutreachResponse,
    OutreachBatchResponse,
    OutreachUpdate,
    OutreachActionResponse,
)
from backend.app.services.outreach_service import OutreachService
from backend.app.core.logging import logger

router = APIRouter(prefix="/outreach", tags=["Outreach Agent"])


@router.post(
    "/generate",
    response_model=OutreachBatchResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate personalized referral email and LinkedIn message drafts",
    description="Crafts concise, grounded, and non-spammy outreach drafts for an approved referral contact and target job.",
)
async def generate_outreach_drafts(
    payload: OutreachGenerateRequest,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await OutreachService.generate_outreach_drafts(
            session=session,
            payload=payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating outreach drafts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate outreach drafts: {str(e)}",
        )


@router.get(
    "",
    response_model=List[OutreachResponse],
    status_code=status.HTTP_200_OK,
    summary="List outreach messages",
    description="List generated outreach drafts with optional filtering by job, contact, channel, or status.",
)
async def list_outreach_messages(
    job_id: Optional[str] = Query(None, description="Filter by Job ID"),
    contact_id: Optional[str] = Query(None, description="Filter by Contact ID"),
    channel: Optional[str] = Query(None, description="Filter by channel: email | linkedin"),
    status: Optional[str] = Query(None, description="Filter by status: DRAFT, NEEDS_REVIEW, APPROVED, SENT, REJECTED"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_db),
):
    try:
        return await OutreachService.list_outreach(
            session=session,
            job_id=job_id,
            contact_id=contact_id,
            channel=channel,
            status=status,
            limit=limit,
            offset=offset,
        )
    except Exception as e:
        logger.error(f"Error listing outreach drafts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list outreach drafts: {str(e)}",
        )


@router.get(
    "/{outreach_id}",
    response_model=OutreachResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single outreach message",
)
async def get_outreach_message(
    outreach_id: str,
    session: AsyncSession = Depends(get_db),
):
    record = await OutreachService.get_outreach(session=session, outreach_id=outreach_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Outreach record with ID '{outreach_id}' not found.",
        )
    return record


@router.put(
    "/{outreach_id}",
    response_model=OutreachResponse,
    status_code=status.HTTP_200_OK,
    summary="Edit outreach draft",
    description="Enables manual editing of subject and message body as part of human-in-the-loop review.",
)
async def edit_outreach_draft(
    outreach_id: str,
    payload: OutreachUpdate,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await OutreachService.edit_outreach(
            session=session,
            outreach_id=outreach_id,
            payload=payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error editing outreach draft: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to edit outreach draft: {str(e)}",
        )


@router.post(
    "/{outreach_id}/approve",
    response_model=OutreachActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve outreach draft",
    description="Human-in-the-loop approval: marks the message as APPROVED for manual sending.",
)
async def approve_outreach_draft(
    outreach_id: str,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await OutreachService.approve_outreach(
            session=session,
            outreach_id=outreach_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error approving outreach draft: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve outreach draft: {str(e)}",
        )


@router.post(
    "/{outreach_id}/reject",
    response_model=OutreachActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject outreach draft",
    description="Human-in-the-loop action: marks the message as REJECTED.",
)
async def reject_outreach_draft(
    outreach_id: str,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await OutreachService.reject_outreach(
            session=session,
            outreach_id=outreach_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error rejecting outreach draft: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reject outreach draft: {str(e)}",
        )


@router.post(
    "/{outreach_id}/sent",
    response_model=OutreachActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark outreach message as sent",
    description="User confirms they have manually sent the outreach message (email or LinkedIn).",
)
async def mark_outreach_sent(
    outreach_id: str,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await OutreachService.mark_as_sent(
            session=session,
            outreach_id=outreach_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error marking outreach as sent: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark outreach as sent: {str(e)}",
        )


@router.delete(
    "/{outreach_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete outreach message",
)
async def delete_outreach_message(
    outreach_id: str,
    session: AsyncSession = Depends(get_db),
):
    deleted = await OutreachService.delete_outreach(
        session=session,
        outreach_id=outreach_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Outreach record with ID '{outreach_id}' not found.",
        )
    return {"success": True, "message": "Outreach record deleted."}
