from sqlalchemy import String, Text, ForeignKey, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship
from typing import List, Optional, Dict, Any
from backend.app.db.base import TimeStampedBase


class Contact(TimeStampedBase):
    """
    Contact model for storing professional connections, alumni, former colleagues,
    and verified company contacts.
    Adheres strictly to permitted and authorized information sources.
    """
    __tablename__ = "contacts"

    candidate_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    company: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    source: Mapped[str] = mapped_column(
        String(100), default="user_provided", nullable=False, index=True
    )  # e.g., "user_provided", "university_alumni", "former_colleague", "authorized_directory"
    profile_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # if legitimately available
    relationship: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    university: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    skills: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)

    # Relationships
    candidate = orm_relationship("Candidate", back_populates="contacts")
    referrals: Mapped[List["Referral"]] = orm_relationship(
        "Referral",
        back_populates="contact",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class Referral(TimeStampedBase):
    """
    Referral model representing a scored referral opportunity between a job posting
    and an identified contact.
    Every recommendation is grounded with evidence and a transparent relevance breakdown.
    """
    __tablename__ = "referrals"

    job_id: Mapped[str] = mapped_column(
        String, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    contact_id: Mapped[str] = mapped_column(
        String, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    
    # Potential relationship types:
    # "university alumni", "current employee", "former colleague", "known professional contact", "user-provided connection"
    relationship_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # 0.0 - 100.0
    relevance_reason: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Status: "suggested", "drafted", "contacted", "referred", "declined"
    status: Mapped[str] = mapped_column(String(50), default="suggested", nullable=False, index=True)
    
    # Evidence & transparent score breakdown
    evidence: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    score_breakdown: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    job = orm_relationship("Job", back_populates="referrals")
    contact: Mapped["Contact"] = orm_relationship("Contact", back_populates="referrals", lazy="joined")
    candidate = orm_relationship("Candidate", back_populates="referrals")
