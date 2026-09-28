import uuid
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc

from backend.app.models.candidate import Candidate
from backend.app.models.job import Job
from backend.app.models.github import GitHubAnalysis
from backend.app.agents.github_agent import GitHubCareerAgent
from backend.app.schemas.github import (
    GitHubAnalyzeRequest,
    GitHubAnalysisResponse,
    GitHubProfileSummary,
    DemonstratedSkillItem,
    MissingSkillItem,
    RelevantProjectItem,
    ResumeEvidenceItem,
    RecommendedImprovementItem,
)
from backend.app.core.logging import logger


class GitHubService:
    """
    Coordinates GitHub Career Analysis.
    Fetches permitted repository information, analyzes tech stack and deployment links,
    compares against target role requirements, and persists results.
    """

    @classmethod
    async def analyze_github(
        cls,
        session: AsyncSession,
        payload: GitHubAnalyzeRequest,
    ) -> GitHubAnalysisResponse:
        """
        Executes complete GitHub Career Analysis for a candidate against a target job.
        """
        username = payload.username.strip().lstrip("@")
        if not username:
            raise ValueError("GitHub username is required.")

        # 1. Fetch Candidate if provided or default
        candidate: Optional[Candidate] = None
        if payload.candidate_id:
            cand_stmt = select(Candidate).where(Candidate.id == payload.candidate_id)
            c_res = await session.execute(cand_stmt)
            candidate = c_res.scalar_one_or_none()
        else:
            cand_stmt = select(Candidate).limit(1)
            c_res = await session.execute(cand_stmt)
            candidate = c_res.scalar_one_or_none()

        # 2. Fetch Target Job if provided or default
        job: Optional[Job] = None
        target_role_skills: List[str] = []
        target_role: Optional[str] = None
        target_company: Optional[str] = None

        if payload.job_id:
            job_stmt = select(Job).where(Job.id == payload.job_id)
            j_res = await session.execute(job_stmt)
            job = j_res.scalar_one_or_none()

        if not job:
            # Fallback to latest analyzed job
            job_stmt = select(Job).order_by(Job.created_at.desc()).limit(1)
            j_res = await session.execute(job_stmt)
            job = j_res.scalar_one_or_none()

        if job:
            target_role = job.role
            target_company = job.company
            reqs = job.required_skills or []
            prefs = job.preferred_skills or []
            target_role_skills = list(dict.fromkeys(reqs + prefs))
        else:
            target_role = "Senior Software Engineer"
            target_company = "Target Tech Company"
            target_role_skills = ["Python", "FastAPI", "Kubernetes", "PostgreSQL", "Docker", "RAG"]

        # 3. Fetch GitHub Profile & Repositories
        profile_data, repos_data = await GitHubCareerAgent.fetch_github_profile_and_repos(
            username=username,
            github_token=payload.github_token,
        )

        # 4. Analyze Evidence & Compare against Target Role
        analysis_dict = GitHubCareerAgent.analyze_github_evidence(
            username=username,
            profile_data=profile_data,
            repos_data=repos_data,
            target_role_skills=target_role_skills,
            target_role=target_role,
            target_company=target_company,
        )

        # 5. Persist Analysis Record
        analysis_record = GitHubAnalysis(
            id=str(uuid.uuid4()),
            candidate_id=candidate.id if candidate else None,
            job_id=job.id if job else None,
            username=username,
            profile_summary=analysis_dict["profile_summary"],
            skills_demonstrated=analysis_dict["skills_demonstrated"],
            skills_missing_evidence=analysis_dict["skills_missing_evidence"],
            relevant_projects=analysis_dict["relevant_projects"],
            potential_resume_evidence=analysis_dict["potential_resume_evidence"],
            recommended_improvements=analysis_dict["recommended_improvements"],
            metadata_json={
                "target_role": target_role,
                "target_company": target_company,
            },
        )
        session.add(analysis_record)
        await session.commit()
        await session.refresh(analysis_record)

        return GitHubAnalysisResponse(
            id=analysis_record.id,
            candidate_id=analysis_record.candidate_id,
            job_id=analysis_record.job_id,
            target_role=target_role,
            target_company=target_company,
            profile_summary=GitHubProfileSummary(**analysis_record.profile_summary),
            skills_demonstrated=[DemonstratedSkillItem(**s) for s in analysis_record.skills_demonstrated],
            skills_missing_evidence=[MissingSkillItem(**m) for m in analysis_record.skills_missing_evidence],
            relevant_projects=[RelevantProjectItem(**p) for p in analysis_record.relevant_projects],
            potential_resume_evidence=[ResumeEvidenceItem(**r) for r in analysis_record.potential_resume_evidence],
            recommended_improvements=[RecommendedImprovementItem(**i) for i in analysis_record.recommended_improvements],
            created_at=analysis_record.created_at,
        )

    @classmethod
    async def get_latest_analysis(
        cls,
        session: AsyncSession,
        username: Optional[str] = None,
        candidate_id: Optional[str] = None,
    ) -> Optional[GitHubAnalysisResponse]:
        """
        Retrieves the latest cached GitHub analysis for a user or candidate.
        """
        stmt = select(GitHubAnalysis).order_by(GitHubAnalysis.created_at.desc())
        if username:
            stmt = stmt.where(GitHubAnalysis.username == username.strip().lstrip("@"))
        if candidate_id:
            stmt = stmt.where(GitHubAnalysis.candidate_id == candidate_id)

        res = await session.execute(stmt)
        record = res.scalar_one_or_none()
        if not record:
            return None

        target_role = record.metadata_json.get("target_role")
        target_company = record.metadata_json.get("target_company")

        return GitHubAnalysisResponse(
            id=record.id,
            candidate_id=record.candidate_id,
            job_id=record.job_id,
            target_role=target_role,
            target_company=target_company,
            profile_summary=GitHubProfileSummary(**record.profile_summary),
            skills_demonstrated=[DemonstratedSkillItem(**s) for s in record.skills_demonstrated],
            skills_missing_evidence=[MissingSkillItem(**m) for m in record.skills_missing_evidence],
            relevant_projects=[RelevantProjectItem(**p) for p in record.relevant_projects],
            potential_resume_evidence=[ResumeEvidenceItem(**r) for r in record.potential_resume_evidence],
            recommended_improvements=[RecommendedImprovementItem(**i) for i in record.recommended_improvements],
            created_at=record.created_at,
        )
