from sqlalchemy import String, Text, ForeignKey, DateTime, JSON, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship
from typing import Optional, Dict, Any, List
import datetime
from backend.app.db.base import TimeStampedBase


# -----------------------------------------------------------------------------
# Legacy Outreach (Phases 1-14)
# -----------------------------------------------------------------------------

class OutreachStatus:
    DRAFT = "DRAFT"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    APPROVED = "APPROVED"
    SENT = "SENT"
    REJECTED = "REJECTED"

    ALL = [DRAFT, NEEDS_REVIEW, APPROVED, SENT, REJECTED]


class Outreach(TimeStampedBase):
    """
    Legacy Outreach model representing generated referral communication drafts
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


# -----------------------------------------------------------------------------
# Phase 19: Production-Grade Outreach Preparation Engine
# -----------------------------------------------------------------------------

class OutreachDraftStatus:
    DRAFT = "DRAFT"
    VALIDATING = "VALIDATING"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    EDITED = "EDITED"
    APPROVED_FOR_DISPATCH = "APPROVED_FOR_DISPATCH"
    REJECTED = "REJECTED"
    REGENERATE_REQUIRED = "REGENERATE_REQUIRED"
    BLOCKED = "BLOCKED"
    # Future placeholder: DISPATCHED is strictly PROHIBITED in Phase 19
    DISPATCHED = "DISPATCHED"

    VALID_TRANSITIONS = {
        DRAFT: {VALIDATING, REJECTED},
        VALIDATING: {REVIEW_REQUIRED, BLOCKED, REJECTED},
        REVIEW_REQUIRED: {EDITED, APPROVED_FOR_DISPATCH, REGENERATE_REQUIRED, REJECTED},
        EDITED: {VALIDATING, REJECTED},
        REGENERATE_REQUIRED: {DRAFT, VALIDATING, REJECTED},
        BLOCKED: {EDITED, REGENERATE_REQUIRED, REJECTED},
        APPROVED_FOR_DISPATCH: {REJECTED, REGENERATE_REQUIRED, DISPATCHED},
        DISPATCHED: set(),
        REJECTED: {REGENERATE_REQUIRED, DRAFT},
    }


class OutreachChannel:
    LINKEDIN = "LINKEDIN"
    EMAIL = "EMAIL"
    OTHER = "OTHER"
    ALL = [LINKEDIN, EMAIL, OTHER]


class OutreachLength:
    SHORT = "SHORT"
    MEDIUM = "MEDIUM"
    ALL = [SHORT, MEDIUM]


class OutreachDraft(TimeStampedBase):
    """
    Phase 19 OutreachDraft model.
    Represents an evidence-grounded, AI-crafted, human-reviewed outreach communication
    prepared for an approved referral contact and target job.
    Strictly governed by human approval: APPROVE != SEND.
    Phase 19 terminates at APPROVED_FOR_DISPATCH.
    """
    __tablename__ = "outreach_drafts"

    candidate_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=True, index=True
    )
    job_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True, index=True
    )
    referral_contact_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("referral_contacts.id", ondelete="CASCADE"), nullable=True, index=True
    )
    resume_version_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("resume_versions.id", ondelete="SET NULL"), nullable=True, index=True
    )

    recipient_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    recipient_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    recipient_profile_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    channel: Mapped[str] = mapped_column(
        String(50), default=OutreachChannel.LINKEDIN, nullable=False, index=True
    )
    subject: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    def __init__(self, **kwargs):
        if "message_body" in kwargs and "body" not in kwargs:
            kwargs["body"] = kwargs.pop("message_body")
        super().__init__(**kwargs)

    @property
    def message_body(self) -> str:
        return self.body

    @message_body.setter
    def message_body(self, value: str) -> None:
        self.body = value

    status: Mapped[str] = mapped_column(
        String(50), default=OutreachDraftStatus.DRAFT, nullable=False, index=True
    )

    generation_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(50), default="v1.0", nullable=False)

    personalization_evidence: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    validation_results: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    risk_flags: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)

    approved_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    rejected_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    human_edits: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)

    # Invariant: Phase 19 never dispatches; defaults to NOT_DISPATCHED
    dispatch_status: Mapped[str] = mapped_column(
        String(50), default="NOT_DISPATCHED", nullable=False, index=True
    )

    audit_metadata: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    candidate = orm_relationship("Candidate", backref="outreach_drafts")
    job = orm_relationship("Job", backref="outreach_drafts")
    referral_contact = orm_relationship("ReferralContact", backref="outreach_drafts")
    resume_version = orm_relationship("ResumeVersion", backref="outreach_drafts")
    audit_events = orm_relationship(
        "OutreachAuditEvent",
        back_populates="draft",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class OutreachAuditEvent(TimeStampedBase):
    """
    Immutable audit trail for outreach preparation and human approval events.
    Guarantees transparent recording of human reviews, edits, validations, and approvals.
    """
    __tablename__ = "outreach_audit_events"

    draft_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("outreach_drafts.id", ondelete="CASCADE"), nullable=True, index=True
    )
    candidate_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    job_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    referral_contact_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)

    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    actor: Mapped[str] = mapped_column(String(100), default="user", nullable=False)
    payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    no_message_sent: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    draft = orm_relationship("OutreachDraft", back_populates="audit_events")


# -----------------------------------------------------------------------------
# Phase 20: Authorized Outreach Dispatch & Idempotency
# -----------------------------------------------------------------------------

class OutreachDispatchStatus:
    READY_TO_SEND = "READY_TO_SEND"
    QUEUED = "QUEUED"
    SENDING = "SENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    BOUNCED = "BOUNCED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    MANUAL_SEND_REQUIRED = "MANUAL_SEND_REQUIRED"

    ALL = [
        READY_TO_SEND,
        QUEUED,
        SENDING,
        SENT,
        DELIVERED,
        BOUNCED,
        FAILED,
        CANCELLED,
        MANUAL_SEND_REQUIRED,
    ]


class OutreachDispatch(TimeStampedBase):
    """
    Phase 20 OutreachDispatch model.
    Tracks the execution, provider delivery, and idempotency of an authorized outreach send.
    Only drafts in APPROVED_FOR_DISPATCH status are eligible for dispatch.
    """
    __tablename__ = "outreach_dispatches"

    draft_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("outreach_drafts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    job_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    referral_contact_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)

    channel: Mapped[str] = mapped_column(String(50), default="EMAIL", nullable=False, index=True)
    recipient_name: Mapped[str] = mapped_column(String(255), nullable=False)
    recipient_address: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), default="AUTHORIZED_MOCK", nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)

    status: Mapped[str] = mapped_column(
        String(50), default=OutreachDispatchStatus.READY_TO_SEND, nullable=False, index=True
    )
    provider_message_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    sent_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    delivery_confirmed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    audit_metadata: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    draft = orm_relationship("OutreachDraft", backref="dispatches")

