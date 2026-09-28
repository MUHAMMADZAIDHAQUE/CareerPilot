from fastapi import FastAPI, Request, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import time
import uuid
import traceback

from backend.app.core.config import settings
from backend.app.core.logging import setup_logging, logger
from backend.app.api.routes import api_router
from backend.app.api.v1.health import router as health_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    setup_logging()
    logger.info(
        f"Starting {settings.PROJECT_NAME} v{settings.VERSION} [{settings.ENVIRONMENT}]",
        extra={"env": settings.ENVIRONMENT}
    )
    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI-Powered Job Search, Resume Tailoring, Referral & Interview Copilot API",
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# -----------------------------------------------------------------------------
# Middleware Configuration
# -----------------------------------------------------------------------------

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time_and_tracing(request: Request, call_next):
    """Attaches request tracing ID and measures execution latency."""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    start_time = time.time()

    response = await call_next(request)

    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
    response.headers["X-Request-ID"] = request_id

    # Log request summary
    logger.info(
        f"{request.method} {request.url.path} -> {response.status_code} ({process_time:.4f}s)",
        extra={"request_id": request_id, "path": request.url.path, "status": response.status_code}
    )
    return response


# -----------------------------------------------------------------------------
# Exception Handlers
# -----------------------------------------------------------------------------

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    """Standardized HTTP Exception response."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTPException",
            "message": exc.detail,
            "status_code": exc.status_code,
            "path": request.url.path,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Standardized 422 Request Validation Error response."""
    logger.warning(f"Validation error on {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "ValidationError",
            "message": "Input validation failed",
            "details": exc.errors(),
            "path": request.url.path,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catches all unexpected exceptions and prevents server crash."""
    error_trace = traceback.format_exc()
    logger.error(f"Unhandled server exception on {request.url.path}: {exc}\n{error_trace}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "An unexpected internal error occurred. Please try again later.",
            "path": request.url.path,
        },
    )


from backend.app.api.v1.health import router as health_router
from backend.app.api.v1.profile import router as profile_router
from backend.app.api.v1.resume import router as resume_router, resumes_router
from backend.app.api.v1.jobs import router as jobs_router
from backend.app.api.v1.referrals import router as referrals_router
from backend.app.api.v1.outreach import router as outreach_router
from backend.app.api.v1.applications import router as applications_router


# -----------------------------------------------------------------------------
# Route Registration
# -----------------------------------------------------------------------------

# Mount explicit endpoints requested: /api/health, /api/profile, /api/resume, /api/resumes, /api/jobs, /api/contacts, /api/outreach, /api/applications
app.include_router(health_router, prefix="/api")
app.include_router(profile_router, prefix="/api")
app.include_router(resume_router, prefix="/api")
app.include_router(resumes_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(referrals_router, prefix="/api")
app.include_router(outreach_router, prefix="/api")
app.include_router(applications_router, prefix="/api")

# Mount full API v1 router: /api/v1/...
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["Root"])
async def root():
    """Root metadata discovery endpoint."""
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs_url": "/api/docs",
        "health_url": "/api/health",
    }
