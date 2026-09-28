from fastapi import APIRouter, status
from backend.app.schemas.health import HealthResponse, DatabaseHealth
from backend.app.db.session import check_db_health
from backend.app.core.config import settings
from datetime import datetime

router = APIRouter(tags=["Health & Diagnostics"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Application Health & Diagnostics",
    description="Returns the status of the FastAPI backend, PostgreSQL database, and pgvector extension.",
)
async def get_system_health() -> HealthResponse:
    """Comprehensive health check checking DB and pgvector connectivity."""
    db_result = await check_db_health()
    
    db_health = DatabaseHealth(
        status=db_result["status"],
        pgvector_enabled=db_result["pgvector_enabled"],
        error=db_result.get("error"),
    )

    overall_status = "healthy"
    if db_result["status"] != "connected":
        overall_status = "degraded"

    return HealthResponse(
        status=overall_status,
        environment=settings.ENVIRONMENT,
        version=settings.VERSION,
        timestamp=datetime.utcnow(),
        database=db_health,
        services={
            "api": "online",
            "langgraph": "ready",
            "pdf_engine": "ready",
            "matching_engine": "ready",
        },
    )


@router.get(
    "/readyz",
    status_code=status.HTTP_200_OK,
    summary="Kubernetes / Docker Readiness Probe",
)
async def readiness_probe():
    """Simple readiness probe."""
    return {"status": "ready"}
