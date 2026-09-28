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
