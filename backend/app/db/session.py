from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text
from typing import AsyncGenerator, Tuple, Dict, Any
from backend.app.core.config import settings
from backend.app.core.logging import logger

# Create async engine with pooling
engine = create_async_engine(
    settings.async_database_url,
    echo=settings.DEBUG and False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an async database session."""
    async with AsyncSessionLocal() as session:
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
    Returns structured status dictionary.
    """
    try:
        async with AsyncSessionLocal() as session:
            # Check basic connection
            res = await session.execute(text("SELECT 1"))
            res.scalar()

            # Check pgvector extension status
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
                "pgvector_enabled": pgvector_enabled,
                "error": None
            }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "disconnected",
            "pgvector_enabled": False,
            "error": str(e)
        }
