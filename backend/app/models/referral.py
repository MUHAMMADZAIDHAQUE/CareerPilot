from sqlalchemy import String, Text, ForeignKey, Float, JSON, Integer
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
    outreach_messages = orm_relationship(
        "Outreach",
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


class ReferralContact(TimeStampedBase):
    """
    ReferralContact model representing a discovered potential referral contact
    associated with a target company and job.
    Enforces deduplication across sources, transparent relevance scoring,
    and strict human-in-the-loop outreach governance.
    """
    __tablename__ = "referral_contacts"

    company_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    company: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    job_id: Mapped[str] = mapped_column(
        String, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    headline: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    current_title: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    profile_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    source: Mapped[str] = mapped_column(String(100), default="linkedin", nullable=False, index=True)
    source_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    source_references: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    public_contact_method: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    university: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    graduation_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    skills: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    
    # Relevance Scoring & Transparent Breakdown
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # 0.0 - 100.0
    relevance_reasons: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    score_breakdown: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Classification & Verification States
    relationship_type: Mapped[str] = mapped_column(
        String(50), default="EMPLOYEE", nullable=False, index=True
    )  # EMPLOYEE, ENGINEER, SENIOR_ENGINEER, ENGINEERING_MANAGER, RECRUITER, HIRING_TEAM, ALUMNI, TEAM_MEMBER, TECH_LEAD, OTHER
    verification_status: Mapped[str] = mapped_column(
        String(50), default="VERIFIED", nullable=False, index=True
    )  # VERIFIED, PARTIALLY_VERIFIED, UNVERIFIED, STALE
    last_verified_at: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    discovered_at: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    duplicate_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    outreach_status: Mapped[str] = mapped_column(
        String(50), default="NOT_CONTACTED", nullable=False, index=True
    )  # NOT_CONTACTED, SELECTED, APPROVED, SENT, REPLIED, DECLINED, NO_RESPONSE, DO_NOT_CONTACT

    # Backward-compatibility property aliases
    @property
    def role(self) -> str:
        return self.current_title

    @property
    def relevance_reason(self) -> str:
        return "; ".join(self.relevance_reasons) if self.relevance_reasons else f"{self.name} at {self.company}"

    # Relationships
    job = orm_relationship("Job", back_populates="referral_contacts")
    candidate = orm_relationship("Candidate", back_populates="referral_contacts")

