import os
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text
from typing import AsyncGenerator, Dict, Any
from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.db.base import Base
import backend.app.models  # Register all ORM models

SQLITE_DEV_PATH = Path("data/careerpilot_dev.db")
SQLITE_DEV_URL = f"sqlite+aiosqlite:///{SQLITE_DEV_PATH.absolute()}"

# Primary PostgreSQL Engine
primary_engine = create_async_engine(
    settings.async_database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)
PrimarySessionLocal = async_sessionmaker(
    bind=primary_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Aliases for backward compatibility
engine = primary_engine
AsyncSessionLocal = PrimarySessionLocal

# Dev SQLite Fallback Engine
sqlite_engine = None
SqliteSessionLocal = None
_tables_initialized = False


def _sync_sqlite_columns_sync(connection):
    cursor = connection.connection.cursor()
    cursor.execute("PRAGMA table_info(candidates);")
    existing_cand_cols = {col[1] for col in cursor.fetchall()}
    if "user_id" not in existing_cand_cols:
        cursor.execute("ALTER TABLE candidates ADD COLUMN user_id VARCHAR(36);")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(36) PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            hashed_password VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'CANDIDATE' NOT NULL,
            is_active BOOLEAN DEFAULT 1 NOT NULL,
            is_verified BOOLEAN DEFAULT 0 NOT NULL,
            metadata_json JSON DEFAULT '{}' NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
    """)

    cursor.execute("PRAGMA table_info(jobs);")
    existing_job_cols = {col[1] for col in cursor.fetchall()}
    new_job_cols = [
        ("normalized_title", "VARCHAR(255)"),
        ("official_company_url", "VARCHAR(500)"),
        ("remote_status", "VARCHAR(50) DEFAULT 'Unknown'"),
        ("experience_level", "VARCHAR(50) DEFAULT 'Unknown'"),
        ("is_fresher_eligible", "BOOLEAN DEFAULT 0"),
        ("fresher_eligibility_reason", "TEXT"),
        ("source_references", "JSON DEFAULT '[]'"),
        ("posted_at", "VARCHAR(100)"),
        ("last_verified_at", "VARCHAR(100)"),
        ("india_relevance", "VARCHAR(50) DEFAULT 'INDIA_POSSIBLE'"),
        ("india_relevance_score", "FLOAT DEFAULT 0.5"),
        ("india_location_type", "VARCHAR(50)"),
        ("india_location", "VARCHAR(255)"),
        ("remote_india", "BOOLEAN DEFAULT 0"),
        ("country", "VARCHAR(100) DEFAULT 'India'"),
        ("experience_min", "FLOAT"),
        ("experience_max", "FLOAT"),
        ("experience_category", "VARCHAR(50)"),
        ("entry_level_score", "FLOAT DEFAULT 0.0"),
        ("content_hash", "VARCHAR(64)"),
        ("scam_score", "FLOAT DEFAULT 0.0"),
        ("scam_risk_level", "VARCHAR(50) DEFAULT 'LOW'"),
        ("has_safety_warnings", "BOOLEAN DEFAULT 0"),
        ("safety_warnings", "JSON DEFAULT '[]'"),
    ]
    for col_name, col_type in new_job_cols:
        if col_name not in existing_job_cols:
            cursor.execute(f"ALTER TABLE jobs ADD COLUMN {col_name} {col_type};")

    cursor.execute("PRAGMA table_info(match_results);")
    existing_match_cols = {col[1] for col in cursor.fetchall()}
    new_match_cols = [
        ("structured_score", "FLOAT DEFAULT 0.0"),
        ("total_score", "FLOAT DEFAULT 0.0"),
        ("match_category", "VARCHAR(50) DEFAULT 'POSSIBLE_MATCH'"),
        ("eligibility_status", "VARCHAR(50) DEFAULT 'ELIGIBLE'"),
        ("fresher_eligible", "BOOLEAN DEFAULT 0"),
    ]
    for col_name, col_type in new_match_cols:
        if col_name not in existing_match_cols:
            cursor.execute(f"ALTER TABLE match_results ADD COLUMN {col_name} {col_type};")

    cursor.execute("PRAGMA table_info(resume_versions);")
    existing_resume_ver_cols = {col[1] for col in cursor.fetchall()}
    new_resume_ver_cols = [
        ("status", "VARCHAR(50) DEFAULT 'REVIEW_REQUIRED'"),
        ("pdf_path", "VARCHAR(500)"),
        ("ats_score", "FLOAT DEFAULT 0.0"),
        ("ats_details", "TEXT DEFAULT '{}'"),
        ("generated_at", "VARCHAR(50)"),
        ("approved_at", "VARCHAR(50)"),
        ("rejection_reason", "TEXT"),
    ]
    for col_name, col_type in new_resume_ver_cols:
        if col_name not in existing_resume_ver_cols:
            cursor.execute(f"ALTER TABLE resume_versions ADD COLUMN {col_name} {col_type};")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS referral_contacts (
            id VARCHAR(36) PRIMARY KEY,
            company_id VARCHAR(255),
            company_name VARCHAR(255) NOT NULL,
            company VARCHAR(255) NOT NULL,
            job_id VARCHAR(36) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
            candidate_id VARCHAR(36) REFERENCES candidates(id) ON DELETE SET NULL,
            name VARCHAR(255) NOT NULL,
            headline VARCHAR(500),
            current_title VARCHAR(255) NOT NULL,
            department VARCHAR(150),
            location VARCHAR(255),
            profile_url VARCHAR(500),
            source VARCHAR(100) DEFAULT 'linkedin' NOT NULL,
            source_url VARCHAR(500),
            source_references JSON DEFAULT '[]' NOT NULL,
            public_contact_method VARCHAR(255),
            university VARCHAR(255),
            graduation_year INTEGER,
            skills JSON DEFAULT '[]' NOT NULL,
            relevance_score FLOAT DEFAULT 0.0 NOT NULL,
            relevance_reasons JSON DEFAULT '[]' NOT NULL,
            score_breakdown JSON DEFAULT '{}' NOT NULL,
            relationship_type VARCHAR(50) DEFAULT 'EMPLOYEE' NOT NULL,
            verification_status VARCHAR(50) DEFAULT 'VERIFIED' NOT NULL,
            last_verified_at VARCHAR(100),
            discovered_at VARCHAR(100),
            duplicate_key VARCHAR(255) NOT NULL,
            notes TEXT,
            outreach_status VARCHAR(50) DEFAULT 'NOT_CONTACTED' NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS outreach_drafts (
            id VARCHAR(36) PRIMARY KEY,
            candidate_id VARCHAR(36) REFERENCES candidates(id) ON DELETE CASCADE,
            job_id VARCHAR(36) REFERENCES jobs(id) ON DELETE CASCADE,
            referral_contact_id VARCHAR(36) REFERENCES referral_contacts(id) ON DELETE CASCADE,
            resume_version_id VARCHAR(36) REFERENCES resume_versions(id) ON DELETE SET NULL,
            recipient_name VARCHAR(255),
            recipient_email VARCHAR(255),
            recipient_profile_url VARCHAR(500),
            channel VARCHAR(50) DEFAULT 'LINKEDIN' NOT NULL,
            subject VARCHAR(255),
            body TEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'DRAFT' NOT NULL,
            generation_version INTEGER DEFAULT 1 NOT NULL,
            prompt_version VARCHAR(50) DEFAULT 'v1.0' NOT NULL,
            personalization_evidence JSON DEFAULT '[]' NOT NULL,
            validation_results JSON DEFAULT '{}' NOT NULL,
            risk_flags JSON DEFAULT '[]' NOT NULL,
            approved_at DATETIME,
            approved_by VARCHAR(255),
            rejected_at DATETIME,
            rejected_by VARCHAR(255),
            human_edits JSON DEFAULT '[]' NOT NULL,
            dispatch_status VARCHAR(50) DEFAULT 'NOT_DISPATCHED' NOT NULL,
            audit_metadata JSON DEFAULT '{}' NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
    """)

    cursor.execute("PRAGMA table_info(outreach_drafts);")
    existing_outreach_cols = {col[1] for col in cursor.fetchall()}
    new_outreach_cols = [
        ("recipient_name", "VARCHAR(255)"),
        ("recipient_email", "VARCHAR(255)"),
        ("recipient_profile_url", "VARCHAR(500)"),
    ]
    for col_name, col_type in new_outreach_cols:
        if col_name not in existing_outreach_cols:
            cursor.execute(f"ALTER TABLE outreach_drafts ADD COLUMN {col_name} {col_type};")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS outreach_audit_events (
            id VARCHAR(36) PRIMARY KEY,
            draft_id VARCHAR(36) REFERENCES outreach_drafts(id) ON DELETE CASCADE,
            candidate_id VARCHAR(36),
            job_id VARCHAR(36),
            referral_contact_id VARCHAR(36),
            event_type VARCHAR(100) NOT NULL,
            actor VARCHAR(100) DEFAULT 'user' NOT NULL,
            payload JSON DEFAULT '{}' NOT NULL,
            no_message_sent BOOLEAN DEFAULT 1 NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS job_alerts (
            id VARCHAR(36) PRIMARY KEY,
            candidate_id VARCHAR(36) REFERENCES candidates(id) ON DELETE CASCADE,
            alert_name VARCHAR(255) NOT NULL,
            roles JSON DEFAULT '[]' NOT NULL,
            locations JSON DEFAULT '[]' NOT NULL,
            sources JSON DEFAULT '[]' NOT NULL,
            experience_levels JSON DEFAULT '[]' NOT NULL,
            work_modes JSON DEFAULT '[]' NOT NULL,
            min_match_score FLOAT DEFAULT 70.0 NOT NULL,
            frequency VARCHAR(50) DEFAULT 'DAILY' NOT NULL,
            is_active BOOLEAN DEFAULT 1 NOT NULL,
            last_run_at DATETIME,
            metadata_json JSON DEFAULT '{}' NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS outreach_dispatches (
            id VARCHAR(36) PRIMARY KEY,
            draft_id VARCHAR(36) NOT NULL REFERENCES outreach_drafts(id) ON DELETE CASCADE,
            candidate_id VARCHAR(36),
            job_id VARCHAR(36),
            referral_contact_id VARCHAR(36),
            channel VARCHAR(50) DEFAULT 'EMAIL' NOT NULL,
            recipient_name VARCHAR(255) NOT NULL,
            recipient_address VARCHAR(255) NOT NULL,
            provider VARCHAR(50) DEFAULT 'AUTHORIZED_MOCK' NOT NULL,
            idempotency_key VARCHAR(255) UNIQUE NOT NULL,
            status VARCHAR(50) DEFAULT 'READY_TO_SEND' NOT NULL,
            provider_message_id VARCHAR(255),
            sent_at DATETIME,
            delivery_confirmed_at DATETIME,
            error_details TEXT,
            audit_metadata JSON DEFAULT '{}' NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS inbound_responses (
            id VARCHAR(36) PRIMARY KEY,
            candidate_id VARCHAR(36) REFERENCES candidates(id) ON DELETE SET NULL,
            job_id VARCHAR(36) REFERENCES jobs(id) ON DELETE SET NULL,
            contact_id VARCHAR(36),
            outreach_id VARCHAR(36),
            dispatch_id VARCHAR(36),
            application_id VARCHAR(36) REFERENCES applications(id) ON DELETE SET NULL,
            channel VARCHAR(50) DEFAULT 'EMAIL' NOT NULL,
            message_id VARCHAR(255),
            received_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            sender VARCHAR(255) NOT NULL,
            subject VARCHAR(255),
            body TEXT NOT NULL,
            classification VARCHAR(50) DEFAULT 'OTHER' NOT NULL,
            confidence FLOAT DEFAULT 1.0 NOT NULL,
            action_required BOOLEAN DEFAULT 0 NOT NULL,
            assessment_detected BOOLEAN DEFAULT 0 NOT NULL,
            interview_detected BOOLEAN DEFAULT 0 NOT NULL,
            deadline_detected BOOLEAN DEFAULT 0 NOT NULL,
            metadata_json JSON DEFAULT '{}' NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS assessments (
            id VARCHAR(36) PRIMARY KEY,
            application_id VARCHAR(36) REFERENCES applications(id) ON DELETE CASCADE,
            job_id VARCHAR(36) REFERENCES jobs(id) ON DELETE CASCADE,
            response_id VARCHAR(36) REFERENCES inbound_responses(id) ON DELETE SET NULL,
            candidate_id VARCHAR(36) REFERENCES candidates(id) ON DELETE SET NULL,
            assessment_type VARCHAR(50) DEFAULT 'CODING_ASSESSMENT' NOT NULL,
            title VARCHAR(255) NOT NULL,
            platform VARCHAR(100) DEFAULT 'HACKERRANK' NOT NULL,
            url VARCHAR(500),
            deadline DATETIME,
            status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
            notes TEXT,
            confidence FLOAT DEFAULT 1.0 NOT NULL,
            metadata_json JSON DEFAULT '{}' NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS deadlines (
            id VARCHAR(36) PRIMARY KEY,
            application_id VARCHAR(36) REFERENCES applications(id) ON DELETE CASCADE,
            candidate_id VARCHAR(36) REFERENCES candidates(id) ON DELETE SET NULL,
            deadline_type VARCHAR(50) DEFAULT 'APPLICATION_DEADLINE' NOT NULL,
            title VARCHAR(255) NOT NULL,
            due_date DATETIME NOT NULL,
            status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
            priority VARCHAR(50) DEFAULT 'MEDIUM' NOT NULL,
            notes TEXT,
            metadata_json JSON DEFAULT '{}' NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS interview_events (
            id VARCHAR(36) PRIMARY KEY,
            application_id VARCHAR(36) REFERENCES applications(id) ON DELETE CASCADE,
            candidate_id VARCHAR(36) REFERENCES candidates(id) ON DELETE SET NULL,
            job_id VARCHAR(36) REFERENCES jobs(id) ON DELETE CASCADE,
            company VARCHAR(255) NOT NULL,
            scheduled_at DATETIME NOT NULL,
            interview_type VARCHAR(50) DEFAULT 'TECHNICAL' NOT NULL,
            meeting_url VARCHAR(500),
            status VARCHAR(50) DEFAULT 'SCHEDULED' NOT NULL,
            notes TEXT,
            metadata_json JSON DEFAULT '{}' NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(36) PRIMARY KEY,
            candidate_id VARCHAR(36) REFERENCES candidates(id) ON DELETE SET NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            category VARCHAR(50) DEFAULT 'SYSTEM' NOT NULL,
            is_read BOOLEAN DEFAULT 0 NOT NULL,
            deep_link VARCHAR(500),
            metadata_json JSON DEFAULT '{}' NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS connected_providers (
            id VARCHAR(36) PRIMARY KEY,
            candidate_id VARCHAR(36) REFERENCES candidates(id) ON DELETE SET NULL,
            provider_type VARCHAR(50) NOT NULL,
            email_address VARCHAR(255) NOT NULL,
            is_connected BOOLEAN DEFAULT 1 NOT NULL,
            status VARCHAR(50) DEFAULT 'CONNECTED' NOT NULL,
            scopes JSON DEFAULT '[]' NOT NULL,
            metadata_json JSON DEFAULT '{}' NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
    """)


async def _get_sqlite_session_factory():
    global sqlite_engine, SqliteSessionLocal, _tables_initialized
    if sqlite_engine is None:
        SQLITE_DEV_PATH.parent.mkdir(parents=True, exist_ok=True)
        sqlite_engine = create_async_engine(
            SQLITE_DEV_URL,
            echo=False,
        )
        SqliteSessionLocal = async_sessionmaker(
            bind=sqlite_engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    if not _tables_initialized:
        async with sqlite_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.run_sync(_sync_sqlite_columns_sync)
        _tables_initialized = True
    return SqliteSessionLocal


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency yielding an async database session.
    Automatically uses PostgreSQL, or falls back to local SQLite in development.
    """
    if "sqlite" in settings.async_database_url:
        if settings.ENVIRONMENT == "production":
            raise RuntimeError("CRITICAL: SQLite database backend is strictly prohibited in production environment. A PostgreSQL connection is required.")
        factory = await _get_sqlite_session_factory()
        async with factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
        return

    # Try PostgreSQL first
    session = None
    use_sqlite = False
    try:
        session = PrimarySessionLocal()
        await session.execute(text("SELECT 1"))
    except Exception as e:
        if session:
            await session.close()
            session = None
        if settings.ENVIRONMENT == "development":
            logger.warning(f"PostgreSQL connection failed ({e}). Falling back to local SQLite dev database.")
            use_sqlite = True
        else:
            raise

    if use_sqlite:
        factory = await _get_sqlite_session_factory()
        async with factory() as sqlite_session:
            try:
                yield sqlite_session
            except Exception:
                await sqlite_session.rollback()
                raise
            finally:
                await sqlite_session.close()
        return

    try:
        yield session
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def check_db_health() -> Dict[str, Any]:
    """
    Checks the status of the PostgreSQL connection and whether pgvector is enabled.
    Falls back to SQLite status in local development.
    """
    try:
        async with PrimarySessionLocal() as session:
            res = await session.execute(text("SELECT 1"))
            res.scalar()

            pgvector_enabled = False
            try:
                vec_check = await session.execute(
                    text("SELECT extname FROM pg_extension WHERE extname = 'vector'")
                )
                pgvector_enabled = vec_check.scalar() is not None
            except Exception as e:
                logger.warning(f"Could not verify pgvector extension: {e}")

            return {
                "status": "connected",
                "backend": "postgresql",
                "pgvector_enabled": pgvector_enabled,
                "error": None
            }
    except Exception as e:
        if settings.ENVIRONMENT == "development":
            try:
                factory = await _get_sqlite_session_factory()
                async with factory() as session:
                    res = await session.execute(text("SELECT 1"))
                    res.scalar()
                    return {
                        "status": "connected",
                        "backend": "sqlite_fallback",
                        "pgvector_enabled": False,
                        "error": None,
                        "notice": "PostgreSQL offline, using SQLite dev storage"
                    }
            except Exception as sql_e:
                return {
                    "status": "disconnected",
                    "pgvector_enabled": False,
                    "error": f"PostgreSQL ({e}); SQLite ({sql_e})"
                }
        return {
            "status": "disconnected",
            "pgvector_enabled": False,
            "error": str(e)
        }
