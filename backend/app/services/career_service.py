from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from sqlalchemy.orm import selectinload

from backend.app.models.candidate import Candidate
from backend.app.models.job import Job, MatchResult
from backend.app.models.application import Application
from backend.app.agents.skill_gap_agent import CareerSkillGapAgent
from backend.app.schemas.career import SkillGapAnalysisResponse
from backend.app.core.logging import logger


class CareerService:
    """
    Coordinates Career Skill Gap Analysis across candidate verified background,
    target roles, saved jobs, applied jobs, and matching requirement rejections.
    """

    @classmethod
    async def get_career_skill_gaps(
        cls,
        session: AsyncSession,
        candidate_id: Optional[str] = None,
    ) -> SkillGapAnalysisResponse:
        """
        Analyzes candidate verified background against saved, applied, and target market jobs
        to identify recurring skill gaps and generate a 3-phase learning roadmap.
        """
        # 1. Fetch Candidate
        candidate: Optional[Candidate] = None
        if candidate_id:
            cand_stmt = (
                select(Candidate)
                .options(
                    selectinload(Candidate.skills),
                    selectinload(Candidate.projects),
                    selectinload(Candidate.experiences),
                    selectinload(Candidate.career_preference),
                )
                .where(Candidate.id == candidate_id)
            )
            cand_res = await session.execute(cand_stmt)
            candidate = cand_res.scalar_one_or_none()

        if not candidate:
            # Fallback to primary candidate profile
            cand_stmt = (
                select(Candidate)
                .options(
                    selectinload(Candidate.skills),
                    selectinload(Candidate.projects),
                    selectinload(Candidate.experiences),
                    selectinload(Candidate.career_preference),
                )
                .limit(1)
            )
            cand_res = await session.execute(cand_stmt)
            candidate = cand_res.scalar_one_or_none()

        if not candidate:
            raise ValueError("Candidate profile not found. Please create or import a candidate profile first.")

        # 2. Fetch Applications (both saved and applied)
        app_stmt = (
            select(Application)
            .options(selectinload(Application.job))
            .where(Application.candidate_id == candidate.id)
            .order_by(Application.created_at.desc())
        )
        app_res = await session.execute(app_stmt)
        applications = list(app_res.scalars().all())

        # 3. Fetch Match Results
        match_stmt = (
            select(MatchResult)
            .where(MatchResult.candidate_id == candidate.id)
            .order_by(MatchResult.created_at.desc())
        )
        match_res = await session.execute(match_stmt)
        match_results = list(match_res.scalars().all())

        # 4. Fetch Target Jobs
        # Gather jobs from applications
        app_job_ids = {a.job_id for a in applications if a.job_id}
        target_jobs: List[Dict[str, Any]] = []

        for a in applications:
            if a.job:
                target_jobs.append({
                    "id": a.job.id,
                    "role": a.job.role,
                    "company": a.job.company,
                    "required_skills": a.job.required_skills or [],
                    "preferred_skills": a.job.preferred_skills or [],
                    "technologies": a.job.technologies or [],
                })

        # Also supplement with recent active jobs in database (up to 15) to ensure robust market signals
        job_stmt = (
            select(Job)
            .order_by(Job.created_at.desc())
            .limit(15)
        )
        j_res = await session.execute(job_stmt)
        additional_jobs = j_res.scalars().all()
        for j in additional_jobs:
            if j.id not in app_job_ids:
                target_jobs.append({
                    "id": j.id,
                    "role": j.role,
                    "company": j.company,
                    "required_skills": j.required_skills or [],
                    "preferred_skills": j.preferred_skills or [],
                    "technologies": j.technologies or [],
                })

        # 5. Format candidate data
        candidate_data = {
            "id": candidate.id,
            "full_name": candidate.full_name,
            "skills": [
                {
                    "name": s.name,
                    "proficiency": getattr(s, "proficiency_level", None) or "Intermediate",
                    "years_of_experience": getattr(s, "years_of_experience", None),
                }
                for s in (candidate.skills or [])
            ],
            "projects": [
                {
                    "id": p.id,
                    "title": getattr(p, "title", None) or getattr(p, "name", "Project"),
                    "description": p.description or "",
                    "technologies": p.technologies or [],
                }
                for p in (candidate.projects or [])
            ],
            "experiences": [
                {
                    "company": e.company,
                    "role": e.role,
                    "description": getattr(e, "description", None) or "",
                    "bullet_points": e.bullet_points or [],
                    "technologies_used": getattr(e, "technologies_used", None) or [],
                }
                for e in (candidate.experiences or [])
            ],
        }

        # Format applications
        apps_data = [
            {
                "id": a.id,
                "status": a.status,
                "job": {
                    "id": a.job.id,
                    "role": a.job.role,
                    "company": a.job.company,
                    "required_skills": a.job.required_skills or [],
                    "preferred_skills": a.job.preferred_skills or [],
                    "technologies": a.job.technologies or [],
                } if a.job else None,
            }
            for a in applications
        ]

        # Format match results
        matches_data = [
            {
                "id": m.id,
                "missing_required_skills": m.missing_required_skills or [],
                "missing_preferred_skills": m.missing_preferred_skills or [],
                "matched_skills": m.matched_skills or [],
            }
            for m in match_results
        ]

        # Career preferences
        pref_data = None
        if candidate.career_preference:
            pref_data = {
                "preferred_roles": candidate.career_preference.preferred_roles or [],
                "preferred_skills": getattr(candidate.career_preference, "preferred_skills", None) or [],
            }

        # 6. Run Agent
        result = CareerSkillGapAgent.analyze_skill_gaps(
            candidate_data=candidate_data,
            target_jobs=target_jobs,
            applications=apps_data,
            match_results=matches_data,
            career_preferences=pref_data,
        )

        return SkillGapAnalysisResponse(**result)
