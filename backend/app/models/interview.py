from sqlalchemy import String, Text, ForeignKey, DateTime, Integer, Float, JSON, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, Dict, Any, List
import datetime
from backend.app.db.base import TimeStampedBase


class InterviewSessionStatus:
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    ABANDONED = "ABANDONED"


class InterviewPreparation(TimeStampedBase):
    """
    Persisted Interview Preparation Kit for a specific job and candidate.
    Contains grounded question banks across technical, project, behavioral,
    JD-specific, and resume-specific categories, plus study topics.
    """
    __tablename__ = "interview_preparations"

    job_id: Mapped[str] = mapped_column(
        String, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    resume_version_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("resume_versions.id", ondelete="SET NULL"), nullable=True, index=True
    )

    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(255), nullable=False)

    technical_questions: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    project_questions: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    behavioral_questions: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    jd_specific_questions: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    resume_specific_questions: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    follow_up_questions: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    suggested_preparation_topics: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    general_questions: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)

    disclaimer: Mapped[str] = mapped_column(
        Text,
        default="Simulated interview preparation questions generated from the job description and candidate profile. Not actual or proprietary leaked company questions.",
        nullable=False,
    )
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    job = relationship("Job", back_populates="interview_preparations")
    candidate = relationship("Candidate", back_populates="interview_preparations")
    resume_version = relationship("ResumeVersion")


class InterviewSession(TimeStampedBase):
    """
    Live Interactive Mock Interview Session.
    Conducts turn-by-turn interview simulation with answer evaluation,
    follow-up probes, weak area tracking, and final feedback synthesis.
    """
    __tablename__ = "interview_sessions"

    job_id: Mapped[str] = mapped_column(
        String, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    resume_version_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("resume_versions.id", ondelete="SET NULL"), nullable=True, index=True
    )

    status: Mapped[str] = mapped_column(
        String(50), default=InterviewSessionStatus.IN_PROGRESS, nullable=False, index=True
    )
    current_turn_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_target_questions: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    weak_areas: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    final_feedback: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    started_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    job = relationship("Job", back_populates="interview_sessions")
    candidate = relationship("Candidate", back_populates="interview_sessions")
    resume_version = relationship("ResumeVersion")
    turns = relationship(
        "InterviewTurn",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="InterviewTurn.turn_index",
        lazy="selectin",
    )


class InterviewTurn(TimeStampedBase):
    """
    Individual turn in an interactive interview.
    Stores the asked question, candidate's answer, evaluation scores across
    the 6 categories, and any generated follow-up question.
    """
    __tablename__ = "interview_turns"

    session_id: Mapped[str] = mapped_column(
        String, ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    turn_index: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    context_source: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    candidate_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    answered_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    evaluation: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    follow_up_question: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_follow_up: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    session = relationship("InterviewSession", back_populates="turns")
