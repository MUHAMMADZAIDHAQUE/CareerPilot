from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload
from typing import Optional, List, Dict, Any

from backend.app.models.candidate import (
    Candidate,
    Education,
    Experience,
    Skill,
    Project,
    Certification,
    Achievement,
    CareerPreference,
)
from backend.app.schemas.candidate import (
    CandidateCreate,
    CandidateUpdate,
    EducationCreate,
    ExperienceCreate,
    SkillCreate,
    ProjectCreate,
    CertificationCreate,
    AchievementCreate,
    CareerPreferenceCreate,
    CareerPreferenceUpdate,
    StructuredResumeImport,
)
from backend.app.core.logging import logger


class ProfileService:
    """Business logic service for managing structured Candidate profiles."""

    @staticmethod
    async def get_candidate(session: AsyncSession, candidate_id: Optional[str] = None) -> Optional[Candidate]:
        """
        Retrieves a candidate by ID, or the first candidate if ID is omitted.
        Eagerly loads all profile relationships.
        """
        stmt = select(Candidate).options(
            selectinload(Candidate.education),
            selectinload(Candidate.experiences),
            selectinload(Candidate.skills),
            selectinload(Candidate.projects),
            selectinload(Candidate.certifications),
            selectinload(Candidate.achievements),
            selectinload(Candidate.career_preference),
        )

        if candidate_id:
            stmt = stmt.where(Candidate.id == candidate_id)
        else:
            stmt = stmt.limit(1)

        result = await session.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def get_by_email(session: AsyncSession, email: str) -> Optional[Candidate]:
        """Retrieves candidate by email address with eager loaded relationships."""
        stmt = select(Candidate).options(
            selectinload(Candidate.education),
            selectinload(Candidate.experiences),
            selectinload(Candidate.skills),
            selectinload(Candidate.projects),
            selectinload(Candidate.certifications),
            selectinload(Candidate.achievements),
            selectinload(Candidate.career_preference),
        ).where(Candidate.email == email)
        result = await session.execute(stmt)
        return result.scalars().first()

    @classmethod
    async def create_candidate(cls, session: AsyncSession, data: CandidateCreate) -> Candidate:
        """Creates a new Candidate with optional nested relationships."""
        existing = await cls.get_by_email(session, data.email)
        if existing:
            raise ValueError(f"Candidate with email {data.email} already exists.")

        candidate = Candidate(
            full_name=data.full_name,
            email=data.email,
            headline=data.headline,
            summary=data.summary,
            location=data.location,
            phone=data.phone,
            linkedin_url=data.linkedin_url,
            github_url=data.github_url,
            portfolio_url=data.portfolio_url,
        )
        session.add(candidate)
        await session.flush()  # Generate candidate.id

        # Add Skills
        if data.skills:
            for s in data.skills:
                skill = Skill(candidate_id=candidate.id, **s.model_dump())
                session.add(skill)

        # Add Experiences
        if data.experiences:
            for exp in data.experiences:
                experience = Experience(candidate_id=candidate.id, **exp.model_dump())
                session.add(experience)

        # Add Education
        if data.education:
            for edu in data.education:
                education = Education(candidate_id=candidate.id, **edu.model_dump())
                session.add(education)

        # Add Projects
        if data.projects:
            for proj in data.projects:
                project = Project(candidate_id=candidate.id, **proj.model_dump())
                session.add(project)

        # Add Certifications
        if data.certifications:
            for cert in data.certifications:
                certification = Certification(candidate_id=candidate.id, **cert.model_dump())
                session.add(certification)

        # Add Achievements
        if data.achievements:
            for ach in data.achievements:
                achievement = Achievement(candidate_id=candidate.id, **ach.model_dump())
                session.add(achievement)

        # Add Career Preference
        if data.career_preference:
            pref = CareerPreference(candidate_id=candidate.id, **data.career_preference.model_dump())
            session.add(pref)

        await session.commit()
        return await cls.get_candidate(session, candidate.id)

    @classmethod
    async def update_candidate(
        cls, session: AsyncSession, candidate_id: str, update_data: CandidateUpdate
    ) -> Optional[Candidate]:
        """Updates candidate core details and career preferences."""
        candidate = await cls.get_candidate(session, candidate_id)
        if not candidate:
            return None

        # Update scalar fields
        update_dict = update_data.model_dump(exclude_unset=True, exclude={"career_preference"})
        for key, value in update_dict.items():
            setattr(candidate, key, value)

        # Update or create Career Preference if specified
        if update_data.career_preference is not None:
            pref_data = update_data.career_preference.model_dump(exclude_unset=True)
            # Check existing preference query directly to avoid un-spawned lazy loads
            pref_stmt = select(CareerPreference).where(CareerPreference.candidate_id == candidate.id)
            pref_res = await session.execute(pref_stmt)
            existing_pref = pref_res.scalars().first()

            if existing_pref:
                for k, v in pref_data.items():
                    setattr(existing_pref, k, v)
            else:
                new_pref = CareerPreference(candidate_id=candidate.id, **pref_data)
                session.add(new_pref)

        await session.commit()
        session.expire_all()
        return await cls.get_candidate(session, candidate_id)

    @classmethod
    async def add_skill(cls, session: AsyncSession, candidate_id: str, skill_data: SkillCreate) -> Skill:
        """Adds a single skill to candidate."""
        candidate = await cls.get_candidate(session, candidate_id)
        if not candidate:
            raise ValueError(f"Candidate {candidate_id} not found")

        skill = Skill(candidate_id=candidate_id, **skill_data.model_dump())
        session.add(skill)
        await session.commit()
        await session.refresh(skill)
        return skill

    @classmethod
    async def add_project(cls, session: AsyncSession, candidate_id: str, project_data: ProjectCreate) -> Project:
        """Adds a project to candidate."""
        candidate = await cls.get_candidate(session, candidate_id)
        if not candidate:
            raise ValueError(f"Candidate {candidate_id} not found")

        project = Project(candidate_id=candidate_id, **project_data.model_dump())
        session.add(project)
        await session.commit()
        await session.refresh(project)
        return project

    @classmethod
    async def add_experience(cls, session: AsyncSession, candidate_id: str, exp_data: ExperienceCreate) -> Experience:
        """Adds work experience to candidate."""
        candidate = await cls.get_candidate(session, candidate_id)
        if not candidate:
            raise ValueError(f"Candidate {candidate_id} not found")

        experience = Experience(candidate_id=candidate_id, **exp_data.model_dump())
        session.add(experience)
        await session.commit()
        await session.refresh(experience)
        return experience

    @classmethod
    async def add_education(cls, session: AsyncSession, candidate_id: str, edu_data: EducationCreate) -> Education:
        """Adds education entry to candidate."""
        candidate = await cls.get_candidate(session, candidate_id)
        if not candidate:
            raise ValueError(f"Candidate {candidate_id} not found")

        education = Education(candidate_id=candidate_id, **edu_data.model_dump())
        session.add(education)
        await session.commit()
        await session.refresh(education)
        return education

    @classmethod
    async def import_structured_resume(
        cls, session: AsyncSession, data: StructuredResumeImport
    ) -> Candidate:
        """
        Accepts structured resume data and converts/upserts it into the candidate profile.
        Replaces/refreshes related collections while preserving candidate identity.
        """
        candidate = await cls.get_by_email(session, data.email)

        if not candidate:
            candidate = Candidate(
                full_name=data.full_name,
                email=data.email,
                headline=data.headline,
                summary=data.summary,
                location=data.location,
                phone=data.phone,
                linkedin_url=data.linkedin_url,
                github_url=data.github_url,
                portfolio_url=data.portfolio_url,
            )
            session.add(candidate)
            await session.flush()
        else:
            # Update core attributes
            candidate.full_name = data.full_name
            candidate.headline = data.headline or candidate.headline
            candidate.summary = data.summary or candidate.summary
            candidate.location = data.location or candidate.location
            candidate.phone = data.phone or candidate.phone
            candidate.linkedin_url = data.linkedin_url or candidate.linkedin_url
            candidate.github_url = data.github_url or candidate.github_url
            candidate.portfolio_url = data.portfolio_url or candidate.portfolio_url

            # Clear existing children to cleanly re-populate from structured source
            await session.execute(delete(Skill).where(Skill.candidate_id == candidate.id))
            await session.execute(delete(Experience).where(Experience.candidate_id == candidate.id))
            await session.execute(delete(Education).where(Education.candidate_id == candidate.id))
            await session.execute(delete(Project).where(Project.candidate_id == candidate.id))
            await session.execute(delete(Certification).where(Certification.candidate_id == candidate.id))
            await session.execute(delete(Achievement).where(Achievement.candidate_id == candidate.id))
            await session.execute(delete(CareerPreference).where(CareerPreference.candidate_id == candidate.id))

        # Populate Education
        for edu in data.education:
            session.add(Education(candidate_id=candidate.id, **edu.model_dump()))

        # Populate Experience
        for exp in data.experience:
            session.add(Experience(candidate_id=candidate.id, **exp.model_dump()))

        # Populate Skills
        for s in data.skills:
            session.add(Skill(candidate_id=candidate.id, **s.model_dump()))

        # Populate Projects
        for proj in data.projects:
            session.add(Project(candidate_id=candidate.id, **proj.model_dump()))

        # Populate Certifications
        for cert in data.certifications:
            session.add(Certification(candidate_id=candidate.id, **cert.model_dump()))

        # Populate Achievements
        for ach in data.achievements:
            session.add(Achievement(candidate_id=candidate.id, **ach.model_dump()))

        # Populate Career Preferences
        if data.career_preference:
            session.add(CareerPreference(candidate_id=candidate.id, **data.career_preference.model_dump()))

        await session.commit()
        return await cls.get_candidate(session, candidate.id)
