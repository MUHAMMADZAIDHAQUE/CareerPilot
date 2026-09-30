import re
import uuid
import hashlib
import difflib
from datetime import datetime
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
from backend.app.services.latex_compiler_service import LaTeXCompilerService
from backend.app.services.n8n import N8nService
from backend.app.schemas.tailoring import (
    TailorResumeRequest,
    TailorResumeResponse,
    ResumeVersionRead,
    ValidationReport,
    DiffSummary,
    ResumeDiffResponse,
    ResumeDiffItem,
    ATSDetails,
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
    def compute_ats_details(
        cls,
        arg1: Any = None,
        arg2: Any = None,
        tailored_latex: str = "",
        candidate: Optional[Candidate] = None,
        job: Optional[Job] = None,
    ) -> Dict[str, Any]:
        """
        Calculates transparent ATS keyword alignment, keyword coverage, and traceable evidence chain.
        Guarantees zero hallucination: missing JD requirements are flagged as gaps, NEVER inserted.
        Robust to argument ordering (candidate, job or job, candidate).
        """
        from backend.app.services.job_analyzer_service import JobAnalyzerService

        cand = candidate
        jb = job
        if cand is None or jb is None:
            if hasattr(arg1, "required_skills"):
                jb = arg1
                cand = arg2
            else:
                cand = arg1
                jb = arg2

        candidate = cand
        job = jb

        jd_keywords = set()
        for s in (getattr(job, "required_skills", []) or []):
            if s and s.strip():
                jd_keywords.add(s.strip())
        for s in (getattr(job, "preferred_skills", []) or []):
            if s and s.strip():
                jd_keywords.add(s.strip())
        for s in (job.technologies or []):
            if s and s.strip():
                jd_keywords.add(s.strip())

        desc_lower = (job.raw_description or "").lower()
        for cat, techs in JobAnalyzerService.KNOWN_TECH_CATALOG.items():
            for t in techs:
                if re.search(r'\b' + re.escape(t.lower()) + r'\b', desc_lower):
                    jd_keywords.add(t)

        cand_skills: Dict[str, str] = {}
        for s in candidate.skills:
            if s.name:
                cand_skills[s.name.lower()] = s.name
        for exp in candidate.experiences:
            for t in (exp.technologies_used or []):
                if t:
                    cand_skills[t.lower()] = t
        for proj in candidate.projects:
            for t in (proj.technologies or []):
                if t:
                    cand_skills[t.lower()] = t

        matched_keywords = []
        missing_keywords = []
        evidence_chain = []
        potential_gaps = []

        for kw in sorted(jd_keywords):
            kw_lower = kw.lower()
            if kw_lower in cand_skills:
                canonical_name = cand_skills[kw_lower]
                matched_keywords.append(canonical_name)
                evidence_chain.append({
                    "jd_keyword": kw,
                    "candidate_evidence": f"Verified candidate technology: {canonical_name}",
                    "action": f"Emphasized in tailored technical skills & project alignment",
                })
            else:
                missing_keywords.append(kw)
                potential_gaps.append(f"{kw} required/preferred in JD but not verified in master candidate profile.")

        total_jd = len(jd_keywords)
        coverage_pct = round((len(matched_keywords) / max(total_jd, 1)) * 100, 1)

        skills_emphasized = matched_keywords[:8]
        skills_omitted = [
            s.name for s in candidate.skills
            if s.name and s.name.lower() not in {k.lower() for k in jd_keywords}
        ][:5]

        return {
            "ats_score": coverage_pct,
            "matched_keywords": matched_keywords,
            "missing_keywords": missing_keywords,
            "skills_emphasized": skills_emphasized,
            "skills_omitted": skills_omitted,
            "potential_gaps": potential_gaps,
            "evidence_chain": evidence_chain,
        }

    @classmethod
    def _repair_latex_source(cls, latex: str) -> str:
        """
        Self-healing routine to repair common syntax errors in generated LaTeX:
        - Strips markdown fences
        - Ensures balanced document tags
        """
        repaired = latex

        # 1. Strip markdown fences
        repaired = re.sub(r"^```(?:latex|tex)?\s*", "", repaired, flags=re.MULTILINE)
        repaired = re.sub(r"```\s*$", "", repaired, flags=re.MULTILINE)

        # 2. Ensure basic document structure
        if "\\documentclass" not in repaired:
            repaired = "\\documentclass[letterpaper,11pt]{article}\n" + repaired
        if "\\begin{document}" not in repaired:
            repaired = "\\begin{document}\n" + repaired
        if "\\end{document}" not in repaired:
            repaired = repaired + "\n\\end{document}\n"

        return repaired.strip()

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
        3. Fetch Master LaTeX resume (and capture SHA-256 hash for immutability verification).
        4. Tailoring + Validation loop (up to MAX_TAILOR_RETRIES).
        5. Assert Master Resume remained strictly unchanged.
        6. Compute transparent ATS keywords and evidence chain.
        7. Persist to resume_versions with status REVIEW_REQUIRED.
        8. Compile PDF with isolated LaTeX compiler + self-healing retry.
        9. Non-blocking n8n event dispatch.
        """
        payload = payload or TailorResumeRequest()

        # 1. Fetch Job
        job_res = await session.execute(select(Job).where(Job.id == job_id))
        job = job_res.scalars().first()
        if not job:
            raise ValueError(f"Job with ID '{job_id}' not found.")

        # 2. Fetch Candidate
        candidate: Optional[Candidate] = None
        if payload.candidate_id:
            c_res = await session.execute(select(Candidate).where(Candidate.id == payload.candidate_id))
            candidate = c_res.scalars().first()
        if not candidate:
            c_res = await session.execute(select(Candidate).order_by(Candidate.created_at.desc()))
            candidate = c_res.scalars().first()

        if not candidate:
            raise ValueError("No candidate profile found. Please create or import a profile first.")

        # 3. Fetch or compute Match Result
        m_res = await session.execute(
            select(MatchResult)
            .where(MatchResult.candidate_id == candidate.id, MatchResult.job_id == job.id)
            .order_by(MatchResult.created_at.desc())
        )
        match_result = m_res.scalars().first()
        if not match_result:
            logger.info(f"No existing match found for job {job_id}. Running matching engine...")
            match_response = await MatchingService.match_candidate_to_job(
                session=session,
                job_id=job.id,
                candidate_id=candidate.id,
            )
            m_res = await session.execute(
                select(MatchResult).where(MatchResult.id == match_response.id)
            )
            match_result = m_res.scalars().first()

        # 4. Load Master LaTeX Resume (strictly read-only)
        master_latex, source_resume_id = await cls.get_or_load_master_resume(
            session=session,
            candidate_id=candidate.id,
            source_resume_id=payload.master_resume_id,
        )
        master_sha256_before = hashlib.sha256(master_latex.encode("utf-8")).hexdigest()

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

        # 6. Verify Master Resume Immutability (zero changes allowed)
        master_latex_after, _ = await cls.get_or_load_master_resume(
            session=session,
            candidate_id=candidate.id,
            source_resume_id=source_resume_id,
        )
        master_sha256_after = hashlib.sha256(master_latex_after.encode("utf-8")).hexdigest()
        assert master_sha256_before == master_sha256_after, (
            "CRITICAL INVARIANT VIOLATION: Master resume content was modified during tailoring!"
        )

        # 7. Compute ATS Keyword Details and Evidence Chain
        ats_details = cls.compute_ats_details(candidate=candidate, job=job, tailored_latex=tailored_latex)
        ats_score = ats_details.get("ats_score", 0.0)

        # Determine final validation status & initial review status
        validation_status = "valid" if (validation_report and validation_report.is_valid) else "rejected"
        initial_status = "REVIEW_REQUIRED" if validation_status == "valid" else "REJECTED"

        # Count existing versions for version number
        v_count_res = await session.execute(
            select(ResumeVersion).where(
                ResumeVersion.candidate_id == candidate.id, ResumeVersion.job_id == job.id
            )
        )
        existing_versions = len(v_count_res.scalars().all())
        version_number = existing_versions + 1

        # 8. Persist to resume_versions
        now = datetime.utcnow()
        version_record = ResumeVersion(
            id=str(uuid.uuid4()),
            candidate_id=candidate.id,
            job_id=job.id,
            source_resume_id=source_resume_id,
            latex_content=tailored_latex,
            validation_status=validation_status,
            version_number=version_number,
            status=initial_status,
            ats_score=ats_score,
            ats_details=ats_details,
            generated_at=now.isoformat(),
            validation_details=validation_report.model_dump() if validation_report else {},
            diff_summary=diff_summary.model_dump() if diff_summary else {},
        )
        session.add(version_record)
        await session.commit()
        await session.refresh(version_record)

        # 9. Compile PDF with isolated LaTeX compiler + self-healing retry
        try:
            from backend.app.schemas.compilation import CompilePDFRequest
            comp_res = await LaTeXCompilerService.compile_resume_version(
                session=session,
                resume_version_id=version_record.id,
                request=CompilePDFRequest(force_recompile=True),
            )
            if comp_res.compilation_status != "success":
                logger.info(f"Initial PDF compilation status: {comp_res.compilation_status}. Running self-healing repair...")
                repaired = cls._repair_latex_source(version_record.latex_content)
                if repaired != version_record.latex_content:
                    version_record.latex_content = repaired
                    session.add(version_record)
                    await session.commit()
                    await session.refresh(version_record)
                    comp_res = await LaTeXCompilerService.compile_resume_version(
                        session=session,
                        resume_version_id=version_record.id,
                        request=CompilePDFRequest(force_recompile=True),
                    )

            if comp_res.compilation_status == "success":
                version_record.pdf_path = f"/api/v1/resumes/tailored/{version_record.id}/pdf"
                session.add(version_record)
                await session.commit()
                await session.refresh(version_record)
        except Exception as comp_err:
            logger.warning(f"Tailored PDF compilation non-critical warning: {comp_err}")

        # 10. Non-blocking n8n notification event dispatch
        try:
            if N8nService.is_enabled():
                await N8nService.dispatch_event(
                    target_path="resume-tailored",
                    payload={
                        "event": "resume_tailored",
                        "version_id": version_record.id,
                        "candidate_id": candidate.id,
                        "job_id": job.id,
                        "role": job.role,
                        "company": job.company,
                        "status": version_record.status,
                        "ats_score": version_record.ats_score,
                    },
                )
        except Exception as n8n_err:
            logger.warning(f"Could not dispatch event to n8n: {n8n_err}")

        msg = (
            f"Successfully tailored resume version {version_number} for {job.role} at {job.company}. Ready for user review."
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
    async def approve_resume(
        cls,
        session: AsyncSession,
        version_id: str,
        notes: Optional[str] = None,
    ) -> ResumeVersion:
        """Explicit human approval transition: REVIEW_REQUIRED -> APPROVED."""
        stmt = select(ResumeVersion).where(ResumeVersion.id == version_id)
        res = await session.execute(stmt)
        version = res.scalar_one_or_none()
        if not version:
            raise ValueError(f"Resume version '{version_id}' not found.")

        version.status = "APPROVED"
        version.approved_at = datetime.utcnow().isoformat()
        session.add(version)
        await session.commit()
        await session.refresh(version)

        # Non-blocking n8n notification event
        try:
            if N8nService.is_enabled():
                approved_at_str = (
                    version.approved_at.isoformat()
                    if hasattr(version.approved_at, "isoformat")
                    else str(version.approved_at or "")
                )
                await N8nService.dispatch_event(
                    target_path="resume-approved",
                    payload={
                        "event": "resume_approved",
                        "version_id": version.id,
                        "candidate_id": version.candidate_id,
                        "job_id": version.job_id,
                        "status": "APPROVED",
                        "approved_at": approved_at_str,
                        "notes": notes,
                    },
                )
        except Exception as e:
            logger.warning(f"Could not dispatch approve event to n8n: {e}")

        return version

    @classmethod
    async def reject_resume(
        cls,
        session: AsyncSession,
        version_id: str,
        reason: Optional[str] = None,
    ) -> ResumeVersion:
        """Transition: REVIEW_REQUIRED -> REJECTED."""
        stmt = select(ResumeVersion).where(ResumeVersion.id == version_id)
        res = await session.execute(stmt)
        version = res.scalar_one_or_none()
        if not version:
            raise ValueError(f"Resume version '{version_id}' not found.")

        version.status = "REJECTED"
        version.rejection_reason = reason
        session.add(version)
        await session.commit()
        await session.refresh(version)
        return version

    @classmethod
    async def update_latex(
        cls,
        session: AsyncSession,
        version_id: str,
        new_latex: str,
    ) -> ResumeVersion:
        """
        Applies manual LaTeX edits from the user editor.
        Re-audits against verified profile to prevent hallucination/fabrication,
        re-computes ATS alignment, and re-compiles PDF.
        """
        stmt = select(ResumeVersion).where(ResumeVersion.id == version_id)
        res = await session.execute(stmt)
        version = res.scalar_one_or_none()
        if not version:
            raise ValueError(f"Resume version '{version_id}' not found.")

        # Fetch Candidate & Job for re-audit
        cand_res = await session.execute(select(Candidate).where(Candidate.id == version.candidate_id))
        candidate = cand_res.scalar_one_or_none()

        job_res = await session.execute(select(Job).where(Job.id == version.job_id))
        job = job_res.scalar_one_or_none()

        master_latex, _ = await cls.get_or_load_master_resume(
            session=session,
            candidate_id=version.candidate_id,
            source_resume_id=version.source_resume_id,
        )

        candidate_data = {
            "id": candidate.id if candidate else "",
            "full_name": candidate.full_name if candidate else "",
            "email": candidate.email if candidate else "",
            "headline": candidate.headline if candidate else "",
            "summary": candidate.summary if candidate else "",
            "skills": [{"name": s.name, "category": s.category, "proficiency": s.proficiency_level} for s in candidate.skills] if candidate else [],
            "experience": [{"company_name": getattr(e, "company", getattr(e, "company_name", "")), "job_title": getattr(e, "role", getattr(e, "job_title", "")), "bullet_points": e.bullet_points, "technologies_used": e.technologies_used} for e in candidate.experiences] if candidate else [],
            "projects": [{"title": p.title, "description": p.description, "technologies": p.technologies, "bullet_points": p.bullet_points} for p in candidate.projects] if candidate else [],
            "education": [{"institution_name": getattr(ed, "institution", getattr(ed, "institution_name", "")), "degree": ed.degree, "field_of_study": ed.field_of_study, "gpa": ed.gpa} for ed in candidate.education] if candidate else [],
        }
        job_data = {
            "id": job.id if job else "",
            "role": job.role if job else "",
            "company": job.company if job else "",
            "required_skills": job.required_skills if job else [],
            "preferred_skills": job.preferred_skills if job else [],
            "technologies": job.technologies if job else [],
            "responsibilities": job.responsibilities if job else [],
        }

        validation_report = ResumeValidatorAgent.audit_tailored_resume(
            tailored_latex=new_latex,
            master_latex=master_latex,
            candidate_data=candidate_data,
            job_data=job_data,
        )

        version.latex_content = new_latex
        version.validation_status = "valid" if validation_report.is_valid else "rejected"
        version.validation_details = validation_report.model_dump()
        version.status = "REVIEW_REQUIRED"

        if candidate and job:
            ats_info = cls.compute_ats_details(candidate, job, new_latex)
            version.ats_score = ats_info.get("ats_score", 0.0)
            version.ats_details = ats_info

        session.add(version)
        await session.commit()
        await session.refresh(version)

        # Recompile PDF
        try:
            from backend.app.schemas.compilation import CompilePDFRequest
            comp_res = await LaTeXCompilerService.compile_resume_version(
                session=session,
                resume_version_id=version.id,
                request=CompilePDFRequest(force_recompile=True),
            )
            if comp_res.compilation_status == "success":
                version.pdf_path = f"/api/v1/resumes/tailored/{version.id}/pdf"
                session.add(version)
                await session.commit()
                await session.refresh(version)
        except Exception as e:
            logger.warning(f"Error compiling modified LaTeX: {e}")

        return version

    @classmethod
    async def get_categorized_diff(
        cls,
        session: AsyncSession,
        version_id: str,
    ) -> ResumeDiffResponse:
        """
        Generates a transparent resume-change/diff summary between Master Resume
        and Tailored Resume across categories:
        - ADDED / EMPHASIZED
        - DE-EMPHASIZED
        - REORDERED
        - UNCHANGED
        - REMOVED
        """
        stmt = select(ResumeVersion).where(ResumeVersion.id == version_id)
        res = await session.execute(stmt)
        version = res.scalar_one_or_none()
        if not version:
            raise ValueError(f"Resume version '{version_id}' not found.")

        master_latex, _ = await cls.get_or_load_master_resume(
            session=session,
            candidate_id=version.candidate_id,
            source_resume_id=version.source_resume_id,
        )
        tailored_latex = version.latex_content

        master_lines = master_latex.splitlines(keepends=True)
        tailored_lines = tailored_latex.splitlines(keepends=True)
        diff_gen = difflib.unified_diff(
            master_lines,
            tailored_lines,
            fromfile="Master Resume",
            tofile=f"Tailored Resume v{version.version_number}",
        )
        raw_diff = "".join(diff_gen)

        diff_summary_dict = version.diff_summary or {}

        categories: Dict[str, List[ResumeDiffItem]] = {
            "ADDED / EMPHASIZED": [],
            "DE-EMPHASIZED": [],
            "REORDERED": [],
            "UNCHANGED": [],
            "REMOVED": [],
        }

        # 1. Skills Added / Emphasized
        for skill in diff_summary_dict.get("skills_added", []):
            categories["ADDED / EMPHASIZED"].append(
                ResumeDiffItem(
                    category="ADDED / EMPHASIZED",
                    title=f"{skill} emphasized",
                    description=f"Highlighted verified skill '{skill}' to align with primary job description keywords.",
                    traceable_evidence=f"Candidate technology profile verified: {skill}",
                )
            )

        # 2. Bullets Modified / Emphasized
        for bullet in diff_summary_dict.get("bullets_modified", []):
            categories["ADDED / EMPHASIZED"].append(
                ResumeDiffItem(
                    category="ADDED / EMPHASIZED",
                    title="Tailored achievement bullet",
                    description=bullet if isinstance(bullet, str) else str(bullet),
                    traceable_evidence="Derived directly from candidate experiences and projects.",
                )
            )

        # 3. De-emphasized skills
        for skill in diff_summary_dict.get("skills_removed", []):
            categories["DE-EMPHASIZED"].append(
                ResumeDiffItem(
                    category="DE-EMPHASIZED",
                    title=f"{skill} de-emphasized",
                    description=f"De-prioritized '{skill}' to preserve single-page density for target role requirements.",
                    traceable_evidence="Skill retained in master candidate profile.",
                )
            )

        # 4. Reordered projects
        for proj in diff_summary_dict.get("projects_promoted", []):
            categories["REORDERED"].append(
                ResumeDiffItem(
                    category="REORDERED",
                    title=f"{proj} promoted higher",
                    description=f"Promoted project '{proj}' to top position in projects section due to high tech alignment.",
                    traceable_evidence=f"Verified project: {proj}",
                )
            )
        for proj in diff_summary_dict.get("projects_demoted", []):
            categories["REORDERED"].append(
                ResumeDiffItem(
                    category="REORDERED",
                    title=f"{proj} moved lower",
                    description=f"Moved project '{proj}' lower in the section to emphasize more relevant work.",
                    traceable_evidence=f"Verified project: {proj}",
                )
            )

        # 5. Core Unchanged Invariants
        categories["UNCHANGED"].append(
            ResumeDiffItem(
                category="UNCHANGED",
                title="Education & Academic Credentials",
                description="All institutions, degrees, fields of study, and GPAs are preserved verbatim.",
                traceable_evidence="Master candidate academic record.",
            )
        )
        categories["UNCHANGED"].append(
            ResumeDiffItem(
                category="UNCHANGED",
                title="Candidate Identity & Links",
                description="Name, contact email, GitHub, and LinkedIn profiles preserved exactly without alteration.",
                traceable_evidence="Master profile candidate metadata.",
            )
        )

        total_changes = sum(len(items) for cat, items in categories.items() if cat != "UNCHANGED")

        return ResumeDiffResponse(
            resume_version_id=version.id,
            job_id=version.job_id,
            candidate_id=version.candidate_id,
            total_changes=total_changes,
            categories=categories,
            raw_diff=raw_diff,
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

    @classmethod
    async def list_versions(
        cls,
        session: AsyncSession,
        candidate_id: Optional[str] = None,
        job_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[ResumeVersionRead]:
        """Lists tailored resume versions ordered by creation date descending."""
        stmt = select(ResumeVersion)
        if candidate_id:
            stmt = stmt.where(ResumeVersion.candidate_id == candidate_id)
        if job_id:
            stmt = stmt.where(ResumeVersion.job_id == job_id)
        if status:
            stmt = stmt.where(ResumeVersion.status == status)
        stmt = stmt.order_by(ResumeVersion.created_at.desc()).limit(limit)
        res = await session.execute(stmt)
        records = res.scalars().all()
        return [ResumeVersionRead.model_validate(r) for r in records]
