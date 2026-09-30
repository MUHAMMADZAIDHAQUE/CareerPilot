from sqlalchemy import String, Text, ForeignKey, Integer, Float, JSON
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

    # Phase 17: Lifecycle Status, PDF & ATS Transparency
    status: Mapped[str] = mapped_column(
        String(50), default="REVIEW_REQUIRED", index=True, nullable=False
    )  # "DRAFT" | "GENERATING" | "GENERATED" | "REVIEW_REQUIRED" | "APPROVED" | "REJECTED" | "ARCHIVED"
    pdf_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    ats_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=0.0)
    ats_details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    generated_at: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    approved_at: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Backward-compatible property aliases
    @property
    def candidate_profile_id(self) -> str:
        return self.candidate_id

    @property
    def master_resume_id(self) -> Optional[str]:
        return self.source_resume_id

    @property
    def latex_source(self) -> str:
        return self.latex_content

    @property
    def version(self) -> int:
        return self.version_number

    # Relationships
    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="resume_versions")
    job: Mapped["Job"] = relationship("Job", back_populates="resume_versions")
    source_resume: Mapped[Optional["ResumeDocument"]] = relationship("ResumeDocument", back_populates="versions")
    compiled_pdfs: Mapped[List["CompiledResumePDF"]] = relationship(
        "CompiledResumePDF", back_populates="resume_version", cascade="all, delete-orphan", lazy="selectin"
    )


class CompiledResumePDF(TimeStampedBase):
    """
    Compiled PDF artifact generated from a validated LaTeX resume version.
    Associated with candidate, job, and resume_version.
    Captures full compilation logs, duration, compiler engine, and file metadata.
    """
    __tablename__ = "compiled_resume_pdfs"

    resume_version_id: Mapped[str] = mapped_column(
        String, ForeignKey("resume_versions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    candidate_id: Mapped[str] = mapped_column(
        String, ForeignKey("candidates.id", ondelete="CASCADE"), index=True, nullable=False
    )
    job_id: Mapped[str] = mapped_column(
        String, ForeignKey("jobs.id", ondelete="CASCADE"), index=True, nullable=False
    )

    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    compilation_status: Mapped[str] = mapped_column(
        String(50), default="success", index=True, nullable=False
    )  # "success" | "failed" | "timeout" | "security_violation"
    compiler_used: Mapped[str] = mapped_column(String(50), default="pdflatex", nullable=False)
    compilation_log: Mapped[str] = mapped_column(Text, default="", nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    compile_duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    resume_version: Mapped["ResumeVersion"] = relationship("ResumeVersion", back_populates="compiled_pdfs")
    candidate: Mapped["Candidate"] = relationship("Candidate")
    job: Mapped["Job"] = relationship("Job")


# Conceptual entity alias requested in Phase 17
TailoredResume = ResumeVersion


