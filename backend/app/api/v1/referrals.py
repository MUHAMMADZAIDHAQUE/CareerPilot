from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from backend.app.db.session import get_db
from backend.app.schemas.referral import (
    ContactCreate,
    ContactUpdate,
    ContactResponse,
    ReferralResponse,
    ReferralStatusUpdateRequest,
    DiscoverReferralsRequest,
    JobReferralsResponse,
)
from backend.app.services.referral_service import ReferralDiscoveryService
from backend.app.core.logging import logger

router = APIRouter(tags=["Referral Discovery Engine"])


# -----------------------------------------------------------------------------
# Referral Discovery Endpoints
# -----------------------------------------------------------------------------

@router.post(
    "/jobs/{job_id}/referrals",
    response_model=JobReferralsResponse,
    status_code=status.HTTP_200_OK,
    summary="Discover referral opportunities for a selected job",
    description="Identifies potential referral connections grounded in evidence (alumni, current employees, former colleagues, and user contacts).",
)
async def discover_job_referrals(
    job_id: str,
    payload: Optional[DiscoverReferralsRequest] = None,
    session: AsyncSession = Depends(get_db),
):
    try:
        candidate_id = payload.candidate_id if payload else None
        min_score = payload.min_score if payload and payload.min_score is not None else 0.0
        return await ReferralDiscoveryService.discover_referrals_for_job(
            session=session,
            job_id=job_id,
            candidate_id=candidate_id,
            min_score=min_score,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error discovering referrals for job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to discover referral opportunities: {str(e)}",
        )


@router.get(
    "/jobs/{job_id}/referrals",
    response_model=JobReferralsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get referral opportunities for a job",
    description="Retrieves discovered referrals for the specified job, running discovery automatically if not yet evaluated.",
)
async def get_job_referrals(
    job_id: str,
    candidate_id: Optional[str] = Query(None, description="Optional Candidate ID"),
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ReferralDiscoveryService.discover_referrals_for_job(
            session=session,
            job_id=job_id,
            candidate_id=candidate_id,
            min_score=0.0,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching referrals for job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch referral opportunities: {str(e)}",
        )


@router.patch(
    "/jobs/{job_id}/referrals/{referral_id}",
    response_model=ReferralResponse,
    status_code=status.HTTP_200_OK,
    summary="Update referral status",
    description="Updates outreach tracking status (suggested, drafted, contacted, referred, declined).",
)
async def update_referral_status(
    job_id: str,
    referral_id: str,
    payload: ReferralStatusUpdateRequest,
    session: AsyncSession = Depends(get_db),
):
    valid_statuses = {"suggested", "drafted", "contacted", "referred", "declined", "accepted"}
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{payload.status}'. Must be one of: {', '.join(sorted(valid_statuses))}",
        )

    updated = await ReferralDiscoveryService.update_referral_status(
        session=session,
        referral_id=referral_id,
        new_status=payload.status,
        notes=payload.notes,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Referral with ID '{referral_id}' not found.",
        )
    return updated


# -----------------------------------------------------------------------------
# Contact Management CRUD Endpoints
# -----------------------------------------------------------------------------

@router.post(
    "/contacts",
    response_model=ContactResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Manually create a contact",
    description="Allows users to store professional connections, colleagues, and verified network contacts.",
)
async def create_contact(
    payload: ContactCreate,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ReferralDiscoveryService.create_contact(
            session=session,
            payload=payload,
        )
    except Exception as e:
        logger.error(f"Error creating contact: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create contact: {str(e)}",
        )


@router.get(
    "/contacts",
    response_model=List[ContactResponse],
    status_code=status.HTTP_200_OK,
    summary="List contacts",
    description="List network contacts with optional filtering by company, candidate, or search query.",
)
async def list_contacts(
    candidate_id: Optional[str] = Query(None, description="Filter by candidate ID"),
    company: Optional[str] = Query(None, description="Filter by company"),
    search: Optional[str] = Query(None, description="Search query across name, role, company, school"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ReferralDiscoveryService.list_contacts(
            session=session,
            candidate_id=candidate_id,
            company=company,
            search=search,
            limit=limit,
            offset=offset,
        )
    except Exception as e:
        logger.error(f"Error listing contacts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list contacts: {str(e)}",
        )


@router.get(
    "/contacts/{contact_id}",
    response_model=ContactResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single contact",
)
async def get_contact(
    contact_id: str,
    session: AsyncSession = Depends(get_db),
):
    contact = await ReferralDiscoveryService.get_contact(session=session, contact_id=contact_id)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact with ID '{contact_id}' not found.",
        )
    return contact


@router.put(
    "/contacts/{contact_id}",
    response_model=ContactResponse,
    status_code=status.HTTP_200_OK,
    summary="Update contact",
)
async def update_contact(
    contact_id: str,
    payload: ContactUpdate,
    session: AsyncSession = Depends(get_db),
):
    updated = await ReferralDiscoveryService.update_contact(
        session=session,
        contact_id=contact_id,
        payload=payload,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact with ID '{contact_id}' not found.",
        )
    return updated


@router.delete(
    "/contacts/{contact_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete contact",
)
async def delete_contact(
    contact_id: str,
    session: AsyncSession = Depends(get_db),
):
    deleted = await ReferralDiscoveryService.delete_contact(
        session=session,
        contact_id=contact_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact with ID '{contact_id}' not found.",
        )
    return {"success": True, "message": "Contact deleted successfully."}
