import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.candidate import Candidate, Project, Skill, Experience
from backend.app.models.job import Job, JobRequirement
from backend.app.models.interview import InterviewSessionStatus
from backend.app.agents.interview_agent import InterviewAgent


@pytest.mark.asyncio
async def test_interview_prep_kit_generation(
    async_client: AsyncClient, db_session: AsyncSession
):
    """
    Tests generating a comprehensive interview preparation kit for a job.
    Verifies all 7 required question categories and preparation topics,
    anti-hallucination labeling of general questions, and non-claims disclaimer.
    """
    # 1. Create Job with requirements & responsibilities
    job = Job(
        company="Stripe",
        role="Staff Backend Infrastructure Engineer",
        domain="Fintech & Global Payments",
        raw_description="Design and scale Stripe's core distributed ledger and payment pipelines.",
        required_skills=["PostgreSQL", "Distributed Systems", "Go", "Redis"],
        preferred_skills=["Kafka", "Kubernetes"],
        responsibilities=[
            "Architect high-throughput payment processing pipelines handling billions in volume",
            "Optimize database queries and distributed lock contention in PostgreSQL",
        ],
    )
    # 2. Create Candidate with verified project & experience
    candidate = Candidate(
        full_name="Sarah Chen",
        email="sarah.chen.infra@example.com",
    )
    db_session.add_all([job, candidate])
    await db_session.flush()

    # Add candidate project and skills
    skill1 = Skill(candidate_id=candidate.id, name="PostgreSQL", category="Database")
    skill2 = Skill(candidate_id=candidate.id, name="Distributed Systems", category="Architecture")
    proj = Project(
        candidate_id=candidate.id,
        title="Global Ledger Service",
        description="High-throughput financial ledger handling double-entry accounting with idempotency keys.",
        technologies=["PostgreSQL", "Go", "Redis", "Docker"],
    )
    exp = Experience(
        candidate_id=candidate.id,
        company="CloudScale Networks",
        role="Senior Distributed Systems Engineer",
        start_date="2022-01-01",
        bullet_points=["Reduced API latency by 35% through custom Redis connection pooling and index optimization."],
    )
    db_session.add_all([skill1, skill2, proj, exp])
    await db_session.commit()

    # 3. Request Interview Prep Kit via API
    res = await async_client.post(f"/api/interview/prep/{job.id}?candidate_id={candidate.id}")
    assert res.status_code == 200
    data = res.json()

    # Verify Core Attributes
    assert data["company_name"] == "Stripe"
    assert data["role"] == "Staff Backend Infrastructure Engineer"

    # Verify 1. Technical Questions (grounded in JD skills)
    assert len(data["technical_questions"]) >= 4
    tech_topics = [q["topic"] for q in data["technical_questions"]]
    assert any("PostgreSQL" in t for t in tech_topics)
    for q in data["technical_questions"]:
        assert "context_source" in q
        assert len(q["sample_good_points"]) >= 2

    # Verify 2. Project Questions (grounded in candidate's verified project)
    assert len(data["project_questions"]) >= 1
    p_names = [q["project_name"] for q in data["project_questions"]]
    assert "Global Ledger Service" in p_names
    assert "Candidate Project:" in data["project_questions"][0]["context_source"]

    # Verify 3. Behavioral Questions (with STAR framework tips)
    assert len(data["behavioral_questions"]) >= 2
    for b in data["behavioral_questions"]:
        assert "competency" in b
        assert "star_framework_tip" in b
        assert "Situation" in b["star_framework_tip"]
        assert "Action" in b["star_framework_tip"]

    # Verify 4. JD-Specific Questions
    assert len(data["jd_specific_questions"]) >= 1
    assert "JD Responsibility:" in data["jd_specific_questions"][0]["context_source"]

    # Verify 5. Resume-Specific Questions (probes claims)
    assert len(data["resume_specific_questions"]) >= 1
    assert "Candidate Resume Experience:" in data["resume_specific_questions"][0]["context_source"]

    # Verify 6. Follow-up Questions
    assert len(data["follow_up_questions"]) >= 2

    # Verify 7. Suggested Preparation Topics
    assert len(data["suggested_preparation_topics"]) >= 3
    priorities = [t["priority"] for t in data["suggested_preparation_topics"]]
    assert "HIGH" in priorities

    # Verify General questions are explicitly labeled as GENERAL
    assert len(data["general_questions"]) >= 1
    for g in data["general_questions"]:
        assert g["category"] == "GENERAL"

    # Verify Disclaimer against leaked questions
    assert "not claimed to be actual, proprietary, or leaked" in data["disclaimer"].lower()

    # 4. Verify GET /api/interview/prep/{job_id} retrieves saved kit
    get_res = await async_client.get(f"/api/interview/prep/{job.id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == data["id"]


@pytest.mark.asyncio
async def test_interactive_mock_interview_simulation(
    async_client: AsyncClient, db_session: AsyncSession
):
    """
    Tests the interactive mock interview simulator:
    1. Start interview session
    2. Receive turn 0 question
    3. Submit answer to question
    4. Verify evaluation across all 6 categories:
       - Technical accuracy
       - Relevance
       - Clarity
       - Structure
       - Evidence
       - Communication
    5. Verify follow-up generation and next turn creation
    6. Complete interview and verify final synthesized feedback
    """
    job = Job(
        company="Datadog",
        role="Senior Backend Engineer",
        raw_description="Build distributed observability backends in Python and Go.",
        required_skills=["Python", "FastAPI", "Distributed Systems"],
    )
    candidate = Candidate(
        full_name="Alex Rivera",
        email="alex.rivera.mock@example.com",
    )
    db_session.add_all([job, candidate])
    await db_session.commit()

    # 1. Start Session with target of 2 questions
    start_payload = {
        "job_id": job.id,
        "candidate_id": candidate.id,
        "total_questions": 2,
    }
    start_res = await async_client.post("/api/interview/sessions", json=start_payload)
    assert start_res.status_code == 201
    session_data = start_res.json()

    session_id = session_data["id"]
    assert session_data["status"] == InterviewSessionStatus.IN_PROGRESS
    assert session_data["total_target_questions"] == 2
    assert session_data["current_turn"] is not None
    assert session_data["current_turn"]["turn_index"] == 0
    assert len(session_data["current_turn"]["question"]) > 10

    # 2. Submit Answer to Turn 0 with concrete metrics and technical details
    answer_payload = {
        "answer": (
            "In my previous project, we faced high latency on our order processing endpoint. "
            "The Situation was 450ms p99 latency under 8,000 RPS. "
            "My Task was optimizing database connection pooling and adding a Redis cache tier. "
            "I took Action by introducing write-through caching with connection multiplexing and query indexing on PostgreSQL. "
            "As a Result, our p99 latency dropped to 48ms, throughput increased by 220%, and we achieved 99.99% uptime during peak flash sales."
        )
    }
    ans_res = await async_client.post(f"/api/interview/sessions/{session_id}/answer", json=answer_payload)
    assert ans_res.status_code == 200
    after_ans_data = ans_res.json()

    # Check Turn 0 Evaluation
    turn0 = [t for t in after_ans_data["turns"] if t["turn_index"] == 0][0]
    assert turn0["candidate_answer"] is not None
    eval_dict = turn0["evaluation"]
    assert eval_dict is not None

    # Check all 6 mandatory categories are scored
    assert "technical_accuracy" in eval_dict
    assert "relevance" in eval_dict
    assert "clarity" in eval_dict
    assert "structure" in eval_dict
    assert "evidence" in eval_dict
    assert "communication" in eval_dict
    assert "overall_score" in eval_dict

    # Check strong evidence score because of quantitative metrics
    assert eval_dict["evidence"] >= 75.0
    assert eval_dict["structure"] >= 75.0
    assert len(eval_dict["strengths"]) >= 1
    assert turn0["follow_up_question"] is not None

    # Check that Turn 1 was automatically scheduled
    assert after_ans_data["current_turn"] is not None
    assert after_ans_data["current_turn"]["turn_index"] == 1

    # 3. Answer Turn 1 to reach total_target_questions (2)
    turn1_answer = {
        "answer": (
            "When downstream dependencies began timing out, I implemented exponential backoff with jitter and a circuit breaker using the Hystrix pattern. "
            "This prevented cascading service failures and maintained system availability at 99.95%."
        )
    }
    finish_res = await async_client.post(f"/api/interview/sessions/{session_id}/answer", json=turn1_answer)
    assert finish_res.status_code == 200
    final_session = finish_res.json()

    # 4. Session should now be COMPLETED
    assert final_session["status"] == InterviewSessionStatus.COMPLETED
    assert final_session["completed_at"] is not None

    # 5. Verify Final Feedback Report
    final_fb = final_session["final_feedback"]
    assert final_fb is not None
    assert final_fb["overall_score"] > 60.0
    assert "category_scores" in final_fb
    for cat in ["technical_accuracy", "relevance", "clarity", "structure", "evidence", "communication"]:
        assert cat in final_fb["category_scores"]
    assert len(final_fb["strengths"]) >= 1
    assert len(final_fb["recommendations"]) >= 1
    assert len(final_fb["preparation_topics_to_review"]) >= 1


@pytest.mark.asyncio
async def test_weak_area_tracking_and_early_finish(
    async_client: AsyncClient, db_session: AsyncSession
):
    """
    Tests weak area detection when candidate gives a brief, vague answer,
    and tests the early finish endpoint.
    """
    job = Job(
        company="Uber",
        role="Systems Engineer",
        raw_description="High-throughput dispatch systems.",
        required_skills=["Go", "Kafka"],
    )
    candidate = Candidate(
        full_name="Jordan Bell",
        email="jordan.bell.test@example.com",
    )
    db_session.add_all([job, candidate])
    await db_session.commit()

    # Start session with 5 questions
    start_res = await async_client.post(
        "/api/interview/sessions",
        json={"job_id": job.id, "candidate_id": candidate.id, "total_questions": 5},
    )
    s_data = start_res.json()
    s_id = s_data["id"]

    # Submit a very short and vague answer without metrics
    vague_answer = {"answer": "I worked on databases and it was fine."}
    ans_res = await async_client.post(f"/api/interview/sessions/{s_id}/answer", json=vague_answer)
    assert ans_res.status_code == 200
    updated = ans_res.json()

    # Verify weak areas were detected and recorded
    assert len(updated["weak_areas"]) >= 1

    # Finish early via POST /api/interview/sessions/{session_id}/finish
    finish_res = await async_client.post(f"/api/interview/sessions/{s_id}/finish")
    assert finish_res.status_code == 200
    finished_data = finish_res.json()
    assert finished_data["status"] == InterviewSessionStatus.COMPLETED
    assert finished_data["final_feedback"] is not None
