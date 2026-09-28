from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import DateTime, func
import datetime
import uuid


from pgvector.sqlalchemy import Vector
from sqlalchemy.ext.compiler import compiles


# Allow SQLite to compile Vector columns as BLOB for testing and local fallback
@compiles(Vector, "sqlite")
def compile_vector_sqlite(type_, compiler, **kw):
    return "BLOB"


class Base(DeclarativeBase):
    """Base model class for all SQLAlchemy ORM entities."""
    pass


class TimeStampedBase(Base):
    """Abstract base model with automated timestamping and UUID primary keys."""
    __abstract__ = True

    id: Mapped[str] = mapped_column(
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
