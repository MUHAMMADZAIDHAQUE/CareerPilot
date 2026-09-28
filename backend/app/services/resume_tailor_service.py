import uuid
from pathlib import Path
from typing import Optional, Dict, Any, Tuple, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.models.candidate import Candidate
from backend.app.models.job import Job, MatchResult
from backend.app.models.resume import ResumeDocument, ResumeVersion
from backend.app.agents.resume_tailor_agent import ResumeTailoringAgent
from backend.app.agents.resume_validator_agent import ResumeValidatorAgent
from backend.app.services.matching_service import MatchingService
from backend.app.schemas.tailoring import (
    TailorResumeRequest,
    TailorResumeResponse,
    ResumeVersionRead,
    ValidationReport,
    DiffSummary,
)
from backend.app.core.logging import logger

MASTER_RESUME_FALLBACK_PATH = Path("resume/master/sample_master_resume.tex")
MAX_TAILOR_RETRIES = 3


class ResumeTailorService:
    """
    Evidence-grounded Resume Tailoring Service.
    Coordinates between Tailoring Agent, Validator Agent, and Database Persistence.
    Enforces a strict regeneration loop whenever validation criteria are not met.
    """

    @classmethod
    async def get_or_load_master_resume(
        cls,
        session: AsyncSession,
        candidate_id: str,
        source_resume_id: Optional[str] = None,
    ) -> Tuple[str, Optional[str]]:
        """
        Retrieves the master LaTeX resume text.
        1. Explicit source_resume_id if provided.
        2. Most recent .tex ResumeDocument for candidate.
        3. Canonical master file at resume/master/sample_master_resume.tex.
        Never modifies any master copy.
        """
        # 1. Try explicit ID
        if source_resume_id:
            res = await session.execute(
                select(ResumeDocument).where(ResumeDocument.id == source_resume_id)
            )
            doc = res.scalar_one_or_none()
            if doc:
                p = Path(doc.storage_path)
                if p.exists() and p.suffix.lower() in {".tex", ".latex"}:
                    return p.read_text(encoding="utf-8"), doc.id
                if "\\documentclass" in doc.extracted_text:
                    return doc.extracted_text, doc.id

        # 2. Try candidate's latest uploaded .tex document
        res = await session.execute(
            select(ResumeDocument)
            .where(ResumeDocument.candidate_id == candidate_id, ResumeDocument.file_type == "tex")
            .order_by(ResumeDocument.created_at.desc())
        )
        doc = res.scalar_one_or_none()
        if doc:
            p = Path(doc.storage_path)
            if p.exists() and p.suffix.lower() in {".tex", ".latex"}:
                return p.read_text(encoding="utf-8"), doc.id
            if "\\documentclass" in doc.extracted_text:
                return doc.extracted_text, doc.id

        # 3. Fallback to master template file
        if MASTER_RESUME_FALLBACK_PATH.exists():
            return MASTER_RESUME_FALLBACK_PATH.read_text(encoding="utf-8"), None

        # Ultimate fallback skeleton if file missing
        skeleton = r"""\documentclass[letterpaper,11pt]{article}
\begin{document}
\section{Education}
\section{Experience}
\section{Projects}
\section{Technical Skills}
\end{document}"""
        return skeleton, None

    @classmethod
    async def tailor_resume_for_job(
        cls,
        session: AsyncSession,
        job_id: str,
        payload: Optional[TailorResumeRequest] = None,
    ) -> TailorResumeResponse:
        """
        End-to-end orchestration:
        1. Fetch Job and Candidate.
        2. Fetch or compute MatchResult.
        3. Fetch Master LaTeX resume.
        4. Tailoring + Validation loop (up to MAX_TAILOR_RETRIES).
        5. Persist to resume_versions.
        """
        payload = payload or TailorResumeRequest()

        # 1. Fetch Job
        job_res = await session.execute(select(Job).where(Job.id == job_id))
        job = job_res.scalar_one_or_none()
        if not job:
            raise ValueError(f"Job with ID '{job_id}' not found.")

        # 2. Fetch Candidate
        candidate: Optional[Candidate] = None
        if payload.candidate_id:
            c_res = await session.execute(select(Candidate).where(Candidate.id == payload.candidate_id))
            candidate = c_res.scalar_one_or_none()
        if not candidate:
            c_res = await session.execute(select(Candidate).order_by(Candidate.created_at.desc()))
            candidate = c_res.scalar_one_or_none()

        if not candidate:
            raise ValueError("No candidate profile found. Please create or import a profile first.")

        # 3. Fetch or compute Match Result
        m_res = await session.execute(
            select(MatchResult)
            .where(MatchResult.candidate_id == candidate.id, MatchResult.job_id == job.id)
            .order_by(MatchResult.created_at.desc())
        )
        match_result = m_res.scalar_one_or_none()
        if not match_result:
            logger.info(f"No existing match found for job {job_id}. Running matching engine...")
            match_response = await MatchingService.match_candidate_to_job(
                session=session,
                job_id=job.id,
                candidate_id=candidate.id,
            )
            # reload persisted match
            m_res = await session.execute(
                select(MatchResult).where(MatchResult.id == match_response.id)
            )
            match_result = m_res.scalar_one_or_none()

        # 4. Load Master LaTeX Resume (strictly read-only)
        master_latex, source_resume_id = await cls.get_or_load_master_resume(
            session=session,
            candidate_id=candidate.id,
            source_resume_id=payload.master_resume_id,
        )

        # Build data dictionaries for agents
        candidate_data = {
            "id": candidate.id,
            "full_name": candidate.full_name,
            "email": candidate.email,
            "headline": candidate.headline,
            "summary": candidate.summary,
            "skills": [
                {"name": s.name, "category": s.category, "proficiency": s.proficiency_level}
                for s in candidate.skills
            ],
            "experience": [
                {
                    "company_name": getattr(e, "company", getattr(e, "company_name", "")),
                    "job_title": getattr(e, "role", getattr(e, "job_title", "")),
                    "start_date": e.start_date,
                    "end_date": e.end_date,
                    "bullet_points": e.bullet_points,
                    "technologies_used": e.technologies_used,
                }
                for e in candidate.experiences
            ],
            "projects": [
                {
                    "title": p.title,
                    "description": p.description,
                    "technologies": p.technologies,
                    "bullet_points": p.bullet_points,
                }
                for p in candidate.projects
            ],
            "education": [
                {
                    "institution_name": getattr(ed, "institution", getattr(ed, "institution_name", "")),
                    "degree": ed.degree,
                    "field_of_study": ed.field_of_study,
                    "gpa": ed.gpa,
                }
                for ed in candidate.education
            ],
        }

        job_data = {
            "id": job.id,
            "role": job.role,
            "company": job.company,
            "required_skills": job.required_skills,
            "preferred_skills": job.preferred_skills,
            "technologies": job.technologies,
            "responsibilities": job.responsibilities,
        }

        match_data = {
            "matched_skills": match_result.matched_skills if match_result else [],
            "missing_required_skills": match_result.missing_required_skills if match_result else [],
            "missing_preferred_skills": match_result.missing_preferred_skills if match_result else [],
            "relevant_projects": match_result.relevant_projects if match_result else [],
            "evidence": match_result.evidence if match_result else [],
        }

        # 5. Tailoring + Validation Loop
        tailored_latex = master_latex
        diff_summary: Optional[DiffSummary] = None
        validation_report: Optional[ValidationReport] = None
        retries_attempted = 0
        validator_feedback: Optional[List[str]] = None

        for attempt in range(MAX_TAILOR_RETRIES):
            retries_attempted = attempt
            # Generate draft
            tailored_latex, diff_summary = ResumeTailoringAgent.tailor_resume(
                master_latex=master_latex,
                candidate_data=candidate_data,
                job_data=job_data,
                match_data=match_data,
                validator_feedback=validator_feedback,
                custom_instructions=payload.custom_instructions,
            )

            # Audit draft
            validation_report = ResumeValidatorAgent.audit_tailored_resume(
                tailored_latex=tailored_latex,
                master_latex=master_latex,
                candidate_data=candidate_data,
                job_data=job_data,
            )

            if validation_report.is_valid:
                logger.info(f"Resume passed validation on attempt {attempt + 1}")
                break
            else:
                logger.warning(
                    f"Validation failed on attempt {attempt + 1} with errors: {validation_report.errors}. Retrying with feedback..."
                )
                validator_feedback = validation_report.errors

        # Determine final status
        validation_status = "valid" if (validation_report and validation_report.is_valid) else "rejected"

        # Count existing versions for version number
        v_count_res = await session.execute(
            select(ResumeVersion).where(
                ResumeVersion.candidate_id == candidate.id, ResumeVersion.job_id == job.id
            )
        )
        existing_versions = len(v_count_res.scalars().all())
        version_number = existing_versions + 1

        # 6. Persist to resume_versions
        version_record = ResumeVersion(
            id=str(uuid.uuid4()),
            candidate_id=candidate.id,
            job_id=job.id,
            source_resume_id=source_resume_id,
            latex_content=tailored_latex,
            validation_status=validation_status,
            version_number=version_number,
            validation_details=validation_report.model_dump() if validation_report else {},
            diff_summary=diff_summary.model_dump() if diff_summary else {},
        )
        session.add(version_record)
        await session.commit()
        await session.refresh(version_record)

        msg = (
            f"Successfully tailored resume version {version_number} for {job.role} at {job.company}."
            if validation_status == "valid"
            else f"Tailored resume generated with warnings/rejections: {'; '.join(validation_report.errors if validation_report else [])}"
        )

        return TailorResumeResponse(
            version=ResumeVersionRead.model_validate(version_record),
            master_resume_content=master_latex,
            validation_report=validation_report,
            diff_summary=diff_summary,
            message=msg,
            retries_attempted=retries_attempted,
        )

    @classmethod
    async def get_latest_tailored_version(
        cls,
        session: AsyncSession,
        job_id: str,
        candidate_id: Optional[str] = None,
    ) -> Optional[ResumeVersionRead]:
        """Fetches the latest tailored resume version for a job."""
        stmt = select(ResumeVersion).where(ResumeVersion.job_id == job_id)
        if candidate_id:
            stmt = stmt.where(ResumeVersion.candidate_id == candidate_id)
        stmt = stmt.order_by(ResumeVersion.created_at.desc())
        res = await session.execute(stmt)
        record = res.scalars().first()
        if record:
            return ResumeVersionRead.model_validate(record)
        return None

    @classmethod
    async def get_version_by_id(
        cls,
        session: AsyncSession,
        version_id: str,
    ) -> Optional[ResumeVersionRead]:
        """Fetches a specific resume version by ID."""
        res = await session.execute(
            select(ResumeVersion).where(ResumeVersion.id == version_id)
        )
        record = res.scalar_one_or_none()
        if record:
            return ResumeVersionRead.model_validate(record)
        return None
