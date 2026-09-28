from sqlalchemy import String, Text, ForeignKey, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, Dict, Any, List
from backend.app.db.base import TimeStampedBase


class ResumeDocument(TimeStampedBase):
    """Uploaded Resume Document Record (PDF, LaTeX, Plain Text)."""
    __tablename__ = "resume_documents"

    candidate_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="SET NULL"), index=True, nullable=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)  # pdf | tex | txt | md
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    extracted_text: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)

    candidate: Mapped[Optional["Candidate"]] = relationship("Candidate", back_populates="resume_documents")
    versions: Mapped[List["ResumeVersion"]] = relationship(
        "ResumeVersion", back_populates="source_resume", cascade="all, delete-orphan", lazy="selectin"
    )


class ResumeVersion(TimeStampedBase):
    """
    Evidence-grounded tailored LaTeX resume version generated for a specific job posting.
    Tracks validation status, structured diffs, and exact provenance.
    """
    __tablename__ = "resume_versions"

    candidate_id: Mapped[str] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="CASCADE"), index=True, nullable=False
    )
    job_id: Mapped[str] = mapped_column(
        String, ForeignKey("jobs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    source_resume_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("resume_documents.id", ondelete="SET NULL"), index=True, nullable=True
    )
    latex_content: Mapped[str] = mapped_column(Text, nullable=False)
    validation_status: Mapped[str] = mapped_column(
        String(50), default="valid", index=True, nullable=False
    )  # "valid" | "rejected" | "regenerated"
    version_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    validation_details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    diff_summary: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="resume_versions")
    job: Mapped["Job"] = relationship("Job", back_populates="resume_versions")
    source_resume: Mapped[Optional["ResumeDocument"]] = relationship("ResumeDocument", back_populates="versions")

