from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import datetime


class QuestionContextItem(BaseModel):
    id: str
    question: str
    category: str
    context_source: Optional[str] = None
    sample_good_points: Optional[List[str]] = None
    star_framework_tip: Optional[Dict[str, str]] = None
    difficulty: Optional[str] = None
    rationale: Optional[str] = None


class PreparationTopicItem(BaseModel):
    topic: str
    category: str
    priority: str = Field(..., description="HIGH, MEDIUM, or LOW")
    key_concepts: List[str]
    recommended_prep: str


class InterviewPrepGenerateRequest(BaseModel):
    job_id: str
    candidate_id: Optional[str] = None
    resume_version_id: Optional[str] = None


class InterviewPreparationResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    job_id: str
    candidate_id: Optional[str] = None
    resume_version_id: Optional[str] = None
    company_name: str
    role: str
    technical_questions: List[Dict[str, Any]]
    project_questions: List[Dict[str, Any]]
    behavioral_questions: List[Dict[str, Any]]
    jd_specific_questions: List[Dict[str, Any]]
    resume_specific_questions: List[Dict[str, Any]]
    follow_up_questions: List[Dict[str, Any]]
    suggested_preparation_topics: List[Dict[str, Any]]
    general_questions: List[Dict[str, Any]]
    disclaimer: str
    created_at: datetime.datetime


class EvaluationDetail(BaseModel):
    technical_accuracy: float = Field(..., ge=0, le=100)
    relevance: float = Field(..., ge=0, le=100)
    clarity: float = Field(..., ge=0, le=100)
    structure: float = Field(..., ge=0, le=100)
    evidence: float = Field(..., ge=0, le=100)
    communication: float = Field(..., ge=0, le=100)
    overall_score: float = Field(..., ge=0, le=100)
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    feedback: str
    improvement_tips: List[str] = Field(default_factory=list)


class InterviewTurnResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    session_id: str
    turn_index: int
    category: str
    question: str
    context_source: Optional[str] = None
    candidate_answer: Optional[str] = None
    answered_at: Optional[datetime.datetime] = None
    evaluation: Optional[Dict[str, Any]] = None
    follow_up_question: Optional[str] = None
    is_follow_up: bool = False
    created_at: datetime.datetime


class FinalFeedbackDetail(BaseModel):
    overall_score: float
    category_scores: Dict[str, float]
    summary: str
    strengths: List[str]
    weak_areas: List[str]
    recommendations: List[str]
    preparation_topics_to_review: List[str]


class InterviewSessionStartRequest(BaseModel):
    job_id: str
    candidate_id: Optional[str] = None
    resume_version_id: Optional[str] = None
    total_questions: Optional[int] = Field(default=5, ge=1, le=15)


class InterviewAnswerSubmitRequest(BaseModel):
    answer: str = Field(..., min_length=2, description="Candidate's spoken or written answer")


class InterviewSessionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    job_id: str
    candidate_id: Optional[str] = None
    resume_version_id: Optional[str] = None
    company_name: Optional[str] = None
    role: Optional[str] = None
    status: str
    current_turn_index: int
    total_target_questions: int
    weak_areas: List[str] = Field(default_factory=list)
    final_feedback: Optional[Dict[str, Any]] = None
    started_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None
    current_turn: Optional[InterviewTurnResponse] = None
    turns: List[InterviewTurnResponse] = Field(default_factory=list)
