from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime


class ApplicationBase(BaseModel):
    job_id: str = Field(..., description="Target Job ID")
    candidate_id: Optional[str] = Field(None, description="Candidate ID")
    resume_version_id: Optional[str] = Field(None, description="Tailored Resume Version ID used for application")
    status: str = Field(
        default="SAVED",
        description="One of: 'SAVED', 'READY_TO_APPLY', 'APPLIED', 'SCREENING', 'INTERVIEW', 'TECHNICAL', 'FINAL_ROUND', 'OFFER', 'REJECTED', 'WITHDRAWN'"
    )
    applied_at: Optional[datetime] = Field(None, description="Timestamp when application was submitted")
    source: Optional[str] = Field("direct", description="Application source: direct, referral, linkedin, etc.")
    referral_status: Optional[str] = Field("none", description="Referral status: none, requested, referred, contact_reached")
    interview_stage: Optional[str] = Field(None, description="Interview sub-stage name")
    notes: Optional[str] = Field(None, description="User tracking notes")
    next_action: Optional[str] = Field(None, description="Next actionable step")
    next_followup_date: Optional[datetime] = Field(None, description="Follow-up reminder datetime")
    metadata_json: Dict[str, Any] = Field(default_factory=dict, description="Custom metadata")


class ApplicationCreate(ApplicationBase):
    pass


class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    resume_version_id: Optional[str] = None
    applied_at: Optional[datetime] = None
    source: Optional[str] = None
    referral_status: Optional[str] = None
    interview_stage: Optional[str] = None
    notes: Optional[str] = None
    next_action: Optional[str] = None
    next_followup_date: Optional[datetime] = None
    metadata_json: Optional[Dict[str, Any]] = None


class ApplicationResponse(ApplicationBase):
    id: str
    created_at: datetime
    updated_at: datetime

    # Embedded job info for the CRM card
    job: Optional[Dict[str, Any]] = None
    resume_version: Optional[Dict[str, Any]] = None
    match_score: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class KanbanBoardResponse(BaseModel):
    columns: Dict[str, List[ApplicationResponse]]
    total_applications: int


# -----------------------------------------------------------------------------
# Phase 20: Inbound Response, Assessment, Deadline, and Interview CRM Schemas
# -----------------------------------------------------------------------------

class InboundResponseCreate(BaseModel):
    sender: str
    body: str
    subject: Optional[str] = None
    channel: str = "EMAIL"
    candidate_id: Optional[str] = None
    job_id: Optional[str] = None
    contact_id: Optional[str] = None
    outreach_id: Optional[str] = None
    dispatch_id: Optional[str] = None
    application_id: Optional[str] = None
    message_id: Optional[str] = None
    received_at: Optional[datetime] = None
    metadata_json: Dict[str, Any] = Field(default_factory=dict)


class InboundResponseResponse(BaseModel):
    id: str
    sender: str
    subject: Optional[str] = None
    body: str
    channel: str
    received_at: datetime
    classification: str
    confidence: float
    action_required: bool
    assessment_detected: bool
    interview_detected: bool
    deadline_detected: bool
    candidate_id: Optional[str] = None
    job_id: Optional[str] = None
    contact_id: Optional[str] = None
    outreach_id: Optional[str] = None
    dispatch_id: Optional[str] = None
    application_id: Optional[str] = None
    created_at: datetime
    metadata_json: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class AssessmentCreate(BaseModel):
    title: str
    assessment_type: str = "CODING_ASSESSMENT"  # CODING_ASSESSMENT, APTITUDE_TEST, TECHNICAL_ASSIGNMENT, TAKE_HOME_PROJECT, ONLINE_TEST
    platform: str = "HACKERRANK"
    application_id: Optional[str] = None
    job_id: Optional[str] = None
    response_id: Optional[str] = None
    candidate_id: Optional[str] = None
    url: Optional[str] = None
    deadline: Optional[datetime] = None
    notes: Optional[str] = None
    confidence: float = 1.0


class AssessmentResponse(BaseModel):
    id: str
    title: str
    assessment_type: str
    platform: str
    url: Optional[str] = None
    deadline: Optional[datetime] = None
    status: str
    notes: Optional[str] = None
    confidence: float
    application_id: Optional[str] = None
    job_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    metadata_json: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class DeadlineCreate(BaseModel):
    title: str
    due_date: datetime
    deadline_type: str = "APPLICATION_DEADLINE"  # APPLICATION_DEADLINE, ASSESSMENT_DEADLINE, INTERVIEW, FOLLOW_UP, CUSTOM
    priority: str = "MEDIUM"  # LOW, MEDIUM, HIGH, URGENT
    application_id: Optional[str] = None
    candidate_id: Optional[str] = None
    notes: Optional[str] = None


class DeadlineResponse(BaseModel):
    id: str
    title: str
    due_date: datetime
    deadline_type: str
    status: str
    priority: str
    notes: Optional[str] = None
    application_id: Optional[str] = None
    created_at: datetime
    is_overdue: bool = False
    metadata_json: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class InterviewEventCreate(BaseModel):
    company: str
    scheduled_at: datetime
    interview_type: str = "TECHNICAL"  # HR, TECHNICAL, HIRING_MANAGER, SYSTEM_DESIGN, FINAL_ROUND, OTHER
    meeting_url: Optional[str] = None
    application_id: Optional[str] = None
    candidate_id: Optional[str] = None
    job_id: Optional[str] = None
    status: str = "SCHEDULED"
    notes: Optional[str] = None
    metadata_json: Dict[str, Any] = Field(default_factory=dict)


class InterviewEventResponse(BaseModel):
    id: str
    company: str
    scheduled_at: datetime
    interview_type: str
    meeting_url: Optional[str] = None
    status: str
    notes: Optional[str] = None
    application_id: Optional[str] = None
    job_id: Optional[str] = None
    created_at: datetime
    metadata_json: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    category: str
    is_read: bool
    deep_link: Optional[str] = None
    created_at: datetime
    metadata_json: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class ConnectedProviderResponse(BaseModel):
    id: str
    provider_type: str
    email_address: str
    is_connected: bool
    status: str
    scopes: List[str]
    created_at: datetime
    metadata_json: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class ApplicationDetailResponse(BaseModel):
    application: ApplicationResponse
    job: Optional[Dict[str, Any]] = None
    resume_version: Optional[Dict[str, Any]] = None
    referral_contacts: List[Dict[str, Any]] = Field(default_factory=list)
    outreach_drafts: List[Dict[str, Any]] = Field(default_factory=list)
    inbound_responses: List[InboundResponseResponse] = Field(default_factory=list)
    assessments: List[AssessmentResponse] = Field(default_factory=list)
    deadlines: List[DeadlineResponse] = Field(default_factory=list)
    interview_events: List[InterviewEventResponse] = Field(default_factory=list)
    timeline: List[Dict[str, Any]] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

