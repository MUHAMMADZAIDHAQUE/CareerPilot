from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class RecommendedProjectDetail(BaseModel):
    title: str
    description: str
    key_features: List[str] = Field(default_factory=list)
    deliverables: str


class SkillGapItem(BaseModel):
    skill: str
    frequency_count: int
    frequency_percentage: float
    candidate_evidence: str
    current_strength: str = Field(..., description="Strong | Medium | Weak | Missing")
    priority: str = Field(..., description="CRITICAL | HIGH | MEDIUM | LOW")
    category: Optional[str] = "Technical"
    recommended_learning_path: List[str] = Field(default_factory=list)
    recommended_project: Optional[RecommendedProjectDetail] = None


class RoadmapPhase(BaseModel):
    phase_name: str
    timeline: str
    focus_skills: List[str] = Field(default_factory=list)
    milestones: List[str] = Field(default_factory=list)
    recommended_project: Optional[str] = None


class SkillGapAnalysisResponse(BaseModel):
    model_config = {"from_attributes": True}

    candidate_id: str
    candidate_name: str
    target_jobs_analyzed: int
    saved_jobs_count: int
    applied_jobs_count: int
    total_skills_demanded: int
    market_readiness_score: float
    identified_gaps_count: int
    skills: List[SkillGapItem] = Field(default_factory=list)
    roadmap: List[RoadmapPhase] = Field(default_factory=list)
    summary: str
