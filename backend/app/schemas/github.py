from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import datetime


class GitHubAnalyzeRequest(BaseModel):
    username: str = Field(..., min_length=1, description="GitHub username to inspect")
    github_token: Optional[str] = Field(None, description="Optional user-authorized personal access token")
    job_id: Optional[str] = Field(None, description="Target job ID to compare repository evidence against")
    candidate_id: Optional[str] = Field(None, description="Candidate ID to associate with analysis")


class GitHubProfileSummary(BaseModel):
    username: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    public_repos: int = 0
    followers: int = 0
    following: int = 0
    total_stars: int = 0
    top_languages: List[str] = Field(default_factory=list)
    profile_url: str


class DemonstratedSkillItem(BaseModel):
    skill: str
    category: str = "Technical"
    confidence: str = Field(..., description="High | Medium | Emerging")
    repo_sources: List[str] = Field(default_factory=list)
    evidence_summary: str


class MissingSkillItem(BaseModel):
    skill: str
    category: str = "Target Requirement"
    demanded_by_role: bool = True
    reason: str


class RelevantProjectItem(BaseModel):
    name: str
    description: Optional[str] = None
    html_url: str
    homepage: Optional[str] = None
    stars: int = 0
    forks: int = 0
    primary_language: Optional[str] = None
    topics: List[str] = Field(default_factory=list)
    role_relevance_score: float = Field(..., ge=0, le=100)
    architecture_highlights: List[str] = Field(default_factory=list)
    has_readme: bool = True
    has_deployment: bool = False


class ResumeEvidenceItem(BaseModel):
    skill_or_feature: str
    bullet_point: str
    repository_name: str
    repository_url: str
    verifiable_metrics: Optional[str] = None


class RecommendedImprovementItem(BaseModel):
    category: str
    priority: str = Field(..., description="HIGH | MEDIUM | LOW")
    title: str
    description: str
    actionable_steps: List[str] = Field(default_factory=list)


class GitHubAnalysisResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    candidate_id: Optional[str] = None
    job_id: Optional[str] = None
    target_role: Optional[str] = None
    target_company: Optional[str] = None
    profile_summary: GitHubProfileSummary
    skills_demonstrated: List[DemonstratedSkillItem] = Field(default_factory=list)
    skills_missing_evidence: List[MissingSkillItem] = Field(default_factory=list)
    relevant_projects: List[RelevantProjectItem] = Field(default_factory=list)
    potential_resume_evidence: List[ResumeEvidenceItem] = Field(default_factory=list)
    recommended_improvements: List[RecommendedImprovementItem] = Field(default_factory=list)
    created_at: datetime.datetime
