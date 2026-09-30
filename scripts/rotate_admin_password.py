"""
Secure Admin Password Rotation Utility for CareerPilot.
Accepts new password via NEW_ADMIN_PASSWORD environment variable or secure CLI prompt.
Validates complexity and updates PostgreSQL database without echoing or logging secrets.
"""

import os
import sys
import getpass
import asyncio
from sqlalchemy import select
from backend.app.db.session import PrimarySessionLocal
from backend.app.models.user import User, UserRole
from backend.app.core.security import hash_password

def validate_password_strength(password: str) -> bool:
    if len(password) < 12:
        return False
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password)
    return has_upper and has_lower and has_digit and has_special

async def rotate_password():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@careerpilot.ai")
    new_password = os.environ.get("NEW_ADMIN_PASSWORD")

    if not new_password:
        if sys.stdin.isatty():
            new_password = getpass.getpass(f"Enter new password for {admin_email}: ")
            confirm = getpass.getpass("Confirm new password: ")
            if new_password != confirm:
                print("Error: Passwords do not match.")
                sys.exit(1)
        else:
            print("Error: NEW_ADMIN_PASSWORD environment variable required in non-interactive mode.")
            sys.exit(1)

    if not validate_password_strength(new_password):
        print("Error: Password does not meet security requirements:")
        print("  - Minimum 12 characters")
        print("  - At least one uppercase letter")
        print("  - At least one lowercase letter")
        print("  - At least one number")
        print("  - At least one special character")
        sys.exit(1)

    async with PrimarySessionLocal() as session:
        stmt = select(User).where(User.email == admin_email, User.role == UserRole.ADMIN)
        res = await session.execute(stmt)
        admin_user = res.scalars().first()

        if not admin_user:
            print(f"Error: Admin account '{admin_email}' not found.")
            sys.exit(1)

        admin_user.hashed_password = hash_password(new_password)
        session.add(admin_user)
        await session.commit()
        print(f"[✓] Successfully rotated password for admin account '{admin_email}'.")

if __name__ == "__main__":
    asyncio.run(rotate_password())
