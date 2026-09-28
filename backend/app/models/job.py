from sqlalchemy import String, Text, ForeignKey, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from typing import List, Optional, Dict, Any
from backend.app.db.base import TimeStampedBase
from backend.app.core.config import settings


class JobPosting(TimeStampedBase):
    """Target Job Posting."""
    __tablename__ = "job_postings"

    title: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    company: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    employment_type: Mapped[Optional[str]] = mapped_column(String(50), default="Full-time")
    source_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    raw_description: Mapped[str] = mapped_column(Text, nullable=False)

    # Parsed structured requirements
    parsed_requirements: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    must_have_skills: Mapped[List[str]] = mapped_column(JSON, default=list)
    nice_to_have_skills: Mapped[List[str]] = mapped_column(JSON, default=list)

    # Dense semantic embedding of JD
    embedding = mapped_column(Vector(settings.EMBEDDING_DIMENSION), nullable=True)

    match_results: Mapped[List["MatchResult"]] = relationship(
        "MatchResult", back_populates="job_posting", cascade="all, delete-orphan"
    )


class MatchResult(TimeStampedBase):
    """Evaluation Match Result between Candidate and Job Posting."""
    __tablename__ = "match_results"

    candidate_id: Mapped[str] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="CASCADE"), index=True, nullable=False
    )
    job_id: Mapped[str] = mapped_column(
        String, ForeignKey("job_postings.id", ondelete="CASCADE"), index=True, nullable=False
    )

    total_score: Mapped[float] = mapped_column(Float, nullable=False)  # 0.0 - 100.0
    structured_score: Mapped[float] = mapped_column(Float, nullable=False)
    semantic_score: Mapped[float] = mapped_column(Float, nullable=False)

    matched_skills: Mapped[List[str]] = mapped_column(JSON, default=list)
    missing_skills: Mapped[List[str]] = mapped_column(JSON, default=list)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence_citations: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)

    job_posting: Mapped["JobPosting"] = relationship("JobPosting", back_populates="match_results")
