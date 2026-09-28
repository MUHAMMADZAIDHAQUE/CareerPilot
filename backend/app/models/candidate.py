from sqlalchemy import String, Text, ForeignKey, Integer, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from typing import List, Optional, Dict, Any
from backend.app.db.base import TimeStampedBase
from backend.app.core.config import settings


class Candidate(TimeStampedBase):
    """Canonical Candidate Profile."""
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
    experiences: Mapped[List["Experience"]] = relationship(
        "Experience", back_populates="candidate", cascade="all, delete-orphan"
    )
    skills: Mapped[List["Skill"]] = relationship(
        "Skill", back_populates="candidate", cascade="all, delete-orphan"
    )
    resume_templates: Mapped[List["ResumeTemplate"]] = relationship(
        "ResumeTemplate", back_populates="candidate", cascade="all, delete-orphan"
    )


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
    end_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Null if current
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Bullet points representing verified achievements (Source of Truth)
    bullet_points: Mapped[List[str]] = mapped_column(JSON, default=list)
    technologies_used: Mapped[List[str]] = mapped_column(JSON, default=list)
    
    # Embedding for experience chunk
    embedding = mapped_column(Vector(settings.EMBEDDING_DIMENSION), nullable=True)

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="experiences")


class Skill(TimeStampedBase):
    """Verified Candidate Skill."""
    __tablename__ = "skills"

    candidate_id: Mapped[str] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(100), default="General")  # e.g., Languages, Frameworks, Cloud, Databases
    proficiency_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # e.g., Expert, Proficient
    years_of_experience: Mapped[Optional[float]] = mapped_column(nullable=True)

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="skills")


class ResumeTemplate(TimeStampedBase):
    """Source LaTeX Resume Template owned by a candidate."""
    __tablename__ = "resume_templates"

    candidate_id: Mapped[str] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    latex_source: Mapped[str] = mapped_column(Text, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=True)

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="resume_templates")
