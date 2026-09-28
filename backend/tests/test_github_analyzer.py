import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.candidate import Candidate
from backend.app.models.job import Job
from backend.app.agents.github_agent import GitHubCareerAgent


@pytest.mark.asyncio
async def test_github_analyzer_full_pipeline(
    async_client: AsyncClient, db_session: AsyncSession
):
    """
    Tests complete GitHub Career Analyzer pipeline:
    1. Inspects permitted repository information (repos, languages, README highlights, topics).
    2. Compares evidence against target role requirements.
    3. Verifies skills demonstrated, skills missing evidence, relevant projects,
       verifiable resume bullets, and actionable improvements.
    4. Enforces guardrail: Never fabricates contribution claims.
    """
    # 1. Create Job and Candidate
    job = Job(
        company="Coinbase",
        role="Senior Distributed Systems Infrastructure Engineer",
        raw_description="Scale high-frequency crypto trading engines and asynchronous ledger pipelines.",
        required_skills=["Python", "FastAPI", "Docker", "Kubernetes", "Kafka"],
        preferred_skills=["Redis", "Terraform"],
    )
    candidate = Candidate(
        full_name="Liam Gallagher",
        email="liam.gallagher.infra@example.com",
    )
    db_session.add_all([job, candidate])
    await db_session.commit()

    # 2. Call POST /api/github/analyze
    analyze_payload = {
        "username": "liam-dev",
        "job_id": job.id,
        "candidate_id": candidate.id,
    }
    res = await async_client.post("/api/github/analyze", json=analyze_payload)
    assert res.status_code == 200
    data = res.json()

    # Verify Profile Summary
    profile = data["profile_summary"]
    assert profile["username"] == "liam-dev"
    assert profile["public_repos"] > 0
    assert len(profile["top_languages"]) > 0

    # Verify Skills Demonstrated
    assert len(data["skills_demonstrated"]) >= 2
    demonstrated_names = [s["skill"].lower() for s in data["skills_demonstrated"]]
    assert any("python" in d or "fastapi" in d or "redis" in d for d in demonstrated_names)
    for s in data["skills_demonstrated"]:
        assert len(s["repo_sources"]) >= 1
        assert "evidence_summary" in s

    # Verify Skills Missing Evidence (Kubernetes and Kafka from JD not in repos)
    assert len(data["skills_missing_evidence"]) >= 1
    missing_names = [m["skill"].lower() for m in data["skills_missing_evidence"]]
    assert any("kubernetes" in m or "kafka" in m for m in missing_names)
    for m in data["skills_missing_evidence"]:
        assert m["demanded_by_role"] is True
        assert "target role" in m["reason"].lower()

    # Verify Relevant Projects
    assert len(data["relevant_projects"]) >= 2
    top_project = data["relevant_projects"][0]
    assert top_project["role_relevance_score"] >= 50.0
    assert len(top_project["architecture_highlights"]) >= 1
    assert "html_url" in top_project

    # Verify Potential Resume Evidence (Ground-truth verification: no fabricated claims)
    assert len(data["potential_resume_evidence"]) >= 2
    for r in data["potential_resume_evidence"]:
        assert r["repository_name"] in [p["name"] for p in data["relevant_projects"]]
        assert r["repository_url"].startswith("http")
        assert len(r["bullet_point"]) > 20

    # Verify Recommended Improvements
    assert len(data["recommended_improvements"]) >= 2
    categories = [i["category"] for i in data["recommended_improvements"]]
    assert any("README" in c or "Deployment" in c for c in categories)

    # 3. Verify GET /api/github/latest retrieves the saved analysis
    latest_res = await async_client.get(f"/api/github/latest?username=liam-dev")
    assert latest_res.status_code == 200
    assert latest_res.json()["id"] == data["id"]


@pytest.mark.asyncio
async def test_github_analyzer_validation_error(async_client: AsyncClient):
    """Verifies empty username handling returns 422 validation error."""
    res = await async_client.post("/api/github/analyze", json={"username": ""})
    assert res.status_code == 422
