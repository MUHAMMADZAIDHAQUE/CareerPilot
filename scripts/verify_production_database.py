"""
Comprehensive Production Database Verification Script.
Audits PostgreSQL version, pgvector status, Alembic head, pooling, and SSL.
"""

import asyncio
from sqlalchemy import text
from backend.app.db.session import PrimarySessionLocal, primary_engine
from backend.app.core.config import settings

async def verify_database():
    print("\n=======================================================")
    print("CAREERPILOT PRODUCTION DATABASE AUDIT")
    print("=======================================================")
    
    # 1. Connection URL sanitization check
    db_url = settings.DATABASE_URL
    has_ssl = "ssl" in db_url.lower() or "sslmode" in db_url.lower()
    is_supabase = "supabase" in db_url.lower()
    print(f"Target Provider:      {'Supabase' if is_supabase else 'Self-hosted/Other'}")
    print(f"SSL Configured:       {has_ssl}")
    print(f"Pool Size:            {primary_engine.pool.size() if hasattr(primary_engine.pool, 'size') else 'N/A'}")

    async with PrimarySessionLocal() as session:
        # 2. PostgreSQL Engine Version
        ver_res = await session.execute(text("SELECT version()"))
        pg_version = ver_res.scalar()
        print(f"Engine Version:       {pg_version}")
        assert "PostgreSQL" in pg_version, "Database is not PostgreSQL!"

        # 3. Check pgvector extension
        vec_res = await session.execute(text("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'"))
        vec_row = vec_res.fetchone()
        assert vec_row is not None, "pgvector extension is NOT installed!"
        print(f"pgvector Extension:   Installed (v{vec_row[1]})")

        # 4. Check Alembic Version Table
        alem_res = await session.execute(text("SELECT version_num FROM alembic_version"))
        current_rev = alem_res.scalar()
        print(f"Alembic Current Head: {current_rev}")
        assert current_rev == "0020_phase23_india_queue", f"Unexpected migration head: {current_rev}"

        # 5. Table Count
        tbl_res = await session.execute(text(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"
        ))
        table_count = tbl_res.scalar()
        print(f"Public Tables Count:  {table_count} tables")
        assert table_count >= 30, f"Table count too low: {table_count}"

        # 6. Verify SQLite Fallback is strictly disabled in production
        print(f"Current Environment:  {settings.ENVIRONMENT}")
        assert "sqlite" not in settings.async_database_url, "async_database_url points to SQLite!"

    print("\n[✓] Production Database Audit: 100% VERIFIED")
    print("=======================================================\n")

if __name__ == "__main__":
    asyncio.run(verify_database())
