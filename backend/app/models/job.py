from sqlalchemy import String, Text, ForeignKey, Float, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from typing import List, Optional, Dict, Any
from backend.app.db.base import TimeStampedBase
from backend.app.core.config import settings


class Job(TimeStampedBase):
    """
    Analyzed Job Posting database model.
    Stores the full original JD along with structured requirements.
    """
    __tablename__ = "jobs"

    company: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    employment_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default="Full-time")
    raw_description: Mapped[str] = mapped_column(Text, nullable=False)  # Original JD preserved
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    domain: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    salary: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    application_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    deadline: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    experience_requirement: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Phase 8: Job Discovery & Sourcing Metadata
    source_type: Mapped[str] = mapped_column(String(50), default="direct", index=True, nullable=False)  # "direct" | "url_import" | "public_feed" | "career_page" | "user_configured"
    source_name: Mapped[str] = mapped_column(String(100), default="Direct Entry", nullable=False)
    canonical_url: Mapped[Optional[str]] = mapped_column(String(500), index=True, nullable=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(255), index=True, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)
    is_expired: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    dedup_hash: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    
    # Structured collections
    education_requirements: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    responsibilities: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    qualifications: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    technologies: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    required_skills: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    preferred_skills: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    inferred_concepts: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)

    # Dense semantic embedding of JD
    embedding = mapped_column(Vector(settings.EMBEDDING_DIMENSION), nullable=True)

    # Relationships
    requirements: Mapped[List["JobRequirement"]] = relationship(
        "JobRequirement",
        back_populates="job",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    match_results: Mapped[List["MatchResult"]] = relationship(
        "MatchResult",
        back_populates="job",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    resume_versions: Mapped[List["ResumeVersion"]] = relationship(
        "ResumeVersion",
        back_populates="job",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    referrals: Mapped[List["Referral"]] = relationship(
        "Referral",
        back_populates="job",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    outreach_messages = relationship(
        "Outreach",
        back_populates="job",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    applications = relationship(
        "Application",
        back_populates="job",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    interview_preparations = relationship(
        "InterviewPreparation",
        back_populates="job",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    interview_sessions = relationship(
        "InterviewSession",
        back_populates="job",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class JobRequirement(TimeStampedBase):
    """
    Granular Job Requirement model.
    Explicitly distinguishes required vs preferred skills vs inferred concepts.
    """
    __tablename__ = "job_requirements"

    job_id: Mapped[str] = mapped_column(
        String, ForeignKey("jobs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    requirement_type: Mapped[str] = mapped_column(
        String(50), index=True, nullable=False
    )  # "required" | "preferred" | "inferred"
    category: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, default="skill"
    )  # "skill" | "technology" | "experience" | "education" | "domain"
    context: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # Verbatim supporting excerpt from JD for zero-hallucination verification
    years_experience: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    embedding = mapped_column(Vector(settings.EMBEDDING_DIMENSION), nullable=True)

    job: Mapped["Job"] = relationship("Job", back_populates="requirements")


class MatchResult(TimeStampedBase):
    """
    Evaluation Match Result between Candidate and Job.
    Stores deterministic score breakdowns, skill coverage, and grounded evidence.
    """
    __tablename__ = "match_results"

    candidate_id: Mapped[str] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="CASCADE"), index=True, nullable=False
    )
    job_id: Mapped[str] = mapped_column(
        String, ForeignKey("jobs.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # Deterministic Sub-scores (0.0 to 100.0)
    overall_match_score: Mapped[float] = mapped_column(Float, nullable=False)
    required_skill_coverage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    preferred_skill_coverage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    semantic_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    experience_compatibility: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    education_compatibility: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    project_relevance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # Legacy alias

    # Breakdown Collections
    matched_skills: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    missing_required_skills: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    missing_preferred_skills: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    relevant_projects: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    evidence: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    weights_used: Mapped[Dict[str, float]] = mapped_column(JSON, default=dict, nullable=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    job: Mapped["Job"] = relationship("Job", back_populates="match_results")
    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="match_results")


# Alias for backward compatibility
JobPosting = Job

