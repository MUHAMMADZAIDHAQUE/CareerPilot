from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_db, get_current_active_user
from backend.app.models.user import User, UserRole
from backend.app.schemas.user import (
    UserRegisterRequest,
    UserLoginRequest,
    UserRead,
    TokenResponse,
)
from backend.app.services.auth_service import AuthService
from backend.app.core.logging import logger
from backend.app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication & Accounts"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Candidate user",
    description="Creates a new user account, initializes candidate profile, and returns signed JWT access token.",
)
async def register(
    payload: UserRegisterRequest,
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    try:
        user, token = await AuthService.register_user(session, payload)
        cand_id = user.candidate.id if user.candidate else None
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserRead(
                id=user.id,
                email=user.email,
                role=user.role,
                is_active=user.is_active,
                is_verified=user.is_verified,
                candidate_id=cand_id,
                created_at=user.created_at,
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Registration failure: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}",
        )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="User Login",
    description="Authenticates with email and password, returning JWT access token and user profile.",
)
async def login(
    payload: UserLoginRequest,
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    try:
        user, token = await AuthService.authenticate_user(session, payload)
        cand_id = user.candidate.id if user.candidate else None
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserRead(
                id=user.id,
                email=user.email,
                role=user.role,
                is_active=user.is_active,
                is_verified=user.is_verified,
                candidate_id=cand_id,
                created_at=user.created_at,
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication error: {str(e)}",
        )


@router.post(
    "/token",
    summary="OAuth2 Password Form Token",
    description="Standard OAuth2 password specification for OpenAPI / Swagger UI authentication.",
)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_db),
):
    try:
        user, token = await AuthService.authenticate_user(
            session,
            UserLoginRequest(email=form_data.username, password=form_data.password),
        )
        return {"access_token": token, "token_type": "bearer"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.get(
    "/me",
    response_model=UserRead,
    summary="Get Current User Profile",
    description="Returns authenticated user details and linked candidate profile.",
)
async def get_me(
    current_user: User = Depends(get_current_active_user),
) -> UserRead:
    cand_id = current_user.candidate.id if current_user.candidate else None
    return UserRead(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        candidate_id=cand_id,
        created_at=current_user.created_at,
    )


@router.post(
    "/seed",
    summary="Seed Default Admin & Demo Accounts",
    description="Initializes default administrator and demo candidate if not already created (development only).",
)
async def seed_users(
    session: AsyncSession = Depends(get_db),
):
    if settings.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account seeding endpoint is strictly disabled in production.",
        )
    await AuthService.seed_default_accounts(session)
    return {
        "status": "success",
        "message": "Development accounts initialized.",
    }
