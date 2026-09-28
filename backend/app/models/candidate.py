from sqlalchemy import String, Text, ForeignKey, Integer, Float, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from typing import List, Optional, Dict, Any
from backend.app.db.base import TimeStampedBase
from backend.app.core.config import settings


class Candidate(TimeStampedBase):
    """Canonical Candidate Profile (Source of Truth)."""
    __tablename__ = "candidates"

    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    headline: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    github_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    portfolio_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Dense semantic embedding for overall candidate profile
    embedding = mapped_column(Vector(settings.EMBEDDING_DIMENSION), nullable=True)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)

    # Relationships
    education: Mapped[List["Education"]] = relationship(
        "Education", back_populates="candidate", cascade="all, delete-orphan", lazy="selectin"
    )
    experiences: Mapped[List["Experience"]] = relationship(
        "Experience", back_populates="candidate", cascade="all, delete-orphan", lazy="selectin"
    )
    skills: Mapped[List["Skill"]] = relationship(
        "Skill", back_populates="candidate", cascade="all, delete-orphan", lazy="selectin"
    )
    projects: Mapped[List["Project"]] = relationship(
        "Project", back_populates="candidate", cascade="all, delete-orphan", lazy="selectin"
    )
    certifications: Mapped[List["Certification"]] = relationship(
        "Certification", back_populates="candidate", cascade="all, delete-orphan", lazy="selectin"
    )
    achievements: Mapped[List["Achievement"]] = relationship(
        "Achievement", back_populates="candidate", cascade="all, delete-orphan", lazy="selectin"
    )
    career_preference: Mapped[Optional["CareerPreference"]] = relationship(
        "CareerPreference", back_populates="candidate", uselist=False, cascade="all, delete-orphan", lazy="selectin"
    )
    resume_templates: Mapped[List["ResumeTemplate"]] = relationship(
        "ResumeTemplate", back_populates="candidate", cascade="all, delete-orphan", lazy="selectin"
    )
    resume_documents: Mapped[List["ResumeDocument"]] = relationship(
        "ResumeDocument", back_populates="candidate", lazy="selectin"
    )
    match_results: Mapped[List["MatchResult"]] = relationship(
        "MatchResult", back_populates="candidate", cascade="all, delete-orphan", lazy="selectin"
    )
    resume_versions: Mapped[List["ResumeVersion"]] = relationship(
        "ResumeVersion", back_populates="candidate", cascade="all, delete-orphan", lazy="selectin"
    )
    contacts: Mapped[List["Contact"]] = relationship(
        "Contact", back_populates="candidate", cascade="all, delete-orphan", lazy="selectin"
    )
    referrals: Mapped[List["Referral"]] = relationship(
        "Referral", back_populates="candidate", cascade="all, delete-orphan", lazy="selectin"
    )
    outreach_messages = relationship(
        "Outreach", back_populates="candidate", cascade="all, delete-orphan", lazy="selectin"
    )
    applications = relationship(
        "Application", back_populates="candidate", cascade="all, delete-orphan", lazy="selectin"
    )
    interview_preparations = relationship(
        "InterviewPreparation", back_populates="candidate", cascade="all, delete-orphan", lazy="selectin"
    )
    interview_sessions = relationship(
        "InterviewSession", back_populates="candidate", cascade="all, delete-orphan", lazy="selectin"
    )


class Education(TimeStampedBase):
    """Academic Degrees & Education History."""
    __tablename__ = "education"

    candidate_id: Mapped[str] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="CASCADE"), index=True, nullable=False
    )
    institution: Mapped[str] = mapped_column(String(255), nullable=False)
    degree: Mapped[str] = mapped_column(String(255), nullable=False)
    field_of_study: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    start_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    end_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    gpa: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    honors: Mapped[List[str]] = mapped_column(JSON, default=list)
    coursework: Mapped[List[str]] = mapped_column(JSON, default=list)

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="education")


class Experience(TimeStampedBase):
    """Canonical Work Experience Record."""
    __tablename__ = "experiences"

    candidate_id: Mapped[str] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="CASCADE"), index=True, nullable=False
    )
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    start_date: Mapped[str] = mapped_column(String(50), nullable=False)
    end_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)
    
    bullet_points: Mapped[List[str]] = mapped_column(JSON, default=list)
    technologies_used: Mapped[List[str]] = mapped_column(JSON, default=list)
    embedding = mapped_column(Vector(settings.EMBEDDING_DIMENSION), nullable=True)

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="experiences")


class Skill(TimeStampedBase):
    """Verified Candidate Skill."""
    __tablename__ = "skills"

    candidate_id: Mapped[str] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(100), default="General")
    proficiency_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    years_of_experience: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    embedding = mapped_column(Vector(settings.EMBEDDING_DIMENSION), nullable=True)

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="skills")


class Project(TimeStampedBase):
    """Technical Portfolio Project."""
    __tablename__ = "projects"

    candidate_id: Mapped[str] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    technologies: Mapped[List[str]] = mapped_column(JSON, default=list)
    repo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    live_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    start_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    end_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bullet_points: Mapped[List[str]] = mapped_column(JSON, default=list)
    embedding = mapped_column(Vector(settings.EMBEDDING_DIMENSION), nullable=True)

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="projects")


class Certification(TimeStampedBase):
    """Professional Certification & Credential."""
    __tablename__ = "certifications"

    candidate_id: Mapped[str] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    issuing_organization: Mapped[str] = mapped_column(String(255), nullable=False)
    issue_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    expiration_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    credential_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    credential_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="certifications")


class Achievement(TimeStampedBase):
    """Honors, Awards, and Notable Achievements."""
    __tablename__ = "achievements"

    candidate_id: Mapped[str] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    issuer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="achievements")


class CareerPreference(TimeStampedBase):
    """Job Search Preferences & Target Criteria."""
    __tablename__ = "career_preferences"

    candidate_id: Mapped[str] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    preferred_roles: Mapped[List[str]] = mapped_column(JSON, default=list)
    preferred_locations: Mapped[List[str]] = mapped_column(JSON, default=list)
    work_mode: Mapped[str] = mapped_column(String(50), default="Remote")  # Remote | Hybrid | On-site | Any
    preferred_employment_type: Mapped[str] = mapped_column(String(50), default="Full-time")  # Full-time | Contract | Part-time | Internship
    target_salary_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    target_salary_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="USD")

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="career_preference")


class ResumeTemplate(TimeStampedBase):
    """Source LaTeX Resume Template owned by candidate."""
    __tablename__ = "resume_templates"

    candidate_id: Mapped[str] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    latex_source: Mapped[str] = mapped_column(Text, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=True)

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="resume_templates")
