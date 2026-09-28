from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime


class SkillBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: str = Field("General", max_length=100)
    proficiency_level: Optional[str] = Field(None, max_length=50)
    years_of_experience: Optional[float] = Field(None, ge=0.0)


class SkillCreate(SkillBase):
    pass


class SkillRead(SkillBase):
    id: str
    candidate_id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ExperienceBase(BaseModel):
    company: str = Field(..., min_length=1, max_length=255)
    role: str = Field(..., min_length=1, max_length=255)
    location: Optional[str] = Field(None, max_length=255)
    start_date: str = Field(..., max_length=50)
    end_date: Optional[str] = Field(None, max_length=50)
    is_current: bool = False
    bullet_points: List[str] = Field(default_factory=list)
    technologies_used: List[str] = Field(default_factory=list)


class ExperienceCreate(ExperienceBase):
    pass


class ExperienceRead(ExperienceBase):
    id: str
    candidate_id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CandidateBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    headline: Optional[str] = Field(None, max_length=255)
    summary: Optional[str] = None
    location: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None


class CandidateCreate(CandidateBase):
    skills: Optional[List[SkillCreate]] = Field(default_factory=list)
    experiences: Optional[List[ExperienceCreate]] = Field(default_factory=list)


class CandidateRead(CandidateBase):
    id: str
    created_at: datetime
    updated_at: datetime
    skills: List[SkillRead] = Field(default_factory=list)
    experiences: List[ExperienceRead] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)
