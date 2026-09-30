from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from pathlib import Path

from backend.app.api.deps import get_db, get_optional_current_user, verify_resource_ownership
from backend.app.models.user import User, UserRole
from backend.app.services.resume_parser_service import ResumeParserService
from backend.app.services.profile_service import ProfileService
from backend.app.schemas.resume import (
    ResumeUploadResponse,
    ResumeConfirmRequest,
    ResumeConfirmResponse,
    ResumeDocumentRead,
)
from backend.app.schemas.tailoring import (
    TailorResumeRequest,
    TailorResumeResponse,
    ResumeVersionRead,
    ApproveResumeRequest,
    ApproveResumeResponse,
    RejectResumeRequest,
    RejectResumeResponse,
    UpdateLatexRequest,
    ResumeDiffResponse,
)
from backend.app.services.resume_tailor_service import ResumeTailorService
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


@router.post(
    "/tailor/{job_id}",
    response_model=TailorResumeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate Job-Specific Tailored LaTeX Resume",
    description="Evidence-based resume tailoring agent. Produces grounded LaTeX resume, verifies with Validator Agent, and records structured diffs.",
)
async def tailor_resume_for_job(
    job_id: str,
    payload: Optional[TailorResumeRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> TailorResumeResponse:
    try:
        return await ResumeTailorService.tailor_resume_for_job(
            session=db,
            job_id=job_id,
            payload=payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Tailoring resume failed for job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Resume tailoring error: {str(e)}",
        )


@router.get(
    "/tailor/{job_id}",
    response_model=Optional[ResumeVersionRead],
    summary="Get Latest Tailored Resume Version for Job",
)
async def get_latest_tailored_resume(
    job_id: str,
    candidate_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> Optional[ResumeVersionRead]:
    record = await ResumeTailorService.get_latest_tailored_version(
        session=db,
        job_id=job_id,
        candidate_id=candidate_id,
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No tailored resume version found for job {job_id}",
        )
    return record


@router.get(
    "/versions",
    response_model=List[ResumeVersionRead],
    summary="List Tailored Resume Versions",
)
async def list_tailored_resume_versions(
    candidate_id: Optional[str] = Query(None),
    job_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> List[ResumeVersionRead]:
    # Multi-user isolation: Candidate can only list their own resume versions
    if isinstance(current_user, User) and current_user.role != UserRole.ADMIN and current_user.candidate:
        candidate_id = current_user.candidate.id
    return await ResumeTailorService.list_versions(
        session=db,
        candidate_id=candidate_id,
        job_id=job_id,
        limit=limit,
    )


@router.get(
    "/versions/{version_id}",
    response_model=ResumeVersionRead,
    summary="Get Specific Tailored Resume Version by ID",
)
async def get_tailored_resume_version(
    version_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> ResumeVersionRead:
    record = await ResumeTailorService.get_version_by_id(
        session=db,
        version_id=version_id,
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume version '{version_id}' not found",
        )
    verify_resource_ownership(record.candidate_id, current_user)
    return record


# -----------------------------------------------------------------------------
# Pluralized Alias Router (/api/resumes/...)
# -----------------------------------------------------------------------------
resumes_router = APIRouter(prefix="/resumes", tags=["Resume Tailoring (Plural Alias)"])


@resumes_router.post(
    "/tailor/{job_id}",
    response_model=TailorResumeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate Job-Specific Tailored LaTeX Resume (Alias)",
)
async def tailor_resume_for_job_alias(
    job_id: str,
    payload: Optional[TailorResumeRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> TailorResumeResponse:
    return await tailor_resume_for_job(job_id=job_id, payload=payload, db=db)


@resumes_router.get(
    "/tailor/{job_id}",
    response_model=Optional[ResumeVersionRead],
    summary="Get Latest Tailored Resume Version for Job (Alias)",
)
async def get_latest_tailored_resume_alias(
    job_id: str,
    candidate_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> Optional[ResumeVersionRead]:
    return await get_latest_tailored_resume(job_id=job_id, candidate_id=candidate_id, db=db)


from fastapi.responses import FileResponse
from backend.app.schemas.compilation import CompilePDFRequest, CompiledPDFResponse
from backend.app.services.latex_compiler_service import LaTeXCompilerService


@resumes_router.get(
    "/versions",
    response_model=List[ResumeVersionRead],
    summary="List Tailored Resume Versions (Alias)",
)
async def list_tailored_resume_versions_alias(
    candidate_id: Optional[str] = Query(None),
    job_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> List[ResumeVersionRead]:
    return await list_tailored_resume_versions(
        candidate_id=candidate_id,
        job_id=job_id,
        limit=limit,
        db=db,
    )


@resumes_router.get(
    "/versions/{version_id}",
    response_model=ResumeVersionRead,
    summary="Get Specific Tailored Resume Version by ID (Alias)",
)
async def get_tailored_resume_version_alias(
    version_id: str,
    db: AsyncSession = Depends(get_db),
) -> ResumeVersionRead:
    return await get_tailored_resume_version(version_id=version_id, db=db)


# -----------------------------------------------------------------------------
# LaTeX Compilation Endpoints (Phase 7)
# -----------------------------------------------------------------------------

@resumes_router.post(
    "/{resume_version_id}/compile",
    response_model=CompiledPDFResponse,
    status_code=status.HTTP_200_OK,
    summary="Compile Tailored LaTeX Resume to PDF",
)
async def compile_resume_version(
    resume_version_id: str,
    payload: Optional[CompilePDFRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> CompiledPDFResponse:
    """
    Compiles a validated tailored LaTeX resume into a publication-grade PDF.
    Runs in an isolated sandbox, enforces security constraints, captures logs,
    and associates the generated PDF with the candidate, job, and resume version.
    """
    try:
        return await LaTeXCompilerService.compile_resume_version(
            session=db,
            resume_version_id=resume_version_id,
            request=payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error compiling resume version '{resume_version_id}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LaTeX compilation system failure: {str(e)}",
        )


@resumes_router.get(
    "/{resume_version_id}/pdf",
    summary="Download or Preview Compiled Resume PDF",
)
async def get_resume_version_pdf(
    resume_version_id: str,
    download: bool = Query(False, description="Set to true to force file download attachment"),
    db: AsyncSession = Depends(get_db),
):
    """
    Streams the latest compiled PDF artifact for a resume version.
    Returns inline preview by default or attachment if download=true.
    """
    pdf_record = await LaTeXCompilerService.get_latest_compiled_pdf(
        session=db,
        resume_version_id=resume_version_id,
    )
    if not pdf_record or not Path(pdf_record.file_path).exists():
        # Auto-compile on the fly from persistent database LaTeX source if file is missing after restart
        try:
            comp_res = await LaTeXCompilerService.compile_latex(
                session=db,
                resume_version_id=resume_version_id,
            )
            if comp_res.compilation_status == "success":
                pdf_record = await LaTeXCompilerService.get_latest_compiled_pdf(
                    session=db,
                    resume_version_id=resume_version_id,
                )
        except Exception as compile_err:
            pass

    if not pdf_record or not Path(pdf_record.file_path).exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No compiled PDF found for resume version '{resume_version_id}'. Please trigger compilation first.",
        )

    disposition = "attachment" if download else "inline"
    return FileResponse(
        path=pdf_record.file_path,
        media_type="application/pdf",
        filename=pdf_record.filename,
        headers={"Content-Disposition": f'{disposition}; filename="{pdf_record.filename}"'},
    )


# Singular Router Aliases (/api/resume/...)
@router.post(
    "/{resume_version_id}/compile",
    response_model=CompiledPDFResponse,
    status_code=status.HTTP_200_OK,
    summary="Compile Tailored LaTeX Resume to PDF (Singular Alias)",
)
async def compile_resume_version_singular(
    resume_version_id: str,
    payload: Optional[CompilePDFRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> CompiledPDFResponse:
    return await compile_resume_version(resume_version_id=resume_version_id, payload=payload, db=db)


@router.get(
    "/{resume_version_id}/pdf",
    summary="Download or Preview Compiled Resume PDF (Singular Alias)",
)
async def get_resume_version_pdf_singular(
    resume_version_id: str,
    download: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    return await get_resume_version_pdf(resume_version_id=resume_version_id, download=download, db=db)


# =============================================================================
# Phase 17 Tailored Resume Endpoints (/api/v1/resumes/tailored/...)
# =============================================================================

@resumes_router.post(
    "/tailor",
    response_model=TailorResumeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate Tailored Resume from Request Body",
    description="Initiates end-to-end tailoring pipeline using verified candidate facts and specified Job ID.",
)
async def tailor_resume_direct(
    payload: TailorResumeRequest,
    db: AsyncSession = Depends(get_db),
) -> TailorResumeResponse:
    if not payload.job_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Field 'job_id' is required in request payload.",
        )
    try:
        return await ResumeTailorService.tailor_resume_for_job(
            session=db,
            job_id=payload.job_id,
            payload=payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Tailoring resume failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Resume tailoring failure: {str(e)}",
        )


@resumes_router.get(
    "/tailored",
    response_model=List[ResumeVersionRead],
    summary="List Tailored Resumes",
    description="Retrieves tailored resume versions filtered optionally by candidate, job, or approval status.",
)
async def list_tailored_resumes(
    candidate_id: Optional[str] = Query(None),
    job_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> List[ResumeVersionRead]:
    return await ResumeTailorService.list_versions(
        session=db,
        candidate_id=candidate_id,
        job_id=job_id,
        status=status,
        limit=limit,
    )


@resumes_router.get(
    "/tailored/{version_id}",
    response_model=ResumeVersionRead,
    summary="Get Specific Tailored Resume Version",
)
async def get_tailored_resume_by_id(
    version_id: str,
    db: AsyncSession = Depends(get_db),
) -> ResumeVersionRead:
    record = await ResumeTailorService.get_version_by_id(session=db, version_id=version_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tailored resume version '{version_id}' not found.",
        )
    return record


@resumes_router.post(
    "/tailored/{version_id}/generate",
    response_model=TailorResumeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Regenerate Tailored Resume Version",
)
async def regenerate_tailored_resume(
    version_id: str,
    payload: Optional[TailorResumeRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> TailorResumeResponse:
    existing = await ResumeTailorService.get_version_by_id(session=db, version_id=version_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tailored resume version '{version_id}' not found.",
        )
    req = payload or TailorResumeRequest(
        job_id=existing.job_id,
        candidate_id=existing.candidate_id,
        master_resume_id=existing.source_resume_id,
    )
    return await ResumeTailorService.tailor_resume_for_job(
        session=db,
        job_id=existing.job_id,
        payload=req,
    )


@resumes_router.post(
    "/tailored/{version_id}/compile",
    response_model=CompiledPDFResponse,
    status_code=status.HTTP_200_OK,
    summary="Compile Tailored Resume to PDF",
)
async def compile_tailored_resume(
    version_id: str,
    payload: Optional[CompilePDFRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> CompiledPDFResponse:
    return await compile_resume_version(resume_version_id=version_id, payload=payload, db=db)


@resumes_router.get(
    "/tailored/{version_id}/pdf",
    summary="Download or Preview Tailored Resume PDF",
)
async def get_tailored_resume_pdf(
    version_id: str,
    download: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    return await get_resume_version_pdf(resume_version_id=version_id, download=download, db=db)


@resumes_router.get(
    "/tailored/{version_id}/diff",
    response_model=ResumeDiffResponse,
    summary="Get Categorized Diff between Master and Tailored Resume",
)
async def get_tailored_resume_diff(
    version_id: str,
    db: AsyncSession = Depends(get_db),
) -> ResumeDiffResponse:
    try:
        return await ResumeTailorService.get_categorized_diff(session=db, version_id=version_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error computing resume diff: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Diff generation failed: {str(e)}",
        )


@resumes_router.post(
    "/tailored/{version_id}/approve",
    response_model=ApproveResumeResponse,
    summary="Approve Tailored Resume (Requires Explicit User Action)",
)
async def approve_tailored_resume(
    version_id: str,
    payload: Optional[ApproveResumeRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> ApproveResumeResponse:
    try:
        notes = payload.notes if payload else None
        version = await ResumeTailorService.approve_resume(session=db, version_id=version_id, notes=notes)
        app_at = (
            version.approved_at.isoformat()
            if hasattr(version.approved_at, "isoformat")
            else str(version.approved_at or "")
        )
        return ApproveResumeResponse(
            success=True,
            status="APPROVED",
            approved_at=app_at,
            message="Resume approved successfully. Ready for application (no application was auto-submitted).",
            ready_for_application=True,
            auto_applied=False,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error approving resume version: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Approval failed: {str(e)}",
        )


@resumes_router.post(
    "/tailored/{version_id}/reject",
    response_model=RejectResumeResponse,
    summary="Reject Tailored Resume",
)
async def reject_tailored_resume(
    version_id: str,
    payload: Optional[RejectResumeRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> RejectResumeResponse:
    try:
        reason = payload.reason if payload else None
        version = await ResumeTailorService.reject_resume(session=db, version_id=version_id, reason=reason)
        return RejectResumeResponse(
            success=True,
            status="REJECTED",
            message=f"Resume version marked as REJECTED: {reason or 'No reason provided.'}",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error rejecting resume version: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Rejection failed: {str(e)}",
        )


@resumes_router.patch(
    "/tailored/{version_id}/latex",
    response_model=ResumeVersionRead,
    summary="Update LaTeX Source with Manual User Edits",
)
async def update_tailored_resume_latex(
    version_id: str,
    payload: UpdateLatexRequest,
    db: AsyncSession = Depends(get_db),
) -> ResumeVersionRead:
    try:
        version = await ResumeTailorService.update_latex(
            session=db,
            version_id=version_id,
            new_latex=payload.latex_content,
        )
        return ResumeVersionRead.model_validate(version)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating resume LaTeX: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LaTeX update failed: {str(e)}",
        )



