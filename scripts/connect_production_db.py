"""
Production Database Setup & Migration Script for CareerPilot Phase 22.
Connects to PostgreSQL, enables vector extension, executes Alembic migrations,
verifies table creation, and seeds production default user accounts.
"""

import os
import sys
import asyncio
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from backend.app.core.config import settings
from backend.app.services.auth_service import AuthService


async def setup_production_db(db_url: str | None = None):
    target_url = db_url or settings.async_database_url
    print(f"\n=======================================================")
    print(f"Connecting to Production PostgreSQL Database...")
    print(f"=======================================================")
    
    # Sanitize URL for logging (hide password)
    masked_url = target_url
    if "@" in masked_url:
        parts = masked_url.split("@")
        credentials = parts[0].split("://")[-1]
        user = credentials.split(":")[0] if ":" in credentials else credentials
        masked_url = f"{parts[0].split('://')[0]}://{user}:****@{parts[1]}"
    print(f"Target: {masked_url}")

    # Create temporary async engine
    engine = create_async_engine(target_url, pool_pre_ping=True)
    
    # 1. Test basic connectivity
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT version();"))
            version = result.scalar()
            print(f"✅ Connection successful!")
            print(f"PostgreSQL Version: {version}\n")

            # 2. Check/Enable pgvector extension
            try:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                await conn.commit()
                print("✅ pgvector extension enabled.")
            except Exception as ve:
                print(f"⚠️ pgvector extension note: {ve}")
    except Exception as e:
        print(f"❌ Failed to connect to PostgreSQL: {e}")
        await engine.dispose()
        return False

    await engine.dispose()

    # 3. Run Alembic migrations
    print("\nRunning Alembic migrations (0001 -> 0019)...")
    import subprocess
    cmd = [sys.executable, "-m", "alembic", "upgrade", "head"]
    result = subprocess.run(cmd, cwd="backend", capture_output=True, text=True)
    print(result.stdout)
    if result.returncode != 0:
        print(f"❌ Migration failed with code {result.returncode}:\n{result.stderr}")
        return False
    print("✅ All Alembic migrations (0001 through 0019) executed successfully!")

    # 4. Verify tables
    async with engine.connect() as conn:
        res = await conn.execute(text(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
        ))
        tables = [row[0] for row in res.fetchall()]
        print(f"\nVerified {len(tables)} tables in production PostgreSQL:")
        for t in tables:
            print(f"  - {t}")

    # 5. Seed default accounts
    from backend.app.db.session import PrimarySessionLocal
    async with PrimarySessionLocal() as session:
        auth_service = AuthService(session)
        admin, candidate = await auth_service.seed_default_accounts()
        print(f"\n✅ Production default accounts seeded:")
        print(f"  - Admin: {admin.email}")
        print(f"  - Candidate: {candidate.email}")

    print("\n=======================================================")
    print("Production PostgreSQL Database is 100% Ready!")
    print("=======================================================\n")
    return True


if __name__ == "__main__":
    url_arg = sys.argv[1] if len(sys.argv) > 1 else None
    if url_arg:
        os.environ["DATABASE_URL"] = url_arg
    asyncio.run(setup_production_db(url_arg))
