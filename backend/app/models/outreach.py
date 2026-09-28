from sqlalchemy import String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship
from typing import Optional, Dict, Any
import datetime
from backend.app.db.base import TimeStampedBase


class OutreachStatus:
    DRAFT = "DRAFT"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    APPROVED = "APPROVED"
    SENT = "SENT"
    REJECTED = "REJECTED"

    ALL = [DRAFT, NEEDS_REVIEW, APPROVED, SENT, REJECTED]


class Outreach(TimeStampedBase):
    """
    Outreach model representing generated referral communication drafts
    (Email and LinkedIn) with human-in-the-loop review and approval tracking.
    """
    __tablename__ = "outreach"

    job_id: Mapped[str] = mapped_column(
        String, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    contact_id: Mapped[str] = mapped_column(
        String, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    referral_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("referrals.id", ondelete="SET NULL"), nullable=True, index=True
    )

    channel: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # "email" or "linkedin"
    subject: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    # Status: DRAFT, NEEDS_REVIEW, APPROVED, SENT, REJECTED
    status: Mapped[str] = mapped_column(
        String(50), default=OutreachStatus.NEEDS_REVIEW, nullable=False, index=True
    )

    relationship_context: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    project_highlight: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    approved_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sent_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    job = orm_relationship("Job", back_populates="outreach_messages")
    contact = orm_relationship("Contact", back_populates="outreach_messages", lazy="joined")
    candidate = orm_relationship("Candidate", back_populates="outreach_messages")
    referral = orm_relationship("Referral")
