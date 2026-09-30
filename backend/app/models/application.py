from sqlalchemy import String, Text, ForeignKey, DateTime, JSON, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship
from typing import List, Optional, Dict, Any
import datetime
from backend.app.db.base import TimeStampedBase


class ApplicationStatus:
    DISCOVERED = "DISCOVERED"
    SAVED = "SAVED"
    ANALYZING = "ANALYZING"
    RESUME_PREPARED = "RESUME_PREPARED"
    RESUME_APPROVED = "RESUME_APPROVED"
    REFERRAL_RESEARCH = "REFERRAL_RESEARCH"
    OUTREACH_PREPARED = "OUTREACH_PREPARED"
    OUTREACH_APPROVED = "OUTREACH_APPROVED"
    OUTREACH_SENT = "OUTREACH_SENT"
    APPLICATION_READY = "APPLICATION_READY"
    APPLIED = "APPLIED"
    ASSESSMENT = "ASSESSMENT"
    INTERVIEW = "INTERVIEW"
    OFFER = "OFFER"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"

    # Legacy compatibility aliases
    READY_TO_APPLY = "READY_TO_APPLY"
    SCREENING = "SCREENING"
    TECHNICAL = "TECHNICAL"
    FINAL_ROUND = "FINAL_ROUND"

    ALL = [
        DISCOVERED,
        SAVED,
        ANALYZING,
        RESUME_PREPARED,
        RESUME_APPROVED,
        REFERRAL_RESEARCH,
        OUTREACH_PREPARED,
        OUTREACH_APPROVED,
        OUTREACH_SENT,
        APPLICATION_READY,
        READY_TO_APPLY,
        APPLIED,
        SCREENING,
        ASSESSMENT,
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
    outreach, response, assessment, interview, and offer lifecycle.
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


# -----------------------------------------------------------------------------
# Phase 20: Inbound Response Tracking, Assessment, Interview & Deadline Models
# -----------------------------------------------------------------------------

class InboundResponse(TimeStampedBase):
    """
    Inbound communication response from a recruiter, contact, or employer.
    Classified evidence-first for referral offers, interview invitations, or assessments.
    """
    __tablename__ = "inbound_responses"

    candidate_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    job_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    contact_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    outreach_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    dispatch_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    application_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("applications.id", ondelete="SET NULL"), nullable=True, index=True
    )

    channel: Mapped[str] = mapped_column(String(50), default="EMAIL", nullable=False)
    message_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    received_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False
    )
    sender: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    classification: Mapped[str] = mapped_column(
        String(50), default="OTHER", nullable=False, index=True
    )  # POSITIVE, REFERRAL_OFFER, INTERESTED, REQUEST_MORE_INFO, ASSESSMENT, INTERVIEW, APPLICATION_UPDATE, DECLINED, NO_RESPONSE, OTHER
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    action_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    assessment_detected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    interview_detected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deadline_detected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    application = orm_relationship("Application", backref="responses")


class Assessment(TimeStampedBase):
    """
    Coding assessment, online test, or technical assignment assigned to the candidate.
    """
    __tablename__ = "assessments"

    application_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=True, index=True
    )
    job_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True, index=True
    )
    response_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("inbound_responses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    candidate_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True, index=True
    )

    assessment_type: Mapped[str] = mapped_column(
        String(50), default="CODING_ASSESSMENT", nullable=False
    )  # CODING_ASSESSMENT, APTITUDE_TEST, TECHNICAL_ASSIGNMENT, TAKE_HOME_PROJECT, ONLINE_TEST
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    platform: Mapped[str] = mapped_column(String(100), default="HACKERRANK", nullable=False)
    url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    deadline: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    application = orm_relationship("Application", backref="assessments")


class Deadline(TimeStampedBase):
    """
    Actionable deadline (application deadline, assessment deadline, interview date, follow-up).
    """
    __tablename__ = "deadlines"

    application_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=True, index=True
    )
    candidate_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True, index=True
    )

    deadline_type: Mapped[str] = mapped_column(
        String(50), default="APPLICATION_DEADLINE", nullable=False, index=True
    )  # APPLICATION_DEADLINE, ASSESSMENT_DEADLINE, INTERVIEW, FOLLOW_UP, CUSTOM
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    due_date: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False, index=True)  # PENDING, MET, MISSED, CANCELLED
    priority: Mapped[str] = mapped_column(String(50), default="MEDIUM", nullable=False)  # LOW, MEDIUM, HIGH, URGENT
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    application = orm_relationship("Application", backref="deadlines")


class InterviewEvent(TimeStampedBase):
    """
    Scheduled interview event (HR, technical, manager, final round) on an application.
    """
    __tablename__ = "interview_events"

    application_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=True, index=True
    )
    candidate_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    job_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True, index=True
    )

    company: Mapped[str] = mapped_column(String(255), nullable=False)
    scheduled_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    interview_type: Mapped[str] = mapped_column(String(50), default="TECHNICAL", nullable=False)  # HR, TECHNICAL, HIRING_MANAGER, SYSTEM_DESIGN, FINAL_ROUND, OTHER
    meeting_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="SCHEDULED", nullable=False, index=True)  # SCHEDULED, COMPLETED, CANCELLED, RESCHEDULED
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    application = orm_relationship("Application", backref="interview_events")


class Notification(TimeStampedBase):
    """
    In-app user notification item with category and deep link.
    """
    __tablename__ = "notifications"

    candidate_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(
        String(50), default="SYSTEM", nullable=False, index=True
    )  # JOB_MATCH, RESUME_READY, REFERRAL_READY, OUTREACH_REVIEW, MESSAGE_SENT, RESPONSE_RECEIVED, ASSESSMENT, INTERVIEW, DEADLINE, SYSTEM
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    deep_link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class ConnectedProvider(TimeStampedBase):
    """
    Authorized email/dispatch integration connection (Gmail, Outlook).
    Stores authorized connection status without exposing raw credentials.
    """
    __tablename__ = "connected_providers"

    candidate_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    provider_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # GMAIL, OUTLOOK
    email_address: Mapped[str] = mapped_column(String(255), nullable=False)
    is_connected: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="CONNECTED", nullable=False)
    scopes: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class ApplicationQueueItem(TimeStampedBase):
    """
    High-Throughput Application Preparation & Queue Model (Phase 23 Part N).
    Enables sequential batch preparation without blind auto-submission.
    Guarantees explicit human confirmation before final submission.
    """
    __tablename__ = "application_queue"

    candidate_id: Mapped[str] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_id: Mapped[str] = mapped_column(
        String, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    priority: Mapped[str] = mapped_column(String(50), default="MEDIUM", nullable=False)  # HIGH, MEDIUM, LOW
    status: Mapped[str] = mapped_column(
        String(50), default="READY", nullable=False, index=True
    )  # READY, NEEDS_RESUME, NEEDS_REVIEW, NEEDS_REFERRAL, NEEDS_OUTREACH, READY_TO_APPLY, MANUAL_SUBMIT, APPLIED, ASSESSMENT, INTERVIEW, OFFER, REJECTED, WITHDRAWN
    next_action: Mapped[str] = mapped_column(String(255), default="Review Job Requirements", nullable=False)
    resume_version_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("resume_versions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    referral_status: Mapped[Optional[str]] = mapped_column(String(100), default="NONE", nullable=True)
    outreach_status: Mapped[Optional[str]] = mapped_column(String(100), default="NONE", nullable=True)
    application_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    application_method: Mapped[str] = mapped_column(String(50), default="DIRECT", nullable=False)  # DIRECT, PORTAL, EMAIL, EXTERNAL_ATS
    deadline: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    user_confirmation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    confirmed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    job = orm_relationship("Job", lazy="joined")
    candidate = orm_relationship("Candidate")
    resume_version = orm_relationship("ResumeVersion", lazy="joined")


# Alias for Phase 23 prompt specification
ApplicationQueue = ApplicationQueueItem


