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
