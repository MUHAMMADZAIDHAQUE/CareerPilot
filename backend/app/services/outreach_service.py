import datetime
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc
from sqlalchemy.orm import selectinload

from backend.app.models.job import Job
from backend.app.models.candidate import Candidate
from backend.app.models.referral import Contact, Referral
from backend.app.models.outreach import Outreach, OutreachStatus
from backend.app.agents.outreach_agent import OutreachAgent
from backend.app.schemas.outreach import (
    OutreachGenerateRequest,
    OutreachResponse,
    OutreachBatchResponse,
    OutreachUpdate,
    OutreachActionResponse,
)
from backend.app.schemas.referral import ContactResponse
from backend.app.core.logging import logger


class OutreachService:
    """
    Coordinates Outreach message generation and human-in-the-loop review.
    Enforces manual-sending requirements for LinkedIn and approval workflows for email.
    """

    @classmethod
    async def generate_outreach_drafts(
        cls,
        session: AsyncSession,
        payload: OutreachGenerateRequest,
    ) -> OutreachBatchResponse:
        """
        Generates personalized referral email and LinkedIn message drafts
        grounded in candidate's verified background and target job requirements.
        """
        # 1. Fetch Job
        job_stmt = select(Job).where(Job.id == payload.job_id)
        job_res = await session.execute(job_stmt)
        job = job_res.scalar_one_or_none()
        if not job:
            raise ValueError(f"Job with ID '{payload.job_id}' not found.")

        # 2. Fetch Contact
        contact_stmt = select(Contact).where(Contact.id == payload.contact_id)
        contact_res = await session.execute(contact_stmt)
        contact = contact_res.scalar_one_or_none()
        if not contact:
            raise ValueError(f"Contact with ID '{payload.contact_id}' not found.")

        # 3. Fetch Candidate
        candidate: Optional[Candidate] = None
        cand_id = payload.candidate_id or contact.candidate_id
        if cand_id:
            cand_stmt = (
                select(Candidate)
                .options(
                    selectinload(Candidate.education),
                    selectinload(Candidate.experiences),
                    selectinload(Candidate.skills),
                    selectinload(Candidate.projects),
                )
                .where(Candidate.id == cand_id)
            )
            cand_res = await session.execute(cand_stmt)
            candidate = cand_res.scalar_one_or_none()
        else:
            cand_stmt = (
                select(Candidate)
                .options(
                    selectinload(Candidate.education),
                    selectinload(Candidate.experiences),
                    selectinload(Candidate.skills),
                    selectinload(Candidate.projects),
                )
                .limit(1)
            )
            cand_res = await session.execute(cand_stmt)
            candidate = cand_res.scalar_one_or_none()

        if not candidate:
            raise ValueError("Candidate profile is required to generate personalized outreach.")

        # 4. Fetch Referral Opportunity (if available for relationship context)
        relationship_type = contact.relationship or "user-provided connection"
        if payload.referral_id:
            ref_stmt = select(Referral).where(Referral.id == payload.referral_id)
            ref_res = await session.execute(ref_stmt)
            ref = ref_res.scalar_one_or_none()
            if ref:
                relationship_type = ref.relationship_type
        else:
            # Check if there is an existing referral for (job, contact)
            ref_stmt = select(Referral).where(
                and_(Referral.job_id == job.id, Referral.contact_id == contact.id)
            )
            ref_res = await session.execute(ref_stmt)
            ref = ref_res.scalar_one_or_none()
            if ref:
                relationship_type = ref.relationship_type

        # 5. Extract projects and select the most relevant one
        candidate_projects = []
        if candidate.projects:
            for p in candidate.projects:
                candidate_projects.append({
                    "id": p.id,
                    "title": p.title,
                    "description": p.description,
                    "technologies": p.technologies or [],
                })

        job_skills = (job.required_skills or []) + (job.technologies or [])
        relevant_project = OutreachAgent._select_relevant_project(
            projects=candidate_projects,
            job_skills=job_skills,
            requested_project_id=payload.relevant_project_id,
        )

        # 6. Candidate, Job, and Contact data dictionaries
        candidate_data = {
            "full_name": candidate.full_name,
            "email": candidate.email,
            "education": [
                {"institution": e.institution, "degree": e.degree, "field": e.field_of_study}
                for e in (candidate.education or [])
            ],
            "skills": [s.name for s in (candidate.skills or [])],
        }

        job_data = {
            "id": job.id,
            "company": job.company,
            "role": job.role,
            "required_skills": job.required_skills or [],
            "technologies": job.technologies or [],
        }

        contact_data = {
            "id": contact.id,
            "name": contact.name,
            "company": contact.company,
            "role": contact.role,
            "department": contact.department,
            "university": contact.university,
            "email": contact.email,
        }

        created_outreach_records: List[Outreach] = []
        channels_to_generate = []
        c_req = (payload.channel or "all").lower().strip()
        if c_req in {"all", "both"}:
            channels_to_generate = ["email", "linkedin"]
        elif c_req in {"email", "mail"}:
            channels_to_generate = ["email"]
        elif c_req in {"linkedin", "inmail"}:
            channels_to_generate = ["linkedin"]
        else:
            channels_to_generate = ["email", "linkedin"]

        # 7. Generate drafts
        for ch in channels_to_generate:
            if ch == "email":
                subj, body, meta = OutreachAgent.generate_email_draft(
                    candidate_data=candidate_data,
                    job_data=job_data,
                    contact_data=contact_data,
                    relationship_type=relationship_type,
                    relevant_project=relevant_project,
                    custom_instructions=payload.custom_instructions,
                )
            else:
                subj, body, meta = OutreachAgent.generate_linkedin_draft(
                    candidate_data=candidate_data,
                    job_data=job_data,
                    contact_data=contact_data,
                    relationship_type=relationship_type,
                    relevant_project=relevant_project,
                    custom_instructions=payload.custom_instructions,
                )

            # Persist in DB with status NEEDS_REVIEW
            outreach_record = Outreach(
                job_id=job.id,
                contact_id=contact.id,
                candidate_id=candidate.id,
                referral_id=payload.referral_id,
                channel=ch,
                subject=subj,
                body=body,
                status=OutreachStatus.NEEDS_REVIEW,
                relationship_context=meta.get("relationship_context"),
                project_highlight=meta.get("project_highlight"),
                metadata_json=meta,
            )
            session.add(outreach_record)
            created_outreach_records.append(outreach_record)

        await session.commit()

        # Refresh with relationships loaded
        messages_response: List[OutreachResponse] = []
        for r in created_outreach_records:
            await session.refresh(r)
            messages_response.append(
                OutreachResponse(
                    id=r.id,
                    job_id=r.job_id,
                    contact_id=r.contact_id,
                    candidate_id=r.candidate_id,
                    referral_id=r.referral_id,
                    channel=r.channel,
                    subject=r.subject,
                    body=r.body,
                    status=r.status,
                    relationship_context=r.relationship_context,
                    project_highlight=r.project_highlight,
                    metadata_json=r.metadata_json,
                    approved_at=r.approved_at,
                    sent_at=r.sent_at,
                    created_at=r.created_at,
                    updated_at=r.updated_at,
                    contact=ContactResponse.model_validate(contact),
                    job={"id": job.id, "company": job.company, "role": job.role},
                )
            )

        logger.info(
            f"Generated {len(messages_response)} outreach drafts for contact '{contact.name}' and job '{job.role}' at '{job.company}'."
        )

        return OutreachBatchResponse(
            job_id=job.id,
            contact_id=contact.id,
            company=job.company,
            contact_name=contact.name,
            messages=messages_response,
        )

    # -------------------------------------------------------------------------
    # Human-in-the-Loop Approval & Status Workflow
    # -------------------------------------------------------------------------

    @classmethod
    async def approve_outreach(
        cls,
        session: AsyncSession,
        outreach_id: str,
    ) -> OutreachActionResponse:
        """Approves a draft message for manual outreach."""
        stmt = select(Outreach).where(Outreach.id == outreach_id)
        res = await session.execute(stmt)
        record = res.scalar_one_or_none()
        if not record:
            raise ValueError(f"Outreach record with ID '{outreach_id}' not found.")

        record.status = OutreachStatus.APPROVED
        record.approved_at = datetime.datetime.now(datetime.timezone.utc)
        await session.commit()
        await session.refresh(record)

        return OutreachActionResponse(
            id=record.id,
            status=record.status,
            message="Outreach draft approved successfully.",
            approved_at=record.approved_at,
        )

    @classmethod
    async def reject_outreach(
        cls,
        session: AsyncSession,
        outreach_id: str,
    ) -> OutreachActionResponse:
        """Rejects a draft message."""
        stmt = select(Outreach).where(Outreach.id == outreach_id)
        res = await session.execute(stmt)
        record = res.scalar_one_or_none()
        if not record:
            raise ValueError(f"Outreach record with ID '{outreach_id}' not found.")

        record.status = OutreachStatus.REJECTED
        await session.commit()
        await session.refresh(record)

        return OutreachActionResponse(
            id=record.id,
            status=record.status,
            message="Outreach draft marked as rejected.",
        )

    @classmethod
    async def mark_as_sent(
        cls,
        session: AsyncSession,
        outreach_id: str,
    ) -> OutreachActionResponse:
        """Marks an approved message as manually sent by the user."""
        stmt = select(Outreach).where(Outreach.id == outreach_id)
        res = await session.execute(stmt)
        record = res.scalar_one_or_none()
        if not record:
            raise ValueError(f"Outreach record with ID '{outreach_id}' not found.")

        record.status = OutreachStatus.SENT
        record.sent_at = datetime.datetime.now(datetime.timezone.utc)
        if not record.approved_at:
            record.approved_at = record.sent_at

        # If connected to a Referral opportunity, update referral status to 'contacted'
        if record.referral_id:
            ref_stmt = select(Referral).where(Referral.id == record.referral_id)
            ref_res = await session.execute(ref_stmt)
            referral = ref_res.scalar_one_or_none()
            if referral:
                referral.status = "contacted"

        await session.commit()
        await session.refresh(record)

        return OutreachActionResponse(
            id=record.id,
            status=record.status,
            message="Outreach marked as sent.",
            approved_at=record.approved_at,
            sent_at=record.sent_at,
        )

    @classmethod
    async def edit_outreach(
        cls,
        session: AsyncSession,
        outreach_id: str,
        payload: OutreachUpdate,
    ) -> OutreachResponse:
        """Allows manual user editing of the draft before approval."""
        stmt = (
            select(Outreach)
            .options(selectinload(Outreach.contact), selectinload(Outreach.job))
            .where(Outreach.id == outreach_id)
        )
        res = await session.execute(stmt)
        record = res.scalar_one_or_none()
        if not record:
            raise ValueError(f"Outreach record with ID '{outreach_id}' not found.")

        if payload.subject is not None:
            record.subject = payload.subject
        if payload.body is not None:
            record.body = payload.body
        if payload.status is not None:
            if payload.status in OutreachStatus.ALL:
                record.status = payload.status
                if payload.status == OutreachStatus.APPROVED and not record.approved_at:
                    record.approved_at = datetime.datetime.now(datetime.timezone.utc)
                elif payload.status == OutreachStatus.SENT and not record.sent_at:
                    record.sent_at = datetime.datetime.now(datetime.timezone.utc)

        await session.commit()
        await session.refresh(record)

        return OutreachResponse(
            id=record.id,
            job_id=record.job_id,
            contact_id=record.contact_id,
            candidate_id=record.candidate_id,
            referral_id=record.referral_id,
            channel=record.channel,
            subject=record.subject,
            body=record.body,
            status=record.status,
            relationship_context=record.relationship_context,
            project_highlight=record.project_highlight,
            metadata_json=record.metadata_json,
            approved_at=record.approved_at,
            sent_at=record.sent_at,
            created_at=record.created_at,
            updated_at=record.updated_at,
            contact=ContactResponse.model_validate(record.contact) if record.contact else None,
            job={"id": record.job.id, "company": record.job.company, "role": record.job.role} if record.job else None,
        )

    @classmethod
    async def list_outreach(
        cls,
        session: AsyncSession,
        job_id: Optional[str] = None,
        contact_id: Optional[str] = None,
        channel: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[OutreachResponse]:
        """Lists outreach records with optional filters."""
        stmt = (
            select(Outreach)
            .options(selectinload(Outreach.contact), selectinload(Outreach.job))
            .order_by(desc(Outreach.created_at))
        )
        conditions = []
        if job_id:
            conditions.append(Outreach.job_id == job_id)
        if contact_id:
            conditions.append(Outreach.contact_id == contact_id)
        if channel:
            conditions.append(Outreach.channel == channel)
        if status:
            conditions.append(Outreach.status == status)

        if conditions:
            stmt = stmt.where(and_(*conditions))

        stmt = stmt.offset(offset).limit(limit)
        res = await session.execute(stmt)
        records = res.scalars().all()

        responses = []
        for r in records:
            responses.append(
                OutreachResponse(
                    id=r.id,
                    job_id=r.job_id,
                    contact_id=r.contact_id,
                    candidate_id=r.candidate_id,
                    referral_id=r.referral_id,
                    channel=r.channel,
                    subject=r.subject,
                    body=r.body,
                    status=r.status,
                    relationship_context=r.relationship_context,
                    project_highlight=r.project_highlight,
                    metadata_json=r.metadata_json,
                    approved_at=r.approved_at,
                    sent_at=r.sent_at,
                    created_at=r.created_at,
                    updated_at=r.updated_at,
                    contact=ContactResponse.model_validate(r.contact) if r.contact else None,
                    job={"id": r.job.id, "company": r.job.company, "role": r.job.role} if r.job else None,
                )
            )
        return responses

    @classmethod
    async def get_outreach(
        cls,
        session: AsyncSession,
        outreach_id: str,
    ) -> Optional[OutreachResponse]:
        """Gets a single outreach record by ID."""
        stmt = (
            select(Outreach)
            .options(selectinload(Outreach.contact), selectinload(Outreach.job))
            .where(Outreach.id == outreach_id)
        )
        res = await session.execute(stmt)
        r = res.scalar_one_or_none()
        if not r:
            return None

        return OutreachResponse(
            id=r.id,
            job_id=r.job_id,
            contact_id=r.contact_id,
            candidate_id=r.candidate_id,
            referral_id=r.referral_id,
            channel=r.channel,
            subject=r.subject,
            body=r.body,
            status=r.status,
            relationship_context=r.relationship_context,
            project_highlight=r.project_highlight,
            metadata_json=r.metadata_json,
            approved_at=r.approved_at,
            sent_at=r.sent_at,
            created_at=r.created_at,
            updated_at=r.updated_at,
            contact=ContactResponse.model_validate(r.contact) if r.contact else None,
            job={"id": r.job.id, "company": r.job.company, "role": r.job.role} if r.job else None,
        )

    @classmethod
    async def delete_outreach(
        cls,
        session: AsyncSession,
        outreach_id: str,
    ) -> bool:
        """Deletes an outreach message."""
        stmt = select(Outreach).where(Outreach.id == outreach_id)
        res = await session.execute(stmt)
        record = res.scalar_one_or_none()
        if not record:
            return False

        await session.delete(record)
        await session.commit()
        return True
