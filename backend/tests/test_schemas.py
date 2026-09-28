import pytest
from pydantic import ValidationError
from backend.app.schemas.candidate import CandidateCreate, ExperienceCreate, SkillCreate
from backend.app.schemas.health import HealthResponse, DatabaseHealth


def test_candidate_schema_valid():
    """Test valid CandidateCreate schema instantiation."""
    candidate_data = {
        "full_name": "Jane Doe",
        "email": "jane.doe@example.com",
        "headline": "Senior Full-Stack & AI Engineer",
        "skills": [
            {"name": "Python", "category": "Languages", "years_of_experience": 5.0},
            {"name": "FastAPI", "category": "Frameworks", "years_of_experience": 4.0},
        ],
        "experiences": [
            {
                "company": "Tech Corp",
                "role": "Lead Software Engineer",
                "start_date": "2022-01",
                "is_current": True,
                "bullet_points": ["Architected distributed microservices handling 10k RPS"],
                "technologies_used": ["Python", "FastAPI", "PostgreSQL"],
            }
        ]
    }
    candidate = CandidateCreate(**candidate_data)
    assert candidate.full_name == "Jane Doe"
    assert candidate.email == "jane.doe@example.com"
    assert len(candidate.skills) == 2
    assert len(candidate.experiences) == 1
    assert candidate.experiences[0].is_current is True


def test_candidate_schema_invalid_email():
    """Test that invalid email format raises validation error."""
    with pytest.raises(ValidationError):
        CandidateCreate(
            full_name="Invalid Candidate",
            email="not-an-email",
        )


def test_health_response_schema():
    """Test HealthResponse schema validation."""
    health = HealthResponse(
        status="healthy",
        environment="development",
        version="1.0.0",
        database=DatabaseHealth(status="connected", pgvector_enabled=True),
        services={"api": "online", "langgraph": "ready"}
    )
    assert health.status == "healthy"
    assert health.database.status == "connected"
    assert health.database.pgvector_enabled is True
