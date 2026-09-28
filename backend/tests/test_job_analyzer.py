import pytest
from httpx import AsyncClient
from unittest.mock import patch

SAMPLE_BACKEND_JD = """
Apex Cloud Systems
Role: Staff Backend Engineer
Location: San Francisco, CA (Hybrid)
Salary: $180,000 - $220,000 / year
Application Deadline: December 15, 2026

ABOUT US:
Apex Cloud Systems is pioneering high-throughput distributed database platforms.

RESPONSIBILITIES:
• Architect, build, and maintain mission-critical distributed microservices.
• Optimize low-latency event processing pipelines using Kafka and Redis.
• Lead architectural reviews and mentor junior engineering staff.

REQUIREMENTS:
• 5+ years of software engineering experience.
• Bachelor of Science in Computer Science or equivalent field.
• Extensive production experience with Python, FastAPI, and SQL.
• Hands-on mastery with PostgreSQL, Docker, and Kubernetes on AWS.

PREFERRED QUALIFICATIONS:
• Experience with Rust, Golang, and high-concurrency event-driven systems.
• Familiarity with pgvector and vector database indexing.
• Contributions to open-source infrastructure projects.
"""

SAMPLE_AI_JD = """
NeuralPath AI
Position: Senior AI Engineer
Location: Remote (USA)
Employment Type: Full-time

We are seeking a Senior AI Engineer to scale our autonomous agent platforms.

WHAT YOU'LL DO:
- Build agentic workflows and multi-agent coordination systems.
- Fine-tune and evaluate LLMs on domain-specific benchmarks.
- Deploy low-latency inference pipelines with FastAPI and Docker.

MINIMUM QUALIFICATIONS:
- 4+ years of Python and PyTorch experience.
- Strong grounding in LangChain, LangGraph, RAG, and LLMs.
- Master's degree in Artificial Intelligence or Computer Science.

NICE TO HAVE:
- Experience with Kubernetes and Triton inference server.
- Familiarity with TypeScript and Next.js frontends.
"""


@pytest.mark.asyncio
async def test_analyze_job_full_jd(async_client: AsyncClient):
    """Tests analyzing a complete JD with requirements, salary, and metadata."""
    payload = {
        "job_description": SAMPLE_BACKEND_JD,
        "job_url": "https://apexcloud.io/careers/staff-backend",
        "company": "Apex Cloud Systems",
        "role": "Staff Backend Engineer",
    }

    response = await async_client.post("/api/jobs/analyze", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()

    # 1. Core metadata
    assert data["company"] == "Apex Cloud Systems"
    assert data["role"] == "Staff Backend Engineer"
    assert "San Francisco" in data["location"]
    assert "$180,000" in (data["salary"] or "")
    assert "2026" in (data["deadline"] or "")
    assert data["application_url"] == "https://apexcloud.io/careers/staff-backend"

    # 2. Preserved original JD
    assert "Apex Cloud Systems is pioneering" in data["raw_description"]

    # 3. Required vs Preferred Skills distinction
    required_lower = [s.lower() for s in data["required_skills"]]
    preferred_lower = [s.lower() for s in data["preferred_skills"]]

    assert "python" in required_lower
    assert "fastapi" in required_lower or "docker" in required_lower
    assert "rust" in preferred_lower or "golang" in preferred_lower

    # 4. Experience & Education
    assert "5+" in (data["experience_requirement"] or "") or "year" in (data["experience_requirement"] or "")
    assert any("computer science" in e.lower() or "bachelor" in e.lower() for e in data["education_requirements"])

    # 5. Itemized granular requirements
    req_breakdown = data["requirements"]
    assert len(req_breakdown) > 0
    req_types = {r["requirement_type"] for r in req_breakdown}
    assert "required" in req_types
    assert "preferred" in req_types

    # 6. Verify GET by ID
    job_id = data["id"]
    get_res = await async_client.get(f"/api/jobs/{job_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == job_id


@pytest.mark.asyncio
async def test_analyze_job_no_hallucinated_salary_or_deadline(async_client: AsyncClient):
    """
    Tests that when salary and deadline are NOT in the JD,
    the analyzer strictly returns None rather than hallucinating values.
    """
    payload = {
        "job_description": SAMPLE_AI_JD,
    }

    response = await async_client.post("/api/jobs/analyze", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()

    assert data["company"] == "NeuralPath AI"
    assert "AI Engineer" in data["role"]
    assert data["salary"] is None, "Must not hallucinate salary when absent"
    assert data["deadline"] is None, "Must not hallucinate deadline when absent"

    # Verify AI skills
    req_lower = [s.lower() for s in data["required_skills"]]
    assert "python" in req_lower
    assert any(tech in req_lower for tech in ["pytorch", "langchain", "langgraph", "llms", "rag"])

    pref_lower = [s.lower() for s in data["preferred_skills"]]
    assert any(tech in pref_lower for tech in ["kubernetes", "typescript", "next.js"])


@pytest.mark.asyncio
async def test_analyze_job_validation_error(async_client: AsyncClient):
    """Tests 422 error on empty or too-short JD."""
    payload = {
        "job_description": "Short",
    }
    response = await async_client.post("/api/jobs/analyze", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_analyzed_jobs(async_client: AsyncClient):
    """Tests listing recently analyzed jobs."""
    # Create a job first
    await async_client.post("/api/jobs/analyze", json={"job_description": SAMPLE_AI_JD})

    response = await async_client.get("/api/jobs")
    assert response.status_code == 200
    jobs = response.json()
    assert isinstance(jobs, list)
    assert len(jobs) >= 1
