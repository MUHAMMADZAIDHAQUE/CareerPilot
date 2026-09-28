import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
import datetime

from backend.app.models.candidate import Candidate, Skill, Experience, Education, Project
from backend.app.models.job import Job
from backend.app.models.application import Application, ApplicationStatus
from backend.app.models.referral import Referral, Contact
from backend.app.models.outreach import Outreach, OutreachStatus
from backend.app.models.interview import InterviewSession, InterviewSessionStatus
from backend.app.services.dashboard_service import DashboardService


@pytest.mark.asyncio
async def test_dashboard_summary_full_lifecycle(
    async_client: AsyncClient, db_session: AsyncSession
):
    """
    Tests Phase 15 Main Dashboard Endpoint and Service:
    Verifies all 10 dashboard sections:
    1. Profile completion
    2. Jobs discovered
    3. Strong job matches
    4. Applications (CRM)
    5. Referral opportunities
    6. Outreach requiring approval
    7. Interviews
    8. Skill gaps
    9. Recommended projects
    10. Follow-ups
    Along with pipeline workflow counts.
    """
    # 1. Candidate setup
    candidate = Candidate(
        full_name="Sarah Connor",
        email="sarah.c@techcorp.io",
        headline="Senior Distributed Systems Architect",
        summary="10+ years engineering high-throughput distributed microservices.",
        github_url="https://github.com/sarahconnor",
    )
    db_session.add(candidate)
    await db_session.flush()

    s1 = Skill(candidate_id=candidate.id, name="Python", proficiency_level="Expert")
    s2 = Skill(candidate_id=candidate.id, name="Go", proficiency_level="Advanced")
    s3 = Skill(candidate_id=candidate.id, name="Distributed Systems", proficiency_level="Expert")
    db_session.add_all([s1, s2, s3])

    exp = Experience(
        candidate_id=candidate.id,
        company="Cyberdyne Systems",
        role="Lead Infrastructure Engineer",
        start_date="2021-01-01",
        is_current=True,
        bullet_points=["Designed scalable message brokers"],
        technologies_used=["Python", "Go", "Kafka"],
    )
    db_session.add(exp)

    edu = Education(
        candidate_id=candidate.id,
        institution="MIT",
        degree="B.S.",
        field_of_study="Computer Science",
        start_date="2016-09-01",
        end_date="2020-05-15",
    )
    db_session.add(edu)

    proj = Project(
        candidate_id=candidate.id,
        title="Async Event Stream Engine",
        technologies=["Python", "Go", "Redis"],
    )
    db_session.add(proj)

    # 2. Jobs Discovered
    job1 = Job(
        company="Anthropic",
        role="Distributed Systems Engineer",
        raw_description="Scale LLM inference backends.",
        required_skills=["Python", "Distributed Systems", "Kubernetes"],
        source_type="career_page",
        source_name="Anthropic Careers",
    )
    job2 = Job(
        company="Stripe",
        role="Core Infrastructure Lead",
        raw_description="Reliable financial transaction processing.",
        required_skills=["Go", "Distributed Systems"],
        source_type="direct",
        source_name="Direct Entry",
    )
    db_session.add_all([job1, job2])
    await db_session.flush()

    # 3. Application CRM & Follow-up
    tomorrow = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)
    app1 = Application(
        job_id=job1.id,
        candidate_id=candidate.id,
        status=ApplicationStatus.SCREENING,
        next_action="Prepare for preliminary technical screen",
        next_followup_date=tomorrow,
    )
    app2 = Application(
        job_id=job2.id,
        candidate_id=candidate.id,
        status=ApplicationStatus.SAVED,
    )
    db_session.add_all([app1, app2])

    # 4. Referral & Contact
    contact = Contact(
        name="Miles Dyson",
        company="Anthropic",
        role="Principal Director of AI",
        source="alumni",
    )
    db_session.add(contact)
    await db_session.flush()

    referral = Referral(
        job_id=job1.id,
        contact_id=contact.id,
        relationship_type="former colleague",
        relevance_reason="Worked together on infrastructure team",
        status="identified",
    )
    db_session.add(referral)

    # 5. Outreach requiring approval
    outreach = Outreach(
        job_id=job1.id,
        contact_id=contact.id,
        candidate_id=candidate.id,
        channel="email",
        subject="Reconnecting regarding Anthropic Distributed Systems Role",
        body="Hi Miles, hope you're doing great. I saw the opening on your infrastructure team...",
        status=OutreachStatus.NEEDS_REVIEW,
    )
    db_session.add(outreach)

    # 6. Mock Interview Session
    interview_session = InterviewSession(
        job_id=job1.id,
        candidate_id=candidate.id,
        status=InterviewSessionStatus.COMPLETED,
        final_feedback={"overall_score": 88.5},
    )
    db_session.add(interview_session)
    await db_session.commit()

    # Call Dashboard Service directly
    summary = await DashboardService.get_dashboard_summary(db_session, candidate_id=candidate.id)
    assert summary is not None
    assert summary.profile_completion.score >= 80
    assert summary.jobs_discovered.total_jobs >= 2
    assert len(summary.strong_matches) >= 1
    assert summary.applications.total_applications >= 2
    assert len(summary.referral_opportunities) >= 1
    assert len(summary.outreach_requiring_approval) >= 1
    assert summary.outreach_requiring_approval[0].contact_name == "Miles Dyson"
    assert len(summary.interviews) >= 1
    assert len(summary.skill_gaps) >= 1
    assert len(summary.recommended_projects) >= 1
    assert len(summary.follow_ups) >= 1
    assert summary.follow_ups[0].company == "Anthropic"

    # Call REST API endpoint
    response = await async_client.get(f"/api/dashboard?candidate_id={candidate.id}")
    assert response.status_code == 200
    data = response.json()

    # Validate 10 sections present in response payload
    assert "profile_completion" in data
    assert "jobs_discovered" in data
    assert "strong_matches" in data
    assert "applications" in data
    assert "referral_opportunities" in data
    assert "outreach_requiring_approval" in data
    assert "interviews" in data
    assert "skill_gaps" in data
    assert "recommended_projects" in data
    assert "follow_ups" in data
    assert "pipeline_counts" in data

    # Verify pipeline counts
    assert data["pipeline_counts"]["jobs_count"] >= 2
    assert data["pipeline_counts"]["pending_approvals_count"] >= 1
