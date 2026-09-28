from pydantic import BaseModel, EmailStr, Field, ConfigDict, HttpUrl
from typing import List, Optional, Dict, Any
from datetime import datetime


# -----------------------------------------------------------------------------
# Skill Schemas
# -----------------------------------------------------------------------------
class SkillBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Skill or technology name")
    category: str = Field("General", max_length=100, description="Category (e.g., Languages, Frameworks, Cloud, Databases, AI/ML)")
    proficiency_level: Optional[str] = Field(None, max_length=50, description="Proficiency level (e.g., Beginner, Intermediate, Advanced, Expert)")
    years_of_experience: Optional[float] = Field(None, ge=0.0, description="Years of practical experience")


class SkillCreate(SkillBase):
    pass


class SkillBulkCreate(BaseModel):
    skills: List[SkillCreate] = Field(..., min_length=1)


class SkillRead(SkillBase):
    id: str
    candidate_id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Education Schemas
# -----------------------------------------------------------------------------
class EducationBase(BaseModel):
    institution: str = Field(..., min_length=1, max_length=255, description="University or Institution name")
    degree: str = Field(..., min_length=1, max_length=255, description="Degree obtained (e.g., Bachelor of Science)")
    field_of_study: Optional[str] = Field(None, max_length=255, description="Field of study / Major (e.g., Computer Science)")
    start_date: Optional[str] = Field(None, max_length=50, description="Start date (e.g., 2018-09)")
    end_date: Optional[str] = Field(None, max_length=50, description="End date / Graduation date (e.g., 2022-05)")
    gpa: Optional[str] = Field(None, max_length=20, description="GPA / Grade summary")
    honors: List[str] = Field(default_factory=list, description="Honors or distinctions")
    coursework: List[str] = Field(default_factory=list, description="Relevant coursework")


class EducationCreate(EducationBase):
    pass


class EducationRead(EducationBase):
    id: str
    candidate_id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Experience Schemas
# -----------------------------------------------------------------------------
class ExperienceBase(BaseModel):
    company: str = Field(..., min_length=1, max_length=255, description="Employer / Company name")
    role: str = Field(..., min_length=1, max_length=255, description="Job title / Role")
    location: Optional[str] = Field(None, max_length=255, description="Location (e.g., San Francisco, CA / Remote)")
    start_date: str = Field(..., max_length=50, description="Start date (e.g., 2021-06)")
    end_date: Optional[str] = Field(None, max_length=50, description="End date (None if currently working)")
    is_current: bool = Field(False, description="Whether this is the current job")
    bullet_points: List[str] = Field(default_factory=list, description="Verified achievement bullet points (Source of Truth)")
    technologies_used: List[str] = Field(default_factory=list, description="Technologies / tools utilized")


class ExperienceCreate(ExperienceBase):
    pass


class ExperienceRead(ExperienceBase):
    id: str
    candidate_id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Project Schemas
# -----------------------------------------------------------------------------
class ProjectBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Project title")
    description: Optional[str] = Field(None, description="Overview summary of project")
    technologies: List[str] = Field(default_factory=list, description="Technologies & frameworks used")
    repo_url: Optional[str] = Field(None, max_length=500, description="Source code repository URL")
    live_url: Optional[str] = Field(None, max_length=500, description="Live deployment / demo URL")
    start_date: Optional[str] = Field(None, max_length=50)
    end_date: Optional[str] = Field(None, max_length=50)
    bullet_points: List[str] = Field(default_factory=list, description="Key features and technical highlights")


class ProjectCreate(ProjectBase):
    pass


class ProjectRead(ProjectBase):
    id: str
    candidate_id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Certification & Achievement Schemas
# -----------------------------------------------------------------------------
class CertificationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    issuing_organization: str = Field(..., min_length=1, max_length=255)
    issue_date: Optional[str] = Field(None, max_length=50)
    expiration_date: Optional[str] = Field(None, max_length=50)
    credential_id: Optional[str] = Field(None, max_length=255)
    credential_url: Optional[str] = Field(None, max_length=500)


class CertificationCreate(CertificationBase):
    pass


class CertificationRead(CertificationBase):
    id: str
    candidate_id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AchievementBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    date: Optional[str] = Field(None, max_length=50)
    issuer: Optional[str] = Field(None, max_length=255)


class AchievementCreate(AchievementBase):
    pass


class AchievementRead(AchievementBase):
    id: str
    candidate_id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Career Preferences Schemas
# -----------------------------------------------------------------------------
class CareerPreferenceBase(BaseModel):
    preferred_roles: List[str] = Field(
        default_factory=list,
        description="Target job roles (e.g., ['Senior Software Engineer', 'AI Engineer'])"
    )
    preferred_locations: List[str] = Field(
        default_factory=list,
        description="Target locations (e.g., ['San Francisco, CA', 'New York, NY', 'Remote'])"
    )
    work_mode: str = Field(
        "Remote",
        description="Work mode preference: Remote | Hybrid | On-site | Any"
    )
    preferred_employment_type: str = Field(
        "Full-time",
        description="Employment type: Full-time | Contract | Part-time | Internship"
    )
    target_salary_min: Optional[int] = Field(None, ge=0, description="Minimum annual target compensation")
    target_salary_max: Optional[int] = Field(None, ge=0, description="Maximum annual target compensation")
    currency: str = Field("USD", max_length=10)


class CareerPreferenceCreate(CareerPreferenceBase):
    pass


class CareerPreferenceUpdate(BaseModel):
    preferred_roles: Optional[List[str]] = None
    preferred_locations: Optional[List[str]] = None
    work_mode: Optional[str] = None
    preferred_employment_type: Optional[str] = None
    target_salary_min: Optional[int] = None
    target_salary_max: Optional[int] = None
    currency: Optional[str] = None


class CareerPreferenceRead(CareerPreferenceBase):
    id: str
    candidate_id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Candidate Profile Schemas
# -----------------------------------------------------------------------------
class CandidateBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255, description="Full legal name")
    email: EmailStr = Field(..., description="Contact email address")
    headline: Optional[str] = Field(None, max_length=255, description="Professional headline")
    summary: Optional[str] = Field(None, description="Executive summary / Bio")
    location: Optional[str] = Field(None, max_length=255, description="Current location")
    phone: Optional[str] = Field(None, max_length=50, description="Phone number")
    linkedin_url: Optional[str] = Field(None, max_length=255)
    github_url: Optional[str] = Field(None, max_length=255)
    portfolio_url: Optional[str] = Field(None, max_length=255)


class CandidateCreate(CandidateBase):
    skills: Optional[List[SkillCreate]] = Field(default_factory=list)
    experiences: Optional[List[ExperienceCreate]] = Field(default_factory=list)
    education: Optional[List[EducationCreate]] = Field(default_factory=list)
    projects: Optional[List[ProjectCreate]] = Field(default_factory=list)
    certifications: Optional[List[CertificationCreate]] = Field(default_factory=list)
    achievements: Optional[List[AchievementCreate]] = Field(default_factory=list)
    career_preference: Optional[CareerPreferenceCreate] = None


class CandidateUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    headline: Optional[str] = None
    summary: Optional[str] = None
    location: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    career_preference: Optional[CareerPreferenceUpdate] = None


class CandidateRead(CandidateBase):
    id: str
    created_at: datetime
    updated_at: datetime
    skills: List[SkillRead] = Field(default_factory=list)
    experiences: List[ExperienceRead] = Field(default_factory=list)
    education: List[EducationRead] = Field(default_factory=list)
    projects: List[ProjectRead] = Field(default_factory=list)
    certifications: List[CertificationRead] = Field(default_factory=list)
    achievements: List[AchievementRead] = Field(default_factory=list)
    career_preference: Optional[CareerPreferenceRead] = None
    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Structured Resume Import Schema
# -----------------------------------------------------------------------------
class StructuredResumeImport(BaseModel):
    """
    Schema for structured JSON input containing a candidate's complete profile
    (e.g., from an exported resume, JSON resume standard, or profile builder).
    """
    full_name: str = Field(..., min_length=1)
    email: EmailStr
    headline: Optional[str] = None
    summary: Optional[str] = None
    location: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None

    education: List[EducationCreate] = Field(default_factory=list)
    experience: List[ExperienceCreate] = Field(default_factory=list)
    skills: List[SkillCreate] = Field(default_factory=list)
    projects: List[ProjectCreate] = Field(default_factory=list)
    certifications: List[CertificationCreate] = Field(default_factory=list)
    achievements: List[AchievementCreate] = Field(default_factory=list)
    career_preference: Optional[CareerPreferenceCreate] = None
