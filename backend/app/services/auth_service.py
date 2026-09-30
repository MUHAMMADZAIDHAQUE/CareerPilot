import uuid
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.app.models.user import User, UserRole
from backend.app.models.candidate import Candidate
from backend.app.schemas.user import UserRegisterRequest, UserLoginRequest
import os
from backend.app.core.config import settings
from backend.app.core.security import hash_password, verify_password, create_access_token
from backend.app.core.logging import logger


class AuthService:
    """
    Core authentication, credential verification, and user management service.
    """

    @classmethod
    async def get_by_email(cls, session: AsyncSession, email: str) -> Optional[User]:
        stmt = (
            select(User)
            .where(User.email == email.lower().strip())
            .options(selectinload(User.candidate))
        )
        res = await session.execute(stmt)
        return res.scalars().first()

    @classmethod
    async def get_by_id(cls, session: AsyncSession, user_id: str) -> Optional[User]:
        stmt = (
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.candidate))
        )
        res = await session.execute(stmt)
        return res.scalars().first()

    @classmethod
    async def register_user(
        cls, session: AsyncSession, payload: UserRegisterRequest, role: str = UserRole.CANDIDATE
    ) -> Tuple[User, str]:
        normalized_email = payload.email.lower().strip()
        existing = await cls.get_by_email(session, normalized_email)
        if existing:
            raise ValueError(f"An account with email '{normalized_email}' already exists.")

        user_id = str(uuid.uuid4())
        hashed_pwd = hash_password(payload.password)

        new_user = User(
            id=user_id,
            email=normalized_email,
            hashed_password=hashed_pwd,
            role=role,
            is_active=True,
            is_verified=False,
            metadata_json={"registered_via": "web"},
        )
        session.add(new_user)
        await session.flush()

        # Check if an existing candidate profile matches this email, or create new
        stmt_cand = select(Candidate).where(Candidate.email == normalized_email)
        cand_res = await session.execute(stmt_cand)
        candidate = cand_res.scalars().first()

        if candidate:
            candidate.user_id = user_id
            session.add(candidate)
        else:
            candidate = Candidate(
                id=str(uuid.uuid4()),
                user_id=user_id,
                full_name=payload.full_name,
                email=normalized_email,
                headline=payload.headline or "Software Engineer",
                metadata_json={},
            )
            session.add(candidate)

        await session.commit()
        await session.refresh(new_user)

        token = create_access_token(subject=new_user.id, role=new_user.role)
        return new_user, token

    @classmethod
    async def authenticate_user(
        cls, session: AsyncSession, payload: UserLoginRequest
    ) -> Tuple[User, str]:
        normalized_email = payload.email.lower().strip()
        user = await cls.get_by_email(session, normalized_email)

        if not user or not verify_password(payload.password, user.hashed_password):
            raise ValueError("Invalid email or password.")

        if not user.is_active:
            raise ValueError("Account has been deactivated. Please contact support.")

        token = create_access_token(subject=user.id, role=user.role)
        return user, token

    @classmethod
    async def seed_default_accounts(cls, session: AsyncSession) -> None:
        """
        Seeds default admin and candidate accounts if none exist,
        ensuring smooth verification and zero friction for operators.
        """
        try:
            # 1. Seed Admin
            admin_email = os.environ.get("ADMIN_EMAIL", "admin@careerpilot.ai")
            existing_admin = await cls.get_by_email(session, admin_email)
            if not existing_admin:
                admin_initial_pass = os.environ.get("ADMIN_INITIAL_PASSWORD", "Admin@CareerPilot2026!")
                admin_id = str(uuid.uuid4())
                admin_user = User(
                    id=admin_id,
                    email=admin_email,
                    hashed_password=hash_password(admin_initial_pass),
                    role=UserRole.ADMIN,
                    is_active=True,
                    is_verified=True,
                    metadata_json={"seed": True, "description": "Default System Administrator"},
                )
                session.add(admin_user)

            # In production, skip seeding demo candidate
            if settings.ENVIRONMENT == "production":
                await session.commit()
                return

            # 2. Seed Candidate (Alex Chen) - Development only
            cand_email = "alex.chen@example.com"
            existing_cand_user = await cls.get_by_email(session, cand_email)
            if not existing_cand_user:
                cand_user_id = str(uuid.uuid4())
                cand_user = User(
                    id=cand_user_id,
                    email=cand_email,
                    hashed_password=hash_password("Candidate@2026!"),
                    role=UserRole.CANDIDATE,
                    is_active=True,
                    is_verified=True,
                    metadata_json={"seed": True, "description": "Default Demo Candidate"},
                )
                session.add(cand_user)

                # Link to candidate if exists
                stmt = select(Candidate).where(Candidate.email == cand_email)
                res = await session.execute(stmt)
                candidate = res.scalars().first()
                if candidate:
                    candidate.user_id = cand_user_id
                    session.add(candidate)

            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.warning(f"Default user seeding skipped or failed non-critically: {e}")
