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
        _tables_initialized = True
    return SqliteSessionLocal


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency yielding an async database session.
    Automatically uses PostgreSQL, or falls back to local SQLite in development.
    """
    if "sqlite" in settings.async_database_url:
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
    try:
        async with PrimarySessionLocal() as session:
            # Test connection
            await session.execute(text("SELECT 1"))
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    except Exception as e:
        if settings.ENVIRONMENT == "development":
            logger.warning(f"PostgreSQL connection failed ({e}). Falling back to local SQLite dev database.")
            factory = await _get_sqlite_session_factory()
            async with factory() as session:
                try:
                    yield session
                except Exception:
                    await session.rollback()
                    raise
                finally:
                    await session.close()
        else:
            raise


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
