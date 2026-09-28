from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import datetime


class ProfileCompletionItem(BaseModel):
    category: str
    label: str
    is_completed: bool = False
    weight: int = 10
    detail: Optional[str] = None


class ProfileCompletionSummary(BaseModel):
    score: int = Field(..., ge=0, le=100, description="Overall profile completion percentage")
    candidate_name: Optional[str] = None
    candidate_headline: Optional[str] = None
    skills_count: int = 0
    experiences_count: int = 0
    education_count: int = 0
    projects_count: int = 0
    has_master_resume: bool = False
    has_github_linked: bool = False
    completed_items: List[str] = Field(default_factory=list)
    missing_items: List[str] = Field(default_factory=list)


class JobsDiscoveredSummary(BaseModel):
    total_jobs: int = 0
    active_jobs: int = 0
    sources_breakdown: Dict[str, int] = Field(default_factory=dict)
    recent_jobs: List[Dict[str, Any]] = Field(default_factory=list)


class StrongMatchItem(BaseModel):
    job_id: str
    company: str
    role: str
    location: Optional[str] = None
    match_score: float = Field(..., ge=0, le=100)
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    created_at: Optional[datetime.datetime] = None


class ApplicationSummary(BaseModel):
    total_applications: int = 0
    by_status: Dict[str, int] = Field(default_factory=dict)
    recent_applications: List[Dict[str, Any]] = Field(default_factory=list)


class ReferralOpportunityItem(BaseModel):
    job_id: str
    job_role: str
    job_company: str
    contact_id: str
    contact_name: str
    contact_company: str
    relationship_type: str
    relevance_reason: str
    status: str = "identified"


class PendingOutreachItem(BaseModel):
    id: str
    job_id: str
    job_role: str
    job_company: str
    contact_name: str
    channel: str  # email | linkedin
    subject: Optional[str] = None
    body_snippet: str
    status: str
    created_at: datetime.datetime


class InterviewItem(BaseModel):
    id: str
    type: str  # "mock_session" | "crm_stage"
    company: str
    role: str
    stage_or_status: str
    score: Optional[float] = None
    updated_at: Optional[datetime.datetime] = None


class SkillGapSummaryItem(BaseModel):
    skill: str
    category: str = "Technical"
    frequency: int = 1
    priority: str = "HIGH"  # CRITICAL | HIGH | MEDIUM | LOW
    current_strength: str = "Weak"  # Weak | Medium | Strong


class RecommendedProjectSummaryItem(BaseModel):
    title: str
    description: str
    focus_skills: List[str] = Field(default_factory=list)
    deliverables: str


class FollowupItem(BaseModel):
    application_id: str
    job_id: str
    company: str
    role: str
    next_action: str
    followup_date: datetime.datetime
    is_overdue: bool = False
    days_diff: int = 0


class PipelineCounts(BaseModel):
    jobs_count: int = 0
    matched_count: int = 0
    tailored_resumes_count: int = 0
    compiled_pdfs_count: int = 0
    referrals_count: int = 0
    outreaches_count: int = 0
    pending_approvals_count: int = 0
    applied_count: int = 0
    interviews_count: int = 0


class DashboardSummaryResponse(BaseModel):
    candidate_id: Optional[str] = None
    generated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    pipeline_counts: PipelineCounts

    # 10 Core Dashboard Sections
    profile_completion: ProfileCompletionSummary
    jobs_discovered: JobsDiscoveredSummary
    strong_matches: List[StrongMatchItem] = Field(default_factory=list)
    applications: ApplicationSummary
    referral_opportunities: List[ReferralOpportunityItem] = Field(default_factory=list)
    outreach_requiring_approval: List[PendingOutreachItem] = Field(default_factory=list)
    interviews: List[InterviewItem] = Field(default_factory=list)
    skill_gaps: List[SkillGapSummaryItem] = Field(default_factory=list)
    recommended_projects: List[RecommendedProjectSummaryItem] = Field(default_factory=list)
    follow_ups: List[FollowupItem] = Field(default_factory=list)
