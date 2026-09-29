from fastapi import APIRouter
from backend.app.api.v1 import (
    health,
    profile,
    resume,
    jobs,
    referrals,
    outreach,
    applications,
    interview,
    career,
    github,
    dashboard,
)

api_router = APIRouter()

# Include versioned routers
api_router.include_router(health.router)
api_router.include_router(profile.router)
api_router.include_router(resume.router)
api_router.include_router(resume.resumes_router)
api_router.include_router(jobs.router)
api_router.include_router(referrals.router)
api_router.include_router(outreach.router)
api_router.include_router(applications.router)
api_router.include_router(interview.router)
api_router.include_router(career.router)
api_router.include_router(github.router)
api_router.include_router(dashboard.router)

