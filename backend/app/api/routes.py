from fastapi import APIRouter
from backend.app.api.v1 import health

api_router = APIRouter()

# Include versioned routers
api_router.include_router(health.router)
