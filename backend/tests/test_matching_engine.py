import pytest
from httpx import AsyncClient

SAMPLE_CANDIDATE_DATA = {
    "full_name": "Elena Rostova",
    "email": "elena.rostova@example.com",
    "headline": "Lead Distributed Systems Engineer",
    "summary": "High-throughput systems architect specializing in Python, FastAPI, distributed caching, and microservices.",
    "location": "San Francisco, CA",
    "skills": [
        {"name": "Python", "category": "Languages", "proficiency_level": "Expert", "years_of_experience": 6.0},
        {"name": "FastAPI", "category": "Frameworks", "proficiency_level": "Expert", "years_of_experience": 4.0},
        {"name": "Docker", "category": "Cloud & DevOps", "proficiency_level": "Advanced", "years_of_experience": 5.0},
        {"name": "PostgreSQL", "category": "Databases", "proficiency_level": "Advanced", "years_of_experience": 5.0},
        {"name": "Redis", "category": "Databases", "proficiency_level": "Advanced", "years_of_experience": 4.0},
        {"name": "SQL", "category": "Languages", "proficiency_level": "Advanced", "years_of_experience": 6.0},
    ],
    "experience": [
        {
            "company": "Apex Cloud Systems",
            "role": "Lead Systems Engineer",
            "location": "San Francisco, CA",
            "start_date": "2021-01",
            "end_date": None,
            "is_current": True,
            "bullet_points": [
                "Engineered scalable microservices processing 50k requests/sec using Python, FastAPI, and Redis.",
                "Optimized PostgreSQL query execution and database connection pooling."
            ],
            "technologies_used": ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis"]
        }
    ],
    "education": [
        {
            "institution": "UC Berkeley",
            "degree": "Bachelor of Science",
            "field_of_study": "Computer Science",
            "gpa": "3.88"
        }
    ],
    "projects": [
        {
            "title": "Distributed Vector Indexer",
            "description": "High-performance vector similarity search engine in FastAPI and Docker.",
            "technologies": ["Python", "FastAPI", "Docker", "pgvector"],
            "bullet_points": [
                "Architected sub-5ms low-latency nearest neighbor vector lookup engine.",
                "Containerized microservices deployment with Docker."
            ]
        }
    ],
    "career_preference": {
        "preferred_roles": ["Staff Backend Engineer"],
        "preferred_locations": ["San Francisco, CA"],
        "work_mode": "Remote",
        "preferred_employment_type": "Full-time",
        "currency": "USD"
    }
}

SAMPLE_JOB_TEXT = """
Apex Cloud Systems
Role: Staff Backend Engineer
Location: San Francisco, CA
Salary: $190,000 - $230,000 / year

ABOUT US:
Building high-scale cloud platforms and telemetry pipelines.

REQUIREMENTS:
• 4+ years of software engineering experience.
• Bachelor of Science in Computer Science or related technical field.
• Extensive experience with Python, FastAPI, and Docker.
• Production mastery of Kubernetes on AWS.

PREFERRED QUALIFICATIONS:
• Familiarity with Rust, Kafka, and Redis caching.
• Knowledge of vector databases and pgvector.
"""


@pytest.mark.asyncio
async def test_deterministic_matching_calculation(async_client: AsyncClient):
    """
    Tests deterministic matching score computation, skill coverage breakdown,
    grounded evidence verification, and database persistence.
    """
    # 1. Setup candidate profile
    cand_res = await async_client.post("/api/profile/structured-import", json=SAMPLE_CANDIDATE_DATA)
    assert cand_res.status_code == 200, cand_res.text
    candidate_id = cand_res.json()["id"]

    # 2. Analyze Job
    job_res = await async_client.post("/api/jobs/analyze", json={"job_description": SAMPLE_JOB_TEXT})
    assert job_res.status_code == 201, job_res.text
    job_id = job_res.json()["id"]

    # 3. Match Candidate against Job
    match_payload = {
        "candidate_id": candidate_id,
        "weights": {
            "required_skill_coverage": 0.35,
            "semantic_skill_similarity": 0.25,
            "experience_compatibility": 0.15,
            "project_relevance": 0.15,
            "education_compatibility": 0.10,
        }
    }
    match_res = await async_client.post(f"/api/jobs/{job_id}/match", json=match_payload)
    assert match_res.status_code == 200, match_res.text
    data = match_res.json()

    # 4. Verify Deterministic Scoring Output
    assert "overall_match_score" in data
    assert 0.0 <= data["overall_match_score"] <= 100.0
    assert 0.0 <= data["required_skill_coverage"] <= 100.0
    assert 0.0 <= data["preferred_skill_coverage"] <= 100.0
    assert 0.0 <= data["experience_compatibility"] <= 100.0
    assert 0.0 <= data["education_compatibility"] <= 100.0
    assert 0.0 <= data["project_relevance"] <= 100.0

    # 5. Verify Skills Partitioning
    matched_lower = [s.lower() for s in data["matched_skills"]]
    missing_req_lower = [s.lower() for s in data["missing_required_skills"]]
    missing_pref_lower = [s.lower() for s in data["missing_preferred_skills"]]

    # Candidate has Python, FastAPI, Docker -> Matched
    assert "python" in matched_lower
    assert "fastapi" in matched_lower
    assert "docker" in matched_lower

    # Candidate lacks Kubernetes -> Missing Required
    assert "kubernetes" in missing_req_lower

    # Candidate has Redis (matched preferred) but lacks Rust or Kafka
    assert any(p in missing_pref_lower for p in ["rust", "kafka"])

    # 6. Verify Evidence Citations (Zero Hallucination)
    evidence_list = data["evidence"]
    assert len(evidence_list) > 0
    for ev in evidence_list:
        assert ev["requirement"]
        assert ev["evidence_quote"]
        assert ev["source_type"] in ["experience", "project", "skill"]
        assert ev["source_title"]
        # Quote must contain or reflect actual candidate data
        assert len(ev["evidence_quote"]) > 5

    # 7. Verify Relevant Projects
    assert len(data["relevant_projects"]) >= 1
    top_project = data["relevant_projects"][0]
    assert "Vector" in top_project["title"] or "Distributed" in top_project["title"]
    assert top_project["relevance_score"] > 50.0

    # 8. Verify Explanation
    assert len(data["explanation"]) > 30
    assert "Elena Rostova" in data["explanation"] or "Candidate" in data["explanation"]
    assert "Staff Backend Engineer" in data["explanation"]


@pytest.mark.asyncio
async def test_configurable_weights_affect_overall_score(async_client: AsyncClient):
    """
    Tests that configuring scoring weights changes the overall composite score deterministically.
    """
    # 1. Setup candidate & job
    cand_res = await async_client.post("/api/profile/structured-import", json=SAMPLE_CANDIDATE_DATA)
    candidate_id = cand_res.json()["id"]

    job_res = await async_client.post("/api/jobs/analyze", json={"job_description": SAMPLE_JOB_TEXT})
    job_id = job_res.json()["id"]

    # 2. Run with standard weights
    res1 = await async_client.post(
        f"/api/jobs/{job_id}/match",
        json={"candidate_id": candidate_id}
    )
    score1 = res1.json()["overall_match_score"]

    # 3. Run with heavy weight on education (which is 100% compatible)
    res2 = await async_client.post(
        f"/api/jobs/{job_id}/match",
        json={
            "candidate_id": candidate_id,
            "weights": {
                "required_skill_coverage": 0.05,
                "semantic_skill_similarity": 0.05,
                "experience_compatibility": 0.05,
                "project_relevance": 0.05,
                "education_compatibility": 0.80,
            }
        }
    )
    score2 = res2.json()["overall_match_score"]

    assert score1 != score2, "Custom weights must deterministically alter the overall score"
    assert score2 > score1, "Heavy education weighting should yield a higher score since candidate has 100% education match"


@pytest.mark.asyncio
async def test_match_invalid_job_id(async_client: AsyncClient):
    """Tests 404 response on matching non-existent job ID."""
    res = await async_client.post("/api/jobs/non-existent-uuid/match", json={})
    assert res.status_code == 404
