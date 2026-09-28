from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional, List, Dict, Any
import datetime

from backend.app.models.candidate import Candidate
from backend.app.models.job import Job
from backend.app.models.application import Application, ApplicationStatus
from backend.app.models.outreach import Outreach, OutreachStatus
from backend.app.models.referral import Referral, Contact
from backend.app.models.interview import InterviewSession
from backend.app.models.resume import ResumeDocument, ResumeVersion, CompiledResumePDF
from backend.app.schemas.dashboard import (
    DashboardSummaryResponse,
    ProfileCompletionSummary,
    JobsDiscoveredSummary,
    StrongMatchItem,
    ApplicationSummary,
    ReferralOpportunityItem,
    PendingOutreachItem,
    InterviewItem,
    SkillGapSummaryItem,
    RecommendedProjectSummaryItem,
    FollowupItem,
    PipelineCounts,
)


class DashboardService:
    @staticmethod
    async def get_dashboard_summary(
        db: AsyncSession,
        candidate_id: Optional[str] = None,
    ) -> DashboardSummaryResponse:
        now = datetime.datetime.now(datetime.timezone.utc)

        # 1. Fetch Candidate
        candidate: Optional[Candidate] = None
        if candidate_id:
            res = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
            candidate = res.scalar_one_or_none()

        if not candidate:
            res = await db.execute(select(Candidate).order_by(Candidate.created_at.desc()).limit(1))
            candidate = res.scalar_one_or_none()

        # Extract Candidate attributes
        cand_name = candidate.full_name if candidate else "Career Candidate"
        cand_headline = candidate.headline if candidate else None
        skills_list = [s.name for s in (candidate.skills if candidate else [])]
        experiences_list = candidate.experiences if candidate else []
        education_list = candidate.education if candidate else []
        projects_list = candidate.projects if candidate else []
        has_github = bool(candidate and candidate.github_url)

        # Master resume check
        has_master_resume = False
        if candidate:
            resume_docs = await db.execute(
                select(ResumeDocument).where(ResumeDocument.candidate_id == candidate.id)
            )
            has_master_resume = len(resume_docs.scalars().all()) > 0

        # Calculate Profile Completion
        score = 0
        completed_items = []
        missing_items = []

        if candidate and candidate.full_name and candidate.email:
            score += 15
            completed_items.append("Personal Info (Name & Email)")
        else:
            missing_items.append("Personal Info (Name & Email)")

        if cand_headline or (candidate and candidate.summary):
            score += 10
            completed_items.append("Professional Headline / Summary")
        else:
            missing_items.append("Professional Headline / Summary")

        if len(skills_list) >= 3:
            score += 15
            completed_items.append(f"Core Skills ({len(skills_list)} added)")
        else:
            missing_items.append(f"Add at least 3 core skills (currently {len(skills_list)})")

        if len(experiences_list) >= 1:
            score += 15
            completed_items.append(f"Work Experience ({len(experiences_list)} added)")
        else:
            missing_items.append("Work Experience entries")

        if len(education_list) >= 1:
            score += 10
            completed_items.append("Education background")
        else:
            missing_items.append("Education background")

        if len(projects_list) >= 1:
            score += 15
            completed_items.append(f"Key Projects ({len(projects_list)} added)")
        else:
            missing_items.append("Key Projects & technical deliverables")

        if has_master_resume:
            score += 10
            completed_items.append("Master Resume Document")
        else:
            missing_items.append("Upload Master LaTeX or PDF Resume")

        if has_github:
            score += 10
            completed_items.append("GitHub Profile linked")
        else:
            missing_items.append("Link GitHub repository profile")

        score = min(score, 100)

        profile_summary = ProfileCompletionSummary(
            score=score,
            candidate_name=cand_name,
            candidate_headline=cand_headline,
            skills_count=len(skills_list),
            experiences_count=len(experiences_list),
            education_count=len(education_list),
            projects_count=len(projects_list),
            has_master_resume=has_master_resume,
            has_github_linked=has_github,
            completed_items=completed_items,
            missing_items=missing_items,
        )

        # 2. Jobs Discovered
        jobs_res = await db.execute(select(Job).order_by(Job.created_at.desc()))
        all_jobs: List[Job] = jobs_res.scalars().all()
        total_jobs = len(all_jobs)
        active_jobs = sum(1 for j in all_jobs if getattr(j, "is_active", True))

        sources_breakdown: Dict[str, int] = {}
        for j in all_jobs:
            st = getattr(j, "source_type", "direct") or "direct"
            sources_breakdown[st] = sources_breakdown.get(st, 0) + 1

        recent_jobs_payload = [
            {
                "id": j.id,
                "company": j.company,
                "role": j.role,
                "location": j.location or "Remote",
                "source_type": getattr(j, "source_type", "direct"),
                "source_name": getattr(j, "source_name", "Direct"),
                "created_at": j.created_at.isoformat() if j.created_at else None,
            }
            for j in all_jobs[:6]
        ]

        jobs_summary = JobsDiscoveredSummary(
            total_jobs=total_jobs,
            active_jobs=active_jobs,
            sources_breakdown=sources_breakdown,
            recent_jobs=recent_jobs_payload,
        )

        # 3. Strong Job Matches
        candidate_skills_lower = {s.lower() for s in skills_list}
        strong_matches: List[StrongMatchItem] = []

        for j in all_jobs:
            req_skills = j.required_skills or []
            matched = [s for s in req_skills if s.lower() in candidate_skills_lower]
            missing = [s for s in req_skills if s.lower() not in candidate_skills_lower]

            coverage = (len(matched) / len(req_skills)) if req_skills else 0.8
            stored_score = getattr(j, "match_score", None)
            calc_score = round(coverage * 100, 1) if stored_score is None else float(stored_score)

            if calc_score >= 60.0 or len(strong_matches) < 4:
                strong_matches.append(
                    StrongMatchItem(
                        job_id=j.id,
                        company=j.company,
                        role=j.role,
                        location=j.location,
                        match_score=calc_score,
                        matched_skills=matched[:6],
                        missing_skills=missing[:4],
                        created_at=j.created_at,
                    )
                )

        strong_matches.sort(key=lambda m: m.match_score, reverse=True)
        strong_matches = strong_matches[:6]

        # 4. Applications (CRM)
        app_res = await db.execute(
            select(Application).order_by(Application.updated_at.desc())
        )
        all_apps: List[Application] = app_res.scalars().all()
        by_status: Dict[str, int] = {st: 0 for st in ApplicationStatus.ALL}
        for a in all_apps:
            by_status[a.status] = by_status.get(a.status, 0) + 1

        recent_apps_payload = [
            {
                "id": a.id,
                "job_id": a.job_id,
                "company": a.job.company if a.job else "Target Company",
                "role": a.job.role if a.job else "Target Role",
                "status": a.status,
                "referral_status": a.referral_status or "none",
                "next_action": a.next_action,
                "next_followup_date": a.next_followup_date.isoformat() if a.next_followup_date else None,
            }
            for a in all_apps[:6]
        ]

        app_summary = ApplicationSummary(
            total_applications=len(all_apps),
            by_status=by_status,
            recent_applications=recent_apps_payload,
        )

        # 5. Referral Opportunities
        ref_res = await db.execute(
            select(Referral, Contact, Job)
            .join(Contact, Referral.contact_id == Contact.id)
            .join(Job, Referral.job_id == Job.id)
            .order_by(Referral.created_at.desc())
        )
        referral_rows = ref_res.all()
        referral_opportunities: List[ReferralOpportunityItem] = []
        for ref, con, job in referral_rows[:6]:
            referral_opportunities.append(
                ReferralOpportunityItem(
                    job_id=job.id,
                    job_role=job.role,
                    job_company=job.company,
                    contact_id=con.id,
                    contact_name=con.name,
                    contact_company=con.company,
                    relationship_type=ref.relationship_type,
                    relevance_reason=ref.relevance_reason or "Professional connection",
                    status=ref.status,
                )
            )

        # 6. Outreach Requiring Approval
        outreach_res = await db.execute(
            select(Outreach)
            .where(Outreach.status == OutreachStatus.NEEDS_REVIEW)
            .order_by(Outreach.created_at.desc())
        )
        pending_outreaches: List[Outreach] = outreach_res.scalars().all()
        pending_outreach_items: List[PendingOutreachItem] = []
        for o in pending_outreaches[:6]:
            job_obj = o.job
            con_obj = o.contact
            pending_outreach_items.append(
                PendingOutreachItem(
                    id=o.id,
                    job_id=o.job_id,
                    job_role=job_obj.role if job_obj else "Target Role",
                    job_company=job_obj.company if job_obj else "Target Company",
                    contact_name=con_obj.name if con_obj else "Referral Contact",
                    channel=o.channel,
                    subject=o.subject,
                    body_snippet=o.body[:140] + ("..." if len(o.body) > 140 else ""),
                    status=o.status,
                    created_at=o.created_at,
                )
            )

        # 7. Interviews
        interviews: List[InterviewItem] = []
        # From CRM applications in interview stage
        for a in all_apps:
            if a.status in [ApplicationStatus.INTERVIEW, ApplicationStatus.TECHNICAL, ApplicationStatus.FINAL_ROUND]:
                interviews.append(
                    InterviewItem(
                        id=a.id,
                        type="crm_stage",
                        company=a.job.company if a.job else "Company",
                        role=a.job.role if a.job else "Role",
                        stage_or_status=a.interview_stage or a.status,
                        updated_at=a.updated_at,
                    )
                )

        # From Interactive Mock Interview Sessions
        session_res = await db.execute(
            select(InterviewSession).order_by(InterviewSession.updated_at.desc()).limit(6)
        )
        mock_sessions: List[InterviewSession] = session_res.scalars().all()
        for s in mock_sessions:
            job_for_session = s.job
            final_score = None
            if s.final_feedback and isinstance(s.final_feedback, dict):
                final_score = s.final_feedback.get("overall_score")

            interviews.append(
                InterviewItem(
                    id=s.id,
                    type="mock_session",
                    company=job_for_session.company if job_for_session else "Target Company",
                    role=job_for_session.role if job_for_session else "Target Role",
                    stage_or_status=s.status,
                    score=final_score,
                    updated_at=s.updated_at,
                )
            )

        # 8. Skill Gaps Analysis
        # Determine frequency of demanded skills across all active jobs
        skill_counts: Dict[str, int] = {}
        for j in all_jobs:
            for s in (j.required_skills or []):
                s_clean = s.strip()
                skill_counts[s_clean] = skill_counts.get(s_clean, 0) + 1

        skill_gaps: List[SkillGapSummaryItem] = []
        for s_name, freq in sorted(skill_counts.items(), key=lambda x: x[1], reverse=True):
            if s_name.lower() not in candidate_skills_lower:
                priority = "CRITICAL" if freq >= 3 else ("HIGH" if freq >= 2 else "MEDIUM")
                skill_gaps.append(
                    SkillGapSummaryItem(
                        skill=s_name,
                        category="Technical",
                        frequency=freq,
                        priority=priority,
                        current_strength="Weak",
                    )
                )
            elif freq >= 2:
                skill_gaps.append(
                    SkillGapSummaryItem(
                        skill=s_name,
                        category="Technical",
                        frequency=freq,
                        priority="LOW",
                        current_strength="Strong",
                    )
                )

        skill_gaps = skill_gaps[:8]

        # 9. Recommended Projects
        recommended_projects = [
            RecommendedProjectSummaryItem(
                title="Distributed Task Execution & Async Worker Engine",
                description="Production worker architecture utilizing Redis Queues, FastAPI, and PostgreSQL with retry logic and distributed locks.",
                focus_skills=["FastAPI", "Redis", "Distributed Systems", "Docker"],
                deliverables="Worker library, queue benchmark script, and telemetry dashboard.",
            ),
            RecommendedProjectSummaryItem(
                title="RAG Context Retrieval Pipeline & Vector Semantic Search",
                description="High-throughput hybrid retrieval engine combining lexical search with pgvector cosine distance and reranking.",
                focus_skills=["pgvector", "PostgreSQL", "RAG", "Python"],
                deliverables="Embedding pipeline, evaluation benchmark script, and REST API.",
            ),
            RecommendedProjectSummaryItem(
                title="Microservices Observability & Containerized Deployment",
                description="Docker Compose multi-service topology with Prometheus instrumentation and automated CI/CD GitHub Actions.",
                focus_skills=["Docker", "Kubernetes", "CI/CD", "Prometheus"],
                deliverables="Deployment manifests, CI pipeline script, and load test runner.",
            ),
        ]

        # 10. Follow-ups
        follow_ups: List[FollowupItem] = []
        for a in all_apps:
            if a.next_followup_date:
                # Calculate days diff
                # normalize timezones for comparison
                dt = a.next_followup_date
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=datetime.timezone.utc)
                delta = dt - now
                days_diff = delta.days
                is_overdue = dt < now
                follow_ups.append(
                    FollowupItem(
                        application_id=a.id,
                        job_id=a.job_id,
                        company=a.job.company if a.job else "Company",
                        role=a.job.role if a.job else "Role",
                        next_action=a.next_action or "Review status and send polite follow-up",
                        followup_date=a.next_followup_date,
                        is_overdue=is_overdue,
                        days_diff=days_diff,
                    )
                )

        follow_ups.sort(key=lambda f: (not f.is_overdue, f.days_diff))
        follow_ups = follow_ups[:8]

        # Pipeline Summary Counts
        resumes_tailored_count = (
            await db.execute(select(func.count(ResumeVersion.id)))
        ).scalar() or 0
        compiled_pdfs_count = (
            await db.execute(select(func.count(CompiledResumePDF.id)))
        ).scalar() or 0
        referrals_count = (
            await db.execute(select(func.count(Referral.id)))
        ).scalar() or 0
        outreaches_count = (
            await db.execute(select(func.count(Outreach.id)))
        ).scalar() or 0
        applied_count = by_status.get(ApplicationStatus.APPLIED, 0) + by_status.get(ApplicationStatus.SCREENING, 0)

        pipeline_counts = PipelineCounts(
            jobs_count=total_jobs,
            matched_count=len(strong_matches),
            tailored_resumes_count=resumes_tailored_count,
            compiled_pdfs_count=compiled_pdfs_count,
            referrals_count=referrals_count,
            outreaches_count=outreaches_count,
            pending_approvals_count=len(pending_outreaches),
            applied_count=applied_count,
            interviews_count=len(interviews),
        )

        return DashboardSummaryResponse(
            candidate_id=candidate.id if candidate else None,
            generated_at=now,
            pipeline_counts=pipeline_counts,
            profile_completion=profile_summary,
            jobs_discovered=jobs_summary,
            strong_matches=strong_matches,
            applications=app_summary,
            referral_opportunities=referral_opportunities,
            outreach_requiring_approval=pending_outreach_items,
            interviews=interviews,
            skill_gaps=skill_gaps,
            recommended_projects=recommended_projects,
            follow_ups=follow_ups,
        )
