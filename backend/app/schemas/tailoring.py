from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime


class TailorResumeRequest(BaseModel):
    """Request payload for tailoring a master resume to a specific job."""
    candidate_id: Optional[str] = Field(None, description="Optional Candidate ID (defaults to active candidate)")
    master_resume_id: Optional[str] = Field(None, description="Optional uploaded master resume document ID")
    custom_instructions: Optional[str] = Field(None, description="Optional user guidance, e.g. target backend emphasis")


class ValidationCheckItem(BaseModel):
    """Individual resume validator check status."""
    check_name: str
    passed: bool
    details: str
    warnings: List[str] = Field(default_factory=list)


class ValidationReport(BaseModel):
    """Complete validation verdict returned by the Resume Validator Agent."""
    is_valid: bool
    passed_checks: List[str] = Field(default_factory=list)
    failed_checks: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    checks: List[ValidationCheckItem] = Field(default_factory=list)
    metrics_audited: List[str] = Field(default_factory=list)
    technologies_audited: List[str] = Field(default_factory=list)


class SectionDiff(BaseModel):
    """Structured section-by-section diff showing original vs tailored content."""
    section_name: str
    change_type: str  # "reordered" | "tailored_bullets" | "refined" | "unchanged"
    original_snippet: str
    tailored_snippet: str
    rationale: str
    traceable_evidence: List[str] = Field(default_factory=list)


class DiffSummary(BaseModel):
    """Aggregate diff metrics and section breakdown."""
    total_sections_audited: int
    sections_modified: int
    skills_reordered: bool
    projects_reordered: bool
    bullets_tailored: int
    unsupported_claims_added: int = 0
    section_diffs: List[SectionDiff] = Field(default_factory=list)


class ResumeVersionRead(BaseModel):
    """Pydantic schema for tailored ResumeVersion model representation."""
    id: str
    candidate_id: str
    job_id: str
    source_resume_id: Optional[str] = None
    latex_content: str
    validation_status: str
    version_number: int = 1
    validation_details: Dict[str, Any] = Field(default_factory=dict)
    diff_summary: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TailorResumeResponse(BaseModel):
    """Complete response returned by POST /api/resumes/tailor/{job_id}."""
    version: ResumeVersionRead
    master_resume_content: str
    validation_report: ValidationReport
    diff_summary: DiffSummary
    message: str
    retries_attempted: int = 0
