from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime


class UserRole:
    CANDIDATE = "CANDIDATE"
    ADMIN = "ADMIN"


class UserRegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="Valid user email address")
    password: str = Field(..., min_length=8, description="Secure password (min 8 characters)")
    full_name: str = Field(..., min_length=2, description="Candidate's full name")
    headline: Optional[str] = Field(None, description="Optional professional headline")


class UserLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered user email")
    password: str = Field(..., description="User password")


class UserRead(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    is_verified: bool
    candidate_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class TokenData(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None


class UserStatusUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[str] = None


class AdminDashboardKPI(BaseModel):
    total_users: int
    active_users: int
    total_candidates: int
    total_jobs: int
    total_applications: int
    total_outreach_drafts: int
    total_resumes: int = 0
    total_tailored_resumes: int = 0
    total_referrals: int = 0
    total_interviews: int = 0
    n8n_connected: bool
    system_status: str
    environment: str


class AdminCandidateItem(BaseModel):
    id: str
    user_id: Optional[str] = None
    email: Optional[str] = None
    full_name: str
    headline: Optional[str] = None
    location: Optional[str] = None
    created_at: Optional[datetime] = None
    resumes_count: int = 0
    applications_count: int = 0
    interviews_count: int = 0


class AdminJobItem(BaseModel):
    id: str
    title: str
    company: str
    location: Optional[str] = None
    source: str
    url: Optional[str] = None
    created_at: Optional[datetime] = None
    applications_count: int = 0


class AdminApplicationItem(BaseModel):
    id: str
    candidate_id: str
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    job_id: str
    job_title: Optional[str] = None
    company: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AdminResumeItem(BaseModel):
    id: str
    candidate_id: str
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    filename: str
    content_type: Optional[str] = None
    is_latex: bool = False
    master_template_saved: bool = False
    created_at: Optional[datetime] = None
    versions_count: int = 0


class AdminReferralItem(BaseModel):
    id: str
    candidate_id: Optional[str] = None
    job_id: Optional[str] = None
    job_title: Optional[str] = None
    company: Optional[str] = None
    contact_name: str
    contact_role: Optional[str] = None
    channel: str
    status: str
    risk_level: Optional[str] = None
    created_at: Optional[datetime] = None


class AdminInterviewItem(BaseModel):
    id: str
    candidate_id: str
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    job_id: str
    job_title: Optional[str] = None
    company: Optional[str] = None
    status: str
    turns_count: int = 0
    overall_score: Optional[float] = None
    created_at: Optional[datetime] = None
