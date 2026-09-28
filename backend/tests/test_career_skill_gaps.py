import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.candidate import Candidate, Skill, Project, Experience, CareerPreference
from backend.app.models.job import Job
from backend.app.models.application import Application, ApplicationStatus
from backend.app.agents.skill_gap_agent import CareerSkillGapAgent


@pytest.mark.asyncio
async def test_career_skill_gaps_analysis(
    async_client: AsyncClient, db_session: AsyncSession
):
    """
    Tests Career Skill Gap Agent:
    - Analyzes candidate profile, saved jobs, applied jobs, target roles.
    - Accurately computes frequency across target jobs.
    - Accurately classifies strengths (Strong, Medium, Weak).
    - Enforces the critical rule: Do NOT claim a skill is missing if it exists in the candidate profile.
    - Generates 3-phase learning roadmap with project recommendations.
    """
    # 1. Create Candidate with verified profile
    candidate = Candidate(
        full_name="Marcus Vance",
        email="marcus.vance.dev@example.com",
    )
    db_session.add(candidate)
    await db_session.flush()

    # Add verified skills: Python (Advanced), SQL (Advanced), FastAPI (Intermediate)
    s1 = Skill(candidate_id=candidate.id, name="Python", proficiency_level="Advanced", years_of_experience=4.0)
    s2 = Skill(candidate_id=candidate.id, name="SQL", proficiency_level="Advanced", years_of_experience=3.5)
    s3 = Skill(candidate_id=candidate.id, name="FastAPI", proficiency_level="Intermediate", years_of_experience=2.0)
    db_session.add_all([s1, s2, s3])

    # Add project with Docker
    proj = Project(
        candidate_id=candidate.id,
        title="Distributed Task Queue",
        description="Async background worker queue built with Python, FastAPI, and Docker containers.",
        technologies=["Python", "FastAPI", "Docker", "PostgreSQL"],
    )
    db_session.add(proj)

    # 2. Create Target Jobs (Saved & Applied)
    # Job 1: Saved Job (demands Python, SQL, Docker, Kubernetes)
    job_saved = Job(
        company="Databricks",
        role="Senior Backend Infrastructure Engineer",
        raw_description="Build distributed compute backends.",
        required_skills=["Python", "SQL", "Kubernetes"],
        preferred_skills=["Docker"],
    )
    # Job 2: Applied Job (demands Python, FastAPI, Kubernetes, RAG)
    job_applied = Job(
        company="Scale AI",
        role="AI Platform Engineer",
        raw_description="Scale LLM inference and enterprise RAG pipelines.",
        required_skills=["Python", "FastAPI", "Kubernetes", "RAG"],
        preferred_skills=["Docker"],
    )
    db_session.add_all([job_saved, job_applied])
    await db_session.flush()

    # 3. Create Applications (one SAVED, one APPLIED)
    app1 = Application(
        job_id=job_saved.id,
        candidate_id=candidate.id,
        status=ApplicationStatus.SAVED,
        source="career_page",
    )
    app2 = Application(
        job_id=job_applied.id,
        candidate_id=candidate.id,
        status=ApplicationStatus.APPLIED,
        source="referral",
    )
    db_session.add_all([app1, app2])
    await db_session.commit()

    # 4. Call GET /api/career/skill-gaps
    res = await async_client.get(f"/api/career/skill-gaps?candidate_id={candidate.id}")
    assert res.status_code == 200
    data = res.json()

    # Check Top Metrics
    assert data["candidate_name"] == "Marcus Vance"
    assert data["target_jobs_analyzed"] >= 2
    assert data["saved_jobs_count"] >= 1
    assert data["applied_jobs_count"] >= 1
    assert data["market_readiness_score"] > 0
    assert len(data["skills"]) >= 5

    skills_by_name = {s["skill"].lower(): s for s in data["skills"]}

    # CRITICAL RULE CHECK: Python, SQL, FastAPI, Docker MUST NOT BE WEAK OR MISSING!
    assert "python" in skills_by_name
    assert skills_by_name["python"]["current_strength"] in ["Strong", "Medium"]
    assert "Listed in Skills" in skills_by_name["python"]["candidate_evidence"]

    assert "sql" in skills_by_name
    assert skills_by_name["sql"]["current_strength"] in ["Strong", "Medium"]

    assert "fastapi" in skills_by_name
    assert skills_by_name["fastapi"]["current_strength"] in ["Strong", "Medium"]

    assert "docker" in skills_by_name
    assert skills_by_name["docker"]["current_strength"] in ["Strong", "Medium"]
    assert "Used in Project" in skills_by_name["docker"]["candidate_evidence"]

    # Kubernetes and RAG ARE GAPS (not in candidate profile)
    assert "kubernetes" in skills_by_name
    assert skills_by_name["kubernetes"]["current_strength"] in ["Weak", "Missing"]
    assert skills_by_name["kubernetes"]["priority"] in ["CRITICAL", "HIGH"]
    assert len(skills_by_name["kubernetes"]["recommended_learning_path"]) >= 2
    assert skills_by_name["kubernetes"]["recommended_project"] is not None

    assert "rag" in skills_by_name
    assert skills_by_name["rag"]["current_strength"] in ["Weak", "Missing"]

    # Verify Frequency Across Target Jobs
    # Kubernetes was in both job_saved and job_applied -> frequency >= 2
    assert skills_by_name["kubernetes"]["frequency_count"] >= 2

    # Verify Learning Roadmap
    assert len(data["roadmap"]) == 3
    assert "Phase 1" in data["roadmap"][0]["phase_name"]
    assert len(data["roadmap"][0]["milestones"]) >= 2
    assert data["roadmap"][0]["recommended_project"] is not None


@pytest.mark.asyncio
async def test_guardrail_do_not_claim_missing_if_in_profile():
    """
    Directly unit tests the CareerSkillGapAgent guardrail:
    A skill in candidate_skills or candidate_projects must NEVER return 'Weak' or 'Missing'.
    """
    candidate_skills = [
        {"name": "PostgreSQL", "proficiency_level": "Advanced", "years_of_experience": 3},
        {"name": "Python", "proficiency_level": "Expert"},
    ]
    candidate_projects = [
        {"title": "Search Engine", "technologies": ["Elasticsearch", "FastAPI"]}
    ]
    candidate_experiences = []

    # 1. Test skill in profile
    strength, evidence = CareerSkillGapAgent._find_candidate_evidence(
        normalized_skill="PostgreSQL",
        candidate_skills=candidate_skills,
        candidate_projects=candidate_projects,
        candidate_experiences=candidate_experiences,
    )
    assert strength in ["Strong", "Medium"]
    assert "Listed in Skills" in evidence

    # 2. Test skill in project
    strength_es, evidence_es = CareerSkillGapAgent._find_candidate_evidence(
        normalized_skill="Elasticsearch",
        candidate_skills=candidate_skills,
        candidate_projects=candidate_projects,
        candidate_experiences=candidate_experiences,
    )
    assert strength_es in ["Strong", "Medium"]
    assert "Used in Project" in evidence_es

    # 3. Test skill NOT in profile
    strength_k8s, evidence_k8s = CareerSkillGapAgent._find_candidate_evidence(
        normalized_skill="Kubernetes",
        candidate_skills=candidate_skills,
        candidate_projects=candidate_projects,
        candidate_experiences=candidate_experiences,
    )
    assert strength_k8s == "Weak"
    assert "No verified evidence" in evidence_k8s
