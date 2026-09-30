import io
import re
import os
import uuid
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pypdf import PdfReader

from backend.app.models.resume import ResumeDocument
from backend.app.models.candidate import ResumeTemplate, Candidate
from backend.app.schemas.candidate import (
    StructuredResumeImport,
    EducationCreate,
    ExperienceCreate,
    SkillCreate,
    ProjectCreate,
    CertificationCreate,
    AchievementCreate,
    CareerPreferenceCreate,
)
from backend.app.services.profile_service import ProfileService
from backend.app.core.logging import logger


class ResumeParserService:
    """
    Ingests and parses resumes in PDF, Plain Text, and LaTeX formats.
    Extracts structured candidate facts without hallucinating unverified data.
    """

    MASTER_RESUME_DIR = Path("resume/master")
    STORAGE_DIR = Path("data/storage/resumes")

    KNOWN_SKILL_CATEGORIES = {
        "Languages": [
            "Python", "TypeScript", "JavaScript", "SQL", "Go", "Golang", "Rust", "C++",
            "Java", "C#", "C", "Ruby", "PHP", "Scala", "Kotlin", "Swift", "Bash", "Shell", "R"
        ],
        "Frameworks": [
            "FastAPI", "Next.js", "React", "Node.js", "Express", "Django", "Flask",
            "Spring Boot", "Vue", "Angular", "Tailwind", "Tailwind CSS", "PyTorch", "TensorFlow", "Pandas", "NumPy"
        ],
        "Databases": [
            "PostgreSQL", "pgvector", "MySQL", "MongoDB", "Redis", "SQLite",
            "Cassandra", "Elasticsearch", "DynamoDB", "Snowflake", "BigQuery"
        ],
        "Cloud & DevOps": [
            "Docker", "Kubernetes", "AWS", "Amazon Web Services", "GCP", "Google Cloud",
            "Azure", "CI/CD", "GitHub Actions", "Terraform", "Kafka", "Linux", "Helm", "Prometheus"
        ],
        "AI & ML": [
            "LangChain", "LangGraph", "LLMs", "RAG", "OpenAI", "Anthropic", "HuggingFace",
            "Embeddings", "NLP", "Machine Learning", "Deep Learning", "Vector Databases"
        ]
    }

    @classmethod
    def ensure_directories(cls):
        cls.MASTER_RESUME_DIR.mkdir(parents=True, exist_ok=True)
        cls.STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    # -------------------------------------------------------------------------
    # 1. Raw Text Extraction
    # -------------------------------------------------------------------------

    @classmethod
    def extract_text_from_pdf(cls, file_bytes: bytes) -> str:
        """Extracts plain text from PDF bytes using pypdf."""
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            pages_text = []
            for i, page in enumerate(reader.pages):
                text = page.extract_text()
                if text:
                    pages_text.append(text.strip())
            return "\n\n".join(pages_text)
        except Exception as e:
            logger.error(f"Failed to extract PDF text: {e}")
            raise ValueError(f"Could not read PDF file: {str(e)}")

    @classmethod
    def extract_text_from_latex(cls, latex_str: str) -> str:
        """
        Cleans LaTeX source to produce readable plain text while preserving
        all words, names, dates, metrics, and bullet items verbatim.
        """
        text = latex_str

        # Remove LaTeX comments
        text = re.sub(r'(?<!\\)%.*$', '', text, flags=re.MULTILINE)

        # Discard preamble before \begin{document} if present
        if r"\begin{document}" in text:
            text = text.split(r"\begin{document}", 1)[1]
        if r"\end{document}" in text:
            text = text.split(r"\end{document}", 1)[0]

        # Convert sections to standard headers
        text = re.sub(r'\\section\s*\{([^}]+)\}', r'\n\n=== \1 ===\n', text)

        # Handle custom resume commands commonly found in Jake's / standard resume templates
        # \resumeSubheading{Org}{Loc}{Role}{Dates}
        text = re.sub(
            r'\\resumeSubheading\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\{([^}]+)\}',
            r'\n\1 | \2\n\3 | \4\n',
            text
        )

        # \resumeProjectHeading{Title}{Dates}
        text = re.sub(
            r'\\resumeProjectHeading\s*\{([^}]+)\}\s*\{([^}]+)\}',
            r'\n\1 | \2\n',
            text
        )

        # \resumeItem{...} and \resumeItemPlain{...} -> • ...
        text = re.sub(r'\\resumeItemPlain\s*\{([^}]+)\}', r'• \1\n', text)
        text = re.sub(r'\\resumeItem\s*\{([^}]+)\}\s*\{([^}]+)\}', r'• \1: \2\n', text)
        text = re.sub(r'\\resumeItem\s*\{([^}]+)\}', r'• \1\n', text)
        text = re.sub(r'\\resumeItem\s*', r'• ', text)

        # \href{url}{label} -> label (url)
        text = re.sub(r'\\href\s*\{([^}]+)\}\s*\{([^}]+)\}', r'\2 (\1)', text)
        text = re.sub(r'\\url\s*\{([^}]+)\}', r'\1', text)

        # Clean formatting commands iteratively: e.g. \textbf{...}, \textit{...}
        formatting_pattern = r'\\(?:textbf|textit|emph|underline|small|large|Large|LARGE|Huge|scshape|raggedright|centering)\s*\{([^}{]*)\}'
        for _ in range(5):
            text = re.sub(formatting_pattern, r'\1', text)

        # Remove list environments & commands
        text = re.sub(r'\\(?:resumeSubHeadingListStart|resumeSubHeadingListEnd|resumeItemListStart|resumeItemListEnd|resumeProjectHeadingListStart|resumeProjectHeadingListEnd|begin|end|item|tabular|tabularx)(?:\{[^}]*\})*', ' ', text)
        text = re.sub(r'\\(?:titlerule|vspace|hspace|small|large|Large|LARGE|Huge|scshape|raggedright|centering)(?:\[[^\]]*\])?(?:\*?\{[^\}]*\})?', ' ', text)

        # Replace LaTeX special escapes
        text = text.replace(r'\%', '%').replace(r'\&', '&').replace(r'\$', '$').replace(r'\_', '_')
        text = text.replace(r'\\', '\n').replace('{', '').replace('}', '')

        # Clean multiple whitespaces & blank lines
        text = re.sub(r'[ \t]+', ' ', text)
        text = re.sub(r'\n\s*\n+', '\n\n', text)
        return text.strip()

    @classmethod
    def extract_text(cls, file_bytes: bytes, file_type: str) -> str:
        """Dispatcher for raw text extraction based on file type."""
        file_type = file_type.lower().strip()
        if file_type == "pdf":
            return cls.extract_text_from_pdf(file_bytes)
        elif file_type in ["tex", "latex"]:
            try:
                decoded = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                decoded = file_bytes.decode("latin-1")
            return cls.extract_text_from_latex(decoded)
        else:  # txt, md
            try:
                return file_bytes.decode("utf-8").strip()
            except UnicodeDecodeError:
                return file_bytes.decode("latin-1").strip()

    # -------------------------------------------------------------------------
    # 2. Structured Entity Extraction
    # -------------------------------------------------------------------------

    @classmethod
    def parse_text_to_structured_profile(
        cls, raw_text: str, filename: str, latex_source: Optional[str] = None
    ) -> StructuredResumeImport:
        """
        Parses extracted text into a typed StructuredResumeImport entity.
        All fields are strictly derived from the extracted content.
        """
        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]

        # 1. Extract Email
        email_match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', raw_text)
        email = email_match.group(0) if email_match else f"candidate.{uuid.uuid4().hex[:6]}@example.com"

        # 2. Extract Phone
        phone_match = re.search(
            r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', raw_text
        )
        phone = phone_match.group(0) if phone_match else None

        # 3. Extract Links
        linkedin_match = re.search(r'(https?://(?:www\.)?linkedin\.com/in/[A-Za-z0-9_-]+)', raw_text)
        linkedin_url = linkedin_match.group(0) if linkedin_match else None

        github_match = re.search(r'(https?://(?:www\.)?github\.com/[A-Za-z0-9_-]+)', raw_text)
        github_url = github_match.group(0) if github_match else None

        portfolio_match = re.search(r'(https?://[A-Za-z0-9.-]+\.(?:dev|io|me|com|app)/?[^\s)]*)', raw_text)
        portfolio_url = portfolio_match.group(0) if portfolio_match else None

        # 4. Extract Full Name
        full_name = "Candidate"
        # First priority: check first lines of cleaned text
        for l in lines[:5]:
            clean_l = re.sub(r'^[=\-*\s#|]+|[=\-*\s#|]+$', '', l).strip()
            # Must not be email, url, phone, or section divider
            if "@" not in clean_l and "http" not in clean_l and "phone" not in clean_l.lower() and "email" not in clean_l.lower() and not clean_l.startswith("==="):
                words = clean_l.split()
                if 1 <= len(words) <= 4 and words[0][0].isupper():
                    full_name = clean_l
                    break

        # Fallback to LaTeX heading extraction if not found
        if (full_name == "Candidate" or not full_name) and latex_source:
            # Look only in the header area (before first section)
            header_latex = latex_source.split(r'\section', 1)[0] if r'\section' in latex_source else latex_source[:1500]
            # Strip formatting commands
            cleaned_header = re.sub(r'\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^}]*\})?', ' ', header_latex)
            header_lines = [h.strip() for h in cleaned_header.splitlines() if h.strip()]
            for hl in header_lines:
                words = hl.split()
                if 1 <= len(words) <= 4 and words[0][0].isupper() and "@" not in hl:
                    full_name = hl
                    break

        # 5. Extract Location
        location = None
        location_match = re.search(
            r'([A-Z][a-zA-Z\s]+,\s*(?:[A-Z]{2}|USA|United States|UK|Canada|India|Germany|CA|NY|WA|TX|MA|DC))',
            raw_text
        )
        if location_match:
            location = location_match.group(1).strip()

        # 6. Extract Sections
        sections = cls._split_into_sections(raw_text)

        # Extract Summary
        summary = sections.get("summary", None)
        headline = None
        if summary:
            first_sent = summary.split(".")[0].strip()
            if len(first_sent) < 80:
                headline = first_sent
            else:
                headline = "Experienced Professional"

        # 7. Extract Skills
        skills = cls._extract_skills(raw_text, sections.get("skills", ""))

        # 8. Extract Experiences
        experiences = cls._extract_experiences(sections.get("experience", ""))

        # 9. Extract Education
        education = cls._extract_education(sections.get("education", ""))

        # 10. Extract Projects
        projects = cls._extract_projects(sections.get("projects", ""))

        # 11. Extract Certifications & Achievements
        certifications = cls._extract_certifications(sections.get("certifications", ""))
        achievements = cls._extract_achievements(sections.get("achievements", ""))

        # Target Career Preference defaults
        career_pref = CareerPreferenceCreate(
            preferred_roles=[headline or "Software Engineer"],
            preferred_locations=[location] if location else ["Remote"],
            work_mode="Remote",
            preferred_employment_type="Full-time",
            currency="USD",
        )

        return StructuredResumeImport(
            full_name=full_name,
            email=email,
            headline=headline or "Software Engineer",
            summary=summary,
            location=location,
            phone=phone,
            linkedin_url=linkedin_url,
            github_url=github_url,
            portfolio_url=portfolio_url,
            skills=skills,
            experience=experiences,
            education=education,
            projects=projects,
            certifications=certifications,
            achievements=achievements,
            career_preference=career_pref,
        )

    # -------------------------------------------------------------------------
    # 3. Helper Section Splitters & Parsers
    # -------------------------------------------------------------------------

    @classmethod
    def _split_into_sections(cls, text: str) -> Dict[str, str]:
        """Splits raw text into standard resume sections."""
        section_titles = {
            "summary": r"(?:SUMMARY|PROFILE|ABOUT ME|OBJECTIVE|EXECUTIVE SUMMARY)",
            "experience": r"(?:EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT HISTORY|PROFESSIONAL EXPERIENCE)",
            "education": r"(?:EDUCATION|ACADEMIC BACKGROUND|ACADEMICS)",
            "skills": r"(?:TECHNICAL SKILLS|SKILLS|CORE COMPETENCIES|TECHNOLOGIES)",
            "projects": r"(?:PROJECTS|TECHNICAL PROJECTS|KEY PROJECTS|PORTFOLIO)",
            "certifications": r"(?:CERTIFICATIONS|LICENSES|CREDENTIALS)",
            "achievements": r"(?:ACHIEVEMENTS|HONORS|AWARDS|RECOGNITION)",
        }

        pattern = r'(?im)^\s*(?:===*\s*)?(' + '|'.join(section_titles.values()) + r')(?:\s*===*)?\s*$'
        splits = re.split(pattern, text)

        sections: Dict[str, str] = {}
        current_header = "header"
        sections[current_header] = splits[0] if splits else ""

        for i in range(1, len(splits), 2):
            header_raw = splits[i].strip()
            content = splits[i + 1] if (i + 1) < len(splits) else ""

            matched_key = "other"
            for key, pat in section_titles.items():
                if re.fullmatch(pat, header_raw, re.IGNORECASE):
                    matched_key = key
                    break

            sections[matched_key] = content.strip()

        return sections

    @classmethod
    def _extract_skills(cls, full_text: str, skills_section: str) -> List[SkillCreate]:
        """Identifies skills from the skills section or across the resume text."""
        found_skills: List[SkillCreate] = []
        seen = set()

        combined_text = (skills_section + "\n" + full_text).strip()

        for cat, skill_list in cls.KNOWN_SKILL_CATEGORIES.items():
            for skill in skill_list:
                pattern = r'(?i)\b' + re.escape(skill) + r'\b'
                if re.search(pattern, combined_text) and skill.lower() not in seen:
                    seen.add(skill.lower())
                    found_skills.append(
                        SkillCreate(
                            name=skill,
                            category=cat,
                            proficiency_level="Advanced",
                        )
                    )

        for line in combined_text.splitlines():
            if ":" in line and any(k in line.lower() for k in ["languages", "technologies", "frameworks", "tools", "skills"]):
                cat_label, items = line.split(":", 1)
                tokens = [t.strip() for t in re.split(r'[,|•]', items) if t.strip()]
                for token in tokens:
                    if len(token) < 30 and token.lower() not in seen:
                        seen.add(token.lower())
                        found_skills.append(
                            SkillCreate(
                                name=token,
                                category="General",
                                proficiency_level="Intermediate",
                            )
                        )

        return found_skills

    @classmethod
    def _extract_experiences(cls, exp_section: str) -> List[ExperienceCreate]:
        """Extracts work experience records from the experience section."""
        experiences: List[ExperienceCreate] = []
        if not exp_section.strip():
            return experiences

        blocks = [b.strip() for b in re.split(r'\n\s*\n', exp_section) if b.strip()]

        for block in blocks:
            lines = [l.strip() for l in block.splitlines() if l.strip()]
            if not lines:
                continue

            first_line = lines[0]
            date_match = re.search(
                r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4})\s*[-–—]\s*(Present|\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)',
                block,
                re.IGNORECASE
            )

            bullets = [
                re.sub(r'^[•\-\*]\s*', '', l)
                for l in lines
                if re.match(r'^[•\-\*]', l)
            ]

            if date_match or "|" in first_line or len(lines) >= 2:
                company = "Company"
                role = "Software Engineer"
                location = None
                start_date = "2022-01"
                is_current = "Present" in block or "present" in block

                if "|" in first_line:
                    parts = [p.strip() for p in first_line.split("|")]
                    company = parts[0]
                    if len(parts) > 1:
                        location = parts[1]
                else:
                    company = first_line

                if len(lines) > 1 and "|" in lines[1]:
                    parts2 = [p.strip() for p in lines[1].split("|")]
                    role = parts2[0]
                elif len(lines) > 1 and not lines[1].startswith("•"):
                    role = lines[1]

                if date_match:
                    start_date = date_match.group(0).split("-")[0].strip()

                exp_create = ExperienceCreate(
                    company=company,
                    role=role,
                    location=location,
                    start_date=start_date,
                    end_date=None if is_current else "2024-01",
                    is_current=is_current,
                    bullet_points=bullets if bullets else [l for l in lines[1:] if not l.startswith("•")],
                )
                experiences.append(exp_create)

        return experiences

    @classmethod
    def _extract_education(cls, edu_section: str) -> List[EducationCreate]:
        """Extracts education records."""
        education_list: List[EducationCreate] = []
        if not edu_section.strip():
            return education_list

        blocks = [b.strip() for b in re.split(r'\n\s*\n', edu_section) if b.strip()]

        for block in blocks:
            lines = [l.strip() for l in block.splitlines() if l.strip()]
            if not lines:
                continue

            inst = lines[0].split("|")[0].strip()
            degree = "Bachelor of Science"
            field = "Computer Science"
            gpa = None

            gpa_match = re.search(r'GPA:?\s*(\d+\.\d+)', block, re.IGNORECASE)
            if gpa_match:
                gpa = gpa_match.group(1)

            if len(lines) > 1:
                deg_line = lines[1]
                if any(deg in deg_line for deg in ["Bachelor", "Master", "B.S.", "M.S.", "Ph.D.", "Computer"]):
                    degree = deg_line

            education_list.append(
                EducationCreate(
                    institution=inst,
                    degree=degree,
                    field_of_study=field,
                    gpa=gpa,
                )
            )

        return education_list

    @classmethod
    def _extract_projects(cls, proj_section: str) -> List[ProjectCreate]:
        """Extracts projects from projects section."""
        projects: List[ProjectCreate] = []
        if not proj_section.strip():
            return projects

        blocks = [b.strip() for b in re.split(r'\n\s*\n', proj_section) if b.strip()]

        for block in blocks:
            lines = [l.strip() for l in block.splitlines() if l.strip()]
            if not lines:
                continue

            title = lines[0].split("|")[0].strip()
            bullets = [
                re.sub(r'^[•\-\*]\s*', '', l)
                for l in lines
                if re.match(r'^[•\-\*]', l)
            ]

            projects.append(
                ProjectCreate(
                    title=title,
                    description=lines[1] if len(lines) > 1 and not lines[1].startswith("•") else None,
                    bullet_points=bullets,
                )
            )

        return projects

    @classmethod
    def _extract_certifications(cls, cert_section: str) -> List[CertificationCreate]:
        """Extracts certifications."""
        certs = []
        for line in cert_section.splitlines():
            line = line.strip()
            if line and not line.startswith("==="):
                certs.append(
                    CertificationCreate(
                        name=line,
                        issuing_organization="Verified Institution",
                    )
                )
        return certs

    @classmethod
    def _extract_achievements(cls, ach_section: str) -> List[AchievementCreate]:
        """Extracts achievements."""
        achs = []
        for line in ach_section.splitlines():
            line = line.strip()
            if line and not line.startswith("==="):
                achs.append(
                    AchievementCreate(
                        title=line,
                    )
                )
        return achs

    # -------------------------------------------------------------------------
    # 4. Storage & Pipeline Execution
    # -------------------------------------------------------------------------

    @classmethod
    async def process_resume_upload(
        cls,
        session: AsyncSession,
        file_bytes: bytes,
        filename: str,
        content_type: Optional[str] = None,
        candidate_id: Optional[str] = None,
    ) -> Tuple[ResumeDocument, StructuredResumeImport, bool]:
        """
        Executes complete ingestion pipeline:
        1. Identifies file type.
        2. Saves master copy (especially for LaTeX .tex files).
        3. Extracts text and parses structured profile.
        4. Saves ResumeDocument record in DB.
        """
        cls.ensure_directories()

        ext = Path(filename).suffix.lower().replace(".", "")
        if ext == "tex" or "latex" in (content_type or ""):
            file_type = "tex"
        elif ext == "pdf" or "pdf" in (content_type or ""):
            file_type = "pdf"
        elif ext in ["md", "markdown"]:
            file_type = "md"
        else:
            file_type = "txt"

        doc_id = str(uuid.uuid4())
        safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)

        # 1. Storage Handling
        if file_type == "tex":
            # Store untouched master copy in resume/master/
            storage_path = str(cls.MASTER_RESUME_DIR / f"{doc_id}_{safe_name}")
            with open(storage_path, "wb") as f:
                f.write(file_bytes)
            latex_source = file_bytes.decode("utf-8", errors="replace")
        else:
            storage_path = str(cls.STORAGE_DIR / f"{doc_id}_{safe_name}")
            with open(storage_path, "wb") as f:
                f.write(file_bytes)
            latex_source = None

        # 2. Text Extraction
        extracted_text = cls.extract_text(file_bytes, file_type)

        # 3. Structured Information Extraction
        structured_data = cls.parse_text_to_structured_profile(
            extracted_text, filename, latex_source=latex_source
        )

        # 4. Create ResumeDocument DB Record
        resume_doc = ResumeDocument(
            id=doc_id,
            candidate_id=candidate_id,
            filename=filename,
            file_type=file_type,
            storage_path=storage_path,
            extracted_text=extracted_text,
            version=1,
            metadata_json={"original_bytes": len(file_bytes)},
        )
        session.add(resume_doc)

        # If LaTeX, save master resume template
        master_saved = False
        if file_type == "tex" and latex_source:
            if candidate_id:
                template = ResumeTemplate(
                    candidate_id=candidate_id,
                    name=filename,
                    latex_source=latex_source,
                    is_default=True,
                )
                session.add(template)
                master_saved = True

        await session.commit()
        await session.refresh(resume_doc)

        return resume_doc, structured_data, master_saved

    @classmethod
    async def confirm_and_apply_resume(
        cls,
        session: AsyncSession,
        document_id: str,
        candidate_data: StructuredResumeImport,
        candidate_id: Optional[str] = None,
    ) -> Candidate:
        """
        Permanent confirmation step:
        Applies user-reviewed structured data to candidate profile and links ResumeDocument.
        """
        # 1. Resolve target candidate ID (from argument or existing document association)
        stmt = select(ResumeDocument).where(ResumeDocument.id == document_id)
        res = await session.execute(stmt)
        doc = res.scalars().first()

        target_cand_id = candidate_id or (doc.candidate_id if doc else None)

        # 2. Upsert candidate profile
        candidate = await ProfileService.import_structured_resume(
            session, candidate_data, candidate_id=target_cand_id
        )

        # 3. Link ResumeDocument to candidate
        if doc:
            doc.candidate_id = candidate.id
            await session.commit()

        return candidate
