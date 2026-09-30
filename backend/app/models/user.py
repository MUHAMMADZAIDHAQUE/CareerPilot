from sqlalchemy import String, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, Dict, Any, TYPE_CHECKING
from backend.app.db.base import TimeStampedBase

if TYPE_CHECKING:
    from backend.app.models.candidate import Candidate


class UserRole:
    CANDIDATE = "CANDIDATE"
    ADMIN = "ADMIN"
    ALL = [CANDIDATE, ADMIN]


class User(TimeStampedBase):
    """
    Core User authentication and role entity.
    Maintains account credentials, verification status, and administrative roles.
    Links one-to-one with Candidate career profiles.
    """
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default=UserRole.CANDIDATE, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    candidate: Mapped[Optional["Candidate"]] = relationship(
        "Candidate", back_populates="user", uselist=False, lazy="selectin"
    )
