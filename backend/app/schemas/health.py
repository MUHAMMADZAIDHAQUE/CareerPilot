from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class DatabaseHealth(BaseModel):
    status: str = Field(..., description="Database connection status: connected | disconnected | degraded")
    pgvector_enabled: bool = Field(..., description="Whether pgvector extension is installed and available")
    error: Optional[str] = Field(None, description="Error detail if disconnected")


class HealthResponse(BaseModel):
    status: str = Field("healthy", description="Application overall health status: healthy | degraded | unhealthy")
    environment: str = Field(..., description="Current environment (development, staging, production)")
    version: str = Field(..., description="Application version")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Server UTC timestamp")
    database: DatabaseHealth
    services: Dict[str, str] = Field(
        default_factory=lambda: {
            "api": "online",
            "langgraph": "ready",
            "pdf_engine": "ready",
        },
        description="Auxiliary subsystem statuses"
    )
