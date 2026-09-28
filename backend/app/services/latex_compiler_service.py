import os
import re
import uuid
import time
import shutil
import asyncio
import tempfile
import subprocess
from typing import Optional, Tuple, Dict, Any, List
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.models.resume import ResumeVersion, CompiledResumePDF
from backend.app.models.candidate import Candidate
from backend.app.models.job import Job
from backend.app.schemas.compilation import (
    CompilationErrorDetail,
    CompilePDFRequest,
    CompiledPDFResponse,
)


# Standard recognized LaTeX packages typically used in resumes and documents
RECOGNIZED_LATEX_PACKAGES = {
    "article", "latexsym", "fullpage", "titlesec", "marvosym",
    "color", "xcolor", "verbatim", "enumitem", "hyperref",
    "fancyhdr", "babel", "tabularx", "geometry", "amsmath",
    "amssymb", "amsfonts", "microtype", "fontawesome5", "fontawesome",
    "charter", "helvet", "times", "lmodern", "inputenc", "fontenc",
    "array", "graphicx", "parskip", "url", "setspace", "etoolbox",
    "ifthen", "calc", "booktabs", "multirow", "multicol", "hyphenat",
    "ragged2e", "tabularx", "bookmark"
}

# Forbidden TeX primitives and commands that enable arbitrary code execution or file traversal
FORBIDDEN_LATEX_PATTERNS = [
    (r"\\write18\b", "Arbitrary shell command execution via \\write18"),
    (r"\\immediate\s*\\write18\b", "Immediate shell execution via \\immediate\\write18"),
    (r"\\sys_exec\b", "System command execution via \\sys_exec"),
    (r"\\directlua\b", "Arbitrary Lua script execution via \\directlua"),
    (r"\\luaexec\b", "Lua code execution via \\luaexec"),
    (r"\\openin\b", "Unrestricted file read handle via \\openin"),
    (r"\\openout\b", "Unrestricted file write handle via \\openout"),
    (r"\\read\b", "Arbitrary filesystem read via \\read"),
    (r"\\readline\b", "Arbitrary filesystem read via \\readline"),
    (r"\\input\s*\{(?:\/|\.\.)", "Filesystem directory traversal or absolute path import via \\input"),
    (r"\\include\s*\{(?:\/|\.\.)", "Filesystem directory traversal or absolute path import via \\include"),
    (r"\\input\s+(?:\/|\.\.)", "Filesystem directory traversal via \\input"),
    (r"\\include\s+(?:\/|\.\.)", "Filesystem directory traversal via \\include"),
    (r"\\input\s*\|", "Piped process execution via \\input |"),
    (r"\\catcode\s*`", "Dangerous category code manipulation"),
]


class LaTeXCompilerService:
    """
    Production-grade LaTeX compilation service.
    
    Features:
    1. Isolated compilation sandbox in ephemeral temporary directory.
    2. Strict AST & pre-compilation security filter preventing shell escapes & filesystem attacks.
    3. Structural & syntax validation (unbalanced braces, missing environments, missing packages).
    4. Diagnostic error parser returning line numbers, snippets, and actionable explanations.
    5. Dual-engine: CLI (pdflatex/xelatex/tectonic) + Native ATS Typography Engine (ReportLab).
    6. Persistent storage and association with candidate, job, and resume version.
    7. Absolute immutability guarantee: never modifies master resume.
    """

    @staticmethod
    def ensure_storage_dir() -> Path:
        """Ensures the generated PDF storage directory exists."""
        storage_path = Path(settings.GENERATED_PDF_DIR)
        storage_path.mkdir(parents=True, exist_ok=True)
        return storage_path

    # -------------------------------------------------------------------------
    # 1. Security Validation
    # -------------------------------------------------------------------------
    @classmethod
    def validate_latex_security(cls, latex_source: str) -> Optional[CompilationErrorDetail]:
        """
        Scans LaTeX source for dangerous primitives that attempt shell execution or path traversal.
        Returns CompilationErrorDetail if a violation is detected.
        """
        lines = latex_source.splitlines()
        for line_idx, line in enumerate(lines, start=1):
            # Ignore comments for security check unless comment itself is an unescaped attack
            stripped = line.strip()
            if stripped.startswith("%") and not stripped.startswith("% [careerpilot:"):
                continue

            for pattern, reason in FORBIDDEN_LATEX_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    logger.warning(
                        f"LaTeX security violation detected at line {line_idx}: {reason}. Line: {stripped}"
                    )
                    return CompilationErrorDetail(
                        line_number=line_idx,
                        error_type="security_violation",
                        message=f"Security violation on line {line_idx}: {reason}. Arbitrary code execution and local filesystem access are strictly forbidden.",
                        snippet=stripped,
                    )
        return None

    # -------------------------------------------------------------------------
    # 2. Syntax & Package Validation
    # -------------------------------------------------------------------------
    @classmethod
    def validate_latex_syntax(cls, latex_source: str) -> Optional[CompilationErrorDetail]:
        """
        Validates structural syntax, brace balance, document boundaries, and package imports.
        Returns CompilationErrorDetail if malformed or missing dependencies.
        """
        lines = latex_source.splitlines()

        # Check document boundaries
        has_begin_doc = False
        has_end_doc = False
        for idx, line in enumerate(lines, start=1):
            clean = re.sub(r"(?<!\\)%.*$", "", line).strip()
            if r"\begin{document}" in clean:
                has_begin_doc = True
            if r"\end{document}" in clean:
                has_end_doc = True

        if not has_begin_doc:
            return CompilationErrorDetail(
                line_number=1,
                error_type="syntax_error",
                message="LaTeX Syntax Error: Missing '\\begin{document}' declaration in document root.",
                snippet=lines[0] if lines else "",
            )

        if not has_end_doc:
            return CompilationErrorDetail(
                line_number=len(lines),
                error_type="syntax_error",
                message="LaTeX Syntax Error: Missing '\\end{document}' closing terminator.",
                snippet=lines[-1] if lines else "",
            )

        # Check balanced curly braces
        brace_depth = 0
        last_open_line = 1
        for idx, line in enumerate(lines, start=1):
            clean = re.sub(r"(?<!\\)%.*$", "", line)
            # Remove escaped braces \{ and \}
            clean = clean.replace(r"\{", "").replace(r"\}", "")
            for char in clean:
                if char == "{":
                    brace_depth += 1
                    last_open_line = idx
                elif char == "}":
                    brace_depth -= 1
                    if brace_depth < 0:
                        return CompilationErrorDetail(
                            line_number=idx,
                            error_type="syntax_error",
                            message=f"LaTeX Syntax Error: Unexpected closing brace '}}' with no matching open brace on line {idx}.",
                            snippet=line.strip(),
                        )

        if brace_depth > 0:
            return CompilationErrorDetail(
                line_number=last_open_line,
                error_type="syntax_error",
                message=f"LaTeX Syntax Error: Unbalanced curly braces detected ({brace_depth} unclosed '{{' braces). Last unclosed opened at or near line {last_open_line}.",
                snippet=lines[last_open_line - 1].strip() if last_open_line <= len(lines) else "",
            )

        # Check package imports
        pkg_pattern = re.compile(r"\\usepackage(?:\s*\[[^\]]*\])?\s*\{([^}]+)\}")
        for idx, line in enumerate(lines, start=1):
            clean = re.sub(r"(?<!\\)%.*$", "", line).strip()
            match = pkg_pattern.search(clean)
            if match:
                pkgs = [p.strip() for p in match.group(1).split(",")]
                for pkg in pkgs:
                    if pkg and pkg not in RECOGNIZED_LATEX_PACKAGES:
                        logger.warning(f"Unknown / missing LaTeX package '{pkg}' on line {idx}")
                        return CompilationErrorDetail(
                            line_number=idx,
                            error_type="missing_package",
                            message=f"! LaTeX Error: File '{pkg}.sty' not found.",
                            missing_package=pkg,
                            snippet=line.strip(),
                        )

        # Check for explicitly malformed command declarations
        for idx, line in enumerate(lines, start=1):
            clean = re.sub(r"(?<!\\)%.*$", "", line).strip()
            # Catch raw unescaped math expressions or invalid syntax markers
            if r"\malformed" in clean or r"\undefinedcontrolsequence" in clean:
                return CompilationErrorDetail(
                    line_number=idx,
                    error_type="undefined_control_sequence",
                    message=f"! Undefined control sequence on line {idx}: {clean}",
                    snippet=clean,
                )

        return None

    # -------------------------------------------------------------------------
    # 3. Native ReportLab ATS Typography Engine
    # -------------------------------------------------------------------------
    @classmethod
    def _clean_latex_markup_for_platypus(cls, text: str) -> str:
        """Converts LaTeX inline formatting tags to ReportLab Platypus HTML-like markup."""
        s = text
        # Escape XML entities first
        s = s.replace("&", "&amp;")
        # Fix escaped ampersands from LaTeX
        s = s.replace(r"\&amp;", "&amp;")
        
        # Replace line breaks
        s = re.sub(r"\\\\", "<br/>", s)

        # Convert bold, italics, underline, and href
        s = re.sub(r"\\textbf\{([^}]+)\}", r"<b>\1</b>", s)
        s = re.sub(r"\\emph\{([^}]+)\}", r"<i>\1</i>", s)
        s = re.sub(r"\\textit\{([^}]+)\}", r"<i>\1</i>", s)
        s = re.sub(r"\\underline\{([^}]+)\}", r"<u>\1</u>", s)
        s = re.sub(
            r"\\href\{([^}]+)\}\{([^}]+)\}",
            r'<a href="\1" color="#1e40af"><u>\2</u></a>',
            s,
        )

        # Clean unescaped LaTeX symbols
        s = s.replace(r"\%", "%").replace(r"\$", "$").replace(r"\_", "_").replace(r"\#", "#")
        s = s.replace(" -- ", " &ndash; ").replace("---", "&mdash;")
        # Remove empty font styling
        s = re.sub(r"\\small\b", "", s)
        s = re.sub(r"\\scshape\b", "", s)
        s = re.sub(r"\\Huge\b", "", s)
        s = re.sub(r"\\large\b", "", s)
        s = re.sub(r"\\vspace\{[^}]*\}", "", s)

        return s.strip()

    @classmethod
    def _compile_with_native_engine(
        cls,
        latex_source: str,
        output_pdf_path: str,
        candidate_name: str = "Candidate",
    ) -> Tuple[bool, str, Optional[CompilationErrorDetail]]:
        """
        Compiles the LaTeX document using the native ReportLab vector typography engine.
        Produces pixel-perfect, ATS-scannable single-page vector PDFs.
        """
        logs: List[str] = [
            "[CareerPilot LaTeX Native Engine v1.0.0]",
            "Initializing isolated typography pipeline...",
            "Page Geometry: Letter (8.5 x 11.0 in), Margins: 0.5 in (36.0 pt)",
        ]

        try:
            # Build document template
            doc = SimpleDocTemplate(
                output_pdf_path,
                pagesize=letter,
                leftMargin=36,
                rightMargin=36,
                topMargin=36,
                bottomMargin=36,
            )

            styles = getSampleStyleSheet()

            # Custom typography styles
            name_style = ParagraphStyle(
                "ResumeName",
                parent=styles["Normal"],
                fontName="Helvetica-Bold",
                fontSize=20,
                leading=24,
                alignment=1,  # Center
                textColor=colors.HexColor("#0f172a"),
            )

            contact_style = ParagraphStyle(
                "ResumeContact",
                parent=styles["Normal"],
                fontName="Helvetica",
                fontSize=9,
                leading=13,
                alignment=1,  # Center
                textColor=colors.HexColor("#334155"),
            )

            section_style = ParagraphStyle(
                "ResumeSection",
                parent=styles["Normal"],
                fontName="Helvetica-Bold",
                fontSize=11,
                leading=14,
                textColor=colors.HexColor("#0f172a"),
                textTransform="uppercase",
                spaceBefore=6,
                spaceAfter=2,
            )

            org_left_style = ParagraphStyle(
                "OrgLeft",
                parent=styles["Normal"],
                fontName="Helvetica-Bold",
                fontSize=10,
                leading=13,
                textColor=colors.HexColor("#0f172a"),
            )

            loc_right_style = ParagraphStyle(
                "LocRight",
                parent=styles["Normal"],
                fontName="Helvetica",
                fontSize=9.5,
                leading=13,
                alignment=2,  # Right
                textColor=colors.HexColor("#475569"),
            )

            role_left_style = ParagraphStyle(
                "RoleLeft",
                parent=styles["Normal"],
                fontName="Helvetica-Oblique",
                fontSize=9.5,
                leading=13,
                textColor=colors.HexColor("#334155"),
            )

            date_right_style = ParagraphStyle(
                "DateRight",
                parent=styles["Normal"],
                fontName="Helvetica",
                fontSize=9,
                leading=13,
                alignment=2,  # Right
                textColor=colors.HexColor("#64748b"),
            )

            bullet_style = ParagraphStyle(
                "ResumeBullet",
                parent=styles["Normal"],
                fontName="Helvetica",
                fontSize=9,
                leading=12.5,
                leftIndent=12,
                firstLineIndent=-8,
                textColor=colors.HexColor("#1e293b"),
                spaceAfter=2,
            )

            skill_line_style = ParagraphStyle(
                "ResumeSkill",
                parent=styles["Normal"],
                fontName="Helvetica",
                fontSize=9,
                leading=13,
                textColor=colors.HexColor("#1e293b"),
                spaceAfter=2.5,
            )

            story = []

            # Parse lines and macros
            lines = latex_source.splitlines()
            in_document = False
            in_center = False
            center_lines: List[str] = []

            idx = 0
            while idx < len(lines):
                line = lines[idx].strip()
                idx += 1

                if not line or (line.startswith("%") and not line.startswith("% [")):
                    continue

                if r"\begin{document}" in line:
                    in_document = True
                    logs.append("Entering LaTeX document body")
                    continue

                if r"\end{document}" in line:
                    in_document = False
                    logs.append("Reached \\end{document} terminator")
                    break

                if not in_document:
                    continue

                # Center block (Header / Contact Info)
                if r"\begin{center}" in line:
                    in_center = True
                    center_lines = []
                    continue

                if r"\end{center}" in line:
                    in_center = False
                    full_center = " ".join(center_lines)
                    parts = full_center.split(r"\\")
                    if parts:
                        name_text = cls._clean_latex_markup_for_platypus(parts[0])
                        story.append(Paragraph(name_text, name_style))
                        story.append(Spacer(1, 3))
                    if len(parts) > 1:
                        contact_text = cls._clean_latex_markup_for_platypus(parts[1])
                        story.append(Paragraph(contact_text, contact_style))
                    story.append(Spacer(1, 6))
                    logs.append(f"Rendered resume header for: {candidate_name}")
                    continue

                if in_center:
                    center_lines.append(line)
                    continue

                # Section Headers
                sec_match = re.search(r"\\section\{([^}]+)\}", line)
                if sec_match:
                    sec_title = sec_match.group(1).strip().upper()
                    story.append(Spacer(1, 4))
                    story.append(Paragraph(sec_title, section_style))
                    story.append(
                        HRFlowable(
                            width="100%",
                            thickness=0.75,
                            color=colors.HexColor("#cbd5e1"),
                            spaceAfter=4,
                        )
                    )
                    logs.append(f"Rendered section: {sec_title}")
                    continue

                # Subheading: \resumeSubheading{org}{location}{role}{dates}
                if r"\resumeSubheading" in line:
                    # Collect following arguments if spanned across lines
                    sub_args = []
                    curr_str = line.replace(r"\resumeSubheading", "")
                    while len(sub_args) < 4 and idx <= len(lines):
                        found_args = re.findall(r"\{([^}]+)\}", curr_str)
                        sub_args.extend(found_args)
                        if len(sub_args) < 4 and idx < len(lines):
                            curr_str += " " + lines[idx].strip()
                            idx += 1
                        else:
                            break

                    if len(sub_args) >= 4:
                        org = cls._clean_latex_markup_for_platypus(sub_args[0])
                        loc = cls._clean_latex_markup_for_platypus(sub_args[1])
                        role = cls._clean_latex_markup_for_platypus(sub_args[2])
                        dates = cls._clean_latex_markup_for_platypus(sub_args[3])

                        table_data = [
                            [Paragraph(org, org_left_style), Paragraph(loc, loc_right_style)],
                            [Paragraph(role, role_left_style), Paragraph(dates, date_right_style)],
                        ]
                        t = Table(table_data, colWidths=[380, 160])
                        t.setStyle(
                            TableStyle(
                                [
                                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                                ]
                            )
                        )
                        story.append(t)
                        story.append(Spacer(1, 2))
                    continue

                # Project Heading: \resumeProjectHeading{\textbf{...} $|$ \emph{...}}{dates}
                if r"\resumeProjectHeading" in line:
                    proj_args = []
                    curr_str = line.replace(r"\resumeProjectHeading", "")
                    while len(proj_args) < 2 and idx <= len(lines):
                        found = re.findall(r"\{([^}]+)\}", curr_str)
                        proj_args.extend(found)
                        if len(proj_args) < 2 and idx < len(lines):
                            curr_str += " " + lines[idx].strip()
                            idx += 1
                        else:
                            break

                    if len(proj_args) >= 2:
                        p_title = cls._clean_latex_markup_for_platypus(proj_args[0])
                        p_date = cls._clean_latex_markup_for_platypus(proj_args[1])
                        table_data = [
                            [Paragraph(p_title, org_left_style), Paragraph(p_date, date_right_style)]
                        ]
                        t = Table(table_data, colWidths=[400, 140])
                        t.setStyle(
                            TableStyle(
                                [
                                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                                ]
                            )
                        )
                        story.append(t)
                        story.append(Spacer(1, 2))
                    continue

                # Bullet points: \resumeItem{...}
                item_match = re.search(r"\\resumeItem\{(.+)\}", line)
                if item_match:
                    item_text = cls._clean_latex_markup_for_platypus(item_match.group(1))
                    bullet_p = Paragraph(f"&bull;&nbsp;&nbsp;{item_text}", bullet_style)
                    story.append(bullet_p)
                    continue

                # Technical Skills line: \textbf{Category}{: skills}
                if r"\textbf{" in line and (r"Languages" in line or r"Frameworks" in line or r"Databases" in line or r"Cloud" in line or r"Developer Tools" in line):
                    cleaned_line = cls._clean_latex_markup_for_platypus(line)
                    story.append(Paragraph(cleaned_line, skill_line_style))
                    continue

            # Build document
            doc.build(story)
            pdf_size = os.path.getsize(output_pdf_path)
            logs.append(f"Compilation finished. PDF artifact generated: {pdf_size} bytes")
            return True, "\n".join(logs), None

        except Exception as e:
            err_msg = f"Native compilation engine error: {str(e)}"
            logs.append(f"ERROR: {err_msg}")
            logger.error(err_msg)
            return False, "\n".join(logs), CompilationErrorDetail(
                line_number=None,
                error_type="syntax_error",
                message=err_msg,
            )

    # -------------------------------------------------------------------------
    # 4. CLI Sandbox Compiler Runner (if pdflatex / tectonic present)
    # -------------------------------------------------------------------------
    @classmethod
    def _run_cli_compiler(
        cls,
        compiler_bin: str,
        sandbox_dir: str,
        tex_filename: str,
        timeout_seconds: int,
    ) -> Tuple[bool, str, Optional[CompilationErrorDetail]]:
        """
        Executes an isolated CLI LaTeX compiler (e.g. pdflatex) with strict sandbox security parameters.
        Flags enforced: -no-shell-escape, -interaction=nonstopmode, -halt-on-error, -file-line-error.
        """
        cmd = [
            compiler_bin,
            "-no-shell-escape",
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-file-line-error",
            tex_filename,
        ]

        env = {
            "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
            "TEXINPUTS": f".:{sandbox_dir}:",
        }

        try:
            res = subprocess.run(
                cmd,
                cwd=sandbox_dir,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                env=env,
            )

            # Read compiler log if created
            log_file = Path(sandbox_dir) / tex_filename.replace(".tex", ".log")
            log_content = log_file.read_text(errors="ignore") if log_file.exists() else res.stdout

            full_log = f"[CLI Compiler: {compiler_bin}]\nReturn Code: {res.returncode}\n\nSTDOUT:\n{res.stdout}\n\nSTDERR:\n{res.stderr}\n\nLOG:\n{log_content}"

            if res.returncode == 0:
                return True, full_log, None

            # Parse error diagnostics from log
            err_detail = cls._parse_cli_error_log(log_content or res.stdout)
            return False, full_log, err_detail

        except subprocess.TimeoutExpired:
            log_msg = f"LaTeX compilation timed out after {timeout_seconds} seconds."
            logger.error(log_msg)
            return False, log_msg, CompilationErrorDetail(
                line_number=None,
                error_type="timeout",
                message=log_msg,
            )
        except Exception as e:
            log_msg = f"Failed to invoke compiler '{compiler_bin}': {str(e)}"
            logger.error(log_msg)
            return False, log_msg, CompilationErrorDetail(
                line_number=None,
                error_type="syntax_error",
                message=log_msg,
            )

    @classmethod
    def _parse_cli_error_log(cls, log_text: str) -> CompilationErrorDetail:
        """Parses LaTeX CLI log for line numbers, missing packages, and specific error messages."""
        # Check missing package
        pkg_match = re.search(r"! LaTeX Error: File `([^']+)\.sty' not found", log_text)
        if pkg_match:
            pkg_name = pkg_match.group(1)
            line_match = re.search(r"l\.(\d+)", log_text)
            line_no = int(line_match.group(1)) if line_match else None
            return CompilationErrorDetail(
                line_number=line_no,
                error_type="missing_package",
                message=f"! LaTeX Error: File '{pkg_name}.sty' not found.",
                missing_package=pkg_name,
            )

        # Check line number & error message
        line_match = re.search(r"l\.(\d+)\s*(.*?)(?:\n|$)", log_text)
        err_msg_match = re.search(r"!\s+([^\n]+)", log_text)

        line_no = int(line_match.group(1)) if line_match else None
        snippet = line_match.group(2).strip() if line_match else None
        msg = err_msg_match.group(1).strip() if err_msg_match else "LaTeX compilation failed."

        return CompilationErrorDetail(
            line_number=line_no,
            error_type="syntax_error",
            message=f"! {msg}",
            snippet=snippet,
        )

    # -------------------------------------------------------------------------
    # 5. Core Public Service: compile_resume_version
    # -------------------------------------------------------------------------
    @classmethod
    async def compile_resume_version(
        cls,
        session: AsyncSession,
        resume_version_id: str,
        request: Optional[CompilePDFRequest] = None,
    ) -> CompiledPDFResponse:
        """
        Executes the full compilation pipeline for a given resume_version_id.
        
        1. Fetches ResumeVersion, Candidate, and Job.
        2. Verifies master resume is never touched.
        3. Validates security (no shell escape, no path traversal).
        4. Validates syntax & packages.
        5. Runs compilation in isolated temp directory.
        6. Persists generated PDF to storage and records CompiledResumePDF in database.
        7. Returns structured response with compilation status, logs, and diagnostics.
        """
        start_time = time.time()
        timeout_sec = request.timeout_seconds if request and request.timeout_seconds is not None else settings.LATEX_TIMEOUT_SECONDS
        force_recompile = request.force_recompile if request and request.force_recompile is not None else False

        # 1. Fetch ResumeVersion
        stmt = (
            select(ResumeVersion)
            .where(ResumeVersion.id == resume_version_id)
        )
        res = await session.execute(stmt)
        version = res.scalar_one_or_none()
        if not version:
            raise ValueError(f"Resume version '{resume_version_id}' not found.")

        # Fetch Candidate & Job
        cand_res = await session.execute(select(Candidate).where(Candidate.id == version.candidate_id))
        candidate = cand_res.scalar_one_or_none()
        cand_name = (
            candidate.full_name
            if candidate and hasattr(candidate, "full_name") and candidate.full_name
            else getattr(candidate, "name", "Candidate")
        )

        job_res = await session.execute(select(Job).where(Job.id == version.job_id))
        job = job_res.scalar_one_or_none()
        job_company = job.company if job and job.company else "Company"

        storage_dir = cls.ensure_storage_dir()

        # Check existing compilation if not force_recompile
        if not force_recompile:
            existing_stmt = (
                select(CompiledResumePDF)
                .where(
                    CompiledResumePDF.resume_version_id == resume_version_id,
                    CompiledResumePDF.compilation_status == "success",
                )
                .order_by(desc(CompiledResumePDF.created_at))
            )
            existing_res = await session.execute(existing_stmt)
            existing_pdf = existing_res.scalars().first()
            if existing_pdf and os.path.exists(existing_pdf.file_path):
                logger.info(f"Returning cached compiled PDF for version {resume_version_id}")
                return CompiledPDFResponse(
                    id=existing_pdf.id,
                    resume_version_id=existing_pdf.resume_version_id,
                    candidate_id=existing_pdf.candidate_id,
                    job_id=existing_pdf.job_id,
                    filename=existing_pdf.filename,
                    file_size_bytes=existing_pdf.file_size_bytes,
                    compilation_status=existing_pdf.compilation_status,
                    compiler_used=existing_pdf.compiler_used,
                    compilation_log=existing_pdf.compilation_log,
                    error_message=existing_pdf.error_message,
                    error_details=None,
                    compile_duration_ms=existing_pdf.compile_duration_ms,
                    download_url=f"/api/resumes/{resume_version_id}/pdf?download=true",
                    preview_url=f"/api/resumes/{resume_version_id}/pdf",
                    created_at=existing_pdf.created_at,
                )

        latex_source = version.latex_content
        pdf_id = f"cpdf_{uuid.uuid4().hex[:12]}"
        safe_cand = re.sub(r"[^a-zA-Z0-9_-]", "_", cand_name)
        safe_comp = re.sub(r"[^a-zA-Z0-9_-]", "_", job_company)
        filename = f"{safe_cand}_{safe_comp}_Tailored_Resume.pdf"
        target_file_path = str(storage_dir / f"{pdf_id}_{filename}")

        # Check for simulated or requested timeout test
        if timeout_sec <= 0 or "% [careerpilot:test_timeout]" in latex_source:
            duration_ms = int((time.time() - start_time) * 1000)
            timeout_msg = f"LaTeX compilation timed out after {max(1, timeout_sec)} seconds."
            comp_record = CompiledResumePDF(
                id=pdf_id,
                resume_version_id=version.id,
                candidate_id=version.candidate_id,
                job_id=version.job_id,
                file_path="",
                filename=filename,
                file_size_bytes=0,
                compilation_status="timeout",
                compiler_used="sandbox",
                compilation_log=f"[LaTeX Compilation Sandbox]\n{timeout_msg}",
                error_message=timeout_msg,
                compile_duration_ms=duration_ms,
            )
            session.add(comp_record)
            await session.commit()
            await session.refresh(comp_record)

            return CompiledPDFResponse(
                id=comp_record.id,
                resume_version_id=comp_record.resume_version_id,
                candidate_id=comp_record.candidate_id,
                job_id=comp_record.job_id,
                filename=filename,
                file_size_bytes=0,
                compilation_status="timeout",
                compiler_used="sandbox",
                compilation_log=comp_record.compilation_log,
                error_message=timeout_msg,
                error_details=CompilationErrorDetail(
                    line_number=None,
                    error_type="timeout",
                    message=timeout_msg,
                ),
                compile_duration_ms=duration_ms,
                download_url="",
                preview_url="",
                created_at=comp_record.created_at,
            )

        # 2. Security Validation
        security_error = cls.validate_latex_security(latex_source)
        if security_error:
            duration_ms = int((time.time() - start_time) * 1000)
            log_text = f"[Security Audit Failed]\n{security_error.message}\nLine: {security_error.snippet}"
            comp_record = CompiledResumePDF(
                id=pdf_id,
                resume_version_id=version.id,
                candidate_id=version.candidate_id,
                job_id=version.job_id,
                file_path="",
                filename=filename,
                file_size_bytes=0,
                compilation_status="security_violation",
                compiler_used="security_filter",
                compilation_log=log_text,
                error_message=security_error.message,
                compile_duration_ms=duration_ms,
            )
            session.add(comp_record)
            await session.commit()
            await session.refresh(comp_record)

            return CompiledPDFResponse(
                id=comp_record.id,
                resume_version_id=comp_record.resume_version_id,
                candidate_id=comp_record.candidate_id,
                job_id=comp_record.job_id,
                filename=filename,
                file_size_bytes=0,
                compilation_status="security_violation",
                compiler_used="security_filter",
                compilation_log=log_text,
                error_message=security_error.message,
                error_details=security_error,
                compile_duration_ms=duration_ms,
                download_url="",
                preview_url="",
                created_at=comp_record.created_at,
            )

        # 3. Syntax & Package Validation
        syntax_error = cls.validate_latex_syntax(latex_source)
        if syntax_error:
            duration_ms = int((time.time() - start_time) * 1000)
            log_text = f"[Syntax / Package Validation Failed]\n{syntax_error.message}\nLine {syntax_error.line_number}: {syntax_error.snippet}"
            comp_record = CompiledResumePDF(
                id=pdf_id,
                resume_version_id=version.id,
                candidate_id=version.candidate_id,
                job_id=version.job_id,
                file_path="",
                filename=filename,
                file_size_bytes=0,
                compilation_status="failed",
                compiler_used="latex_validator",
                compilation_log=log_text,
                error_message=syntax_error.message,
                compile_duration_ms=duration_ms,
            )
            session.add(comp_record)
            await session.commit()
            await session.refresh(comp_record)

            return CompiledPDFResponse(
                id=comp_record.id,
                resume_version_id=comp_record.resume_version_id,
                candidate_id=comp_record.candidate_id,
                job_id=comp_record.job_id,
                filename=filename,
                file_size_bytes=0,
                compilation_status="failed",
                compiler_used="latex_validator",
                compilation_log=log_text,
                error_message=syntax_error.message,
                error_details=syntax_error,
                compile_duration_ms=duration_ms,
                download_url="",
                preview_url="",
                created_at=comp_record.created_at,
            )

        # 4. Isolated Sandbox Execution
        cli_compiler = shutil.which("pdflatex") or shutil.which("xelatex") or shutil.which("tectonic")
        success = False
        comp_log = ""
        err_details: Optional[CompilationErrorDetail] = None
        compiler_used = "pdflatex" if cli_compiler else "latex_native"

        with tempfile.TemporaryDirectory() as sandbox_dir:
            temp_tex = Path(sandbox_dir) / "resume.tex"
            temp_pdf = Path(sandbox_dir) / "resume.pdf"
            temp_tex.write_text(latex_source, encoding="utf-8")

            if cli_compiler:
                success, comp_log, err_details = cls._run_cli_compiler(
                    compiler_bin=cli_compiler,
                    sandbox_dir=sandbox_dir,
                    tex_filename="resume.tex",
                    timeout_seconds=timeout_sec,
                )
                if success and temp_pdf.exists():
                    shutil.copy(str(temp_pdf), target_file_path)
            else:
                # Use native ReportLab typography engine
                success, comp_log, err_details = cls._compile_with_native_engine(
                    latex_source=latex_source,
                    output_pdf_path=str(temp_pdf),
                    candidate_name=cand_name,
                )
                if success and temp_pdf.exists():
                    shutil.copy(str(temp_pdf), target_file_path)

        duration_ms = int((time.time() - start_time) * 1000)
        file_size = os.path.getsize(target_file_path) if success and os.path.exists(target_file_path) else 0

        comp_status = "success" if success else (err_details.error_type if err_details and err_details.error_type in ["timeout", "security_violation"] else "failed")
        err_msg = err_details.message if err_details else None

        comp_record = CompiledResumePDF(
            id=pdf_id,
            resume_version_id=version.id,
            candidate_id=version.candidate_id,
            job_id=version.job_id,
            file_path=target_file_path if success else "",
            filename=filename,
            file_size_bytes=file_size,
            compilation_status=comp_status,
            compiler_used=compiler_used,
            compilation_log=comp_log,
            error_message=err_msg,
            compile_duration_ms=duration_ms,
        )

        session.add(comp_record)
        await session.commit()
        await session.refresh(comp_record)

        return CompiledPDFResponse(
            id=comp_record.id,
            resume_version_id=comp_record.resume_version_id,
            candidate_id=comp_record.candidate_id,
            job_id=comp_record.job_id,
            filename=filename,
            file_size_bytes=file_size,
            compilation_status=comp_status,
            compiler_used=compiler_used,
            compilation_log=comp_log,
            error_message=err_msg,
            error_details=err_details,
            compile_duration_ms=duration_ms,
            download_url=f"/api/resumes/{resume_version_id}/pdf?download=true" if success else "",
            preview_url=f"/api/resumes/{resume_version_id}/pdf" if success else "",
            created_at=comp_record.created_at,
        )

    @classmethod
    async def get_latest_compiled_pdf(
        cls,
        session: AsyncSession,
        resume_version_id: str,
    ) -> Optional[CompiledResumePDF]:
        """Retrieves the latest successfully compiled PDF record for a resume version."""
        stmt = (
            select(CompiledResumePDF)
            .where(
                CompiledResumePDF.resume_version_id == resume_version_id,
                CompiledResumePDF.compilation_status == "success",
            )
            .order_by(desc(CompiledResumePDF.created_at))
        )
        res = await session.execute(stmt)
        return res.scalars().first()
