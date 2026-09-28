from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime
from backend.app.schemas.referral import ContactResponse
from backend.app.schemas.job import JobResponse


class OutreachBase(BaseModel):
    job_id: str = Field(..., description="Target Job ID")
    contact_id: str = Field(..., description="Target Contact ID")
    channel: str = Field(..., description="Communication channel: 'email' or 'linkedin'")
    subject: Optional[str] = Field(None, max_length=255, description="Subject line for email, or null for LinkedIn")
    body: str = Field(..., min_length=1, description="Personalized message body draft")
    status: str = Field(
        default="NEEDS_REVIEW",
        description="Outreach status: 'DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'SENT', 'REJECTED'"
    )
    relationship_context: Optional[str] = Field(None, description="Verified grounded relationship context")
    project_highlight: Optional[str] = Field(None, description="Specific project referenced in the message")
    metadata_json: Dict[str, Any] = Field(default_factory=dict, description="Metadata, guardrail checks, and resume references")


class OutreachCreate(OutreachBase):
    candidate_id: Optional[str] = Field(None, description="Candidate ID")
    referral_id: Optional[str] = Field(None, description="Associated Referral Opportunity ID")


class OutreachUpdate(BaseModel):
    subject: Optional[str] = Field(None, max_length=255)
    body: Optional[str] = Field(None, min_length=1)
    status: Optional[str] = Field(None, description="DRAFT, NEEDS_REVIEW, APPROVED, SENT, REJECTED")


class OutreachResponse(BaseModel):
    id: str
    job_id: str
    contact_id: str
    candidate_id: Optional[str] = None
    referral_id: Optional[str] = None
    channel: str
    subject: Optional[str] = None
    body: str
    status: str
    relationship_context: Optional[str] = None
    project_highlight: Optional[str] = None
    metadata_json: Dict[str, Any] = Field(default_factory=dict)
    approved_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Embedded related entities
    contact: Optional[ContactResponse] = None
    job: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class OutreachGenerateRequest(BaseModel):
    job_id: str = Field(..., description="Target Job ID")
    contact_id: str = Field(..., description="Target Contact ID")
    candidate_id: Optional[str] = Field(None, description="Optional Candidate profile ID")
    referral_id: Optional[str] = Field(None, description="Optional Referral ID")
    relevant_project_id: Optional[str] = Field(None, description="Optional specific project ID to highlight")
    channel: Optional[str] = Field("all", description="'all' (both Email & LinkedIn), 'email', or 'linkedin'")
    custom_instructions: Optional[str] = Field(None, description="Optional user preferences or specific talking points")


class OutreachBatchResponse(BaseModel):
    job_id: str
    contact_id: str
    company: str
    contact_name: str
    messages: List[OutreachResponse]
    ethical_protocol_notice: str = Field(
        default="Human-in-the-loop Protocol: Automated sending is disabled. All LinkedIn messages and referral emails must be reviewed, approved, and manually sent by the user."
    )


class OutreachActionResponse(BaseModel):
    id: str
    status: str
    message: str
    approved_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
