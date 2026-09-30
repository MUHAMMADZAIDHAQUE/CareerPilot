import datetime
import uuid
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc
from sqlalchemy.orm import selectinload

from backend.app.models.job import Job, MatchResult
from backend.app.models.candidate import Candidate
from backend.app.models.resume import ResumeVersion
from backend.app.models.referral import ReferralContact
from backend.app.models.outreach import OutreachDraft, OutreachDispatch
from backend.app.models.application import (
    Application,
    ApplicationStatus,
    InboundResponse,
    Assessment,
    Deadline,
    InterviewEvent,
    Notification,
    ConnectedProvider,
)
from backend.app.schemas.application import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse,
    KanbanBoardResponse,
    InboundResponseResponse,
    AssessmentResponse,
    DeadlineResponse,
    InterviewEventResponse,
    NotificationResponse,
    ConnectedProviderResponse,
    ApplicationDetailResponse,
)
from backend.app.core.logging import logger


class ApplicationService:
    """
    Service for Application CRM, tracking job opportunities across the Kanban lifecycle.
    """

    # Mapping of Kanban columns to corresponding ApplicationStatus values across full 16 stages
    KANBAN_COLUMN_MAP: Dict[str, List[str]] = {
        "Saved": [
            ApplicationStatus.SAVED,
            ApplicationStatus.DISCOVERED,
            ApplicationStatus.ANALYZING,
            ApplicationStatus.RESUME_PREPARED,
            ApplicationStatus.RESUME_APPROVED,
            ApplicationStatus.REFERRAL_RESEARCH,
            ApplicationStatus.OUTREACH_PREPARED,
            ApplicationStatus.OUTREACH_APPROVED,
            ApplicationStatus.OUTREACH_SENT,
        ],
        "Ready": [ApplicationStatus.APPLICATION_READY, ApplicationStatus.READY_TO_APPLY],
        "Applied": [ApplicationStatus.APPLIED],
        "Screening": [ApplicationStatus.SCREENING, ApplicationStatus.ASSESSMENT],
        "Interview": [
            ApplicationStatus.INTERVIEW,
            ApplicationStatus.TECHNICAL,
            ApplicationStatus.FINAL_ROUND,
        ],
        "Offer": [ApplicationStatus.OFFER],
        "Rejected": [ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN],
    }

    # Reverse lookup for stage drops: column name -> default status
    COLUMN_DEFAULT_STATUS: Dict[str, str] = {
        "Saved": ApplicationStatus.SAVED,
        "Ready": ApplicationStatus.APPLICATION_READY,
        "Applied": ApplicationStatus.APPLIED,
        "Screening": ApplicationStatus.ASSESSMENT,
        "Interview": ApplicationStatus.INTERVIEW,
        "Offer": ApplicationStatus.OFFER,
        "Rejected": ApplicationStatus.REJECTED,
    }

    @classmethod
    async def _populate_response(
        cls,
        session: AsyncSession,
        app: Application,
    ) -> ApplicationResponse:
        """Helper to attach job, resume version, and match score metadata."""
        job_data = None
        match_score = None

        if app.job:
            job_data = {
                "id": app.job.id,
                "company": app.job.company,
                "role": app.job.role,
                "location": app.job.location,
                "employment_type": app.job.employment_type,
                "application_url": app.job.application_url,
            }

            # Fetch latest match score if candidate available
            if app.candidate_id:
                stmt = (
                    select(MatchResult.overall_match_score)
                    .where(
                        and_(
                            MatchResult.job_id == app.job_id,
                            MatchResult.candidate_id == app.candidate_id,
                        )
                    )
                    .order_by(desc(MatchResult.created_at))
                    .limit(1)
                )
                m_res = await session.execute(stmt)
                match_score = m_res.scalar_one_or_none()

        resume_data = None
        if app.resume_version:
            resume_data = {
                "id": app.resume_version.id,
                "version_number": app.resume_version.version_number,
                "validation_status": app.resume_version.validation_status,
            }

        return ApplicationResponse(
            id=app.id,
            job_id=app.job_id,
            candidate_id=app.candidate_id,
            resume_version_id=app.resume_version_id,
            status=app.status,
            applied_at=app.applied_at,
            source=app.source,
            referral_status=app.referral_status,
            interview_stage=app.interview_stage,
            notes=app.notes,
            next_action=app.next_action,
            next_followup_date=app.next_followup_date,
            metadata_json=app.metadata_json,
            created_at=app.created_at,
            updated_at=app.updated_at,
            job=job_data,
            resume_version=resume_data,
            match_score=match_score,
        )

    @classmethod
    async def create_application(
        cls,
        session: AsyncSession,
        payload: ApplicationCreate,
    ) -> ApplicationResponse:
        """Creates a new tracked application in the CRM."""
        # 1. Verify Job exists
        j_stmt = select(Job).where(Job.id == payload.job_id)
        j_res = await session.execute(j_stmt)
        job = j_res.scalar_one_or_none()
        if not job:
            raise ValueError(f"Job with ID '{payload.job_id}' not found.")

        # 2. Candidate resolution
        candidate_id = payload.candidate_id
        if not candidate_id:
            c_stmt = select(Candidate.id).limit(1)
            c_res = await session.execute(c_stmt)
            candidate_id = c_res.scalar_one_or_none()

        # 3. Status validation
        status = payload.status.upper()
        if status not in ApplicationStatus.ALL:
            raise ValueError(
                f"Invalid status '{payload.status}'. Must be one of: {', '.join(ApplicationStatus.ALL)}"
            )

        applied_at = payload.applied_at
        if status == ApplicationStatus.APPLIED and not applied_at:
            applied_at = datetime.datetime.now(datetime.timezone.utc)

        # 4. Check if an application already exists for this (job_id, candidate_id)
        if candidate_id:
            existing_stmt = select(Application).where(
                and_(Application.job_id == payload.job_id, Application.candidate_id == candidate_id)
            )
            existing_res = await session.execute(existing_stmt)
            existing_app = existing_res.scalar_one_or_none()
            if existing_app:
                # Update existing rather than creating duplicate
                existing_app.status = status
                if payload.resume_version_id:
                    existing_app.resume_version_id = payload.resume_version_id
                if payload.source:
                    existing_app.source = payload.source
                if payload.referral_status:
                    existing_app.referral_status = payload.referral_status
                if payload.interview_stage:
                    existing_app.interview_stage = payload.interview_stage
                if payload.notes:
                    existing_app.notes = payload.notes
                if payload.next_action:
                    existing_app.next_action = payload.next_action
                if payload.next_followup_date:
                    existing_app.next_followup_date = payload.next_followup_date
                if applied_at:
                    existing_app.applied_at = applied_at
                await session.commit()
                await session.refresh(existing_app)
                return await cls._populate_response(session, existing_app)

        app_record = Application(
            job_id=payload.job_id,
            candidate_id=candidate_id,
            resume_version_id=payload.resume_version_id,
            status=status,
            applied_at=applied_at,
            source=payload.source or "direct",
            referral_status=payload.referral_status or "none",
            interview_stage=payload.interview_stage,
            notes=payload.notes,
            next_action=payload.next_action,
            next_followup_date=payload.next_followup_date,
            metadata_json=payload.metadata_json or {},
        )
        session.add(app_record)
        await session.commit()
        await session.refresh(app_record)

        logger.info(f"Created application CRM record for job '{job.role} at {job.company}' with status {status}.")
        return await cls._populate_response(session, app_record)

    @classmethod
    async def get_application(
        cls,
        session: AsyncSession,
        application_id: str,
    ) -> Optional[ApplicationResponse]:
        """Gets a single application by ID."""
        stmt = (
            select(Application)
            .options(selectinload(Application.job), selectinload(Application.resume_version))
            .where(Application.id == application_id)
        )
        res = await session.execute(stmt)
        record = res.scalar_one_or_none()
        if not record:
            return None
        return await cls._populate_response(session, record)

    @classmethod
    async def update_application(
        cls,
        session: AsyncSession,
        application_id: str,
        payload: ApplicationUpdate,
    ) -> Optional[ApplicationResponse]:
        """Updates application stage, notes, followup date, or resume version."""
        stmt = (
            select(Application)
            .options(selectinload(Application.job), selectinload(Application.resume_version))
            .where(Application.id == application_id)
        )
        res = await session.execute(stmt)
        record = res.scalar_one_or_none()
        if not record:
            return None

        update_dict = payload.model_dump(exclude_unset=True)

        if "status" in update_dict and update_dict["status"]:
            new_status = update_dict["status"].upper()
            if new_status not in ApplicationStatus.ALL:
                raise ValueError(
                    f"Invalid status '{new_status}'. Must be one of: {', '.join(ApplicationStatus.ALL)}"
                )
            record.status = new_status
            if new_status == ApplicationStatus.APPLIED and not record.applied_at:
                record.applied_at = datetime.datetime.now(datetime.timezone.utc)

        for field in [
            "resume_version_id",
            "applied_at",
            "source",
            "referral_status",
            "interview_stage",
            "notes",
            "next_action",
            "next_followup_date",
        ]:
            if field in update_dict:
                setattr(record, field, update_dict[field])

        if "metadata_json" in update_dict and update_dict["metadata_json"]:
            record.metadata_json = {**record.metadata_json, **update_dict["metadata_json"]}

        await session.commit()
        await session.refresh(record)
        return await cls._populate_response(session, record)

    @classmethod
    async def list_applications(
        cls,
        session: AsyncSession,
        candidate_id: Optional[str] = None,
        job_id: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[ApplicationResponse]:
        """Lists applications with optional filtering."""
        stmt = (
            select(Application)
            .options(selectinload(Application.job), selectinload(Application.resume_version))
            .order_by(desc(Application.updated_at))
        )
        conditions = []
        if candidate_id:
            conditions.append(or_(Application.candidate_id == candidate_id, Application.candidate_id.is_(None)))
        if job_id:
            conditions.append(Application.job_id == job_id)
        if status:
            conditions.append(Application.status == status.upper())

        if search:
            stmt = stmt.join(Job, Application.job_id == Job.id)
            conditions.append(
                or_(
                    Job.company.ilike(f"%{search}%"),
                    Job.role.ilike(f"%{search}%"),
                    Application.notes.ilike(f"%{search}%"),
                )
            )

        if conditions:
            stmt = stmt.where(and_(*conditions))

        stmt = stmt.offset(offset).limit(limit)
        res = await session.execute(stmt)
        records = res.scalars().all()

        responses = []
        for r in records:
            responses.append(await cls._populate_response(session, r))
        return responses

    @classmethod
    async def get_kanban_board(
        cls,
        session: AsyncSession,
        candidate_id: Optional[str] = None,
        search: Optional[str] = None,
    ) -> KanbanBoardResponse:
        """
        Organizes all applications into 7 structured Kanban columns:
        Saved, Ready, Applied, Screening, Interview, Offer, Rejected.
        """
        all_apps = await cls.list_applications(
            session=session,
            candidate_id=candidate_id,
            search=search,
            limit=500,
        )

        columns: Dict[str, List[ApplicationResponse]] = {
            col_name: [] for col_name in cls.KANBAN_COLUMN_MAP.keys()
        }

        # Distribute into columns
        default_col = "Discovered" if "Discovered" in columns else list(columns.keys())[0]
        for app_resp in all_apps:
            placed = False
            for col_name, allowed_statuses in cls.KANBAN_COLUMN_MAP.items():
                if app_resp.status in allowed_statuses:
                    columns[col_name].append(app_resp)
                    placed = True
                    break
            if not placed:
                columns[default_col].append(app_resp)

        return KanbanBoardResponse(
            columns=columns,
            total_applications=len(all_apps),
        )

    @classmethod
    async def get_application_detail(
        cls,
        session: AsyncSession,
        application_id: str,
    ) -> Optional[ApplicationDetailResponse]:
        """
        Comprehensive Application detail view:
        Combines job, tailored resume, referrals, outreach drafts,
        inbound responses, assessments, deadlines, interviews, and timeline.
        """
        stmt = (
            select(Application)
            .where(Application.id == application_id)
            .options(
                selectinload(Application.job),
                selectinload(Application.candidate),
                selectinload(Application.resume_version),
            )
        )
        res = await session.execute(stmt)
        app = res.scalar_one_or_none()
        if not app:
            return None

        app_resp = await cls._populate_response(session, app)

        # 1. Job details
        job_data = None
        if app.job:
            job_data = {
                "id": app.job.id,
                "company": app.job.company,
                "role": app.job.role,
                "normalized_title": getattr(app.job, "normalized_title", None) or app.job.role,
                "location": app.job.location,
                "remote_status": getattr(app.job, "remote_status", "Unknown"),
                "employment_type": app.job.employment_type,
                "experience_level": getattr(app.job, "experience_level", "Unknown"),
                "salary": app.job.salary,
                "deadline": app.job.deadline,
                "canonical_url": app.job.canonical_url,
                "application_url": app.job.application_url,
                "official_company_url": getattr(app.job, "official_company_url", None) or app.job.application_url,
                "source_name": getattr(app.job, "source_name", "Direct"),
                "raw_description": app.job.raw_description,
                "required_skills": app.job.required_skills or [],
                "preferred_skills": app.job.preferred_skills or [],
            }

        # 2. Resume version details
        resume_data = None
        if app.resume_version:
            rv = app.resume_version
            resume_data = {
                "id": rv.id,
                "version_number": rv.version_number,
                "job_id": rv.job_id,
                "pdf_path": getattr(rv, "pdf_path", None),
                "tex_path": getattr(rv, "tex_path", None),
                "approval_status": getattr(rv, "approval_status", "DRAFT"),
                "tailored_summary": getattr(rv, "tailored_summary", None),
            }

        # 3. Referral contacts
        ref_stmt = select(ReferralContact).where(ReferralContact.job_id == app.job_id).order_by(desc(ReferralContact.relevance_score))
        ref_res = await session.execute(ref_stmt)
        referral_contacts = [
            {
                "id": c.id,
                "name": c.name,
                "current_role": getattr(c, "current_title", "Engineer"),
                "company": c.company,
                "department": c.department,
                "referral_score": getattr(c, "relevance_score", 0.0),
                "connection_path": getattr(c, "relationship_type", "EMPLOYEE"),
                "is_selected": getattr(c, "outreach_status", "") == "SELECTED",
                "linkedin_url": getattr(c, "profile_url", None),
            }
            for c in ref_res.scalars().all()
        ]

        # 4. Outreach drafts & dispatches
        draft_stmt = select(OutreachDraft).where(OutreachDraft.job_id == app.job_id).order_by(desc(OutreachDraft.created_at))
        draft_res = await session.execute(draft_stmt)
        outreach_drafts = [
            {
                "id": d.id,
                "recipient_name": d.recipient_name,
                "channel": d.channel.value if hasattr(d.channel, "value") else str(d.channel),
                "status": d.status,
                "subject": d.subject,
                "message_body": d.message_body,
                "dispatch_status": d.dispatch_status,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in draft_res.scalars().all()
        ]

        # 5. Inbound Responses
        resp_stmt = select(InboundResponse).where(
            or_(
                InboundResponse.application_id == app.id,
                InboundResponse.job_id == app.job_id,
            )
        ).order_by(desc(InboundResponse.received_at))
        resp_res = await session.execute(resp_stmt)
        inbound_responses = [InboundResponseResponse.model_validate(r) for r in resp_res.scalars().all()]

        # 6. Assessments
        asmt_stmt = select(Assessment).where(
            or_(
                Assessment.application_id == app.id,
                Assessment.job_id == app.job_id,
            )
        ).order_by(desc(Assessment.created_at))
        asmt_res = await session.execute(asmt_stmt)
        assessments = [AssessmentResponse.model_validate(a) for a in asmt_res.scalars().all()]

        # 7. Deadlines
        dl_stmt = select(Deadline).where(Deadline.application_id == app.id).order_by(Deadline.due_date.asc())
        dl_res = await session.execute(dl_stmt)
        deadlines = [DeadlineResponse.model_validate(d) for d in dl_res.scalars().all()]

        # 8. Interview events
        ie_stmt = select(InterviewEvent).where(
            or_(
                InterviewEvent.application_id == app.id,
                InterviewEvent.job_id == app.job_id,
            )
        ).order_by(InterviewEvent.scheduled_at.asc())
        ie_res = await session.execute(ie_stmt)
        interviews = [InterviewEventResponse.model_validate(i) for i in ie_res.scalars().all()]

        # 9. Chronological Timeline construction
        timeline: List[Dict[str, Any]] = []

        if app.job and app.job.created_at:
            timeline.append({
                "timestamp": app.job.created_at.isoformat(),
                "event": "JOB_DISCOVERED",
                "title": f"Opportunity discovered at {app.job.company}",
                "detail": f"Role: {app.job.role} (Source: {app.job.source_name})",
            })

        if app.created_at:
            timeline.append({
                "timestamp": app.created_at.isoformat(),
                "event": "APPLICATION_TRACKED",
                "title": "Application tracked in CRM",
                "detail": f"Status initialized to {app.status}",
            })

        for d in outreach_drafts:
            if d.get("created_at"):
                timeline.append({
                    "timestamp": d["created_at"],
                    "event": "OUTREACH_PREPARED",
                    "title": f"Outreach drafted for {d['recipient_name']}",
                    "detail": f"Channel: {d['channel']} | Status: {d['status']}",
                })

        for r in inbound_responses:
            timeline.append({
                "timestamp": r.received_at.isoformat(),
                "event": "RESPONSE_RECEIVED",
                "title": f"Response received: {r.classification}",
                "detail": f"From: {r.sender} | Subject: {r.subject or 'Message'}",
            })

        for a in assessments:
            timeline.append({
                "timestamp": a.created_at.isoformat(),
                "event": "ASSESSMENT_DETECTED",
                "title": f"Assessment received: {a.title}",
                "detail": f"Platform: {a.platform} | Due: {a.deadline.isoformat() if a.deadline else 'Not specified'}",
            })

        for i in interviews:
            timeline.append({
                "timestamp": i.scheduled_at.isoformat(),
                "event": "INTERVIEW_SCHEDULED",
                "title": f"{i.interview_type} Interview with {i.company}",
                "detail": f"Status: {i.status} | Meeting: {i.meeting_url or 'Link in email'}",
            })

        # Sort timeline ascending by timestamp
        timeline.sort(key=lambda t: t["timestamp"])

        return ApplicationDetailResponse(
            application=app_resp,
            job=job_data,
            resume_version=resume_data,
            referral_contacts=referral_contacts,
            outreach_drafts=outreach_drafts,
            inbound_responses=inbound_responses,
            assessments=assessments,
            deadlines=deadlines,
            interview_events=interviews,
            timeline=timeline,
        )

    @classmethod
    async def delete_application(
        cls,
        session: AsyncSession,
        application_id: str,
    ) -> bool:
        """Deletes an application record from the CRM."""
        stmt = select(Application).where(Application.id == application_id)
        res = await session.execute(stmt)
        record = res.scalar_one_or_none()
        if not record:
            return False

        await session.delete(record)
        await session.commit()
        return True

    # -------------------------------------------------------------------------
    # Notification & Provider Helpers
    # -------------------------------------------------------------------------

    @classmethod
    async def list_notifications(
        cls,
        session: AsyncSession,
        candidate_id: Optional[str] = None,
    ) -> List[NotificationResponse]:
        query = select(Notification).order_by(desc(Notification.created_at))
        if candidate_id:
            query = query.where(Notification.candidate_id == candidate_id)
        res = await session.execute(query)
        return [NotificationResponse.model_validate(n) for n in res.scalars().all()]

    @classmethod
    async def mark_notification_read(
        cls,
        session: AsyncSession,
        notification_id: str,
    ) -> bool:
        res = await session.execute(select(Notification).where(Notification.id == notification_id))
        n = res.scalars().first()
        if not n:
            return False
        n.is_read = True
        await session.commit()
        return True

    @classmethod
    async def list_connected_providers(
        cls,
        session: AsyncSession,
        candidate_id: Optional[str] = None,
    ) -> List[ConnectedProviderResponse]:
        query = select(ConnectedProvider).order_by(desc(ConnectedProvider.created_at))
        if candidate_id:
            query = query.where(ConnectedProvider.candidate_id == candidate_id)
        res = await session.execute(query)
        return [ConnectedProviderResponse.model_validate(p) for p in res.scalars().all()]

    @classmethod
    async def connect_provider(
        cls,
        session: AsyncSession,
        provider_type: str,
        email_address: str,
        candidate_id: Optional[str] = None,
    ) -> ConnectedProviderResponse:
        cand_id = candidate_id
        if not cand_id:
            c_res = await session.execute(select(Candidate).order_by(desc(Candidate.created_at)).limit(1))
            cand = c_res.scalars().first()
            cand_id = cand.id if cand else None

        stmt = select(ConnectedProvider).where(
            ConnectedProvider.provider_type == provider_type.upper(),
        )
        if cand_id:
            stmt = stmt.where(ConnectedProvider.candidate_id == cand_id)
        existing = (await session.execute(stmt)).scalars().first()

        if existing:
            existing.email_address = email_address
            existing.is_connected = True
            existing.status = "CONNECTED"
            provider = existing
        else:
            provider = ConnectedProvider(
                id=str(uuid.uuid4()),
                candidate_id=cand_id,
                provider_type=provider_type.upper(),
                email_address=email_address,
                is_connected=True,
                status="CONNECTED",
                scopes=["https://www.googleapis.com/auth/gmail.send"] if provider_type.upper() == "GMAIL" else ["Mail.Send"],
                metadata_json={"connected_at": datetime.datetime.utcnow().isoformat()},
            )
            session.add(provider)

        await session.commit()
        await session.refresh(provider)
        return ConnectedProviderResponse.model_validate(provider)

    @classmethod
    async def disconnect_provider(
        cls,
        session: AsyncSession,
        provider_type: str,
        candidate_id: Optional[str] = None,
    ) -> bool:
        stmt = select(ConnectedProvider).where(
            ConnectedProvider.provider_type == provider_type.upper(),
        )
        if candidate_id:
            stmt = stmt.where(ConnectedProvider.candidate_id == candidate_id)
        existing = (await session.execute(stmt)).scalars().first()
        if not existing:
            return False
        await session.delete(existing)
        await session.commit()
        return True
