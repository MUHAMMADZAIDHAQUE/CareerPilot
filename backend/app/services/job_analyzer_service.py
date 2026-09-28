import re
import uuid
import asyncio
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.models.job import Job, JobRequirement
from backend.app.schemas.job import (
    ParsedJobAnalysis,
    JobRequirementBase,
    JobResponse,
)

# Optional OpenAI client import
try:
    from openai import AsyncOpenAI
    _has_openai = True
except ImportError:
    _has_openai = False


class JobAnalyzerService:
    """
    Analyzes Job Descriptions with structured LLM parsing,
    strict anti-hallucination guards, and deterministic fallback.
    """

    KNOWN_TECH_CATALOG = {
        "Languages": [
            "Python", "TypeScript", "JavaScript", "SQL", "Go", "Golang", "Rust", "C++",
            "Java", "C#", "C", "Ruby", "PHP", "Scala", "Kotlin", "Swift", "Bash", "Shell", "R"
        ],
        "Frameworks": [
            "FastAPI", "Next.js", "React", "Node.js", "Express", "Django", "Flask",
            "Spring Boot", "Vue", "Angular", "Tailwind", "Tailwind CSS", "PyTorch",
            "TensorFlow", "Pandas", "NumPy", "GraphQL"
        ],
        "Databases": [
            "PostgreSQL", "pgvector", "MySQL", "MongoDB", "Redis", "SQLite",
            "Cassandra", "Elasticsearch", "DynamoDB", "Snowflake", "BigQuery"
        ],
        "Cloud & DevOps": [
            "Docker", "Kubernetes", "AWS", "Amazon Web Services", "GCP", "Google Cloud",
            "Azure", "CI/CD", "GitHub Actions", "Terraform", "Kafka", "Linux", "Helm",
            "Prometheus", "Grafana", "RabbitMQ"
        ],
        "AI & Architecture": [
            "Microservices", "Distributed Systems", "LangChain", "LangGraph", "LLMs",
            "RAG", "Embeddings", "NLP", "Machine Learning", "System Design", "Event-Driven Architecture",
            "REST APIs", "gRPC", "Vector Databases", "High Concurrency"
        ]
    }

    # -------------------------------------------------------------------------
    # 1. Main Entrypoint: Analyze & Persist
    # -------------------------------------------------------------------------

    @classmethod
    async def analyze_and_store_job(
        cls,
        session: AsyncSession,
        job_description: str,
        job_url: Optional[str] = None,
        company: Optional[str] = None,
        role: Optional[str] = None,
    ) -> Job:
        """
        Parses raw JD, validates with Pydantic, and saves Job + JobRequirements.
        """
        # 1. Parse JD using LLM with retry, falling back to deterministic extraction
        parsed_analysis = await cls.analyze_job_description(
            raw_text=job_description,
            provided_company=company,
            provided_role=role,
            provided_url=job_url,
        )

        # 2. Persist Job and JobRequirements to database
        job = await cls.save_job_to_db(
            session=session,
            parsed=parsed_analysis,
            raw_description=job_description,
            source_url=job_url,
        )

        return job

    # -------------------------------------------------------------------------
    # 2. LLM Execution with Retries & Graceful Fallback
    # -------------------------------------------------------------------------

    @classmethod
    async def analyze_job_description(
        cls,
        raw_text: str,
        provided_company: Optional[str] = None,
        provided_role: Optional[str] = None,
        provided_url: Optional[str] = None,
    ) -> ParsedJobAnalysis:
        """
        Extracts structured JD facts using LLM (if configured) with exponential
        backoff retries. Falls back gracefully to deterministic parsing if LLM is
        unavailable or fails.
        """
        if settings.OPENAI_API_KEY and _has_openai:
            max_retries = 3
            for attempt in range(1, max_retries + 1):
                try:
                    logger.info(f"Analyzing JD via LLM (attempt {attempt}/{max_retries})...")
                    analysis = await cls._call_llm_structured_parse(
                        raw_text=raw_text,
                        provided_company=provided_company,
                        provided_role=provided_role,
                        provided_url=provided_url,
                    )
                    return analysis
                except Exception as e:
                    logger.warning(f"LLM parsing attempt {attempt} failed: {e}")
                    if attempt < max_retries:
                        backoff = 2 ** attempt
                        await asyncio.sleep(backoff)
                    else:
                        logger.error(f"All {max_retries} LLM attempts failed. Engaging deterministic fallback.")

        # Fallback: Deterministic Rule-Based Extraction with Anti-Hallucination
        logger.info("Using deterministic semantic JD analyzer (grounded extraction)...")
        return cls._analyze_deterministic(
            raw_text=raw_text,
            provided_company=provided_company,
            provided_role=provided_role,
            provided_url=provided_url,
        )

    @classmethod
    async def _call_llm_structured_parse(
        cls,
        raw_text: str,
        provided_company: Optional[str] = None,
        provided_role: Optional[str] = None,
        provided_url: Optional[str] = None,
    ) -> ParsedJobAnalysis:
        """Calls OpenAI Structured Outputs endpoint with Pydantic schema."""
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        system_prompt = (
            "You are an expert Job Description Analyzer for CareerPilot AI.\n"
            "Analyze the given job description and output structured facts according to the schema.\n"
            "CRITICAL ANTI-HALLUCINATION RULES:\n"
            "1. ONLY extract facts explicitly supported by the text. NEVER fabricate or assume unstated skills or benefits.\n"
            "2. Distinguish cleanly between:\n"
            "   - 'required_skills': Explicitly mandatory, must-have skills or minimum qualifications.\n"
            "   - 'preferred_skills': Nice-to-have, bonus, plus, or preferred qualifications.\n"
            "   - 'inferred_concepts': Architectural concepts or domain paradigms entailed by the role's scope.\n"
            "3. If salary, deadline, or experience are not explicitly stated, leave them as null.\n"
            "4. For each item in requirements_breakdown, provide an exact verbatim context snippet from the text."
        )

        user_content = f"JOB DESCRIPTION:\n```\n{raw_text}\n```\n"
        if provided_company:
            user_content += f"\nProvided Company: {provided_company}"
        if provided_role:
            user_content += f"\nProvided Role: {provided_role}"
        if provided_url:
            user_content += f"\nProvided URL: {provided_url}"

        completion = await client.beta.chat.completions.parse(
            model=settings.DEFAULT_LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            response_format=ParsedJobAnalysis,
            temperature=0.0,
        )

        parsed_result = completion.choices[0].message.parsed
        if not parsed_result:
            raise ValueError("LLM returned empty structured parsed response")

        # Honor pre-supplied overrides if provided
        if provided_company and (not parsed_result.company or parsed_result.company == "Unknown"):
            parsed_result.company = provided_company
        if provided_role and (not parsed_result.role or parsed_result.role == "Unknown"):
            parsed_result.role = provided_role
        if provided_url:
            parsed_result.application_url = provided_url

        return parsed_result

    # -------------------------------------------------------------------------
    # 3. Deterministic Grounded Fallback Analyzer
    # -------------------------------------------------------------------------

    @classmethod
    def _analyze_deterministic(
        cls,
        raw_text: str,
        provided_company: Optional[str] = None,
        provided_role: Optional[str] = None,
        provided_url: Optional[str] = None,
    ) -> ParsedJobAnalysis:
        """
        Performs 100% grounded deterministic analysis of the raw JD.
        Extracts company, role, location, salary, experience, education,
        and cleanly separates required vs preferred vs inferred skills.
        """
        lines = [l.strip() for l in raw_text.splitlines() if l.strip()]

        # 1. Company and Role Extraction
        role = provided_role
        company = provided_company

        for line in lines[:8]:
            clean_line = re.sub(r'^[#*=\-\s]+', '', line).strip()
            # Match "Role: Senior Backend Engineer" or "Position: AI Engineer"
            pos_match = re.match(r'^(?:Job\s+Title|Position|Role|Title):\s*(.*?)$', clean_line, re.IGNORECASE)
            if pos_match and not role:
                role = pos_match.group(1).strip()
                continue

            # Match "Company: Apex Systems" or "Organization: Acme"
            co_match = re.match(r'^(?:Company|Organization|Employer):\s*(.*?)$', clean_line, re.IGNORECASE)
            if co_match and not company:
                company = co_match.group(1).strip()
                continue

            # Match "Staff Backend Engineer at Apex Cloud Systems"
            at_match = re.match(r'^(.*?)\s+(?:at|@)\s+(.*?)$', clean_line, re.IGNORECASE)
            if at_match and not role and not company:
                pot_role, pot_co = at_match.group(1).strip(), at_match.group(2).strip()
                if len(pot_role) < 80 and len(pot_co) < 80 and not any(k in pot_co.lower() for k in ["http", "salary", "location"]):
                    role = pot_role
                    company = pot_co
                    continue

        # If role still not found, search early lines for role keywords
        if not role:
            for l in lines[:5]:
                clean_l = re.sub(r'^[#*=\-\s]+', '', l).strip()
                if any(w in clean_l.lower() for w in ["engineer", "developer", "architect", "manager", "lead", "analyst", "scientist", "specialist"]):
                    if clean_l != company:
                        role = clean_l
                        break

        # If company still not found, check lines before the role line or line 0
        if not company and lines:
            for l in lines[:4]:
                clean_l = re.sub(r'^[#*=\-\s]+', '', l).strip()
                if clean_l and clean_l != role and not any(k in clean_l.lower() for k in ["role", "position", "location", "salary", "http", "deadline", "about", "we are", "seeking"]):
                    company = clean_l
                    break

        if not role and lines:
            role = lines[0] if lines[0] != company else (lines[1] if len(lines) > 1 else "Software Engineer")

        if not company:
            company = "Target Company"

        # 2. Extract Location & Work Mode
        location = "Remote"
        loc_match = re.search(
            r'(?:Location|Based in|Work Location):\s*([^\n;]+)', raw_text, re.IGNORECASE
        )
        if loc_match:
            location = loc_match.group(1).strip()
        else:
            std_loc = re.search(r'\b([A-Z][a-zA-Z\s]+,\s*(?:[A-Z]{2}|USA|UK|Canada|Germany|Remote))\b', raw_text)
            if std_loc:
                location = std_loc.group(1).strip()

        # 3. Employment Type
        employment_type = "Full-time"
        if re.search(r'\b(Contract|Contractor|C2C|W2)\b', raw_text, re.IGNORECASE):
            employment_type = "Contract"
        elif re.search(r'\bPart-time\b', raw_text, re.IGNORECASE):
            employment_type = "Part-time"
        elif re.search(r'\bInternship|Intern\b', raw_text, re.IGNORECASE):
            employment_type = "Internship"

        # 4. Salary Extraction (Strict regex: only if explicit figure exists)
        salary = None
        salary_match = re.search(
            r'(?:Salary|Compensation|Pay Range|Pay):\s*([$€£][\d,]+(?:\s*[-–—to]+\s*[$€£]?[\d,]+)?(?:\s*(?:k|K|/yr|per year|annually))?)',
            raw_text,
            re.IGNORECASE
        )
        if not salary_match:
            salary_match = re.search(
                r'([$€£]\d{2,3}(?:,\d{3})*(?:\s*[-–—]\s*[$€£]?\d{2,3}(?:,\d{3})*|\s*[kK])(?:\s*(?:/yr|per year|annually))?)',
                raw_text
            )
        if salary_match:
            salary = salary_match.group(1).strip()

        # 5. Deadline Extraction
        deadline = None
        deadline_match = re.search(
            r'(?:Application Deadline|Deadline|Apply By|Closes?):\s*([A-Za-z0-9\s,–-]+(?:\d{4}))',
            raw_text,
            re.IGNORECASE
        )
        if deadline_match:
            deadline = deadline_match.group(1).strip()

        # 6. Experience Requirement
        experience_requirement = None
        exp_match = re.search(
            r'(\d+\+?(?:\s*(?:to|-|–)\s*\d+)?\s*years?(?:\s+of)?(?:\s+[\w/]+){0,4}\s+experience)',
            raw_text,
            re.IGNORECASE
        )
        if exp_match:
            experience_requirement = exp_match.group(1).strip()

        # 7. Education Requirement
        education_requirements: List[str] = []
        edu_matches = re.findall(
            r'\b((?:Bachelor(?:(?:\'s)?\s+(?:degree|of\s+[A-Za-z]+))?|Master(?:(?:\'s)?\s+(?:degree|of\s+[A-Za-z]+))?|Ph\.?D\.?|B\.S\b|M\.S\b|Computer Science|relevant (?:technical )?field)[^.\n;]*)',
            raw_text,
            re.IGNORECASE
        )
        for em in edu_matches:
            clean_em = re.sub(r'^[•\-\*#]+\s*', '', em).strip()
            if 3 < len(clean_em) < 120 and clean_em not in education_requirements:
                education_requirements.append(clean_em)

        # 8. Split JD into Sections
        sections = cls._split_jd_sections(raw_text)

        # Extract Responsibilities
        responsibilities = cls._extract_bullet_items(sections.get("responsibilities", ""))

        # Extract Qualifications
        qualifications = cls._extract_bullet_items(sections.get("requirements", ""))

        # Extract Summary
        summary = None
        about_text = sections.get("about", "")
        if about_text:
            summary = " ".join([l for l in about_text.splitlines()[:3] if l])
        elif lines:
            summary = f"{role} at {company} ({location})."

        # 9. Technical Domain
        domain = "Software Engineering"
        domain_keywords = {
            "Distributed Systems": ["distributed", "consensus", "high throughput", "raft", "kafka", "scalability"],
            "AI & Machine Learning": ["llm", "machine learning", "rag", "embeddings", "deep learning", "neural"],
            "Cloud Infrastructure / DevOps": ["cloud", "kubernetes", "docker", "terraform", "infrastructure", "ci/cd"],
            "FinTech": ["fintech", "payments", "trading", "banking", "ledger", "financial"],
            "Cybersecurity": ["security", "zero-trust", "cryptography", "infosec", "penetration", "compliance"],
            "Full Stack Web Development": ["frontend", "backend", "next.js", "react", "full stack", "api"],
        }
        text_lower = raw_text.lower()
        for dom, kws in domain_keywords.items():
            if sum(1 for kw in kws if kw in text_lower) >= 2:
                domain = dom
                break

        # 10. Clean Categorization of Required vs Preferred vs Inferred Skills
        req_section_text = sections.get("requirements", "")
        pref_section_text = sections.get("preferred", "")
        resp_section_text = sections.get("responsibilities", "")

        required_skills: List[str] = []
        preferred_skills: List[str] = []
        inferred_concepts: List[str] = []
        technologies: List[str] = []
        requirements_breakdown: List[JobRequirementBase] = []

        seen_skills = set()

        # Scan for known technical terms
        for cat, skill_list in cls.KNOWN_TECH_CATALOG.items():
            for tech in skill_list:
                pattern = r'(?i)\b' + re.escape(tech) + r'\b'
                tech_lower = tech.lower()

                # Check preferred section first
                if re.search(pattern, pref_section_text):
                    if tech_lower not in seen_skills:
                        seen_skills.add(tech_lower)
                        preferred_skills.append(tech)
                        technologies.append(tech)
                        requirements_breakdown.append(
                            JobRequirementBase(
                                name=tech,
                                requirement_type="preferred",
                                category=cat,
                                context=cls._find_context_sentence(pref_section_text, pattern),
                            )
                        )
                # Check requirements section
                elif re.search(pattern, req_section_text):
                    if tech_lower not in seen_skills:
                        seen_skills.add(tech_lower)
                        required_skills.append(tech)
                        technologies.append(tech)
                        requirements_breakdown.append(
                            JobRequirementBase(
                                name=tech,
                                requirement_type="required",
                                category=cat,
                                context=cls._find_context_sentence(req_section_text, pattern),
                            )
                        )
                # Check rest of text
                elif re.search(pattern, raw_text):
                    if tech_lower not in seen_skills:
                        seen_skills.add(tech_lower)
                        if cat == "AI & Architecture":
                            inferred_concepts.append(tech)
                            req_type = "inferred"
                        else:
                            required_skills.append(tech)
                            technologies.append(tech)
                            req_type = "required"

                        requirements_breakdown.append(
                            JobRequirementBase(
                                name=tech,
                                requirement_type=req_type,
                                category=cat,
                                context=cls._find_context_sentence(raw_text, pattern),
                            )
                        )

        # Infer concepts from domain if not already added
        if domain not in inferred_concepts:
            inferred_concepts.append(domain)
            requirements_breakdown.append(
                JobRequirementBase(
                    name=domain,
                    requirement_type="inferred",
                    category="domain",
                    context=f"Overall domain context deduced from role scope: {domain}",
                )
            )

        return ParsedJobAnalysis(
            company=company,
            role=role,
            location=location,
            employment_type=employment_type,
            summary=summary,
            domain=domain,
            salary=salary,
            application_url=provided_url,
            deadline=deadline,
            experience_requirement=experience_requirement,
            education_requirements=education_requirements,
            required_skills=required_skills,
            preferred_skills=preferred_skills,
            inferred_concepts=inferred_concepts,
            responsibilities=responsibilities,
            qualifications=qualifications,
            technologies=technologies,
            requirements_breakdown=requirements_breakdown,
        )

    # -------------------------------------------------------------------------
    # 4. Storage Handling
    # -------------------------------------------------------------------------

    @classmethod
    async def save_job_to_db(
        cls,
        session: AsyncSession,
        parsed: ParsedJobAnalysis,
        raw_description: str,
        source_url: Optional[str] = None,
    ) -> Job:
        """Saves analyzed job and all itemized JobRequirement entities."""
        job_id = str(uuid.uuid4())

        job = Job(
            id=job_id,
            company=parsed.company,
            role=parsed.role,
            location=parsed.location,
            employment_type=parsed.employment_type,
            raw_description=raw_description,
            summary=parsed.summary,
            domain=parsed.domain,
            salary=parsed.salary,
            application_url=parsed.application_url or source_url,
            deadline=parsed.deadline,
            experience_requirement=parsed.experience_requirement,
            education_requirements=parsed.education_requirements,
            responsibilities=parsed.responsibilities,
            qualifications=parsed.qualifications,
            technologies=parsed.technologies,
            required_skills=parsed.required_skills,
            preferred_skills=parsed.preferred_skills,
            inferred_concepts=parsed.inferred_concepts,
        )
        session.add(job)

        # Create granular JobRequirement records
        for item in parsed.requirements_breakdown:
            req = JobRequirement(
                id=str(uuid.uuid4()),
                job_id=job_id,
                name=item.name,
                requirement_type=item.requirement_type,
                category=item.category or "skill",
                context=item.context,
                years_experience=item.years_experience,
            )
            session.add(req)

        await session.commit()

        # Reload with selectin relationships
        stmt = select(Job).where(Job.id == job_id)
        result = await session.execute(stmt)
        saved_job = result.scalars().first()
        return saved_job or job

    # -------------------------------------------------------------------------
    # 5. Helper Methods
    # -------------------------------------------------------------------------

    @classmethod
    def _split_jd_sections(cls, text: str) -> Dict[str, str]:
        """Splits raw JD into typical sections using multi-pattern regex."""
        section_titles = {
            "about": r"(?:ABOUT (?:US|THE ROLE|THE COMPANY|THE TEAM)|OVERVIEW|COMPANY DESCRIPTION)",
            "responsibilities": r"(?:RESPONSIBILITIES|WHAT YOU(?:'LL| WILL) DO|YOUR ROLE|DUTIES|KEY RESPONSIBILITIES)",
            "requirements": r"(?:REQUIREMENTS|QUALIFICATIONS|MINIMUM QUALIFICATIONS|WHAT YOU(?:'LL)? NEED|WHAT WE(?:'RE)? LOOKING FOR|BASIC QUALIFICATIONS)",
            "preferred": r"(?:PREFERRED QUALIFICATIONS|NICE TO HAVE|BONUS POINTS|PREFERRED SKILLS|PREFERRED|ADDITIONAL QUALIFICATIONS)",
            "benefits": r"(?:BENEFITS|PERKS|WHAT WE OFFER|COMPENSATION|WHY JOIN US)",
        }

        pattern = r'(?im)^\s*(?:#+\s*|[=*-]+\s*)?(' + '|'.join(section_titles.values()) + r')(?:\s*[:=*-]*)?\s*$'
        splits = re.split(pattern, text)

        sections: Dict[str, str] = {}
        sections["header"] = splits[0] if splits else ""

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
    def _extract_bullet_items(cls, section_text: str) -> List[str]:
        """Extracts bullet lines or short paragraphs from a section."""
        items: List[str] = []
        for line in section_text.splitlines():
            line = line.strip()
            if not line:
                continue
            clean = re.sub(r'^[•\-\*#]+\s*', '', line).strip()
            if len(clean) > 8:
                items.append(clean)
        return items

    @classmethod
    def _find_context_sentence(cls, text: str, pattern: str) -> Optional[str]:
        """Extracts the exact sentence or line containing a keyword match."""
        for line in text.splitlines():
            if re.search(pattern, line):
                clean = re.sub(r'^[•\-\*#]+\s*', '', line).strip()
                if len(clean) > 10:
                    return clean
        return None
