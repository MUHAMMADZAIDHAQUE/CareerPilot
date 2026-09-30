from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime


# -----------------------------------------------------------------------------
# Contact Schemas
# -----------------------------------------------------------------------------

class ContactBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Full name of the contact")
    company: str = Field(..., min_length=1, max_length=255, description="Current or recent company")
    role: str = Field(..., min_length=1, max_length=255, description="Job title or role")
    department: Optional[str] = Field(None, max_length=150, description="Department, e.g. Engineering, Product")
    source: str = Field(
        default="user_provided",
        description="Source of contact, e.g., user_provided, university_alumni, former_colleague, authorized_directory"
    )
    profile_url: Optional[str] = Field(None, max_length=500, description="Permitted public profile or website URL")
    email: Optional[str] = Field(None, max_length=255, description="Legitimately available professional email")
    relationship: Optional[str] = Field(None, max_length=255, description="Descriptor of relationship or connection")
    notes: Optional[str] = Field(None, description="Personal or context notes")
    university: Optional[str] = Field(None, max_length=255, description="Alma mater or shared educational institution")
    skills: List[str] = Field(default_factory=list, description="Known technical skills or domain expertise")


class ContactCreate(ContactBase):
    candidate_id: Optional[str] = Field(None, description="Optional associated candidate ID")


class ContactUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    company: Optional[str] = Field(None, min_length=1, max_length=255)
    role: Optional[str] = Field(None, min_length=1, max_length=255)
    department: Optional[str] = Field(None, max_length=150)
    source: Optional[str] = None
    profile_url: Optional[str] = None
    email: Optional[str] = None
    relationship: Optional[str] = None
    notes: Optional[str] = None
    university: Optional[str] = None
    skills: Optional[List[str]] = None


class ContactResponse(ContactBase):
    id: str
    candidate_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Referral Opportunity Schemas
# -----------------------------------------------------------------------------

class ReferralEvidenceItem(BaseModel):
    factor: str = Field(..., description="Scoring factor: same_company, same_university, relevant_department, same_field, role_relevance")
    description: str = Field(..., description="Human-readable explanation of why this factor matched")
    evidence: str = Field(..., description="Factual evidence grounding this claim")
    score_contribution: float = Field(..., description="Points added for this factor")


class ReferralScoreBreakdown(BaseModel):
    same_company: float = 0.0
    same_university: float = 0.0
    relevant_department: float = 0.0
    same_field: float = 0.0
    role_relevance: float = 0.0
    total_score: float = 0.0


class ReferralResponse(BaseModel):
    id: str
    job_id: str
    contact_id: str
    candidate_id: Optional[str] = None
    relationship_type: str = Field(
        ...,
        description="One of: 'university alumni', 'current employee', 'former colleague', 'known professional contact', 'user-provided connection'"
    )
    relevance_score: float = Field(..., description="Transparent relevance score between 0 and 100")
    relevance_reason: str = Field(..., description="Grounded explanation of referral suitability")
    status: str = Field(
        default="suggested",
        description="Referral tracking status: suggested, drafted, contacted, referred, declined"
    )
    evidence: List[Dict[str, Any]] = Field(default_factory=list, description="Verifiable evidence items")
    score_breakdown: Dict[str, Any] = Field(default_factory=dict, description="Transparent factor score breakdown")
    notes: Optional[str] = None
    contact: Optional[ContactResponse] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReferralStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="New status: suggested, drafted, contacted, referred, declined")
    notes: Optional[str] = Field(None, description="Outreach notes or feedback")


class DiscoverReferralsRequest(BaseModel):
    candidate_id: Optional[str] = Field(None, description="Optional target candidate ID")
    min_score: Optional[float] = Field(0.0, ge=0.0, le=100.0, description="Minimum relevance score threshold")


class JobReferralsResponse(BaseModel):
    job_id: str
    company: str
    role: str
    total_opportunities: int
    referrals: List[ReferralResponse]
    ethical_policy_notice: str = Field(
        default="All referral insights respect ethical privacy guidelines: no unauthorized LinkedIn scraping, no automated messaging, and zero unsolicited bulk outreach."
    )


# -----------------------------------------------------------------------------
# Phase 18: Referral Discovery Engine Schemas (50+ Target & Provenance)
# -----------------------------------------------------------------------------

class ReferralContactResponse(BaseModel):
    id: str
    company_id: Optional[str] = None
    company_name: str
    company: str
    job_id: str
    candidate_id: Optional[str] = None
    name: str
    headline: Optional[str] = None
    current_title: str
    role: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    profile_url: Optional[str] = None
    source: str
    source_url: Optional[str] = None
    source_references: List[Dict[str, Any]] = Field(default_factory=list)
    public_contact_method: Optional[str] = None
    university: Optional[str] = None
    graduation_year: Optional[int] = None
    skills: List[str] = Field(default_factory=list)
    relevance_score: float = 0.0
    relevance_reasons: List[str] = Field(default_factory=list)
    score_breakdown: Dict[str, Any] = Field(default_factory=dict)
    relationship_type: str
    verification_status: str
    last_verified_at: Optional[str] = None
    discovered_at: Optional[str] = None
    duplicate_key: Optional[str] = None
    notes: Optional[str] = None
    outreach_status: str = "NOT_CONTACTED"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ReferralDiscoveryRequest(BaseModel):
    job_id: str = Field(..., description="Target Job ID to discover referrals for")
    candidate_id: Optional[str] = Field(None, description="Optional Candidate ID to evaluate alumni/skill alignment")
    target_count: int = Field(50, ge=1, le=200, description="Minimum potential referral discovery target (default: 50)")
    min_score: Optional[float] = Field(0.0, ge=0.0, le=100.0, description="Minimum relevance score threshold")
    sources: Optional[List[str]] = Field(None, description="Optional list of specific sources to query")


class ReferralDiscoveryResponse(BaseModel):
    job_id: str
    company: str
    role: str
    target_count: int = 50
    total_discovered: int
    total_verified: int
    target_reached: bool
    shortfall: int
    sources_used: List[str]
    source_failures: List[Dict[str, Any]] = Field(default_factory=list)
    contacts: List[ReferralContactResponse]
    notice: Optional[str] = None
    ethical_notice: str = Field(
        default="Referral discovery operates strictly via legitimate public/authorized data. No credentials bypassed, no private scraping, zero automated messaging."
    )


class ReferralContactSelectRequest(BaseModel):
    notes: Optional[str] = Field(None, description="Optional selection notes for outreach prep")


class ReferralContactNotesRequest(BaseModel):
    notes: str = Field(..., description="User notes on the contact")


class BulkSelectRequest(BaseModel):
    contact_ids: List[str] = Field(..., description="List of ReferralContact IDs")
    action: str = Field("select", description="'select' | 'deselect' | 'select_all_verified'")


class BulkSelectResponse(BaseModel):
    action: str
    selected_count: int
    updated_contact_ids: List[str]
    message: str


class ReferralSourceStatus(BaseModel):
    source_id: str
    name: str
    enabled: bool
    status: str  # "healthy" | "degraded" | "offline"
    description: str
    legitimate_access_method: str


class ReferralSourceStatusResponse(BaseModel):
    sources: List[ReferralSourceStatus]
    total_configured: int
    total_active: int

