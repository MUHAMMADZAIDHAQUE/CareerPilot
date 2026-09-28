from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime


class CompilationErrorDetail(BaseModel):
    """Structured LaTeX compilation error diagnostic."""
    line_number: Optional[int] = None
    error_type: str  # "syntax_error" | "missing_package" | "undefined_control_sequence" | "timeout" | "security_violation"
    message: str
    snippet: Optional[str] = None
    missing_package: Optional[str] = None


class CompilePDFRequest(BaseModel):
    """Optional settings when requesting LaTeX compilation."""
    timeout_seconds: Optional[int] = Field(15, ge=0, le=60, description="Compilation timeout in seconds")
    force_recompile: Optional[bool] = Field(False, description="Force fresh compilation even if PDF already exists")


class CompiledPDFResponse(BaseModel):
    """Response returned upon LaTeX compilation attempt."""
    id: str
    resume_version_id: str
    candidate_id: str
    job_id: str
    filename: str
    file_size_bytes: int
    compilation_status: str  # "success" | "failed" | "timeout" | "security_violation"
    compiler_used: str  # "pdflatex" | "latex_native" | "tectonic"
    compilation_log: str
    error_message: Optional[str] = None
    error_details: Optional[CompilationErrorDetail] = None
    compile_duration_ms: int
    download_url: str
    preview_url: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
