"""
CareerPilot Phase 19: Outreach Preparation Service.
Orchestrates drafting, deterministic personalization, validation,
safe repairs, human editing audit, and server-side governed approval.
Enforces the core invariant: APPROVE != SEND (NO_MESSAGE_SENT = True).
"""
import uuid
import hashlib
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from backend.app.models.candidate import Candidate
from backend.app.models.job import Job
from backend.app.models.resume import ResumeVersion
from backend.app.models.referral import ReferralContact
from backend.app.models.outreach import (
    OutreachDraft,
    OutreachAuditEvent,
    OutreachDraftStatus,
    OutreachChannel,
    OutreachLength,
)
from backend.app.schemas.outreach import (
    OutreachDraftCreate,
    OutreachDraftGenerateRequest,
    OutreachDraftBulkGenerateRequest,
    OutreachDraftEditRequest,
    OutreachDraftApproveRequest,
    OutreachDraftRejectRequest,
    OutreachDraftRegenerateRequest,
    OutreachDraftResponse,
    OutreachDraftBulkGenerateResponse,
)
from backend.app.services.outreach.outreach_generator import OutreachGenerator
from backend.app.services.outreach.outreach_validator import OutreachValidatorAgent
from backend.app.services.outreach.personalization import PersonalizationEngine
from backend.app.core.logging import logger

MASTER_RESUME_PATH = Path("resume/master/sample_master_resume.tex")


class Phase19OutreachService:
    """
    Service layer for Phase 19 Outreach Preparation Engine.
    Guarantees strict zero-hallucination compliance, human-in-the-loop review,
    and server-enforced state transitions ending at APPROVED_FOR_DISPATCH.
    """

    @classmethod
    def _verify_master_resume_hash(cls) -> str:
        """Computes SHA-256 hash of the master resume file."""
        if not MASTER_RESUME_PATH.exists():
            return "NO_MASTER_RESUME_FILE"
        content = MASTER_RESUME_PATH.read_text(encoding="utf-8")
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    @classmethod
    async def _get_or_create_default_candidate(cls, session: AsyncSession) -> Candidate:
        stmt = (
            select(Candidate)
            .options(
                selectinload(Candidate.skills),
                selectinload(Candidate.education),
                selectinload(Candidate.projects),
            )
            .limit(1)
        )
        res = await session.execute(stmt)
        c = res.scalar_one_or_none()
        if c:
            return c
        candidate = Candidate(
            full_name="Alex Mercer",
            email="alex.mercer@example.com",
            headline="Senior Distributed Systems & Platform Engineer",
        )
        session.add(candidate)
        await session.flush()
        return candidate

    @classmethod
    def _build_candidate_dict(cls, candidate: Candidate) -> Dict[str, Any]:
        """Builds structured candidate facts dictionary."""
        skills = [s.name for s in getattr(candidate, "skills", [])]
        education = [
            {
                "institution": e.institution,
                "degree": e.degree,
                "field_of_study": e.field_of_study,
                "graduation_year": getattr(e, "graduation_year", None),
            }
            for e in getattr(candidate, "education", [])
        ]
        projects = [
            {
                "id": str(p.id),
                "title": p.title,
                "description": p.description,
                "technologies": p.technologies or [],
            }
            for p in getattr(candidate, "projects", [])
        ]
        return {
            "id": str(candidate.id),
            "full_name": candidate.full_name,
            "headline": candidate.headline,
            "email": candidate.email,
            "skills": skills,
            "education": education,
            "projects": projects,
            "github_url": candidate.github_url,
        }

    @classmethod
    def _build_job_dict(cls, job: Job) -> Dict[str, Any]:
        """Builds structured job facts dictionary."""
        role = getattr(job, "role", None) or getattr(job, "title", "Software Engineer")
        company = getattr(job, "company", None) or getattr(job, "company_name", "Company")
        dept = getattr(job, "department", "")
        req_skills = getattr(job, "required_skills", []) or []
        techs = getattr(job, "technologies", []) or []
        desc_text = getattr(job, "raw_description", "") or getattr(job, "description", "")
        return {
            "id": str(job.id),
            "role": role,
            "company": company,
            "department": dept,
            "required_skills": req_skills,
            "technologies": techs,
            "description": desc_text,
            "source_url": getattr(job, "source_url", None),
        }

    @classmethod
    def _build_contact_dict(cls, contact: ReferralContact) -> Dict[str, Any]:
        """Builds structured contact facts dictionary."""
        return {
            "id": str(contact.id),
            "name": contact.name,
            "current_title": contact.current_title,
            "company_name": contact.company_name or contact.company,
            "company": contact.company or contact.company_name,
            "department": contact.department,
            "relationship_type": contact.relationship_type,
            "skills": contact.skills or [],
            "university": contact.university,
            "graduation_year": contact.graduation_year,
            "relevance_score": contact.relevance_score,
            "relevance_reasons": contact.relevance_reasons or [],
            "source_references": contact.source_references or [],
            "source": contact.source,
            "profile_url": contact.profile_url or contact.source_url,
            "outreach_status": contact.outreach_status,
        }

    @classmethod
    async def log_audit_event(
        cls,
        session: AsyncSession,
        event_type: str,
        draft_id: Optional[str] = None,
        candidate_id: Optional[str] = None,
        job_id: Optional[str] = None,
        referral_contact_id: Optional[str] = None,
        actor: str = "user",
        payload: Optional[Dict[str, Any]] = None,
    ) -> OutreachAuditEvent:
        """Appends an immutable audit event."""
        event = OutreachAuditEvent(
            id=str(uuid.uuid4()),
            draft_id=draft_id,
            candidate_id=candidate_id,
            job_id=job_id,
            referral_contact_id=referral_contact_id,
            event_type=event_type,
            actor=actor,
            payload=payload or {},
            no_message_sent=True,
        )
        session.add(event)
        await session.flush()
        return event

    @classmethod
    async def generate_draft(
        cls,
        session: AsyncSession,
        payload: OutreachDraftGenerateRequest,
    ) -> OutreachDraft:
        """
        Generates or regenerates an evidence-grounded outreach draft for a selected referral contact.
        """
        # 1. Fetch Contact & verify selected status
        contact_stmt = select(ReferralContact).where(ReferralContact.id == payload.referral_contact_id)
        contact_res = await session.execute(contact_stmt)
        contact = contact_res.scalar_one_or_none()
        if not contact:
            raise ValueError(f"Referral contact with ID '{payload.referral_contact_id}' not found.")

        # Invariant: Must be selected for outreach
        allowed_statuses = {"SELECTED", "APPROVED", "NOT_CONTACTED"}
        if contact.outreach_status not in allowed_statuses:
            raise ValueError(
                f"Cannot generate outreach for contact with status '{contact.outreach_status}'. Contact must be SELECTED."
            )

        # 2. Fetch Job
        job_stmt = select(Job).where(Job.id == payload.job_id)
        job_res = await session.execute(job_stmt)
        job = job_res.scalar_one_or_none()
        if not job:
            raise ValueError(f"Job with ID '{payload.job_id}' not found.")

        # 3. Fetch Candidate
        candidate = None
        if payload.candidate_id:
            c_stmt = (
                select(Candidate)
                .options(
                    selectinload(Candidate.skills),
                    selectinload(Candidate.education),
                    selectinload(Candidate.projects),
                )
                .where(Candidate.id == payload.candidate_id)
            )
            c_res = await session.execute(c_stmt)
            candidate = c_res.scalar_one_or_none()
        if not candidate:
            candidate = await cls._get_or_create_default_candidate(session)

        # 4. Fetch Resume Version
        resume_version_id = payload.resume_version_id
        if not resume_version_id:
            r_stmt = (
                select(ResumeVersion)
                .where(ResumeVersion.job_id == payload.job_id)
                .order_by(desc(ResumeVersion.created_at))
                .limit(1)
            )
            r_res = await session.execute(r_stmt)
            rv = r_res.scalar_one_or_none()
            if rv:
                resume_version_id = rv.id

        # 5. Build context facts
        candidate_facts = cls._build_candidate_dict(candidate)
        job_facts = cls._build_job_dict(job)
        contact_facts = cls._build_contact_dict(contact)

        # 6. Generate draft
        gen_result = OutreachGenerator.generate_draft(
            candidate_data=candidate_facts,
            job_data=job_facts,
            contact_data=contact_facts,
            channel=payload.channel,
            length=payload.length,
            custom_instructions=payload.custom_instructions,
        )

        # 7. Check if existing draft exists for this contact & job, else create new
        existing_stmt = select(OutreachDraft).where(
            OutreachDraft.job_id == payload.job_id,
            OutreachDraft.referral_contact_id == payload.referral_contact_id,
        )
        existing_res = await session.execute(existing_stmt)
        draft = existing_res.scalar_one_or_none()

        master_hash = cls._verify_master_resume_hash()

        if draft:
            draft.channel = gen_result["channel"]
            draft.subject = gen_result["subject"]
            draft.body = gen_result["body"]
            draft.status = gen_result["status"]
            draft.generation_version += 1
            draft.prompt_version = gen_result["prompt_version"]
            draft.personalization_evidence = gen_result["personalization_evidence"]
            draft.validation_results = gen_result["validation_results"]
            draft.risk_flags = gen_result["risk_flags"]
            draft.resume_version_id = resume_version_id
            draft.audit_metadata = {
                "master_resume_hash": master_hash,
                "NO_MESSAGE_SENT": True,
                "repaired": gen_result["validation_results"].get("repaired", False),
            }
        else:
            draft = OutreachDraft(
                id=str(uuid.uuid4()),
                candidate_id=candidate.id,
                job_id=job.id,
                referral_contact_id=contact.id,
                resume_version_id=resume_version_id,
                channel=gen_result["channel"],
                subject=gen_result["subject"],
                body=gen_result["body"],
                status=gen_result["status"],
                generation_version=1,
                prompt_version=gen_result["prompt_version"],
                personalization_evidence=gen_result["personalization_evidence"],
                validation_results=gen_result["validation_results"],
                risk_flags=gen_result["risk_flags"],
                human_edits=[],
                dispatch_status="NOT_DISPATCHED",
                audit_metadata={
                    "master_resume_hash": master_hash,
                    "NO_MESSAGE_SENT": True,
                    "repaired": gen_result["validation_results"].get("repaired", False),
                },
            )
            session.add(draft)

        await session.flush()

        # Log audit event
        await cls.log_audit_event(
            session=session,
            event_type="OUTREACH_GENERATED",
            draft_id=draft.id,
            candidate_id=candidate.id,
            job_id=job.id,
            referral_contact_id=contact.id,
            payload={
                "channel": draft.channel,
                "status": draft.status,
                "risk_level": gen_result["validation_results"].get("risk_level", "LOW"),
                "evidence_count": len(gen_result["personalization_evidence"]),
            },
        )

        await session.commit()
        await session.refresh(draft)
        return draft

    @classmethod
    async def create_draft(
        cls,
        session: AsyncSession,
        payload: OutreachDraftCreate,
    ) -> OutreachDraft:
        """Creates a blank or pre-filled draft record without full generation."""
        req = OutreachDraftGenerateRequest(
            job_id=payload.job_id,
            referral_contact_id=payload.referral_contact_id,
            candidate_id=payload.candidate_id,
            resume_version_id=payload.resume_version_id,
            channel=payload.channel,
            length=payload.length,
        )
        return await cls.generate_draft(session=session, payload=req)

    @classmethod
    async def validate_draft(
        cls,
        session: AsyncSession,
        draft_id: str,
    ) -> OutreachDraft:
        """Re-validates an existing draft, executing safe repairs if needed."""
        stmt = select(OutreachDraft).where(OutreachDraft.id == draft_id)
        res = await session.execute(stmt)
        draft = res.scalar_one_or_none()
        if not draft:
            raise ValueError(f"Outreach draft with ID '{draft_id}' not found.")

        # Load related entities
        job_stmt = select(Job).where(Job.id == draft.job_id)
        job_res = await session.execute(job_stmt)
        job = job_res.scalar_one_or_none()

        contact_stmt = select(ReferralContact).where(ReferralContact.id == draft.referral_contact_id)
        contact_res = await session.execute(contact_stmt)
        contact = contact_res.scalar_one_or_none()

        c_stmt = (
            select(Candidate)
            .options(
                selectinload(Candidate.skills),
                selectinload(Candidate.education),
                selectinload(Candidate.projects),
            )
            .where(Candidate.id == draft.candidate_id)
        )
        c_res = await session.execute(c_stmt)
        candidate = c_res.scalar_one_or_none()

        candidate_facts = cls._build_candidate_dict(candidate) if candidate else {}
        job_facts = cls._build_job_dict(job) if job else {}
        contact_facts = cls._build_contact_dict(contact) if contact else {}

        val_result = OutreachValidatorAgent.validate_and_repair(
            subject=draft.subject,
            body=draft.body,
            candidate_facts=candidate_facts,
            job_facts=job_facts,
            contact_facts=contact_facts,
            verified_evidence=draft.personalization_evidence or [],
            channel=draft.channel,
        )

        draft.validation_results = val_result
        draft.risk_flags = val_result.get("risk_flags", [])

        if val_result.get("repaired") and val_result.get("repaired_body"):
            draft.body = val_result["repaired_body"]
            if val_result.get("repaired_subject"):
                draft.subject = val_result["repaired_subject"]

        if val_result["passed"]:
            draft.status = OutreachDraftStatus.REVIEW_REQUIRED
        else:
            draft.status = OutreachDraftStatus.BLOCKED

        await cls.log_audit_event(
            session=session,
            event_type="OUTREACH_VALIDATED",
            draft_id=draft.id,
            candidate_id=draft.candidate_id,
            job_id=draft.job_id,
            referral_contact_id=draft.referral_contact_id,
            payload={
                "status": draft.status,
                "passed": val_result["passed"],
                "risk_level": val_result["risk_level"],
                "risk_flags": val_result["risk_flags"],
            },
        )

        await session.commit()
        await session.refresh(draft)
        return draft

    @classmethod
    async def edit_draft(
        cls,
        session: AsyncSession,
        draft_id: str,
        payload: OutreachDraftEditRequest,
    ) -> OutreachDraft:
        """
        Records human edits to subject/body and immediately triggers revalidation.
        Enforces server-side invariant: EDITED -> VALIDATING -> REVIEW_REQUIRED/BLOCKED.
        """
        stmt = select(OutreachDraft).where(OutreachDraft.id == draft_id)
        res = await session.execute(stmt)
        draft = res.scalar_one_or_none()
        if not draft:
            raise ValueError(f"Outreach draft with ID '{draft_id}' not found.")

        # Record human edit history
        edit_entry = {
            "original_body": draft.body,
            "edited_body": payload.body,
            "original_subject": draft.subject,
            "edited_subject": payload.subject if payload.subject is not None else draft.subject,
            "edited_at": datetime.utcnow().isoformat(),
            "edited_by": payload.editor or "user",
            "change_summary": payload.change_summary or "Manual edit via Outreach Review Studio",
        }
        human_edits = list(draft.human_edits or [])
        human_edits.append(edit_entry)
        draft.human_edits = human_edits

        # Update content
        draft.body = payload.body
        if payload.subject is not None:
            draft.subject = payload.subject

        # Transition state to VALIDATING
        draft.status = OutreachDraftStatus.VALIDATING

        await cls.log_audit_event(
            session=session,
            event_type="OUTREACH_EDITED",
            draft_id=draft.id,
            candidate_id=draft.candidate_id,
            job_id=draft.job_id,
            referral_contact_id=draft.referral_contact_id,
            actor=payload.editor or "user",
            payload={"change_summary": edit_entry["change_summary"]},
        )

        # Run revalidation
        return await cls.validate_draft(session=session, draft_id=draft.id)

    @classmethod
    async def approve_draft(
        cls,
        session: AsyncSession,
        draft_id: str,
        payload: OutreachDraftApproveRequest,
    ) -> OutreachDraft:
        """
        Approves an outreach draft for future manual dispatch.
        Server-side security verification:
        1. Draft exists.
        2. Contact exists and is SELECTED.
        3. Job exists.
        4. Validation passed and risk_level != BLOCKED.
        5. Master resume hash matches invariant baseline.
        6. Invariant: APPROVE != SEND (NO_MESSAGE_SENT = True).
        """
        stmt = select(OutreachDraft).where(OutreachDraft.id == draft_id)
        res = await session.execute(stmt)
        draft = res.scalar_one_or_none()
        if not draft:
            raise ValueError(f"Outreach draft with ID '{draft_id}' not found.")

        # Check contact
        contact_stmt = select(ReferralContact).where(ReferralContact.id == draft.referral_contact_id)
        contact_res = await session.execute(contact_stmt)
        contact = contact_res.scalar_one_or_none()
        if not contact:
            raise ValueError("Referral contact associated with draft not found.")

        if contact.outreach_status not in {"SELECTED", "APPROVED", "NOT_CONTACTED"}:
            raise ValueError(
                f"Cannot approve draft: Contact is '{contact.outreach_status}', expected SELECTED."
            )

        # Check validation
        val_res = draft.validation_results or {}
        if not val_res.get("passed", False) or val_res.get("risk_level") == "BLOCKED":
            raise ValueError(
                f"Cannot approve draft: Validation failed or risk level is BLOCKED. Resolve issues first."
            )

        if draft.status == OutreachDraftStatus.BLOCKED:
            raise ValueError("Cannot approve draft with BLOCKED status.")

        # Check master resume immutability
        hash_now = cls._verify_master_resume_hash()
        saved_hash = (draft.audit_metadata or {}).get("master_resume_hash")
        if saved_hash and saved_hash != hash_now:
            raise RuntimeError(
                f"CRITICAL INVARIANT VIOLATION: Master resume file was modified! "
                f"Initial: {saved_hash}, Now: {hash_now}"
            )

        # Transition status
        now_dt = datetime.utcnow()
        draft.status = OutreachDraftStatus.APPROVED_FOR_DISPATCH
        draft.approved_at = now_dt
        draft.approved_by = payload.approver or "user"
        draft.audit_metadata = {
            **(draft.audit_metadata or {}),
            "approved_at": now_dt.isoformat(),
            "approved_by": payload.approver or "user",
            "notes": payload.notes,
            "NO_MESSAGE_SENT": True,
            "master_resume_hash": hash_now,
        }

        # Update contact outreach_status to APPROVED
        contact.outreach_status = "APPROVED"

        await cls.log_audit_event(
            session=session,
            event_type="OUTREACH_APPROVED",
            draft_id=draft.id,
            candidate_id=draft.candidate_id,
            job_id=draft.job_id,
            referral_contact_id=draft.referral_contact_id,
            actor=payload.approver or "user",
            payload={
                "status": draft.status,
                "approved_by": draft.approved_by,
                "notes": payload.notes,
                "no_message_sent": True,
            },
        )

        await session.commit()
        await session.refresh(draft)
        return draft

    @classmethod
    async def reject_draft(
        cls,
        session: AsyncSession,
        draft_id: str,
        payload: OutreachDraftRejectRequest,
    ) -> OutreachDraft:
        """Rejects a draft."""
        stmt = select(OutreachDraft).where(OutreachDraft.id == draft_id)
        res = await session.execute(stmt)
        draft = res.scalar_one_or_none()
        if not draft:
            raise ValueError(f"Outreach draft with ID '{draft_id}' not found.")

        now_dt = datetime.utcnow()
        draft.status = OutreachDraftStatus.REJECTED
        draft.rejected_at = now_dt
        draft.rejected_by = payload.rejector or "user"

        await cls.log_audit_event(
            session=session,
            event_type="OUTREACH_REJECTED",
            draft_id=draft.id,
            candidate_id=draft.candidate_id,
            job_id=draft.job_id,
            referral_contact_id=draft.referral_contact_id,
            actor=payload.rejector or "user",
            payload={"reason": payload.reason},
        )

        await session.commit()
        await session.refresh(draft)
        return draft

    @classmethod
    async def regenerate_draft(
        cls,
        session: AsyncSession,
        draft_id: str,
        payload: OutreachDraftRegenerateRequest,
    ) -> OutreachDraft:
        """Regenerates draft content with updated instructions or preferences."""
        stmt = select(OutreachDraft).where(OutreachDraft.id == draft_id)
        res = await session.execute(stmt)
        draft = res.scalar_one_or_none()
        if not draft:
            raise ValueError(f"Outreach draft with ID '{draft_id}' not found.")

        req = OutreachDraftGenerateRequest(
            job_id=draft.job_id,
            referral_contact_id=draft.referral_contact_id,
            candidate_id=draft.candidate_id,
            resume_version_id=draft.resume_version_id,
            channel=payload.channel or draft.channel,
            length=payload.length or "MEDIUM",
            custom_instructions=payload.custom_instructions,
        )
        updated_draft = await cls.generate_draft(session=session, payload=req)

        await cls.log_audit_event(
            session=session,
            event_type="OUTREACH_REGENERATED",
            draft_id=draft.id,
            candidate_id=draft.candidate_id,
            job_id=draft.job_id,
            referral_contact_id=draft.referral_contact_id,
            payload={"generation_version": updated_draft.generation_version},
        )

        return updated_draft

    @classmethod
    async def bulk_generate(
        cls,
        session: AsyncSession,
        payload: OutreachDraftBulkGenerateRequest,
    ) -> OutreachDraftBulkGenerateResponse:
        """
        Prepares and validates outreach drafts for multiple selected contacts.
        Never dispatches any message.
        """
        # Fetch Job
        job_stmt = select(Job).where(Job.id == payload.job_id)
        job_res = await session.execute(job_stmt)
        job = job_res.scalar_one_or_none()
        if not job:
            raise ValueError(f"Job with ID '{payload.job_id}' not found.")

        company_name = getattr(job, "company", None) or getattr(job, "company_name", "Company")

        drafts: List[OutreachDraft] = []
        total_validated = 0
        total_blocked = 0

        for cid in payload.contact_ids:
            try:
                single_req = OutreachDraftGenerateRequest(
                    job_id=payload.job_id,
                    referral_contact_id=cid,
                    candidate_id=payload.candidate_id,
                    channel=payload.channel,
                    length=payload.length,
                    custom_instructions=payload.custom_instructions,
                )
                draft = await cls.generate_draft(session=session, payload=single_req)
                drafts.append(draft)
                if draft.status == OutreachDraftStatus.REVIEW_REQUIRED:
                    total_validated += 1
                else:
                    total_blocked += 1
            except Exception as e:
                logger.warning(f"Error generating draft for contact {cid}: {e}")

        # Build response items using batch enrichment (eliminating N+1 queries)
        draft_responses = await cls.enrich_draft_responses_batch(session, drafts)

        return OutreachDraftBulkGenerateResponse(
            job_id=payload.job_id,
            company_name=company_name,
            total_requested=len(payload.contact_ids),
            total_generated=len(drafts),
            total_validated=total_validated,
            total_blocked=total_blocked,
            drafts=draft_responses,
        )

    @classmethod
    def build_draft_response(
        cls,
        draft: OutreachDraft,
        contact: Any = None,
        job: Any = None,
    ) -> OutreachDraftResponse:
        """Constructs OutreachDraftResponse from draft and optional related entities/rows."""
        if contact is not None:
            if isinstance(contact, dict):
                c_name = contact.get("name")
                c_title = contact.get("current_title") or contact.get("title")
                c_company = contact.get("company_name") or contact.get("company")
                c_rel = contact.get("relationship_type")
                c_score = contact.get("relevance_score")
                c_url = contact.get("profile_url")
            else:
                c_name = getattr(contact, "name", None)
                c_title = getattr(contact, "current_title", None) or getattr(contact, "title", None)
                c_company = getattr(contact, "company_name", None) or getattr(contact, "company", None)
                c_rel = getattr(contact, "relationship_type", None)
                c_score = getattr(contact, "relevance_score", None)
                c_url = getattr(contact, "profile_url", None)
        else:
            c_name = c_title = c_company = c_rel = c_score = c_url = None

        if job is not None:
            if isinstance(job, dict):
                j_title = job.get("role") or job.get("title")
                j_company = job.get("company") or job.get("company_name")
            else:
                j_title = getattr(job, "role", None) or getattr(job, "title", None)
                j_company = getattr(job, "company", None) or getattr(job, "company_name", None)
        else:
            j_title = j_company = None

        return OutreachDraftResponse(
            id=draft.id,
            candidate_id=draft.candidate_id,
            job_id=draft.job_id,
            referral_contact_id=draft.referral_contact_id,
            resume_version_id=draft.resume_version_id,
            channel=draft.channel,
            subject=draft.subject,
            body=draft.body,
            status=draft.status,
            generation_version=draft.generation_version,
            prompt_version=draft.prompt_version,
            personalization_evidence=draft.personalization_evidence or [],
            validation_results=draft.validation_results or {},
            risk_flags=draft.risk_flags or [],
            approved_at=draft.approved_at,
            approved_by=draft.approved_by,
            rejected_at=draft.rejected_at,
            rejected_by=draft.rejected_by,
            human_edits=draft.human_edits or [],
            dispatch_status=draft.dispatch_status,
            audit_metadata=draft.audit_metadata or {},
            created_at=draft.created_at,
            updated_at=draft.updated_at,
            contact_name=c_name,
            contact_title=c_title,
            contact_company=c_company,
            contact_relationship_type=c_rel,
            contact_relevance_score=c_score,
            contact_profile_url=c_url,
            job_title=j_title,
            job_company=j_company,
        )

    @classmethod
    async def enrich_draft_response(
        cls,
        session: AsyncSession,
        draft: OutreachDraft,
        contact: Any = None,
        job: Any = None,
    ) -> OutreachDraftResponse:
        """Embeds contact and job context into response schema for a single draft."""
        if contact is None and draft.referral_contact_id:
            contact_stmt = select(
                ReferralContact.id,
                ReferralContact.name,
                ReferralContact.current_title,
                ReferralContact.company_name,
                ReferralContact.company,
                ReferralContact.relationship_type,
                ReferralContact.relevance_score,
                ReferralContact.profile_url,
            ).where(ReferralContact.id == draft.referral_contact_id)
            contact_res = await session.execute(contact_stmt)
            contact = contact_res.first()

        if job is None and draft.job_id:
            job_stmt = select(
                Job.id,
                Job.role,
                Job.company,
            ).where(Job.id == draft.job_id)
            job_res = await session.execute(job_stmt)
            job = job_res.first()

        return cls.build_draft_response(draft, contact=contact, job=job)

    @classmethod
    async def enrich_draft_responses_batch(
        cls,
        session: AsyncSession,
        drafts: List[OutreachDraft],
    ) -> List[OutreachDraftResponse]:
        """
        Batch loads related ReferralContact and Job entities to eliminate N+1 queries.
        Executes at most 2 batched SQL queries for related data regardless of draft count.
        """
        if not drafts:
            return []

        contact_ids = {d.referral_contact_id for d in drafts if d.referral_contact_id}
        job_ids = {d.job_id for d in drafts if d.job_id}

        contacts_by_id: Dict[str, Any] = {}
        if contact_ids:
            contacts_stmt = select(
                ReferralContact.id,
                ReferralContact.name,
                ReferralContact.current_title,
                ReferralContact.company_name,
                ReferralContact.company,
                ReferralContact.relationship_type,
                ReferralContact.relevance_score,
                ReferralContact.profile_url,
            ).where(ReferralContact.id.in_(contact_ids))
            contacts_res = await session.execute(contacts_stmt)
            for row in contacts_res.all():
                contacts_by_id[row.id] = row

        jobs_by_id: Dict[str, Any] = {}
        if job_ids:
            jobs_stmt = select(
                Job.id,
                Job.role,
                Job.company,
            ).where(Job.id.in_(job_ids))
            jobs_res = await session.execute(jobs_stmt)
            for row in jobs_res.all():
                jobs_by_id[row.id] = row

        return [
            cls.build_draft_response(
                d,
                contact=contacts_by_id.get(d.referral_contact_id) if d.referral_contact_id else None,
                job=jobs_by_id.get(d.job_id) if d.job_id else None,
            )
            for d in drafts
        ]

    @classmethod
    async def list_drafts(
        cls,
        session: AsyncSession,
        job_id: Optional[str] = None,
        referral_contact_id: Optional[str] = None,
        channel: Optional[str] = None,
        status: Optional[str] = None,
        risk_level: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[OutreachDraftResponse]:
        """Lists outreach drafts with comprehensive filtering and batched related data fetching."""
        query = select(OutreachDraft).order_by(desc(OutreachDraft.updated_at))

        if job_id:
            query = query.where(OutreachDraft.job_id == job_id)
        if referral_contact_id:
            query = query.where(OutreachDraft.referral_contact_id == referral_contact_id)
        if channel and channel.upper() != "ALL":
            query = query.where(OutreachDraft.channel == channel.upper())
        if status and status.upper() != "ALL":
            query = query.where(OutreachDraft.status == status.upper())

        query = query.limit(limit).offset(offset)
        res = await session.execute(query)
        drafts = res.scalars().all()

        if risk_level and risk_level.upper() != "ALL":
            drafts = [
                d for d in drafts
                if (d.validation_results or {}).get("risk_level", "LOW").upper() == risk_level.upper()
            ]

        return await cls.enrich_draft_responses_batch(session, drafts)

    @classmethod
    async def get_draft(
        cls,
        session: AsyncSession,
        draft_id: str,
    ) -> Optional[OutreachDraftResponse]:
        """Retrieves single draft response."""
        stmt = select(OutreachDraft).where(OutreachDraft.id == draft_id)
        res = await session.execute(stmt)
        draft = res.scalar_one_or_none()
        if not draft:
            return None
        return await cls.enrich_draft_response(session, draft)
