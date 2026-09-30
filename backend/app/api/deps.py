from typing import AsyncGenerator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_db
from backend.app.models.user import User, UserRole
from backend.app.services.auth_service import AuthService
from backend.app.core.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/token",
    auto_error=False,
)


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_db),
) -> User:
    """
    Validates JWT access token and returns the authenticated User entity.
    Raises HTTP 401 if unauthenticated or token is expired/invalid.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    user = await AuthService.get_by_id(session, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with this token no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensures the authenticated user account is active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account. Please contact an administrator.",
        )
    return current_user


async def get_current_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """
    Enforces Role-Based Access Control:
    Only users with role == 'ADMIN' may access administrative endpoints.
    Raises HTTP 403 Forbidden for candidate users.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Administrative privileges are required.",
        )
    return current_user


async def get_optional_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Returns the authenticated user if token is present and valid, otherwise None."""
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        return None
    return await AuthService.get_by_id(session, payload.get("sub"))


def verify_resource_ownership(
    resource_candidate_id: Optional[str],
    current_user: Optional[User],
) -> None:
    """
    Enforces Multi-User data isolation (Anti-IDOR):
    If caller is an authenticated candidate, their candidate ID MUST match
    the resource's candidate_id. Admins are permitted for operator oversight.
    """
    if not isinstance(current_user, User):
        return
    if current_user.role == UserRole.ADMIN:
        return
    if not resource_candidate_id:
        return
    if not current_user.candidate:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Candidate profile required.",
        )
    if resource_candidate_id != current_user.candidate.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to access or modify this resource.",
        )


__all__ = [
    "get_db",
    "get_current_user",
    "get_current_active_user",
    "get_current_admin",
    "get_optional_current_user",
    "verify_resource_ownership",
]
