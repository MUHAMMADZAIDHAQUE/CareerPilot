"""
Production Credential Hardening Script for CareerPilot.
Disables demo candidate accounts in the production database and provides
secure administrative status audit without leaking secrets.
"""

import asyncio
from sqlalchemy import select, update
from backend.app.db.session import PrimarySessionLocal
from backend.app.models.user import User, UserRole

async def harden_credentials():
    print("\n--- CareerPilot Production Credential Audit & Hardening ---")
    async with PrimarySessionLocal() as session:
        # 1. Inspect Demo Candidate (alex.chen@example.com)
        cand_email = "alex.chen@example.com"
        stmt = select(User).where(User.email == cand_email)
        res = await session.execute(stmt)
        cand_user = res.scalars().first()

        if cand_user:
            if cand_user.is_active:
                print(f"[!] Demo candidate '{cand_email}' is currently ACTIVE in production.")
                cand_user.is_active = False
                session.add(cand_user)
                await session.commit()
                print(f"[✓] Demo candidate '{cand_email}' has been successfully DEACTIVATED (is_active=False).")
            else:
                print(f"[✓] Demo candidate '{cand_email}' is already inactive (is_active=False).")
        else:
            print(f"[✓] Demo candidate '{cand_email}' does not exist in production.")

        # 2. Inspect Admin Account
        admin_email = "admin@careerpilot.ai"
        stmt_admin = select(User).where(User.email == admin_email)
        res_admin = await session.execute(stmt_admin)
        admin_user = res_admin.scalars().first()

        if admin_user:
            role_val = admin_user.role.value if hasattr(admin_user.role, "value") else admin_user.role
            print(f"[✓] Admin account '{admin_email}' verified: Active={admin_user.is_active}, Verified={admin_user.is_verified}, Role={role_val}")
        else:
            print(f"[!] Admin account '{admin_email}' not found!")

    print("--- Credential Hardening Complete ---\n")

if __name__ == "__main__":
    asyncio.run(harden_credentials())
