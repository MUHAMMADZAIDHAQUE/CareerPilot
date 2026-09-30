from pydantic import BaseModel, Field, HttpUrl, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime


class JobAnalyzeRequest(BaseModel):
    """Payload for POST /api/jobs/analyze."""
    job_description: str = Field(..., min_length=20, description="Pasted raw text of the job description.")
    job_url: Optional[str] = Field(None, description="Optional job posting or application URL.")
    company: Optional[str] = Field(None, max_length=255, description="Optional pre-filled company name.")
    role: Optional[str] = Field(None, max_length=255, description="Optional pre-filled role/title.")


class JobRequirementBase(BaseModel):
    """Granular requirement extracted from the job description."""
    name: str = Field(..., description="Name of the skill, technology, or concept.")
    requirement_type: str = Field(..., description="Required ('required'), Preferred ('preferred'), or Inferred ('inferred').")
    category: Optional[str] = Field("skill", description="Category: skill, technology, experience, education, domain.")
    context: Optional[str] = Field(None, description="Direct supporting sentence or phrase from the JD.")
    years_experience: Optional[float] = Field(None, description="Required years of experience if explicitly specified.")


class JobRequirementResponse(JobRequirementBase):
    id: str
    job_id: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ParsedJobAnalysis(BaseModel):
    """
    Strict schema for Structured LLM output.
    All fields are directly grounded in the source JD to prevent hallucination.
    """
    company: str = Field(..., description="Hiring organization name.")
    role: str = Field(..., description="Specific job title or role.")
    location: Optional[str] = Field("Remote", description="Job location or 'Remote'.")
    employment_type: Optional[str] = Field("Full-time", description="Full-time, Part-time, Contract, etc.")
    summary: Optional[str] = Field(None, description="Concise 2-3 sentence overview of the role.")
    domain: Optional[str] = Field(None, description="Industry or technical domain (e.g. Distributed Systems, FinTech, AI).")
    salary: Optional[str] = Field(None, description="Compensation range ONLY if explicitly stated in text.")
    application_url: Optional[str] = Field(None, description="Application or careers portal URL.")
    deadline: Optional[str] = Field(None, description="Application deadline if explicitly stated.")
    experience_requirement: Optional[str] = Field(None, description="Years and type of required professional experience.")
    
    education_requirements: List[str] = Field(default_factory=list, description="Explicit degree or educational requirements.")
    required_skills: List[str] = Field(default_factory=list, description="Skills explicitly marked as required, mandatory, or minimum qualifications.")
    preferred_skills: List[str] = Field(default_factory=list, description="Skills explicitly marked as preferred, nice-to-have, or bonuses.")
    inferred_concepts: List[str] = Field(default_factory=list, description="Core architectural concepts or domain paradigms evident from the scope.")
    responsibilities: List[str] = Field(default_factory=list, description="Key duties and day-to-day responsibilities.")
    qualifications: List[str] = Field(default_factory=list, description="Formal minimum qualifications.")
    technologies: List[str] = Field(default_factory=list, description="Specific frameworks, languages, databases, and tools mentioned.")
    requirements_breakdown: List[JobRequirementBase] = Field(default_factory=list, description="Detailed itemized breakdown with context quotes.")


class JobResponse(BaseModel):
    """Complete analyzed Job response returned by the API."""
    id: str
    company: str
    role: str
    location: Optional[str] = None
    employment_type: Optional[str] = "Full-time"
    raw_description: str
    summary: Optional[str] = None
    domain: Optional[str] = None
    salary: Optional[str] = None
    application_url: Optional[str] = None
    deadline: Optional[str] = None
    experience_requirement: Optional[str] = None
    education_requirements: List[str] = Field(default_factory=list)
    responsibilities: List[str] = Field(default_factory=list)
    qualifications: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    required_skills: List[str] = Field(default_factory=list)
    preferred_skills: List[str] = Field(default_factory=list)
    inferred_concepts: List[str] = Field(default_factory=list)
    requirements: List[JobRequirementResponse] = Field(default_factory=list)

    # Phase 8 & 16B: Multi-Source Discovery, Normalization & Candidate Matching enrichment
    source_type: Optional[str] = "direct"
    source_name: Optional[str] = "Direct Entry"
    canonical_url: Optional[str] = None
    external_id: Optional[str] = None
    is_active: bool = True
    is_expired: bool = False
    
    # Phase 16B fields
    normalized_title: Optional[str] = None
    official_company_url: Optional[str] = None
    remote_status: Optional[str] = "Unknown"
    experience_level: Optional[str] = "Unknown"
    is_fresher_eligible: bool = False
    fresher_eligibility_reason: Optional[str] = None
    source_references: List[Dict[str, Any]] = Field(default_factory=list)
    posted_at: Optional[str] = None
    last_verified_at: Optional[str] = None
    
    match_score: Optional[float] = None
    match_category: Optional[str] = None
    eligibility_status: Optional[str] = None
    matched_skills: Optional[List[str]] = None
    missing_required_skills: Optional[List[str]] = None
    missing_preferred_skills: Optional[List[str]] = None
    safety_signals: Optional[Dict[str, Any]] = None
    scam_risk_level: Optional[str] = "SAFE"
    has_safety_warnings: bool = False

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Phase 8: Discovery & Import Schemas
# -----------------------------------------------------------------------------

class JobUrlImportRequest(BaseModel):
    """Payload for POST /api/jobs/import-url."""
    url: str = Field(..., description="Job posting or career page URL")
    company: Optional[str] = Field(None, description="Optional override or hint for company name")
    role: Optional[str] = Field(None, description="Optional override or hint for role/title")
    source_name: Optional[str] = Field(None, description="Optional source label (e.g. Greenhouse, Lever, Direct)")


class JobImportItem(BaseModel):
    """Structured job entry for batch or feed import."""
    company: str = Field(..., min_length=1)
    role: str = Field(..., min_length=1)
    description: str = Field(..., min_length=20)
    location: Optional[str] = "Remote"
    employment_type: Optional[str] = "Full-time"
    url: Optional[str] = None
    salary: Optional[str] = None
    deadline: Optional[str] = None
    external_id: Optional[str] = None
    required_skills: Optional[List[str]] = Field(default_factory=list)
    preferred_skills: Optional[List[str]] = Field(default_factory=list)


class JobBulkImportRequest(BaseModel):
    """Payload for POST /api/jobs/import."""
    source_type: str = Field("user_configured", description="Source type: url_import, public_feed, career_page, user_configured")
    source_name: Optional[str] = Field("Custom Import", description="Human-readable source label")
    feed_url: Optional[str] = Field(None, description="URL of public feed or authorized API")
    jobs: Optional[List[JobImportItem]] = Field(None, description="List of structured jobs to import")


class JobImportResultItem(BaseModel):
    """Per-job outcome in import operations."""
    job_id: Optional[str] = None
    company: str
    role: str
    canonical_url: Optional[str] = None
    status: str  # "imported" | "duplicate" | "expired" | "error"
    is_duplicate: bool = False
    message: str


class JobBulkImportResponse(BaseModel):
    """Response returned by POST /api/jobs/import."""
    total_processed: int
    imported_count: int
    duplicate_count: int
    expired_count: int
    results: List[JobImportResultItem]
    jobs: List[JobResponse]


class JobUrlImportResponse(BaseModel):
    """Response returned by POST /api/jobs/import-url."""
    job: JobResponse
    is_duplicate: bool = False
    is_expired: bool = False
    canonical_url: str
    message: str


class RecommendedJobItem(BaseModel):
    """Enriched job opportunity with candidate match score and skill gaps."""
    job: JobResponse
    overall_match_score: float
    matched_skills: List[str]
    missing_required_skills: List[str]
    missing_preferred_skills: List[str]
    project_relevance_summary: Optional[str] = None
    recommendation_reason: str


class RecommendedJobsResponse(BaseModel):
    """Response returned by GET /api/jobs/recommended."""
    candidate_id: Optional[str] = None
    candidate_name: Optional[str] = None
    total_recommendations: int
    recommendations: List[RecommendedJobItem]


# -----------------------------------------------------------------------------
# Phase 16B: Multi-Source Discovery & Alert Schemas
# -----------------------------------------------------------------------------

class JobDiscoveryRequest(BaseModel):
    """Payload for POST /api/jobs/discover."""
    sources: Optional[List[str]] = Field(
        default=None,
        description="List of source identifiers to query ('linkedin', 'freshershunt', 'company_careers', 'indeed', 'public_feed').",
    )
    candidate_id: Optional[str] = Field(None, description="Candidate ID to score matches against.")
    min_match_score: float = Field(65.0, ge=0.0, le=100.0, description="Minimum match score to generate alerts.")
    batch_limit: int = Field(10, ge=1, le=50, description="Max jobs to discover per source.")


class JobAlertItem(BaseModel):
    """Structured job alert item formatted for notifications and workflow dispatch."""
    job_id: str
    title: str
    normalized_title: str
    company: str
    match_score: float
    match_category: str
    location: Optional[str] = None
    why_it_matches: List[str] = Field(default_factory=list)
    potential_gaps: List[str] = Field(default_factory=list)
    source: str
    job_url: Optional[str] = None
    official_application_url: Optional[str] = None
    deadline: Optional[str] = None
    is_fresher_eligible: bool = False
    recommended_next_step: str = "Review opportunity"
    actions: List[str] = Field(default=["VIEW_JOB", "PREPARE_RESUME"])
    rendered_text: str


class JobDiscoveryResponse(BaseModel):
    """Comprehensive outcome response from multi-source discovery run."""
    total_discovered: int
    imported_count: int
    duplicate_merged_count: int
    matched_count: int
    alerts_generated_count: int
    sources_queried: List[str]
    diagnostics: Dict[str, Any]
    alerts: List[JobAlertItem]
    jobs: List[JobResponse]


# -----------------------------------------------------------------------------
# Phase 20: India Fresher Job Portal, Advanced Filters, and Alerts Schemas
# -----------------------------------------------------------------------------

class JobSearchFilterRequest(BaseModel):
    query: Optional[str] = Field(None, description="Free-text job title or keyword query")
    location: Optional[str] = Field(None, description="Primary location text")
    locations: List[str] = Field(default_factory=list, description="Target locations or cities in India")
    sources: List[str] = Field(default_factory=list, description="Enabled source IDs")
    experience_levels: List[str] = Field(default_factory=list, description="Target experience levels")
    job_types: List[str] = Field(default_factory=list, description="Full-time, Internship, etc.")
    work_modes: List[str] = Field(default_factory=list, description="Remote, Hybrid, On-site")
    fresher_mode: bool = Field(False, description="Dedicated Fresher Mode toggle prioritizing entry-level/trainee")
    min_match_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Minimum match score")
    skills: List[str] = Field(default_factory=list, description="Required candidate skills")
    company: Optional[str] = Field(None, description="Company name filter")
    posted_within_days: Optional[int] = Field(None, ge=1, le=365, description="Posted within past N days")
    candidate_id: Optional[str] = Field(None, description="Candidate ID to score matches against")
    limit: int = Field(50, ge=1, le=100, description="Page limit")
    offset: int = Field(0, ge=0, description="Page offset")


class SourceCapabilityResponse(BaseModel):
    source_id: str
    display_name: str
    access_mode: str
    health: str
    last_checked: str
    supports_search: bool
    supports_filters: bool
    supports_pagination: bool
    supports_job_detail: bool
    supports_salary: bool
    supports_location: bool
    supports_experience: bool
    supports_remote: bool
    is_enabled: bool


class JobSearchFilterResponse(BaseModel):
    total_found: int
    jobs: List[JobResponse]
    active_filters: Dict[str, Any]
    available_sources: List[SourceCapabilityResponse]
    available_locations: List[str]
    fresher_mode_active: bool


class JobSaveRequest(BaseModel):
    job_id: str
    candidate_id: Optional[str] = None
    notes: Optional[str] = None


class JobIgnoreRequest(BaseModel):
    job_id: str
    candidate_id: Optional[str] = None
    reason: Optional[str] = None


class JobAlertCreate(BaseModel):
    alert_name: str
    candidate_id: Optional[str] = None
    roles: List[str] = Field(default_factory=list)
    locations: List[str] = Field(default_factory=list)
    sources: List[str] = Field(default_factory=list)
    experience_levels: List[str] = Field(default_factory=list)
    work_modes: List[str] = Field(default_factory=list)
    min_match_score: float = 70.0
    frequency: str = "DAILY"  # DAILY, TWICE_DAILY, WEEKLY, MANUAL
    is_active: bool = True
    metadata_json: Dict[str, Any] = Field(default_factory=dict)


class JobAlertUpdate(BaseModel):
    alert_name: Optional[str] = None
    roles: Optional[List[str]] = None
    locations: Optional[List[str]] = None
    sources: Optional[List[str]] = None
    experience_levels: Optional[List[str]] = None
    work_modes: Optional[List[str]] = None
    min_match_score: Optional[float] = None
    frequency: Optional[str] = None
    is_active: Optional[bool] = None


class JobAlertResponse(BaseModel):
    id: str
    candidate_id: Optional[str] = None
    alert_name: str
    roles: List[str]
    locations: List[str]
    sources: List[str]
    experience_levels: List[str]
    work_modes: List[str]
    min_match_score: float
    frequency: str
    is_active: bool
    last_run_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    metadata_json: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)

