from sqlalchemy import String, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, Dict, Any, List
from backend.app.db.base import TimeStampedBase


class GitHubAnalysis(TimeStampedBase):
    """
    GitHub Career Analysis.
    Stores extracted repository metrics, demonstrated skills, missing skill evidence,
    ranked portfolio projects, potential resume bullet points, and profile improvements.
    """
    __tablename__ = "github_analyses"

    candidate_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    job_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    username: Mapped[str] = mapped_column(String(255), index=True, nullable=False)

    profile_summary: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    skills_demonstrated: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    skills_missing_evidence: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    relevant_projects: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    potential_resume_evidence: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    recommended_improvements: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    candidate = relationship("Candidate", back_populates="github_analyses")
    job = relationship("Job", back_populates="github_analyses")
