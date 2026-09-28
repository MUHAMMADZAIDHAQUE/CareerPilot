import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.candidate import Candidate, Education, Experience, Skill
from backend.app.models.job import Job
from backend.app.models.referral import Contact


@pytest.mark.asyncio
async def test_contact_crud(async_client: AsyncClient, db_session: AsyncSession):
    """Tests manual contact creation, listing, updating, and deletion."""
    # 1. Create a contact
    contact_data = {
        "name": "Sarah Connor",
        "company": "Cyberdyne Systems",
        "role": "Staff Systems Engineer",
        "department": "Engineering",
        "source": "user_provided",
        "profile_url": "https://cyberdyne.example.com/sarah",
        "email": "sarah.connor@cyberdyne.example.com",
        "relationship": "Former Colleague",
        "notes": "Co-authored distributed systems architecture",
        "university": "MIT",
        "skills": ["Distributed Systems", "C++", "Linux", "Kubernetes"],
    }
    create_res = await async_client.post("/api/contacts", json=contact_data)
    assert create_res.status_code == 201
    created_contact = create_res.json()
    contact_id = created_contact["id"]
    assert created_contact["name"] == "Sarah Connor"
    assert created_contact["company"] == "Cyberdyne Systems"
    assert created_contact["university"] == "MIT"

    # 2. List contacts
    list_res = await async_client.get("/api/contacts")
    assert list_res.status_code == 200
    contacts = list_res.json()
    assert len(contacts) >= 1
    assert any(c["id"] == contact_id for c in contacts)

    # 3. Filter contacts by company
    filter_res = await async_client.get("/api/contacts?company=Cyberdyne")
    assert filter_res.status_code == 200
    filtered = filter_res.json()
    assert len(filtered) == 1
    assert filtered[0]["id"] == contact_id

    # 4. Get single contact
    get_res = await async_client.get(f"/api/contacts/{contact_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Sarah Connor"

    # 5. Update contact
    update_res = await async_client.put(
        f"/api/contacts/{contact_id}",
        json={"role": "Principal Systems Architect", "notes": "Promoted to Principal"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["role"] == "Principal Systems Architect"
    assert update_res.json()["notes"] == "Promoted to Principal"

    # 6. Delete contact
    del_res = await async_client.delete(f"/api/contacts/{contact_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # Verify not found after delete
    get_deleted = await async_client.get(f"/api/contacts/{contact_id}")
    assert get_deleted.status_code == 404


@pytest.mark.asyncio
async def test_referral_discovery_grounded_evidence(
    async_client: AsyncClient, db_session: AsyncSession
):
    """
    Tests referral discovery for a job with multiple contacts exhibiting:
    1. Current Employee at target company (Google) + Engineering department + Seniority
    2. University Alumni (Stanford) matching candidate education + Skill overlap
    3. Unrelated contact with low relevance
    """
    # 1. Create a Candidate with Education & Experience
    candidate = Candidate(
        full_name="Alex Chen",
        email="alex.chen@example.com",
        location="San Francisco, CA",
    )
    db_session.add(candidate)
    await db_session.flush()

    edu = Education(
        candidate_id=candidate.id,
        institution="Stanford University",
        degree="B.S. in Computer Science",
        field_of_study="Computer Science",
    )
    exp = Experience(
        candidate_id=candidate.id,
        company="Stripe",
        role="Software Engineer",
        start_date="2021-01",
        end_date="2023-08",
    )
    skill1 = Skill(candidate_id=candidate.id, name="Python")
    skill2 = Skill(candidate_id=candidate.id, name="Kubernetes")
    db_session.add_all([edu, exp, skill1, skill2])
    await db_session.flush()

    # 2. Create Target Job at Google
    job = Job(
        company="Google",
        role="Senior Site Reliability Engineer",
        location="Mountain View, CA",
        raw_description="We are seeking a Senior SRE at Google to scale cloud infrastructure...",
        required_skills=["Kubernetes", "Go", "Distributed Systems", "Linux"],
        preferred_skills=["Python", "Terraform"],
        technologies=["Kubernetes", "GCP", "Linux"],
    )
    db_session.add(job)
    await db_session.flush()

    # 3. Create Contacts
    # Contact A: Current Employee at Google (Lead Cloud Engineer), Stanford Alumni
    contact_a = Contact(
        candidate_id=candidate.id,
        name="Jordan Lee",
        company="Google",
        role="Lead Cloud Infrastructure Engineer",
        department="Engineering",
        source="university_alumni",
        university="Stanford University",
        skills=["Kubernetes", "Go", "GCP", "Linux"],
        email="jordan.lee@google.example.com",
    )

    # Contact B: Former Colleague at Stripe (Senior Backend Engineer)
    contact_b = Contact(
        candidate_id=candidate.id,
        name="Maria Garcia",
        company="Stripe",
        role="Senior Backend Engineer",
        department="Engineering",
        source="former_colleague",
        relationship="Former Colleague at Stripe",
        university="UC Berkeley",
        skills=["Python", "Distributed Systems"],
    )

    # Contact C: Contact in different field at unrelated company
    contact_c = Contact(
        candidate_id=candidate.id,
        name="David Kim",
        company="Acme Retail",
        role="Store Operations Associate",
        department="Operations",
        source="user_provided",
        university="State College",
        skills=["Inventory Management"],
    )

    db_session.add_all([contact_a, contact_b, contact_c])
    await db_session.commit()

    # 4. Trigger Discovery: POST /api/jobs/{job_id}/referrals
    discover_res = await async_client.post(
        f"/api/jobs/{job.id}/referrals",
        json={"candidate_id": candidate.id},
    )
    assert discover_res.status_code == 200
    data = discover_res.json()

    assert data["job_id"] == job.id
    assert data["company"] == "Google"
    assert data["total_opportunities"] >= 2
    assert "ethical_policy_notice" in data
    assert "no unauthorized LinkedIn scraping" in data["ethical_policy_notice"]

    referrals = data["referrals"]
    # Check top referral is Jordan Lee (Current Employee at Google + Alumni + SRE match)
    top_ref = referrals[0]
    assert top_ref["contact"]["name"] == "Jordan Lee"
    assert top_ref["relationship_type"] == "current employee"
    assert top_ref["relevance_score"] >= 80.0  # Company (+35) + Alumni (+25) + Dept (+20) + Skills (+15) + Seniority (+5) = 100!

    # Verify transparent evidence items
    evidence_factors = [item["factor"] for item in top_ref["evidence"]]
    assert "same_company" in evidence_factors
    assert "same_university" in evidence_factors
    assert "relevant_department" in evidence_factors
    assert "same_field" in evidence_factors
    assert "role_relevance" in evidence_factors

    # Verify score breakdown
    breakdown = top_ref["score_breakdown"]
    assert breakdown["same_company"] == 35.0
    assert breakdown["same_university"] == 25.0
    assert breakdown["relevant_department"] == 20.0
    assert breakdown["same_field"] == 15.0
    assert breakdown["role_relevance"] == 5.0
    assert breakdown["total_score"] == 100.0

    # Verify relevance reason is factual and grounded
    assert "Google" in top_ref["relevance_reason"]
    assert "Stanford" in top_ref["relevance_reason"]


@pytest.mark.asyncio
async def test_referral_status_lifecycle(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Tests updating referral status through the outreach workflow."""
    job = Job(
        company="Stripe",
        role="Product Engineer",
        raw_description="Building modern payments infrastructure...",
        required_skills=["Ruby", "TypeScript"],
    )
    contact = Contact(
        name="Samira Patel",
        company="Stripe",
        role="Staff Product Engineer",
        department="Engineering",
        source="user_provided",
    )
    db_session.add_all([job, contact])
    await db_session.commit()

    # Discover
    disc_res = await async_client.post(f"/api/jobs/{job.id}/referrals")
    assert disc_res.status_code == 200
    refs = disc_res.json()["referrals"]
    assert len(refs) == 1
    ref_id = refs[0]["id"]
    assert refs[0]["status"] == "suggested"

    # Update status: suggested -> drafted
    patch_draft = await async_client.patch(
        f"/api/jobs/{job.id}/referrals/{ref_id}",
        json={"status": "drafted", "notes": "Prepared custom introductory message."},
    )
    assert patch_draft.status_code == 200
    assert patch_draft.json()["status"] == "drafted"
    assert patch_draft.json()["notes"] == "Prepared custom introductory message."

    # Update status: drafted -> contacted
    patch_contacted = await async_client.patch(
        f"/api/jobs/{job.id}/referrals/{ref_id}",
        json={"status": "contacted", "notes": "Sent email inquiry regarding open role."},
    )
    assert patch_contacted.status_code == 200
    assert patch_contacted.json()["status"] == "contacted"

    # Test invalid status
    invalid_patch = await async_client.patch(
        f"/api/jobs/{job.id}/referrals/{ref_id}",
        json={"status": "invalid_status_xyz"},
    )
    assert invalid_patch.status_code == 400


@pytest.mark.asyncio
async def test_get_job_referrals_endpoint(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Tests GET /api/jobs/{job_id}/referrals."""
    job = Job(
        company="Datadog",
        role="Software Engineer - Cloud Observability",
        raw_description="Datadog is looking for software engineers...",
        required_skills=["Go", "Python"],
    )
    contact = Contact(
        name="Elena Rostova",
        company="Datadog",
        role="Senior SRE",
        department="Engineering",
        source="user_provided",
    )
    db_session.add_all([job, contact])
    await db_session.commit()

    # Call GET endpoint
    get_res = await async_client.get(f"/api/jobs/{job.id}/referrals")
    assert get_res.status_code == 200
    body = get_res.json()
    assert body["job_id"] == job.id
    assert body["total_opportunities"] == 1
    assert body["referrals"][0]["contact"]["name"] == "Elena Rostova"
    assert body["referrals"][0]["relationship_type"] == "current employee"
