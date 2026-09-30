from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
import os

_ROOT_ENV = str(Path(__file__).resolve().parent.parent.parent.parent / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", _ROOT_ENV),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Core Application
    PROJECT_NAME: str = "CareerPilot AI"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # API Configuration
    API_V1_PREFIX: str = "/api/v1"
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    SECRET_KEY: str = "temporary-dev-secret-key-change-in-production-min-32-chars-long"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # CORS Origins
    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5678",
        "http://127.0.0.1:5678",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                import json
                return json.loads(v)
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    # n8n Orchestration Settings (Phase 16)
    N8N_ENABLED: bool = True
    N8N_PORT: int = 5678
    N8N_BASE_URL: str = "http://localhost:5678"
    N8N_WEBHOOK_BASE_URL: str = "http://localhost:5678/webhook"
    N8N_WEBHOOK_SECRET: str = "careerpilot-n8n-dev-webhook-secret"

    # Multi-Source Job Discovery Settings (Phase 16B)
    JOB_SOURCE_LINKEDIN_ENABLED: bool = True
    JOB_SOURCE_FRESHERSHUNT_ENABLED: bool = True
    JOB_SOURCE_COMPANY_CAREERS_ENABLED: bool = True
    JOB_SOURCE_INDEED_ENABLED: bool = True
    JOB_SOURCE_PUBLIC_FEEDS_ENABLED: bool = True
    JOB_DISCOVERY_DEFAULT_MIN_SCORE: float = 65.0

    # Database Configuration
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "careerpilot"
    POSTGRES_PASSWORD: str = "careerpilot_dev_password"
    POSTGRES_DB: str = "careerpilot_db"
    DATABASE_URL: str | None = None

    # LLM Settings (for subsequent phases)
    OPENAI_API_KEY: str | None = None
    ANTHROPIC_API_KEY: str | None = None
    GOOGLE_API_KEY: str | None = None
    DEFAULT_LLM_MODEL: str = "gpt-4o"
    DEFAULT_EMBEDDING_MODEL: str = "text-embedding-3-large"
    EMBEDDING_DIMENSION: int = 1536  # Default embedding size for OpenAI

    # Storage Settings
    STORAGE_BACKEND: str = "local"  # "local" | "supabase"
    STORAGE_LOCAL_ROOT: str = "data/storage"
    SUPABASE_URL: str | None = None
    SUPABASE_SERVICE_ROLE_KEY: str | None = None
    SUPABASE_KEY: str | None = None
    SUPABASE_STORAGE_BUCKET: str = "careerpilot-storage"
    SUPABASE_STORAGE_SIGNED_URL_EXPIRY_SECONDS: int = 3600
    GENERATED_PDF_DIR: str = "generated/resumes"
    LATEX_TIMEOUT_SECONDS: int = 15
    JOB_RETENTION_DAYS: int = 60

    @property
    def async_database_url(self) -> str:
        raw_url = self.DATABASE_URL or os.environ.get("DATABASE_URL")
        if raw_url and raw_url.strip():
            url = raw_url.strip()
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            if "sslmode=require" in url:
                url = url.replace("sslmode=require", "ssl=require")
            elif "supabase.com" in url and "ssl=" not in url:
                url += ("&ssl=require" if "?" in url else "?ssl=require")
            return url

        is_cloud = bool(os.environ.get("RENDER") or os.environ.get("VERCEL") or self.ENVIRONMENT == "production")
        if is_cloud:
            raise RuntimeError(
                "CRITICAL: DATABASE_URL is not configured in environment variables. "
                "Please add DATABASE_URL in your cloud provider's Environment settings."
            )

        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
            f"{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def sync_database_url(self) -> str:
        raw_url = self.DATABASE_URL or os.environ.get("DATABASE_URL")
        if raw_url and raw_url.strip():
            url = raw_url.strip()
            if url.startswith("postgresql+asyncpg://"):
                url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
            elif url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql://", 1)
            if "ssl=require" in url and "sslmode=require" not in url:
                url = url.replace("ssl=require", "sslmode=require")
            return url

        is_cloud = bool(os.environ.get("RENDER") or os.environ.get("VERCEL") or self.ENVIRONMENT == "production")
        if is_cloud:
            raise RuntimeError(
                "CRITICAL: DATABASE_URL is not configured in environment variables. "
                "Please add DATABASE_URL in your cloud provider's Environment settings."
            )

        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
            f"{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


settings = Settings()
