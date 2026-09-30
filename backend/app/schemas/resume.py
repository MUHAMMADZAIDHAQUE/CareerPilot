from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from backend.app.schemas.candidate import StructuredResumeImport, CandidateRead


class ResumeDocumentRead(BaseModel):
    id: str
    candidate_id: Optional[str] = None
    filename: str
    file_type: str
    storage_path: str
    extracted_text: str
    version: int
    created_at: datetime
    metadata_json: Dict[str, Any] = Field(default_factory=dict)
    model_config = ConfigDict(from_attributes=True)


class ResumeUploadResponse(BaseModel):
    document_id: str
    filename: str
    file_type: str
    storage_path: str
    extracted_text: str
    structured_candidate_data: StructuredResumeImport
    is_latex: bool = False
    master_template_saved: bool = False
    message: str = Field(
        "Resume extracted successfully. Review the structured data below before confirming permanent update to your profile."
    )


class ResumeConfirmRequest(BaseModel):
    document_id: str
    candidate_data: StructuredResumeImport
    candidate_id: Optional[str] = Field(
        None,
        description="Optional candidate ID to associate and apply structured profile to."
    )
    replace_existing: bool = Field(
        True,
        description="Whether to replace or update existing profile sections."
    )


class ResumeConfirmResponse(BaseModel):
    success: bool = True
    candidate: CandidateRead
    document_id: str
    message: str = "Candidate profile updated and verified successfully from resume source."
