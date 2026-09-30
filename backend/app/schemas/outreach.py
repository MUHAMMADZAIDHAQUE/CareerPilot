from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime
from backend.app.schemas.referral import ContactResponse
from backend.app.schemas.job import JobResponse


# -----------------------------------------------------------------------------
# Legacy Outreach Schemas (Phases 1-14)
# -----------------------------------------------------------------------------

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


# -----------------------------------------------------------------------------
# Phase 19: Outreach Preparation & Human Approval Schemas
# -----------------------------------------------------------------------------

class PersonalizationEvidenceItem(BaseModel):
    type: str = Field(..., description="Evidence type: COMPANY, ROLE, TEAM, TECHNOLOGY, PUBLIC_PROJECT, PUBLIC_ARTICLE, PUBLIC_TALK, GITHUB, ALUMNI, JOB_CONTEXT")
    claim: str = Field(..., description="Specific verified factual claim grounded in evidence")
    source: str = Field(..., description="Source of evidence: GitHub, LinkedIn, Company, University, Resume")
    source_url: Optional[str] = Field(None, description="Verifiable URL")
    confidence: float = Field(1.0, description="Evidence confidence score (not referral probability)")
    verified_at: Optional[str] = None


class ValidationResult(BaseModel):
    passed: bool
    risk_level: str = Field("LOW", description="LOW | MEDIUM | HIGH | BLOCKED")
    risk_flags: List[str] = Field(default_factory=list)
    unsupported_claims: List[str] = Field(default_factory=list)
    verified_claims: List[str] = Field(default_factory=list)
    suggested_repairs: List[Dict[str, str]] = Field(default_factory=list)
    repaired: bool = False
    repair_attempts: int = 0


class HumanEditRecord(BaseModel):
    original_body: str
    edited_body: str
    original_subject: Optional[str] = None
    edited_subject: Optional[str] = None
    edited_at: str
    edited_by: str = "user"
    change_summary: Optional[str] = None


class OutreachDraftCreate(BaseModel):
    job_id: str = Field(..., description="Target Job ID")
    referral_contact_id: str = Field(..., description="Selected Referral Contact ID")
    candidate_id: Optional[str] = None
    resume_version_id: Optional[str] = None
    channel: str = Field("LINKEDIN", description="'LINKEDIN', 'EMAIL', or 'OTHER'")
    length: str = Field("MEDIUM", description="'SHORT' or 'MEDIUM'")
    subject: Optional[str] = None
    body: Optional[str] = None


class OutreachDraftGenerateRequest(BaseModel):
    job_id: str = Field(..., description="Target Job ID")
    referral_contact_id: str = Field(..., description="Selected Referral Contact ID")
    candidate_id: Optional[str] = None
    resume_version_id: Optional[str] = None
    channel: str = Field("LINKEDIN", description="'LINKEDIN', 'EMAIL', or 'OTHER'")
    length: str = Field("MEDIUM", description="'SHORT' or 'MEDIUM'")
    custom_instructions: Optional[str] = None


class OutreachDraftBulkGenerateRequest(BaseModel):
    job_id: str = Field(..., description="Target Job ID")
    contact_ids: List[str] = Field(..., min_length=1, description="List of selected Referral Contact IDs")
    candidate_id: Optional[str] = None
    channel: str = Field("LINKEDIN", description="'LINKEDIN', 'EMAIL', or 'OTHER'")
    length: str = Field("MEDIUM", description="'SHORT' or 'MEDIUM'")
    custom_instructions: Optional[str] = None


class OutreachDraftEditRequest(BaseModel):
    subject: Optional[str] = None
    body: str = Field(..., min_length=1, description="Updated message body")
    editor: Optional[str] = "user"
    change_summary: Optional[str] = None


class OutreachDraftApproveRequest(BaseModel):
    approver: Optional[str] = "user"
    notes: Optional[str] = None


class OutreachDraftRejectRequest(BaseModel):
    rejector: Optional[str] = "user"
    reason: Optional[str] = None


class OutreachDraftRegenerateRequest(BaseModel):
    custom_instructions: Optional[str] = None
    channel: Optional[str] = None
    length: Optional[str] = None


class OutreachDraftResponse(BaseModel):
    id: str
    candidate_id: str
    job_id: str
    referral_contact_id: str
    resume_version_id: Optional[str] = None
    channel: str
    subject: Optional[str] = None
    body: str
    status: str
    generation_version: int
    prompt_version: str
    personalization_evidence: List[PersonalizationEvidenceItem] = Field(default_factory=list)
    validation_results: Dict[str, Any] = Field(default_factory=dict)
    risk_flags: List[str] = Field(default_factory=list)
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    rejected_at: Optional[datetime] = None
    rejected_by: Optional[str] = None
    human_edits: List[Dict[str, Any]] = Field(default_factory=list)
    dispatch_status: str
    audit_metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

    # Embedded UI context
    contact_name: Optional[str] = None
    contact_title: Optional[str] = None
    contact_company: Optional[str] = None
    contact_relationship_type: Optional[str] = None
    contact_relevance_score: Optional[float] = None
    contact_profile_url: Optional[str] = None
    job_title: Optional[str] = None
    job_company: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OutreachDraftBulkGenerateResponse(BaseModel):
    job_id: str
    company_name: str
    total_requested: int
    total_generated: int
    total_validated: int
    total_blocked: int
    drafts: List[OutreachDraftResponse]
    notice: str = Field(
        default="Outreach drafts prepared and validated for future dispatch. Messages have NOT been sent. Human review and explicit approval required."
    )


# -----------------------------------------------------------------------------
# Phase 20: Authorized Outreach Dispatch & Idempotency Schemas
# -----------------------------------------------------------------------------

class OutreachDispatchRequest(BaseModel):
    provider: Optional[str] = Field("AUTHORIZED_MOCK", description="Authorized email provider (e.g. GMAIL, OUTLOOK, AUTHORIZED_MOCK)")
    confirm_send: bool = Field(False, description="Explicit human confirmation checkbox to send message")
    confirmed_send: Optional[bool] = Field(None, description="Alias for confirm_send")
    recipient_email_override: Optional[str] = Field(None, description="Optional override recipient email")

    def model_post_init(self, __context: Any) -> None:
        if self.confirmed_send is not None and not self.confirm_send:
            self.confirm_send = self.confirmed_send


class OutreachBulkDispatchRequest(BaseModel):
    draft_ids: List[str] = Field(..., description="List of draft IDs approved for dispatch")
    provider: Optional[str] = Field("AUTHORIZED_MOCK", description="Authorized provider")
    confirm_send: bool = Field(False, description="Explicit human confirmation checkbox to send bulk messages")
    confirmed_send: Optional[bool] = Field(None, description="Alias for confirm_send")

    def model_post_init(self, __context: Any) -> None:
        if self.confirmed_send is not None and not self.confirm_send:
            self.confirm_send = self.confirmed_send


class OutreachDispatchResponse(BaseModel):
    id: str
    draft_id: str
    status: str
    channel: str
    provider: str
    recipient_name: str
    recipient_address: str
    provider_message_id: Optional[str] = None
    sent_at: Optional[datetime] = None
    delivery_confirmed_at: Optional[datetime] = None
    idempotency_key: str
    duplicate_prevented: bool = False
    manual_send_details: Optional[Dict[str, Any]] = None
    message: str
    audit_metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)

