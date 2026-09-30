import datetime
import uuid
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from sqlalchemy.orm import selectinload

from backend.app.models.job import Job
from backend.app.models.candidate import Candidate
from backend.app.models.resume import ResumeVersion
from backend.app.models.interview import (
    InterviewPreparation,
    InterviewSession,
    InterviewTurn,
    InterviewSessionStatus,
)
from backend.app.agents.interview_agent import InterviewAgent
from backend.app.schemas.interview import (
    InterviewPrepGenerateRequest,
    InterviewPreparationResponse,
    InterviewSessionStartRequest,
    InterviewAnswerSubmitRequest,
    InterviewSessionResponse,
    InterviewTurnResponse,
    EvaluationDetail,
    FinalFeedbackDetail,
)
from backend.app.core.logging import logger


class InterviewService:
    """
    Coordinates Interview Preparation generation and Interactive Interview Sessions.
    Enforces grounding in verified candidate profile, JD requirements, and tailored resume.
    """

    @classmethod
    async def get_or_create_prep_kit(
        cls,
        session: AsyncSession,
        job_id: str,
        candidate_id: Optional[str] = None,
        resume_version_id: Optional[str] = None,
        force_regenerate: bool = False,
    ) -> InterviewPreparation:
        """
        Retrieves existing Interview Preparation kit or generates a new one.
        """
        if not force_regenerate:
            existing_stmt = (
                select(InterviewPreparation)
                .where(InterviewPreparation.job_id == job_id)
                .order_by(InterviewPreparation.created_at.desc())
            )
            res = await session.execute(existing_stmt)
            existing = res.scalars().first()
            if existing:
                return existing

        # 1. Fetch Job
        job_stmt = (
            select(Job)
            .options(selectinload(Job.requirements))
            .where(Job.id == job_id)
        )
        job_res = await session.execute(job_stmt)
        job = job_res.scalar_one_or_none()
        if not job:
            raise ValueError(f"Job with ID '{job_id}' not found.")

        # 2. Fetch Candidate
        candidate: Optional[Candidate] = None
        if candidate_id:
            cand_stmt = (
                select(Candidate)
                .options(
                    selectinload(Candidate.education),
                    selectinload(Candidate.experiences),
                    selectinload(Candidate.skills),
                    selectinload(Candidate.projects),
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
                    selectinload(Candidate.education),
                    selectinload(Candidate.experiences),
                    selectinload(Candidate.skills),
                    selectinload(Candidate.projects),
                )
                .limit(1)
            )
            cand_res = await session.execute(cand_stmt)
            candidate = cand_res.scalars().first()

        # 3. Fetch Tailored Resume Version (if specified or latest for job)
        tailored_resume_data = None
        if resume_version_id:
            res_stmt = select(ResumeVersion).where(ResumeVersion.id == resume_version_id)
            rv_res = await session.execute(res_stmt)
            rv = rv_res.scalar_one_or_none()
            if rv:
                tailored_resume_data = {
                    "id": rv.id,
                    "latex_content": rv.latex_content,
                    "diff_summary": rv.diff_summary,
                }
        elif candidate:
            res_stmt = (
                select(ResumeVersion)
                .where(
                    and_(
                        ResumeVersion.job_id == job.id,
                        ResumeVersion.candidate_id == candidate.id,
                    )
                )
                .order_by(ResumeVersion.created_at.desc())
            )
            rv_res = await session.execute(res_stmt)
            rv = rv_res.scalars().first()
            if rv:
                tailored_resume_data = {
                    "id": rv.id,
                    "latex_content": rv.latex_content,
                    "diff_summary": rv.diff_summary,
                }

        # Structure data for agent
        job_data = {
            "id": job.id,
            "role": job.role,
            "company": job.company,
            "domain": job.domain,
            "required_skills": job.required_skills or [r.name for r in (job.requirements or []) if r.requirement_type == "required"],
            "preferred_skills": job.preferred_skills or [r.name for r in (job.requirements or []) if r.requirement_type == "preferred"],
            "responsibilities": job.responsibilities or [],
            "qualifications": job.qualifications or [],
            "description": getattr(job, "raw_description", getattr(job, "description", "")),
        }

        candidate_data = {
            "id": candidate.id if candidate else None,
            "full_name": candidate.full_name if candidate else "Candidate",
            "skills": [
                {
                    "name": s.name,
                    "category": s.category,
                    "proficiency": getattr(s, "proficiency_level", None) or "Intermediate",
                }
                for s in (candidate.skills if candidate else [])
            ],
            "projects": [
                {
                    "id": p.id,
                    "name": getattr(p, "title", None) or getattr(p, "name", "Project"),
                    "description": p.description or "",
                    "technologies": p.technologies or [],
                }
                for p in (candidate.projects if candidate else [])
            ],
            "experiences": [
                {
                    "company": e.company,
                    "role": e.role,
                    "description": "\n".join(e.bullet_points) if getattr(e, "bullet_points", None) else getattr(e, "description", ""),
                }
                for e in (candidate.experiences if candidate else [])
            ],
        }

        # Call Agent
        prep_kit_dict = InterviewAgent.generate_prep_kit(
            candidate_data=candidate_data,
            job_data=job_data,
            tailored_resume_data=tailored_resume_data,
            company_info={"domain": job.domain, "company": job.company},
        )

        # Persist Prep Kit
        prep = InterviewPreparation(
            id=str(uuid.uuid4()),
            job_id=job.id,
            candidate_id=candidate.id if candidate else None,
            resume_version_id=tailored_resume_data.get("id") if tailored_resume_data else None,
            company_name=prep_kit_dict["company_name"],
            role=prep_kit_dict["role"],
            technical_questions=prep_kit_dict["technical_questions"],
            project_questions=prep_kit_dict["project_questions"],
            behavioral_questions=prep_kit_dict["behavioral_questions"],
            jd_specific_questions=prep_kit_dict["jd_specific_questions"],
            resume_specific_questions=prep_kit_dict["resume_specific_questions"],
            follow_up_questions=prep_kit_dict["follow_up_questions"],
            suggested_preparation_topics=prep_kit_dict["suggested_preparation_topics"],
            general_questions=prep_kit_dict["general_questions"],
            disclaimer=prep_kit_dict["disclaimer"],
            metadata_json={"generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()},
        )
        session.add(prep)
        await session.commit()
        await session.refresh(prep)
        return prep

    # -------------------------------------------------------------------------
    # Interactive Mock Interview Session Operations
    # -------------------------------------------------------------------------
    @classmethod
    async def start_session(
        cls,
        session: AsyncSession,
        payload: InterviewSessionStartRequest,
    ) -> InterviewSession:
        """
        Starts a new interactive interview session.
        Initializes turn 0 with the first targeted question.
        """
        # Ensure prep kit is loaded
        prep = await cls.get_or_create_prep_kit(
            session=session,
            job_id=payload.job_id,
            candidate_id=payload.candidate_id,
            resume_version_id=payload.resume_version_id,
        )

        new_session = InterviewSession(
            id=str(uuid.uuid4()),
            job_id=payload.job_id,
            candidate_id=prep.candidate_id,
            resume_version_id=payload.resume_version_id or prep.resume_version_id,
            status=InterviewSessionStatus.IN_PROGRESS,
            current_turn_index=0,
            total_target_questions=payload.total_questions or 5,
            weak_areas=[],
            final_feedback=None,
            metadata_json={"company_name": prep.company_name, "role": prep.role},
        )
        session.add(new_session)
        await session.flush()

        # Pick first question from Prep Kit (e.g. first technical or first project question)
        first_q = None
        category = "TECHNICAL"
        source = None

        if prep.technical_questions:
            q_obj = prep.technical_questions[0]
            first_q = q_obj["question"]
            category = "TECHNICAL"
            source = q_obj.get("context_source")
        elif prep.project_questions:
            q_obj = prep.project_questions[0]
            first_q = q_obj["question"]
            category = "PROJECT"
            source = q_obj.get("context_source")
        else:
            first_q = f"Walk through how your technical background prepares you for the {prep.role} role at {prep.company_name}."
            category = "GENERAL"
            source = "Opening Question"

        first_turn = InterviewTurn(
            id=str(uuid.uuid4()),
            session_id=new_session.id,
            turn_index=0,
            category=category,
            question=first_q,
            context_source=source,
            is_follow_up=False,
        )
        session.add(first_turn)
        await session.commit()

        # Re-fetch session with turns
        stmt = (
            select(InterviewSession)
            .options(selectinload(InterviewSession.turns))
            .where(InterviewSession.id == new_session.id)
        )
        res = await session.execute(stmt)
        return res.scalar_one()

    @classmethod
    async def submit_answer(
        cls,
        session: AsyncSession,
        session_id: str,
        payload: InterviewAnswerSubmitRequest,
    ) -> InterviewSession:
        """
        Submits candidate's answer for the active turn, evaluates it across
        the 6 dimensions, records weak areas, and advances to the next question
        or finalizes the interview.
        """
        stmt = (
            select(InterviewSession)
            .options(
                selectinload(InterviewSession.turns),
                selectinload(InterviewSession.job),
                selectinload(InterviewSession.candidate),
            )
            .where(InterviewSession.id == session_id)
        )
        res = await session.execute(stmt)
        interview_session = res.scalar_one_or_none()
        if not interview_session:
            raise ValueError(f"Interview session with ID '{session_id}' not found.")

        if interview_session.status != InterviewSessionStatus.IN_PROGRESS:
            raise ValueError(f"Session is already {interview_session.status}.")

        turns = sorted(interview_session.turns, key=lambda t: t.turn_index)
        # Find active turn (the latest turn without candidate_answer)
        active_turn: Optional[InterviewTurn] = None
        for t in reversed(turns):
            if not t.candidate_answer:
                active_turn = t
                break

        if not active_turn:
            raise ValueError("No active question waiting for an answer in this session.")

        # 1. Evaluate answer using InterviewAgent
        job_data = {
            "role": interview_session.job.role if interview_session.job else "Software Engineer",
            "company": interview_session.job.company if interview_session.job else "Target Company",
            "required_skills": interview_session.job.required_skills if interview_session.job else [],
        }
        candidate_data = {
            "full_name": interview_session.candidate.full_name if interview_session.candidate else "Candidate",
        }

        evaluation, follow_up_q, detected_weak_areas = InterviewAgent.evaluate_answer(
            question=active_turn.question,
            category=active_turn.category,
            context_source=active_turn.context_source,
            candidate_answer=payload.answer,
            candidate_data=candidate_data,
            job_data=job_data,
        )

        # Update active turn
        active_turn.candidate_answer = payload.answer.strip()
        active_turn.answered_at = datetime.datetime.now(datetime.timezone.utc)
        active_turn.evaluation = evaluation
        active_turn.follow_up_question = follow_up_q

        # Track weak areas
        current_weak_areas = list(interview_session.weak_areas or [])
        for w in detected_weak_areas:
            if w not in current_weak_areas:
                current_weak_areas.append(w)
        interview_session.weak_areas = current_weak_areas

        # Count answered turns
        answered_count = sum(1 for t in turns if t.candidate_answer or t.id == active_turn.id)
        next_turn_index = active_turn.turn_index + 1

        # Check if interview complete
        if answered_count >= interview_session.total_target_questions:
            # Finalize session
            interview_session.status = InterviewSessionStatus.COMPLETED
            interview_session.completed_at = datetime.datetime.now(datetime.timezone.utc)

            # Build turns dictionary list for feedback synthesis
            all_turns_data = [
                {
                    "turn_index": t.turn_index,
                    "category": t.category,
                    "question": t.question,
                    "candidate_answer": t.candidate_answer if t.id != active_turn.id else active_turn.candidate_answer,
                    "evaluation": t.evaluation if t.id != active_turn.id else evaluation,
                }
                for t in turns
            ]
            final_fb = InterviewAgent.synthesize_final_feedback(
                turns=all_turns_data,
                job_data=job_data,
                candidate_data=candidate_data,
                accumulated_weak_areas=current_weak_areas,
            )
            interview_session.final_feedback = final_fb
        else:
            # Advance turn index
            interview_session.current_turn_index = next_turn_index

            # Fetch Prep kit to pick the next diverse question
            prep_stmt = (
                select(InterviewPreparation)
                .where(InterviewPreparation.job_id == interview_session.job_id)
                .order_by(InterviewPreparation.created_at.desc())
            )
            p_res = await session.execute(prep_stmt)
            prep = p_res.scalars().first()

            # Cycle categories: 0=Tech, 1=Follow-up/Project, 2=Behavioral, 3=JD-Specific, 4=Resume-Specific
            next_q = None
            next_cat = "TECHNICAL"
            next_source = None
            is_follow_up = False

            # If the current answer triggered a strong follow-up and answered_count < total - 1, we can ask the follow-up
            if follow_up_q and next_turn_index == 1:
                next_q = follow_up_q
                next_cat = "FOLLOW_UP"
                next_source = f"Follow-up to: {active_turn.question[:50]}..."
                is_follow_up = True
            elif prep:
                if next_turn_index % 4 == 1 and prep.project_questions:
                    idx = (next_turn_index // 2) % len(prep.project_questions)
                    q_obj = prep.project_questions[idx]
                    next_q = q_obj["question"]
                    next_cat = "PROJECT"
                    next_source = q_obj.get("context_source")
                elif next_turn_index % 4 == 2 and prep.behavioral_questions:
                    idx = (next_turn_index // 2) % len(prep.behavioral_questions)
                    q_obj = prep.behavioral_questions[idx]
                    next_q = q_obj["question"]
                    next_cat = "BEHAVIORAL"
                    next_source = q_obj.get("context_source")
                elif next_turn_index % 4 == 3 and prep.jd_specific_questions:
                    idx = (next_turn_index // 2) % len(prep.jd_specific_questions)
                    q_obj = prep.jd_specific_questions[idx]
                    next_q = q_obj["question"]
                    next_cat = "JD_SPECIFIC"
                    next_source = q_obj.get("context_source")
                elif prep.resume_specific_questions:
                    idx = (next_turn_index // 2) % len(prep.resume_specific_questions)
                    q_obj = prep.resume_specific_questions[idx]
                    next_q = q_obj["question"]
                    next_cat = "RESUME_SPECIFIC"
                    next_source = q_obj.get("context_source")

            if not next_q:
                next_q = f"Describe how you handle technical debt and long-term maintainability when building services for {job_data['company']}."
                next_cat = "TECHNICAL"
                next_source = "System Architecture"

            next_turn = InterviewTurn(
                id=str(uuid.uuid4()),
                session_id=interview_session.id,
                turn_index=next_turn_index,
                category=next_cat,
                question=next_q,
                context_source=next_source,
                is_follow_up=is_follow_up,
            )
            session.add(next_turn)

        await session.commit()
        await session.refresh(interview_session)

        # Re-query session with turns fully loaded
        stmt = (
            select(InterviewSession)
            .options(
                selectinload(InterviewSession.turns),
                selectinload(InterviewSession.job),
            )
            .where(InterviewSession.id == session_id)
        )
        final_res = await session.execute(stmt)
        return final_res.scalar_one()

    @classmethod
    async def finish_session_early(
        cls,
        session: AsyncSession,
        session_id: str,
    ) -> InterviewSession:
        """
        Manually completes an in-progress session early and synthesizes feedback.
        """
        stmt = (
            select(InterviewSession)
            .options(
                selectinload(InterviewSession.turns),
                selectinload(InterviewSession.job),
                selectinload(InterviewSession.candidate),
            )
            .where(InterviewSession.id == session_id)
        )
        res = await session.execute(stmt)
        interview_session = res.scalar_one_or_none()
        if not interview_session:
            raise ValueError(f"Interview session with ID '{session_id}' not found.")

        if interview_session.status != InterviewSessionStatus.COMPLETED:
            interview_session.status = InterviewSessionStatus.COMPLETED
            interview_session.completed_at = datetime.datetime.now(datetime.timezone.utc)

            job_data = {
                "role": interview_session.job.role if interview_session.job else "Software Engineer",
                "company": interview_session.job.company if interview_session.job else "Target Company",
                "required_skills": interview_session.job.required_skills if interview_session.job else [],
            }
            candidate_data = {
                "full_name": interview_session.candidate.full_name if interview_session.candidate else "Candidate",
            }

            all_turns_data = [
                {
                    "turn_index": t.turn_index,
                    "category": t.category,
                    "question": t.question,
                    "candidate_answer": t.candidate_answer,
                    "evaluation": t.evaluation,
                }
                for t in interview_session.turns
                if t.candidate_answer
            ]
            final_fb = InterviewAgent.synthesize_final_feedback(
                turns=all_turns_data,
                job_data=job_data,
                candidate_data=candidate_data,
                accumulated_weak_areas=interview_session.weak_areas or [],
            )
            interview_session.final_feedback = final_fb
            await session.commit()
            await session.refresh(interview_session)

        return interview_session

    @classmethod
    async def get_session(
        cls,
        session: AsyncSession,
        session_id: str,
    ) -> Optional[InterviewSession]:
        """
        Retrieves a single interview session with turns.
        """
        stmt = (
            select(InterviewSession)
            .options(
                selectinload(InterviewSession.turns),
                selectinload(InterviewSession.job),
            )
            .where(InterviewSession.id == session_id)
        )
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @classmethod
    async def list_sessions(
        cls,
        session: AsyncSession,
        job_id: Optional[str] = None,
        candidate_id: Optional[str] = None,
        limit: int = 20,
    ) -> List[InterviewSession]:
        """
        Lists recent interview sessions with optional filters.
        """
        stmt = (
            select(InterviewSession)
            .options(
                selectinload(InterviewSession.turns),
                selectinload(InterviewSession.job),
            )
            .order_by(InterviewSession.created_at.desc())
            .limit(limit)
        )
        if job_id:
            stmt = stmt.where(InterviewSession.job_id == job_id)
        if candidate_id:
            stmt = stmt.where(InterviewSession.candidate_id == candidate_id)

        res = await session.execute(stmt)
        return list(res.scalars().all())
