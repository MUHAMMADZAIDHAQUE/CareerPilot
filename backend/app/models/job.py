from sqlalchemy import String, Text, ForeignKey, Float, JSON, Boolean, DateTime, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from typing import List, Optional, Dict, Any
from datetime import datetime
from backend.app.db.base import Base, TimeStampedBase
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
    source_type: Mapped[str] = mapped_column(String(50), default="direct", index=True, nullable=False)  # "direct" | "url_import" | "public_feed" | "career_page" | "user_configured" | "linkedin" | "freshershunt" | "indeed"
    source_name: Mapped[str] = mapped_column(String(100), default="Direct Entry", nullable=False)
    canonical_url: Mapped[Optional[str]] = mapped_column(String(500), index=True, nullable=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(255), index=True, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)
    is_expired: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    dedup_hash: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)

    # Phase 16B: Multi-Source Discovery, Normalization & Fresher Metadata
    normalized_title: Mapped[Optional[str]] = mapped_column(String(255), index=True, nullable=True)
    official_company_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    remote_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="Unknown")  # "Remote" | "Hybrid" | "On-site" | "Unknown"
    experience_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="Unknown")  # "Entry-Level" | "Mid-Level" | "Senior" | "Executive" | "Unknown"
    is_fresher_eligible: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    fresher_eligibility_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_references: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    posted_at: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_verified_at: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Phase 23: India-First Intelligence & Granular Fresher/Scam Detection
    india_relevance: Mapped[str] = mapped_column(String(50), default="INDIA_POSSIBLE", index=True, nullable=False)  # INDIA, REMOTE_INDIA, INDIA_POSSIBLE, NON_INDIA, UNKNOWN
    india_relevance_score: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    india_location_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # METRO_TIER1, TIER2, REMOTE, STATE, COUNTRY_LEVEL, NON_INDIA
    india_location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    remote_india: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    country: Mapped[str] = mapped_column(String(100), default="India", index=True, nullable=False)
    experience_min: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    experience_max: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    experience_category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)  # FRESHER, 0_TO_1, 1_TO_3, 3_TO_5, SENIOR_5_PLUS
    entry_level_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    content_hash: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    scam_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    scam_risk_level: Mapped[str] = mapped_column(String(50), default="LOW", nullable=False)
    has_safety_warnings: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    safety_warnings: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    
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

    # Conceptual field aliases for transparent access
    @property
    def source(self) -> str:
        return self.source_name

    @property
    def source_job_id(self) -> Optional[str]:
        return self.external_id

    @property
    def source_url(self) -> Optional[str]:
        return self.canonical_url or self.application_url

    @property
    def company_name(self) -> str:
        return self.company

    @property
    def job_title(self) -> str:
        return self.role

    @property
    def original_title(self) -> str:
        return self.role

    @property
    def experience_required(self) -> Optional[str]:
        return self.experience_requirement

    @property
    def education_required(self) -> List[str]:
        return self.education_requirements

    @property
    def skills(self) -> List[str]:
        return list(dict.fromkeys((self.required_skills or []) + (self.preferred_skills or [])))

    @property
    def description(self) -> str:
        return self.raw_description

    @property
    def raw_content(self) -> str:
        return self.raw_description

    @property
    def application_deadline(self) -> Optional[str]:
        return self.deadline

    @property
    def status(self) -> str:
        if not self.is_active:
            return "inactive"
        if self.is_expired:
            return "expired"
        return "active"

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
    referral_contacts: Mapped[List["ReferralContact"]] = relationship(
        "ReferralContact",
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
    github_analyses = relationship(
        "GitHubAnalysis",
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
    structured_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # Legacy alias

    # Breakdown Collections
    matched_skills: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    missing_required_skills: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    missing_preferred_skills: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    relevant_projects: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    evidence: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    weights_used: Mapped[Dict[str, float]] = mapped_column(JSON, default=dict, nullable=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Phase 16B: Categorization & Eligibility
    match_category: Mapped[str] = mapped_column(String(50), default="POSSIBLE_MATCH", nullable=False)  # "HIGH_MATCH" | "GOOD_MATCH" | "POSSIBLE_MATCH" | "LOW_MATCH" | "INELIGIBLE"
    eligibility_status: Mapped[str] = mapped_column(String(50), default="ELIGIBLE", nullable=False)  # "ELIGIBLE" | "INELIGIBLE" | "BORDERLINE"
    fresher_eligible: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    @property
    def missing_skills(self) -> List[str]:
        return list(dict.fromkeys((self.missing_required_skills or []) + (self.missing_preferred_skills or [])))

    @property
    def match_explanation(self) -> Optional[str]:
        return self.explanation

    # Relationships
    job: Mapped["Job"] = relationship("Job", back_populates="match_results")
    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="match_results")


class JobAlert(TimeStampedBase):
    """
    Automated Job Search Alert.
    Stores user filter criteria, target roles, locations, sources, and frequency.
    """
    __tablename__ = "job_alerts"

    candidate_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=True, index=True
    )
    alert_name: Mapped[str] = mapped_column(String(255), nullable=False)
    roles: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    locations: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    sources: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    experience_levels: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    work_modes: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    min_match_score: Mapped[float] = mapped_column(Float, default=70.0, nullable=False)
    frequency: Mapped[str] = mapped_column(String(50), default="DAILY", nullable=False)  # DAILY, TWICE_DAILY, WEEKLY, MANUAL
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


# Alias for backward compatibility
JobPosting = Job


class JobSource(Base):
    """
    Modular Job Source Configuration & Ingestion Record (Phase 23).
    Supports 100+ source configurations (Greenhouse, Lever, RSS, APIs, ATS feeds).
    Tracks real-time health, rate limits, run history, and India-relevance metrics.
    """
    __tablename__ = "job_sources"

    source_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), default="GREENHOUSE", nullable=False, index=True)
    region: Mapped[str] = mapped_column(String(100), default="India", nullable=False)
    country: Mapped[str] = mapped_column(String(100), default="India", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE", index=True, nullable=False)  # ACTIVE, PAUSED, DISABLED, ERROR, REQUIRES_AUTH, NOT_SUPPORTED
    authorization_method: Mapped[str] = mapped_column(String(50), default="PUBLIC_ACCESS", nullable=False)
    ingestion_method: Mapped[str] = mapped_column(String(50), default="PUBLIC_ATS", nullable=False)
    endpoint_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    rate_limit_per_minute: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    supports_pagination: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_success_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_failure_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    jobs_fetched_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    jobs_accepted_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    jobs_rejected_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duplicates_found_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    avg_ingestion_time_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    terms_metadata: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    runs = relationship("JobSourceRun", back_populates="source", cascade="all, delete-orphan", lazy="selectin")


class JobSourceRun(TimeStampedBase):
    """Execution Run Log for a Job Source Ingestion Attempt."""
    __tablename__ = "job_source_runs"

    source_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("job_sources.source_id", ondelete="CASCADE"), index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(50), default="SUCCESS", index=True, nullable=False)  # SUCCESS, FAILED, RUNNING
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    jobs_fetched: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    jobs_accepted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    jobs_rejected: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duplicates_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    source = relationship("JobSource", back_populates="runs")



