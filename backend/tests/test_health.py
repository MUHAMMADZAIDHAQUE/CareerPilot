import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint(async_client: AsyncClient):
    """Test the GET /api/health endpoint."""
    response = await async_client.get("/api/health")
    assert response.status_code == 200

    data = response.json()
    assert "status" in data
    assert data["status"] in ["healthy", "degraded"]
    assert "environment" in data
    assert "version" in data
    assert "database" in data
    assert "status" in data["database"]
    assert "pgvector_enabled" in data["database"]
    assert "services" in data
    assert data["services"]["api"] == "online"


@pytest.mark.asyncio
async def test_v1_health_endpoint(async_client: AsyncClient):
    """Test the GET /api/v1/health endpoint alias."""
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data


@pytest.mark.asyncio
async def test_readiness_probe(async_client: AsyncClient):
    """Test the GET /api/v1/readyz endpoint."""
    response = await async_client.get("/api/v1/readyz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"


@pytest.mark.asyncio
async def test_root_metadata_endpoint(async_client: AsyncClient):
    """Test GET / root metadata endpoint."""
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert data["name"] == "CareerPilot AI"
    assert "docs_url" in data


@pytest.mark.asyncio
async def test_middleware_tracing_headers(async_client: AsyncClient):
    """Test that custom middleware attaches X-Request-ID and X-Process-Time."""
    response = await async_client.get("/api/health")
    assert "x-request-id" in response.headers
    assert "x-process-time" in response.headers
