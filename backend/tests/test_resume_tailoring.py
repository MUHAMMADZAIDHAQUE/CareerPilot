import pytest
import hashlib
from pathlib import Path
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.models.candidate import Candidate, Skill, Experience, Project, Education
from backend.app.models.job import Job, MatchResult
from backend.app.models.resume import ResumeVersion
from backend.app.agents.resume_validator_agent import ResumeValidatorAgent
from backend.app.agents.resume_tailor_agent import ResumeTailoringAgent

MASTER_PATH = Path("resume/master/sample_master_resume.tex")


@pytest.mark.asyncio
async def test_evidence_based_tailoring_success(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test end-to-end evidence-based resume tailoring:
    1. Candidate with verified skills & experience exists.
    2. Analyzed Job exists.
    3. POST /api/resumes/tailor/{job_id} generates valid tailored LaTeX.
    4. Master LaTeX resume file is strictly unmodified.
    5. Version is saved to resume_versions table.
    """
    assert MASTER_PATH.exists()
    master_before = MASTER_PATH.read_text(encoding="utf-8")
    hash_before = hashlib.sha256(master_before.encode("utf-8")).hexdigest()

    # Create candidate
    candidate = Candidate(
        full_name="Alex Mercer",
        email="alex.mercer.tailor@example.com",
        headline="Senior Backend Engineer",
        summary="Senior Software Engineer with 4+ years of experience in distributed systems.",
    )
    db_session.add(candidate)
    await db_session.flush()

    # Add verified skills
    skills = [
        Skill(candidate_id=candidate.id, name="Python", category="Languages"),
        Skill(candidate_id=candidate.id, name="FastAPI", category="Frameworks & Libraries"),
        Skill(candidate_id=candidate.id, name="PostgreSQL", category="Databases & Storage"),
        Skill(candidate_id=candidate.id, name="Docker", category="Cloud & DevOps"),
        Skill(candidate_id=candidate.id, name="Kubernetes", category="Cloud & DevOps"),
        Skill(candidate_id=candidate.id, name="Kafka", category="Cloud & DevOps"),
    ]
    db_session.add_all(skills)

    # Add experience (using model fields: company, role)
    exp = Experience(
        candidate_id=candidate.id,
        company="Apex Distributed Systems",
        role="Senior Software Engineer",
        start_date="June 2022",
        end_date="Present",
        is_current=True,
        bullet_points=[
            "Engineered high-throughput event processing pipelines handling 100k requests/sec using Python, FastAPI, and Kafka.",
            "Optimized PostgreSQL query latency by 42% through indexing and pgvector vector similarity searches.",
        ],
        technologies_used=["Python", "FastAPI", "PostgreSQL", "Kafka"],
    )
    db_session.add(exp)

    # Add project
    proj = Project(
        candidate_id=candidate.id,
        title="Distributed Vector Search Engine",
        description="High-performance vector index engine supporting HNSW similarity lookups with sub-5ms p99 latency.",
        technologies=["Python", "Rust", "FastAPI", "Docker"],
        bullet_points=[
            "Built a high-performance vector index engine supporting HNSW similarity lookups with sub-5ms p99 latency.",
            "Integrated automated semantic caching layer in Redis reducing duplicate embedding calls by 60%.",
        ],
    )
    db_session.add(proj)

    # Add education
    edu = Education(
        candidate_id=candidate.id,
        institution="University of California, Berkeley",
        degree="Bachelor of Science",
        field_of_study="Computer Science",
        gpa="3.85",
    )
    db_session.add(edu)

    # Create job
    job = Job(
        company="Apex Cloud Systems",
        role="Staff Backend Engineer",
        raw_description="Seeking a Staff Backend Engineer proficient in Python, FastAPI, PostgreSQL, Docker, and Kubernetes.",
        required_skills=["Python", "FastAPI", "PostgreSQL", "Docker", "Kubernetes"],
        preferred_skills=["Kafka", "Redis"],
        technologies=["Python", "FastAPI", "PostgreSQL", "Docker", "Kubernetes"],
        responsibilities=["Design distributed APIs", "Maintain PostgreSQL clusters"],
    )
    db_session.add(job)
    await db_session.commit()

    # Invoke POST /api/resumes/tailor/{job_id}
    response = await async_client.post(
        f"/api/resumes/tailor/{job.id}",
        json={"candidate_id": candidate.id},
    )

    assert response.status_code == 201
    data = response.json()

    assert "version" in data
    assert "validation_report" in data
    assert "diff_summary" in data
    assert data["version"]["validation_status"] == "valid"
    assert data["validation_report"]["is_valid"] is True
    assert data["diff_summary"]["skills_reordered"] is True

    # Verify master resume was NOT modified
    master_after = MASTER_PATH.read_text(encoding="utf-8")
    hash_after = hashlib.sha256(master_after.encode("utf-8")).hexdigest()
    assert hash_before == hash_after, "Master resume was modified! Master copy must remain immutable."

    # Verify database persistence
    version_id = data["version"]["id"]
    saved_v = await db_session.execute(select(ResumeVersion).where(ResumeVersion.id == version_id))
    assert saved_v.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_validator_agent_detects_fabricated_metrics():
    """Test that ResumeValidatorAgent rejects ungrounded/invented quantitative metrics."""
    master = MASTER_PATH.read_text(encoding="utf-8")
    candidate_data = {
        "full_name": "Alex Mercer",
        "skills": [{"name": "Python"}, {"name": "FastAPI"}],
        "experience": [
            {
                "company_name": "Apex Distributed Systems",
                "bullet_points": ["Handled 100k requests/sec using Python."],
            }
        ],
        "projects": [],
        "education": [{"institution_name": "University of California, Berkeley"}],
    }

    # Inject fabricated metric into tailored LaTeX
    fabricated_latex = master.replace(
        "handling 100k requests/sec",
        "handling 100k requests/sec and boosted revenue by 98.5%",
    )

    report = ResumeValidatorAgent.audit_tailored_resume(
        tailored_latex=fabricated_latex,
        master_latex=master,
        candidate_data=candidate_data,
    )

    assert report.is_valid is False
    assert any("metric" in err.lower() for err in report.errors)
    assert any("98.5%" in err for err in report.errors)


@pytest.mark.asyncio
async def test_validator_agent_detects_fabricated_technologies():
    """Test that ResumeValidatorAgent rejects hallucinated skills/technologies."""
    master = MASTER_PATH.read_text(encoding="utf-8")
    candidate_data = {
        "full_name": "Alex Mercer",
        "skills": [{"name": "Python"}, {"name": "FastAPI"}],
        "experience": [],
        "projects": [],
        "education": [{"institution_name": "University of California, Berkeley"}],
    }

    # Inject unknown technology "Solidity" into technical skills
    fabricated_latex = master.replace(
        r"\textbf{Languages}{: Python",
        r"\textbf{Languages}{: Solidity, Python",
    )

    report = ResumeValidatorAgent.audit_tailored_resume(
        tailored_latex=fabricated_latex,
        master_latex=master,
        candidate_data=candidate_data,
    )

    assert report.is_valid is False
    assert any("technology" in err.lower() or "skill" in err.lower() for err in report.errors)
    assert any("Solidity" in err for err in report.errors)


@pytest.mark.asyncio
async def test_validator_agent_detects_fabricated_projects():
    """Test that ResumeValidatorAgent rejects unfamiliar projects."""
    master = MASTER_PATH.read_text(encoding="utf-8")
    candidate_data = {
        "full_name": "Alex Mercer",
        "skills": [],
        "experience": [],
        "projects": [{"title": "Distributed Vector Search Engine"}],
        "education": [{"institution_name": "University of California, Berkeley"}],
    }

    # Inject fabricated project
    fabricated_latex = master.replace(
        r"\textbf{Distributed Vector Search Engine}",
        r"\textbf{Quantum AI Cryptography Engine}",
    )

    report = ResumeValidatorAgent.audit_tailored_resume(
        tailored_latex=fabricated_latex,
        master_latex=master,
        candidate_data=candidate_data,
    )

    assert report.is_valid is False
    assert any("project" in err.lower() for err in report.errors)


@pytest.mark.asyncio
async def test_get_tailored_resume_endpoints(async_client: AsyncClient, db_session: AsyncSession):
    """Test GET /api/resumes/tailor/{job_id} and GET /api/resumes/versions/{version_id}."""
    candidate = Candidate(
        full_name="Jane Doe",
        email="jane.doe.test@example.com",
    )
    job = Job(
        company="TechCorp",
        role="Lead Engineer",
        raw_description="Test JD",
        required_skills=["Python"],
    )
    db_session.add_all([candidate, job])
    await db_session.flush()

    version = ResumeVersion(
        candidate_id=candidate.id,
        job_id=job.id,
        latex_content=r"\documentclass{article}\begin{document}Test\end{document}",
        validation_status="valid",
        version_number=1,
    )
    db_session.add(version)
    await db_session.commit()

    # Test GET by job_id
    res1 = await async_client.get(f"/api/resumes/tailor/{job.id}")
    assert res1.status_code == 200
    assert res1.json()["id"] == version.id

    # Test GET by version_id
    res2 = await async_client.get(f"/api/resumes/versions/{version.id}")
    assert res2.status_code == 200
    assert res2.json()["id"] == version.id
