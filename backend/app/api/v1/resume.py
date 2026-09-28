from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from pathlib import Path

from backend.app.api.deps import get_db
from backend.app.services.resume_parser_service import ResumeParserService
from backend.app.services.profile_service import ProfileService
from backend.app.schemas.resume import (
    ResumeUploadResponse,
    ResumeConfirmRequest,
    ResumeConfirmResponse,
    ResumeDocumentRead,
)
from backend.app.schemas.candidate import CandidateRead
from backend.app.models.resume import ResumeDocument
from sqlalchemy import select
from backend.app.core.logging import logger

router = APIRouter(prefix="/resume", tags=["Resume Ingestion & Processing"])

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".pdf", ".tex", ".txt", ".md", ".latex"}


@router.post(
    "/upload",
    response_model=ResumeUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload & Extract Resume",
    description="Accepts a PDF, LaTeX (.tex), or plain text resume, extracts and parses structured information, saves master copy, and returns structured data for user review.",
)
async def upload_resume(
    file: UploadFile = File(..., description="Resume file (.pdf, .tex, .txt, .md)"),
    candidate_id: Optional[str] = Form(None, description="Optional Candidate ID to associate"),
    db: AsyncSession = Depends(get_db),
) -> ResumeUploadResponse:
    filename = file.filename or "uploaded_resume.pdf"
    ext = Path(filename).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Supported formats: .pdf, .tex, .txt, .md",
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds the 10 MB maximum limit.",
        )

    try:
        resume_doc, structured_data, master_saved = await ResumeParserService.process_resume_upload(
            session=db,
            file_bytes=file_bytes,
            filename=filename,
            content_type=file.content_type,
            candidate_id=candidate_id,
        )

        return ResumeUploadResponse(
            document_id=resume_doc.id,
            filename=resume_doc.filename,
            file_type=resume_doc.file_type,
            storage_path=resume_doc.storage_path,
            extracted_text=resume_doc.extracted_text,
            structured_candidate_data=structured_data,
            is_latex=(resume_doc.file_type == "tex"),
            master_template_saved=master_saved,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Resume extraction failed for {filename}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Resume extraction error: {str(e)}",
        )


@router.post(
    "/confirm",
    response_model=ResumeConfirmResponse,
    status_code=status.HTTP_200_OK,
    summary="Confirm & Apply Resume to Candidate Profile",
    description="Applies verified and human-reviewed structured resume data permanently to the candidate profile.",
)
async def confirm_resume_import(
    request: ResumeConfirmRequest,
    db: AsyncSession = Depends(get_db),
) -> ResumeConfirmResponse:
    try:
        candidate = await ResumeParserService.confirm_and_apply_resume(
            session=db,
            document_id=request.document_id,
            candidate_data=request.candidate_data,
        )

        return ResumeConfirmResponse(
            success=True,
            candidate=candidate,
            document_id=request.document_id,
            message=f"Successfully imported profile for {candidate.full_name}.",
        )
    except Exception as e:
        logger.error(f"Failed to confirm resume import: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply resume to profile: {str(e)}",
        )


@router.get(
    "/documents",
    response_model=List[ResumeDocumentRead],
    summary="List Uploaded Resume Documents",
)
async def list_resume_documents(
    candidate_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> List[ResumeDocumentRead]:
    stmt = select(ResumeDocument)
    if candidate_id:
        stmt = stmt.where(ResumeDocument.candidate_id == candidate_id)
    stmt = stmt.order_by(ResumeDocument.created_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())
