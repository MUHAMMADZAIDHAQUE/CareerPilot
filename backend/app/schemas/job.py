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

    # Phase 8: Job Discovery metadata & Candidate Matching enrichment
    source_type: Optional[str] = "direct"
    source_name: Optional[str] = "Direct Entry"
    canonical_url: Optional[str] = None
    external_id: Optional[str] = None
    is_active: bool = True
    is_expired: bool = False
    match_score: Optional[float] = None
    matched_skills: Optional[List[str]] = None
    missing_required_skills: Optional[List[str]] = None
    missing_preferred_skills: Optional[List[str]] = None

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
