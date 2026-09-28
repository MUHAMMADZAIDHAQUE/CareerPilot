from sqlalchemy import String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship
from typing import Optional, Dict, Any
import datetime
from backend.app.db.base import TimeStampedBase


class ApplicationStatus:
    SAVED = "SAVED"
    READY_TO_APPLY = "READY_TO_APPLY"
    APPLIED = "APPLIED"
    SCREENING = "SCREENING"
    INTERVIEW = "INTERVIEW"
    TECHNICAL = "TECHNICAL"
    FINAL_ROUND = "FINAL_ROUND"
    OFFER = "OFFER"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"

    ALL = [
        SAVED,
        READY_TO_APPLY,
        APPLIED,
        SCREENING,
        INTERVIEW,
        TECHNICAL,
        FINAL_ROUND,
        OFFER,
        REJECTED,
        WITHDRAWN,
    ]


class Application(TimeStampedBase):
    """
    Application CRM Model.
    Tracks a job opportunity through the candidate's application, referral,
    interview, and offer lifecycle.
    """
    __tablename__ = "applications"

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
        String(50), default=ApplicationStatus.SAVED, nullable=False, index=True
    )
    applied_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    source: Mapped[Optional[str]] = mapped_column(
        String(100), default="direct", nullable=True
    )  # direct | referral | linkedin | company_portal | job_board
    referral_status: Mapped[Optional[str]] = mapped_column(
        String(100), default="none", nullable=True
    )  # none | requested | referred | contact_reached
    interview_stage: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )  # e.g., "Recruiter Screen", "Hiring Manager", "System Design", "Onsite"
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_action: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    next_followup_date: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    job = orm_relationship("Job", back_populates="applications", lazy="joined")
    candidate = orm_relationship("Candidate", back_populates="applications")
    resume_version = orm_relationship("ResumeVersion", lazy="joined")
