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
    n8n_connected: bool
    system_status: str
    environment: str
