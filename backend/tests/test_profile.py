import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_and_get_profile(async_client: AsyncClient):
    """Test POST /api/profile and GET /api/profile."""
    payload = {
        "full_name": "Sarah Connor",
        "email": "sarah.connor@example.com",
        "headline": "Senior AI Systems Architect",
        "summary": "Experienced architect with deep background in distributed systems and LLMs.",
        "location": "San Francisco, CA",
        "skills": [
            {"name": "Python", "category": "Languages", "years_of_experience": 6.0},
            {"name": "FastAPI", "category": "Frameworks", "years_of_experience": 4.0},
            {"name": "pgvector", "category": "Databases", "years_of_experience": 2.0},
        ],
        "experiences": [
            {
                "company": "Cyberdyne Systems",
                "role": "Lead Engineer",
                "location": "Sunnyvale, CA",
                "start_date": "2021-01",
                "is_current": True,
                "bullet_points": ["Architected distributed agent workflows"],
                "technologies_used": ["Python", "FastAPI", "PostgreSQL"],
            }
        ],
        "education": [
            {
                "institution": "Stanford University",
                "degree": "Master of Science",
                "field_of_study": "Computer Science",
                "start_date": "2018-09",
                "end_date": "2020-06",
                "gpa": "3.92",
            }
        ],
        "projects": [
            {
                "title": "CareerPilot AI",
                "description": "AI career assistant and resume tailor",
                "technologies": ["FastAPI", "Next.js", "pgvector"],
                "repo_url": "https://github.com/example/careerpilot",
                "bullet_points": ["Built zero-hallucination resume tailoring engine"],
            }
        ],
        "career_preference": {
            "preferred_roles": ["Staff AI Engineer", "Principal Architect"],
            "preferred_locations": ["San Francisco, CA", "Remote"],
            "work_mode": "Remote",
            "preferred_employment_type": "Full-time",
            "target_salary_min": 180000,
            "target_salary_max": 250000,
            "currency": "USD",
        },
    }

    # 1. POST /api/profile
    create_res = await async_client.post("/api/profile", json=payload)
    assert create_res.status_code == 201, create_res.text
    created = create_res.json()
    assert created["full_name"] == "Sarah Connor"
    assert created["email"] == "sarah.connor@example.com"
    assert len(created["skills"]) == 3
    assert len(created["experiences"]) == 1
    assert len(created["education"]) == 1
    assert len(created["projects"]) == 1
    assert created["career_preference"]["work_mode"] == "Remote"
    assert created["career_preference"]["target_salary_min"] == 180000

    # 2. GET /api/profile
    get_res = await async_client.get("/api/profile")
    assert get_res.status_code == 200
    fetched = get_res.json()
    assert fetched["id"] == created["id"]
    assert fetched["headline"] == "Senior AI Systems Architect"
    assert fetched["skills"][0]["name"] in ["Python", "FastAPI", "pgvector"]


@pytest.mark.asyncio
async def test_update_profile(async_client: AsyncClient):
    """Test PUT /api/profile."""
    # First create a candidate
    payload = {
        "full_name": "Marcus Wright",
        "email": "marcus.wright@example.com",
        "headline": "Software Engineer",
    }
    create_res = await async_client.post("/api/profile", json=payload)
    assert create_res.status_code == 201
    candidate_id = create_res.json()["id"]

    # Update candidate headline, summary, and career preferences
    update_payload = {
        "headline": "Staff AI Engineer",
        "location": "Seattle, WA",
        "career_preference": {
            "preferred_roles": ["Staff Engineer"],
            "work_mode": "Hybrid",
            "target_salary_min": 200000,
        }
    }
    put_res = await async_client.put(f"/api/profile?candidate_id={candidate_id}", json=update_payload)
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["headline"] == "Staff AI Engineer"
    assert updated["location"] == "Seattle, WA"
    assert updated["career_preference"]["work_mode"] == "Hybrid"
    assert updated["career_preference"]["target_salary_min"] == 200000


@pytest.mark.asyncio
async def test_add_sub_entities(async_client: AsyncClient):
    """Test POST /api/profile/skills, /projects, /experience, /education."""
    create_res = await async_client.post("/api/profile", json={
        "full_name": "John Connor",
        "email": "john.connor@example.com",
    })
    candidate_id = create_res.json()["id"]

    # 1. Add Skill
    skill_res = await async_client.post(
        f"/api/profile/skills?candidate_id={candidate_id}",
        json={"name": "TypeScript", "category": "Languages", "years_of_experience": 3.5}
    )
    assert skill_res.status_code == 201
    assert skill_res.json()["name"] == "TypeScript"

    # 2. Add Project
    proj_res = await async_client.post(
        f"/api/profile/projects?candidate_id={candidate_id}",
        json={
            "title": "Autonomous Drone Fleet",
            "technologies": ["C++", "Python", "ROS"],
            "description": "Robotics control mesh",
        }
    )
    assert proj_res.status_code == 201
    assert proj_res.json()["title"] == "Autonomous Drone Fleet"

    # 3. Add Experience
    exp_res = await async_client.post(
        f"/api/profile/experience?candidate_id={candidate_id}",
        json={
            "company": "Resistance Tech",
            "role": "Field Operations Lead",
            "start_date": "2023-01",
            "is_current": True,
            "bullet_points": ["Managed distributed tactical networks"],
        }
    )
    assert exp_res.status_code == 201
    assert exp_res.json()["company"] == "Resistance Tech"

    # 4. Add Education
    edu_res = await async_client.post(
        f"/api/profile/education?candidate_id={candidate_id}",
        json={
            "institution": "MIT",
            "degree": "B.S. in Electrical Engineering",
            "start_date": "2015-09",
            "end_date": "2019-05",
        }
    )
    assert edu_res.status_code == 201
    assert edu_res.json()["institution"] == "MIT"

    # Verify all loaded in GET /api/profile
    profile_res = await async_client.get(f"/api/profile?candidate_id={candidate_id}")
    profile = profile_res.json()
    assert len(profile["skills"]) == 1
    assert len(profile["projects"]) == 1
    assert len(profile["experiences"]) == 1
    assert len(profile["education"]) == 1


@pytest.mark.asyncio
async def test_structured_resume_import(async_client: AsyncClient):
    """Test POST /api/profile/structured-import."""
    import_payload = {
        "full_name": "Kyle Reese",
        "email": "kyle.reese@example.com",
        "headline": "Tactical Systems Specialist",
        "summary": "Proven track record in high-stakes mission-critical infrastructure.",
        "skills": [
            {"name": "Rust", "category": "Languages"},
            {"name": "Kubernetes", "category": "Cloud & DevOps"},
        ],
        "experience": [
            {
                "company": "Tech Recon",
                "role": "Systems Engineer",
                "start_date": "2020-03",
                "end_date": "2024-02",
                "bullet_points": ["Deployed fault-tolerant edge clusters"],
                "technologies_used": ["Rust", "Docker", "Linux"],
            }
        ],
        "education": [
            {
                "institution": "Georgia Tech",
                "degree": "B.S. in Computer Engineering",
                "start_date": "2016-08",
                "end_date": "2020-05",
            }
        ],
        "projects": [
            {
                "title": "Mesh Network Sentinel",
                "technologies": ["Rust", "libp2p"],
                "description": "Decentralized resilience protocol",
            }
        ],
        "career_preference": {
            "preferred_roles": ["Site Reliability Engineer", "Platform Engineer"],
            "work_mode": "Remote",
            "target_salary_min": 175000,
        }
    }

    res = await async_client.post("/api/profile/structured-import", json=import_payload)
    assert res.status_code == 200, res.text
    imported = res.json()
    assert imported["full_name"] == "Kyle Reese"
    assert len(imported["skills"]) == 2
    assert len(imported["experiences"]) == 1
    assert len(imported["education"]) == 1
    assert len(imported["projects"]) == 1
    assert imported["career_preference"]["work_mode"] == "Remote"
