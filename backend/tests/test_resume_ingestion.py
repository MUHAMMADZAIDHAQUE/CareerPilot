import pytest
import io
from pathlib import Path
from httpx import AsyncClient
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from backend.app.services.resume_parser_service import ResumeParserService


def generate_sample_pdf() -> bytes:
    """Generates a valid test PDF in memory using reportlab."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    
    # Title / Header
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, 750, "Diana Prince")
    c.setFont("Helvetica", 10)
    c.drawString(50, 735, "Email: diana.prince@themyscira.io | Phone: +1 (555) 382-9102")
    c.drawString(50, 720, "Location: Washington, DC | https://github.com/dianaprince")

    # Summary
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 690, "Summary")
    c.setFont("Helvetica", 10)
    c.drawString(50, 675, "Principal Systems Architect with expertise in distributed security and cloud.")

    # Experience
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 645, "Experience")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, 630, "Themyscira Global Security | Washington, DC")
    c.setFont("Helvetica", 9)
    c.drawString(50, 615, "Lead Security Architect | Jan 2021 - Present")
    c.drawString(60, 600, "• Designed zero-trust distributed mesh security protocol using Python and Go.")
    c.drawString(60, 585, "• Managed cryptographic infrastructure supporting 5M+ daily transactions.")

    # Education
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 555, "Education")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, 540, "Columbia University | New York, NY")
    c.setFont("Helvetica", 9)
    c.drawString(50, 525, "Master of Science in Cybersecurity | GPA: 3.95")

    # Skills
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 495, "Technical Skills")
    c.setFont("Helvetica", 9)
    c.drawString(50, 480, "Languages: Python, Go, SQL, TypeScript, Rust")
    c.drawString(50, 465, "Technologies: Docker, Kubernetes, AWS, PostgreSQL, FastAPI")

    c.save()
    buf.seek(0)
    return buf.read()


@pytest.mark.asyncio
async def test_latex_resume_upload(async_client: AsyncClient):
    """Tests uploading a master LaTeX (.tex) resume."""
    latex_path = Path("resume/master/sample_master_resume.tex")
    assert latex_path.exists(), "Master sample resume template must exist"

    with open(latex_path, "rb") as f:
        file_content = f.read()

    files = {
        "file": ("sample_master_resume.tex", file_content, "application/x-tex")
    }

    # 1. Upload LaTeX resume
    response = await async_client.post("/api/resume/upload", files=files)
    assert response.status_code == 200, response.text
    data = response.json()

    saved_path = Path(data["storage_path"])
    try:
        assert data["file_type"] == "tex"
        assert data["is_latex"] is True
        assert "Alex Mercer" in data["structured_candidate_data"]["full_name"]
        assert "alex.mercer@example.com" == data["structured_candidate_data"]["email"]
        assert len(data["structured_candidate_data"]["skills"]) > 0
        assert len(data["structured_candidate_data"]["experience"]) > 0
        assert len(data["structured_candidate_data"]["education"]) > 0

        # Verify master copy exists in resume/master/
        assert saved_path.exists()
        assert saved_path.suffix == ".tex" or "master" in str(saved_path)

        # 2. Confirm and apply to candidate profile
        confirm_payload = {
            "document_id": data["document_id"],
            "candidate_data": data["structured_candidate_data"],
            "replace_existing": True,
        }
        confirm_res = await async_client.post("/api/resume/confirm", json=confirm_payload)
        assert confirm_res.status_code == 200, confirm_res.text
        candidate = confirm_res.json()["candidate"]
        assert candidate["email"] == "alex.mercer@example.com"
        assert len(candidate["experiences"]) >= 1
    finally:
        if saved_path.exists() and saved_path.name != "sample_master_resume.tex":
            saved_path.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_pdf_resume_upload(async_client: AsyncClient):
    """Tests uploading and parsing a PDF resume."""
    pdf_bytes = generate_sample_pdf()
    files = {
        "file": ("diana_prince_resume.pdf", pdf_bytes, "application/pdf")
    }

    response = await async_client.post("/api/resume/upload", files=files)
    assert response.status_code == 200, response.text
    data = response.json()
    saved_path = Path(data["storage_path"])
    try:
        assert data["file_type"] == "pdf"
        assert "diana.prince@themyscira.io" in data["extracted_text"]
        assert data["structured_candidate_data"]["email"] == "diana.prince@themyscira.io"
        assert "Diana Prince" in data["structured_candidate_data"]["full_name"]

        # Verify extracted skills contain Python, Go, Docker, AWS
        skill_names = [s["name"] for s in data["structured_candidate_data"]["skills"]]
        assert any(s.lower() == "python" for s in skill_names)
        assert any(s.lower() == "docker" for s in skill_names)
    finally:
        if saved_path.exists():
            saved_path.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_plain_text_resume_upload(async_client: AsyncClient):
    """Tests uploading and parsing a plain text (.txt) resume."""
    text_content = """
Arthur Curry
Email: arthur.curry@atlantis.org
Phone: (555) 234-5678
Location: Boston, MA
https://github.com/arthurcurry

=== SUMMARY ===
Senior Infrastructure and Marine Telemetry Engineer with 5 years experience.

=== EXPERIENCE ===
Atlantis Deep Tech | Boston, MA
Telemetry Architect | 2021 - Present
• Engineered acoustic underwater telemetry transmission mesh in Python and C++.
• Scaled data ingestion pipelines to 50k packets per second.

=== EDUCATION ===
MIT | Cambridge, MA
B.S. in Marine Engineering | 2016 - 2020

=== SKILLS ===
Languages: Python, C++, SQL
Technologies: Docker, Linux, Kafka, PostgreSQL
    """.encode("utf-8")

    files = {
        "file": ("resume.txt", text_content, "text/plain")
    }

    response = await async_client.post("/api/resume/upload", files=files)
    assert response.status_code == 200, response.text
    data = response.json()
    saved_path = Path(data["storage_path"])
    try:
        assert data["file_type"] == "txt"
        assert data["structured_candidate_data"]["full_name"] == "Arthur Curry"
        assert data["structured_candidate_data"]["email"] == "arthur.curry@atlantis.org"
        assert len(data["structured_candidate_data"]["experience"]) == 1
    finally:
        if saved_path.exists():
            saved_path.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_invalid_file_extension(async_client: AsyncClient):
    """Tests rejection of invalid file extensions."""
    files = {
        "file": ("malicious_executable.exe", b"fake binary", "application/octet-stream")
    }
    response = await async_client.post("/api/resume/upload", files=files)
    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["message"]


@pytest.mark.asyncio
async def test_empty_file_upload(async_client: AsyncClient):
    """Tests rejection of 0-byte file upload."""
    files = {
        "file": ("empty_resume.pdf", b"", "application/pdf")
    }
    response = await async_client.post("/api/resume/upload", files=files)
    assert response.status_code == 400
    assert "Uploaded file is empty" in response.json()["message"]
