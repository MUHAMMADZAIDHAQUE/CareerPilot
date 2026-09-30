from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime


class MatchWeights(BaseModel):
    """Configurable weights for deterministic scoring."""
    required_skill_coverage: float = Field(0.35, ge=0.0, le=1.0, description="Weight for required skills coverage")
    semantic_skill_similarity: float = Field(0.25, ge=0.0, le=1.0, description="Weight for semantic vector similarity")
    experience_compatibility: float = Field(0.15, ge=0.0, le=1.0, description="Weight for years and seniority compatibility")
    project_relevance: float = Field(0.15, ge=0.0, le=1.0, description="Weight for relevant portfolio projects")
    education_compatibility: float = Field(0.10, ge=0.0, le=1.0, description="Weight for degree level and field of study")


class MatchRequest(BaseModel):
    """Payload for POST /api/jobs/{job_id}/match."""
    candidate_id: Optional[str] = Field(None, description="Optional candidate ID. Defaults to active profile.")
    weights: Optional[MatchWeights] = Field(default_factory=MatchWeights, description="Customizable scoring weights.")


class EvidenceItem(BaseModel):
    """
    Grounded evidence mapping:
    JD requirement → candidate evidence → source project/experience.
    Never fabricated.
    """
    requirement: str = Field(..., description="Target job requirement or skill.")
    requirement_type: str = Field(..., description="'required', 'preferred', or 'inferred'.")
    evidence_quote: str = Field(..., description="Direct verbatim excerpt from candidate's profile.")
    source_type: str = Field(..., description="'experience', 'project', 'skill', or 'education'.")
    source_title: str = Field(..., description="Company name, project title, or institution.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Factual alignment score.")


class RelevantProjectMatch(BaseModel):
    """Project with calculated relevance score and overlapping technologies."""
    id: Optional[str] = None
    title: str
    description: Optional[str] = None
    relevance_score: float = Field(..., ge=0.0, le=100.0)
    matching_skills: List[str] = Field(default_factory=list)
    key_bullet: Optional[str] = None


class MatchResponse(BaseModel):
    """
    Structured response for Candidate–Job Matching Engine.
    All scores are calculated deterministically.
    """
    id: Optional[str] = None
    candidate_id: str
    job_id: str
    overall_match_score: float = Field(..., ge=0.0, le=100.0, description="Weighted composite match score (0-100)")
    required_skill_coverage: float = Field(..., ge=0.0, le=100.0, description="Percentage of required skills satisfied")
    preferred_skill_coverage: float = Field(..., ge=0.0, le=100.0, description="Percentage of preferred skills satisfied")
    semantic_score: float = Field(..., ge=0.0, le=100.0, description="Dense semantic vector similarity score")
    experience_compatibility: float = Field(..., ge=0.0, le=100.0, description="Experience tenure & seniority match score")
    education_compatibility: float = Field(..., ge=0.0, le=100.0, description="Education level & field compatibility score")
    project_relevance: float = Field(..., ge=0.0, le=100.0, description="Average relevance of top portfolio projects")
    
    matched_skills: List[str] = Field(default_factory=list, description="Skills present in both JD and candidate profile")
    missing_required_skills: List[str] = Field(default_factory=list, description="Strictly required skills candidate lacks")
    missing_preferred_skills: List[str] = Field(default_factory=list, description="Nice-to-have skills candidate lacks")
    relevant_projects: List[RelevantProjectMatch] = Field(default_factory=list, description="Top matching portfolio projects")
    evidence: List[EvidenceItem] = Field(default_factory=list, description="Itemized factual evidence citations")
    explanation: str = Field(..., description="Honest, grounded assessment of strengths and gaps")
    weights_used: Dict[str, float] = Field(default_factory=dict, description="Weights applied during calculation")
    match_category: str = Field("POSSIBLE_MATCH", description="HIGH_MATCH | GOOD_MATCH | POSSIBLE_MATCH | LOW_MATCH | INELIGIBLE")
    eligibility_status: str = Field("ELIGIBLE", description="ELIGIBLE | INELIGIBLE | BORDERLINE")
    fresher_eligible: bool = Field(False, description="Whether job is fresher eligible")
    missing_skills: List[str] = Field(default_factory=list, description="Combined missing required and preferred skills")
    match_explanation: Optional[str] = Field(None, description="Detailed transparent justification")
    why_it_matches: List[str] = Field(default_factory=list, description="Bulleted reasons why candidate matches")
    potential_gaps: List[str] = Field(default_factory=list, description="Bulleted potential gaps")
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
