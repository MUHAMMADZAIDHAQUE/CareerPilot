import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc
from sqlalchemy.orm import selectinload

from backend.app.models.job import Job, MatchResult
from backend.app.models.candidate import Candidate
from backend.app.models.resume import ResumeVersion
from backend.app.models.application import Application, ApplicationStatus
from backend.app.schemas.application import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse,
    KanbanBoardResponse,
)
from backend.app.core.logging import logger


class ApplicationService:
    """
    Service for Application CRM, tracking job opportunities across the Kanban lifecycle.
    """

    # Mapping of 7 primary Kanban columns to corresponding ApplicationStatus values
    KANBAN_COLUMN_MAP: Dict[str, List[str]] = {
        "Saved": [ApplicationStatus.SAVED],
        "Ready": [ApplicationStatus.READY_TO_APPLY],
        "Applied": [ApplicationStatus.APPLIED],
        "Screening": [ApplicationStatus.SCREENING],
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
        "Ready": ApplicationStatus.READY_TO_APPLY,
        "Applied": ApplicationStatus.APPLIED,
        "Screening": ApplicationStatus.SCREENING,
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
        for app_resp in all_apps:
            placed = False
            for col_name, allowed_statuses in cls.KANBAN_COLUMN_MAP.items():
                if app_resp.status in allowed_statuses:
                    columns[col_name].append(app_resp)
                    placed = True
                    break
            if not placed:
                # Default fallback to Saved
                columns["Saved"].append(app_resp)

        return KanbanBoardResponse(
            columns=columns,
            total_applications=len(all_apps),
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
