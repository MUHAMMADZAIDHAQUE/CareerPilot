from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from backend.app.db.session import get_db
from backend.app.api.deps import get_optional_current_user, verify_resource_ownership
from backend.app.models.user import User, UserRole
from backend.app.schemas.referral import (
    ContactCreate,
    ContactUpdate,
    ContactResponse,
    ReferralResponse,
    ReferralStatusUpdateRequest,
    DiscoverReferralsRequest,
    JobReferralsResponse,
    ReferralContactResponse,
    ReferralDiscoveryRequest,
    ReferralDiscoveryResponse,
    ReferralContactSelectRequest,
    ReferralContactNotesRequest,
    BulkSelectRequest,
    BulkSelectResponse,
    ReferralSourceStatusResponse,
)
from backend.app.services.referral_discovery.discovery_service import ReferralDiscoveryService as Phase18DiscoveryService
from backend.app.services.referral_service import ReferralDiscoveryService
from backend.app.core.logging import logger

router = APIRouter(tags=["Referral Discovery Engine"])


# -----------------------------------------------------------------------------
# Phase 18: Multi-Source Referral Discovery Engine Endpoints (50+ Target)
# -----------------------------------------------------------------------------

@router.post(
    "/referrals/discover",
    response_model=ReferralDiscoveryResponse,
    status_code=status.HTTP_200_OK,
    summary="Discover potential referral contacts across configured sources",
    description="Discovers up to 50+ verified potential referral contacts for an approved job across LinkedIn public directory, company team pages, university alumni networks, GitHub, and public tech profiles.",
)
async def discover_referrals_engine(
    payload: ReferralDiscoveryRequest,
    session: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    try:
        candidate_id = payload.candidate_id
        if not candidate_id and current_user and current_user.candidate:
            candidate_id = current_user.candidate.id
        return await Phase18DiscoveryService.discover_referrals(
            session=session,
            job_id=payload.job_id,
            candidate_id=candidate_id,
            target_count=payload.target_count or 100,
            min_score=payload.min_score or 0.0,
            sources_filter=payload.sources,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error executing referral discovery for job {payload.job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute referral discovery: {str(e)}",
        )


@router.get(
    "/referrals/sources/status",
    response_model=ReferralSourceStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get status and health of all referral sources",
    description="Returns configuration and health status of all legitimate referral discovery adapters.",
)
async def get_referral_sources_status():
    return Phase18DiscoveryService.get_sources_status()


@router.post(
    "/referrals/bulk-select",
    response_model=BulkSelectResponse,
    status_code=status.HTTP_200_OK,
    summary="Bulk select or deselect referral contacts",
    description="Allows bulk selection of discovered contacts for human-approved outreach preparation.",
)
async def bulk_select_referral_contacts(
    payload: BulkSelectRequest,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await Phase18DiscoveryService.bulk_select_contacts(
            session=session,
            contact_ids=payload.contact_ids,
            action=payload.action,
        )
    except Exception as e:
        logger.error(f"Error in bulk selecting contacts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk selection failed: {str(e)}",
        )


@router.get(
    "/referrals/job/{job_id}",
    response_model=ReferralDiscoveryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get referral discovery results for a job",
    description="Retrieves discovered referral contacts for a specific job, running discovery automatically if not yet evaluated.",
)
async def get_job_referrals_discovery(
    job_id: str,
    candidate_id: Optional[str] = Query(None, description="Optional Candidate ID"),
    session: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    try:
        if not candidate_id and current_user and current_user.candidate:
            candidate_id = current_user.candidate.id
        # Check if contacts already exist for this job
        existing = await Phase18DiscoveryService.list_referral_contacts(
            session=session,
            job_id=job_id,
            limit=200,
        )
        if existing:
            # Reconstruct discovery response
            verified_count = sum(1 for c in existing if c.verification_status == "VERIFIED")
            target_reached = len(existing) >= Phase18DiscoveryService.TARGET_COUNT
            shortfall = max(0, Phase18DiscoveryService.TARGET_COUNT - len(existing))
            notice = None
            if not target_reached:
                notice = "Target not reached because fewer verified/relevant contacts were discoverable from the configured sources."
            
            # Retrieve job for metadata
            from backend.app.models.job import Job
            from sqlalchemy import select
            j_stmt = select(Job).where(Job.id == job_id)
            j_res = await session.execute(j_stmt)
            job = j_res.scalar_one_or_none()
            company = job.company if job else "Company"
            role = job.role if job else "Role"

            return ReferralDiscoveryResponse(
                job_id=job_id,
                company=company,
                role=role,
                target_count=Phase18DiscoveryService.TARGET_COUNT,
                total_discovered=len(existing),
                total_verified=verified_count,
                target_reached=target_reached,
                shortfall=shortfall,
                sources_used=["LinkedIn Public Professional Index", "Company Public Team Page", "University Alumni Directory", "GitHub Public Contributor Directory", "Public Professional Profiles & Tech Speakers"],
                source_failures=[],
                contacts=existing,
                notice=notice,
            )

        # Otherwise trigger discovery
        return await Phase18DiscoveryService.discover_referrals(
            session=session,
            job_id=job_id,
            candidate_id=candidate_id,
            target_count=Phase18DiscoveryService.TARGET_COUNT,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching referral discovery for job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch referral discovery: {str(e)}",
        )


@router.get(
    "/referrals",
    response_model=List[ReferralContactResponse],
    status_code=status.HTTP_200_OK,
    summary="List discovered referral contacts with filters",
)
async def list_referral_contacts_endpoint(
    job_id: Optional[str] = Query(None, description="Filter by job ID"),
    company: Optional[str] = Query(None, description="Filter by company name"),
    relationship_type: Optional[str] = Query(None, description="Filter by relationship: ALL, ENGINEERS, MANAGERS, RECRUITERS, ALUMNI, HIRING_TEAM"),
    verification_status: Optional[str] = Query(None, description="Filter by verification: VERIFIED, PARTIALLY_VERIFIED, UNVERIFIED"),
    outreach_status: Optional[str] = Query(None, description="Filter by status: NOT_CONTACTED, SELECTED, APPROVED, DO_NOT_CONTACT"),
    search: Optional[str] = Query(None, description="Search name, title, company, university"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_db),
):
    try:
        return await Phase18DiscoveryService.list_referral_contacts(
            session=session,
            job_id=job_id,
            company=company,
            relationship_type=relationship_type,
            verification_status=verification_status,
            outreach_status=outreach_status,
            search=search,
            limit=limit,
            offset=offset,
        )
    except Exception as e:
        logger.error(f"Error listing referral contacts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list referral contacts: {str(e)}",
        )


@router.get(
    "/referrals/{id}",
    response_model=ReferralContactResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single referral contact details",
)
async def get_referral_contact_endpoint(
    id: str,
    session: AsyncSession = Depends(get_db),
):
    contact = await Phase18DiscoveryService.get_referral_contact_by_id(session=session, contact_id=id)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Referral contact with ID '{id}' not found.",
        )
    return contact


@router.post(
    "/referrals/{id}/select",
    response_model=ReferralContactResponse,
    status_code=status.HTTP_200_OK,
    summary="Select a contact for outreach preparation (HITL)",
    description="Marks contact as SELECTED. Strictly preserves HITL: never sends messages or emails automatically.",
)
async def select_referral_contact_endpoint(
    id: str,
    payload: Optional[ReferralContactSelectRequest] = None,
    session: AsyncSession = Depends(get_db),
):
    notes = payload.notes if payload else None
    contact = await Phase18DiscoveryService.select_contact(session=session, contact_id=id, notes=notes)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Referral contact with ID '{id}' not found.",
        )
    return contact


@router.post(
    "/referrals/{id}/dismiss",
    response_model=ReferralContactResponse,
    status_code=status.HTTP_200_OK,
    summary="Dismiss contact from referral recommendations",
)
async def dismiss_referral_contact_endpoint(
    id: str,
    session: AsyncSession = Depends(get_db),
):
    contact = await Phase18DiscoveryService.dismiss_contact(session=session, contact_id=id)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Referral contact with ID '{id}' not found.",
        )
    return contact


@router.patch(
    "/referrals/{id}/notes",
    response_model=ReferralContactResponse,
    status_code=status.HTTP_200_OK,
    summary="Update notes on a referral contact",
)
async def update_referral_contact_notes_endpoint(
    id: str,
    payload: ReferralContactNotesRequest,
    session: AsyncSession = Depends(get_db),
):
    contact = await Phase18DiscoveryService.update_contact_notes(
        session=session,
        contact_id=id,
        notes=payload.notes,
    )
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Referral contact with ID '{id}' not found.",
        )
    return contact



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
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    try:
        # Multi-user isolation: Candidate can only list their own contacts
        if isinstance(current_user, User) and current_user.role != UserRole.ADMIN and current_user.candidate:
            candidate_id = current_user.candidate.id
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
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    contact = await ReferralDiscoveryService.get_contact(session=session, contact_id=contact_id)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact with ID '{contact_id}' not found.",
        )
    verify_resource_ownership(contact.candidate_id, current_user)
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
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    contact = await ReferralDiscoveryService.get_contact(session=session, contact_id=contact_id)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact with ID '{contact_id}' not found.",
        )
    verify_resource_ownership(contact.candidate_id, current_user)
    updated = await ReferralDiscoveryService.update_contact(
        session=session,
        contact_id=contact_id,
        payload=payload,
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
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    contact = await ReferralDiscoveryService.get_contact(session=session, contact_id=contact_id)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact with ID '{contact_id}' not found.",
        )
    verify_resource_ownership(contact.candidate_id, current_user)
    deleted = await ReferralDiscoveryService.delete_contact(
        session=session,
        contact_id=contact_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact with ID '{contact_id}' not found.",
        )
    return {"success": True, "message": f"Contact '{contact_id}' deleted successfully."}
