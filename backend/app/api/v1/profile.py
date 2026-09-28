from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from backend.app.api.deps import get_db
from backend.app.services.profile_service import ProfileService
from backend.app.schemas.candidate import (
    CandidateCreate,
    CandidateUpdate,
    CandidateRead,
    SkillCreate,
    SkillRead,
    ProjectCreate,
    ProjectRead,
    ExperienceCreate,
    ExperienceRead,
    EducationCreate,
    EducationRead,
    StructuredResumeImport,
)
from backend.app.core.logging import logger

router = APIRouter(prefix="/profile", tags=["Candidate Profile"])


@router.post(
    "",
    response_model=CandidateRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Candidate Profile",
    description="Creates a new structured candidate profile with optional nested education, experiences, skills, projects, and career preferences.",
)
async def create_profile(
    candidate_in: CandidateCreate,
    db: AsyncSession = Depends(get_db),
) -> CandidateRead:
    try:
        candidate = await ProfileService.create_candidate(db, candidate_in)
        return candidate
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create candidate profile: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create profile.")


@router.get(
    "",
    response_model=CandidateRead,
    summary="Get Candidate Profile",
    description="Retrieves the current candidate profile with all related entities (skills, experiences, education, projects, certifications, achievements, and career preferences).",
)
async def get_profile(
    candidate_id: Optional[str] = Query(None, description="Optional Candidate ID. If omitted, returns first candidate profile."),
    db: AsyncSession = Depends(get_db),
) -> CandidateRead:
    candidate = await ProfileService.get_candidate(db, candidate_id)
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found. Create a profile with POST /api/profile first."
        )
    return candidate


@router.put(
    "",
    response_model=CandidateRead,
    summary="Update Candidate Profile",
    description="Updates core candidate details and career preferences.",
)
async def update_profile(
    candidate_update: CandidateUpdate,
    candidate_id: Optional[str] = Query(None, description="Candidate ID to update. If omitted, updates default candidate."),
    db: AsyncSession = Depends(get_db),
) -> CandidateRead:
    # Resolve target candidate
    candidate = await ProfileService.get_candidate(db, candidate_id)
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found."
        )

    updated = await ProfileService.update_candidate(db, candidate.id, candidate_update)
    return updated


@router.post(
    "/skills",
    response_model=SkillRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add Candidate Skill",
    description="Appends a verified skill to the candidate's skill inventory.",
)
async def add_skill(
    skill_in: SkillCreate,
    candidate_id: Optional[str] = Query(None, description="Candidate ID. If omitted, uses default candidate."),
    db: AsyncSession = Depends(get_db),
) -> SkillRead:
    candidate = await ProfileService.get_candidate(db, candidate_id)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate profile not found.")

    skill = await ProfileService.add_skill(db, candidate.id, skill_in)
    return skill


@router.post(
    "/projects",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add Technical Project",
    description="Appends a technical project to the candidate's portfolio.",
)
async def add_project(
    project_in: ProjectCreate,
    candidate_id: Optional[str] = Query(None, description="Candidate ID. If omitted, uses default candidate."),
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    candidate = await ProfileService.get_candidate(db, candidate_id)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate profile not found.")

    project = await ProfileService.add_project(db, candidate.id, project_in)
    return project


@router.post(
    "/experience",
    response_model=ExperienceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add Work Experience",
    description="Appends a verified work experience record to the candidate's profile.",
)
async def add_experience(
    experience_in: ExperienceCreate,
    candidate_id: Optional[str] = Query(None, description="Candidate ID. If omitted, uses default candidate."),
    db: AsyncSession = Depends(get_db),
) -> ExperienceRead:
    candidate = await ProfileService.get_candidate(db, candidate_id)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate profile not found.")

    exp = await ProfileService.add_experience(db, candidate.id, experience_in)
    return exp


@router.post(
    "/education",
    response_model=EducationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add Education Entry",
    description="Appends an academic degree / education record to the candidate's profile.",
)
async def add_education(
    education_in: EducationCreate,
    candidate_id: Optional[str] = Query(None, description="Candidate ID. If omitted, uses default candidate."),
    db: AsyncSession = Depends(get_db),
) -> EducationRead:
    candidate = await ProfileService.get_candidate(db, candidate_id)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate profile not found.")

    edu = await ProfileService.add_education(db, candidate.id, education_in)
    return edu


@router.post(
    "/structured-import",
    response_model=CandidateRead,
    status_code=status.HTTP_200_OK,
    summary="Import Structured Resume Data",
    description="Accepts structured resume data in JSON format and converts/populates the candidate profile without manual entry.",
)
async def import_structured_resume(
    resume_import: StructuredResumeImport,
    db: AsyncSession = Depends(get_db),
) -> CandidateRead:
    try:
        candidate = await ProfileService.import_structured_resume(db, resume_import)
        return candidate
    except Exception as e:
        logger.error(f"Error importing structured resume: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Import failed: {str(e)}")
