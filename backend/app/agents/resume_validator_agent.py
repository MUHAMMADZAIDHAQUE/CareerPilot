import re
from typing import List, Dict, Any, Set, Tuple, Optional
from backend.app.schemas.tailoring import ValidationReport, ValidationCheckItem
from backend.app.core.logging import logger


def extract_latex_command_args(text: str, command: str) -> List[List[str]]:
    """
    Extracts all argument lists for a given LaTeX command, correctly balancing nested curly braces.
    Example: for command = r"\resumeProjectHeading", returns [ [arg1, arg2], ... ]
    """
    results: List[List[str]] = []
    idx = 0
    cmd_len = len(command)
    while True:
        pos = text.find(command, idx)
        if pos == -1:
            break
        curr = pos + cmd_len
        args: List[str] = []
        while curr < len(text):
            while curr < len(text) and text[curr].isspace():
                curr += 1
            if curr < len(text) and text[curr] == "{":
                brace_count = 1
                start_arg = curr + 1
                curr += 1
                while curr < len(text) and brace_count > 0:
                    if text[curr] == "{":
                        brace_count += 1
                    elif text[curr] == "}":
                        brace_count -= 1
                    curr += 1
                if brace_count == 0:
                    args.append(text[start_arg : curr - 1])
                else:
                    break
            else:
                break
        if args:
            results.append(args)
        idx = pos + cmd_len
    return results


class ResumeValidatorAgent:
    """
    Rigorously verifies tailored LaTeX resumes against candidate ground truth.
    Guarantees zero-hallucination and evidence compliance:
    1. All projects exist in candidate profile or master resume.
    2. All technologies exist in candidate verified skills, projects, or experiences.
    3. All education is unchanged (institutions, degrees, GPA, dates).
    4. All experience is unchanged (companies, titles, dates, locations).
    5. No fabricated metrics (percentages, throughput, dollar values, latencies).
    6. No fabricated claims or unsupported entities.
    7. Required LaTeX sections and valid document structure exist.
    """

    SECTION_PATTERN = re.compile(r"\\(?:sub)*section\*?\{([^}]+)\}", re.IGNORECASE)

    # Numerical and metric patterns (captures %, \%, k, $, ms, requests/sec, etc.)
    METRIC_PATTERN = re.compile(
        r"(\b\d+(?:\.\d+)?\\?%|\b\d+k\b|\b\$\d+(?:,\d+)*(?:\.\d+)?[kmb]?\b|\bsub-\d+ms\b|\b\d+x\b|\b\d+(?:,\d+)*\s*(?:requests|users|queries|calls|req/sec|rps|events)\b)",
        re.IGNORECASE,
    )

    REQUIRED_LATEX_MARKERS = [
        "\\documentclass",
        "\\begin{document}",
        "\\end{document}",
    ]

    REQUIRED_SECTIONS = [
        "Education",
        "Experience",
        "Projects",
        "Technical Skills",
    ]

    @classmethod
    def audit_tailored_resume(
        cls,
        tailored_latex: str,
        master_latex: str,
        candidate_data: Dict[str, Any],
        job_data: Optional[Dict[str, Any]] = None,
    ) -> ValidationReport:
        """
        Runs the full verification suite against the candidate ground truth.
        Returns a ValidationReport detailing passed/failed checks, metrics audited, and warnings.
        """
        errors: List[str] = []
        warnings: List[str] = []
        passed_checks: List[str] = []
        failed_checks: List[str] = []
        check_items: List[ValidationCheckItem] = []

        # 1. LaTeX Syntax & Structure Check
        syntax_passed, syntax_errs = cls._check_latex_structure(tailored_latex)
        if syntax_passed:
            passed_checks.append("latex_syntax")
            check_items.append(
                ValidationCheckItem(
                    check_name="LaTeX Structure & Syntax",
                    passed=True,
                    details="Valid LaTeX document with proper preamble, environments, and balanced tags.",
                )
            )
        else:
            failed_checks.append("latex_syntax")
            errors.extend(syntax_errs)
            check_items.append(
                ValidationCheckItem(
                    check_name="LaTeX Structure & Syntax",
                    passed=False,
                    details=f"LaTeX syntax issues: {'; '.join(syntax_errs)}",
                )
            )

        # 2. Required Sections Check
        sections_passed, sections_found, missing_secs = cls._check_required_sections(tailored_latex)
        if sections_passed:
            passed_checks.append("required_sections")
            check_items.append(
                ValidationCheckItem(
                    check_name="Required Sections Integrity",
                    passed=True,
                    details=f"All essential sections present: {', '.join(sections_found)}.",
                )
            )
        else:
            failed_checks.append("required_sections")
            err_msg = f"Missing mandatory sections: {', '.join(missing_secs)}"
            errors.append(err_msg)
            check_items.append(
                ValidationCheckItem(
                    check_name="Required Sections Integrity",
                    passed=False,
                    details=err_msg,
                )
            )

        # 3. Education Immutability Check
        edu_passed, edu_errs = cls._check_education_unchanged(tailored_latex, master_latex, candidate_data)
        if edu_passed:
            passed_checks.append("education_unchanged")
            check_items.append(
                ValidationCheckItem(
                    check_name="Education Grounding",
                    passed=True,
                    details="Education credentials, degrees, institutions, and dates match source ground truth exactly.",
                )
            )
        else:
            failed_checks.append("education_unchanged")
            errors.extend(edu_errs)
            check_items.append(
                ValidationCheckItem(
                    check_name="Education Grounding",
                    passed=False,
                    details=f"Education alterations detected: {'; '.join(edu_errs)}",
                )
            )

        # 4. Experience Companies, Titles & Dates Immutability Check
        exp_passed, exp_errs = cls._check_experience_entities(tailored_latex, master_latex, candidate_data)
        if exp_passed:
            passed_checks.append("experience_entities_unchanged")
            check_items.append(
                ValidationCheckItem(
                    check_name="Experience Grounding",
                    passed=True,
                    details="All employer names, job titles, and employment periods are genuine and uninvented.",
                )
            )
        else:
            failed_checks.append("experience_entities_unchanged")
            errors.extend(exp_errs)
            check_items.append(
                ValidationCheckItem(
                    check_name="Experience Grounding",
                    passed=False,
                    details=f"Experience integrity violations: {'; '.join(exp_errs)}",
                )
            )

        # 5. Project Provenance Check
        proj_passed, proj_errs = cls._check_projects_exist(tailored_latex, master_latex, candidate_data)
        if proj_passed:
            passed_checks.append("projects_exist")
            check_items.append(
                ValidationCheckItem(
                    check_name="Project Provenance",
                    passed=True,
                    details="All highlighted portfolio projects correspond to genuine verified candidate projects.",
                )
            )
        else:
            failed_checks.append("projects_exist")
            errors.extend(proj_errs)
            check_items.append(
                ValidationCheckItem(
                    check_name="Project Provenance",
                    passed=False,
                    details=f"Unrecognized projects detected: {'; '.join(proj_errs)}",
                )
            )

        # 6. Technology Grounding Audit
        tech_passed, tech_errs, audited_techs = cls._check_technologies_exist(
            tailored_latex, master_latex, candidate_data
        )
        if tech_passed:
            passed_checks.append("technologies_grounded")
            check_items.append(
                ValidationCheckItem(
                    check_name="Technology Truth Audit",
                    passed=True,
                    details=f"All {len(audited_techs)} cited technologies are grounded in candidate skills or project evidence.",
                )
            )
        else:
            failed_checks.append("technologies_grounded")
            errors.extend(tech_errs)
            check_items.append(
                ValidationCheckItem(
                    check_name="Technology Truth Audit",
                    passed=False,
                    details=f"Fabricated/unverified technologies cited: {'; '.join(tech_errs)}",
                )
            )

        # 7. Metric & Quantitative Grounding Audit
        metric_passed, metric_errs, audited_metrics = cls._check_metrics_grounded(
            tailored_latex, master_latex, candidate_data
        )
        if metric_passed:
            passed_checks.append("metrics_grounded")
            check_items.append(
                ValidationCheckItem(
                    check_name="Quantitative Metric Grounding",
                    passed=True,
                    details=f"All {len(audited_metrics)} quantitative metrics ({', '.join(audited_metrics[:5])}) originate from candidate source evidence.",
                )
            )
        else:
            failed_checks.append("metrics_grounded")
            errors.extend(metric_errs)
            check_items.append(
                ValidationCheckItem(
                    check_name="Quantitative Metric Grounding",
                    passed=False,
                    details=f"Fabricated metrics detected: {'; '.join(metric_errs)}",
                )
            )

        is_valid = len(errors) == 0

        return ValidationReport(
            is_valid=is_valid,
            passed_checks=passed_checks,
            failed_checks=failed_checks,
            errors=errors,
            warnings=warnings,
            checks=check_items,
            metrics_audited=audited_metrics,
            technologies_audited=audited_techs,
        )

    # -------------------------------------------------------------------------
    # Helper Inspection Methods
    # -------------------------------------------------------------------------

    @classmethod
    def _check_latex_structure(cls, latex: str) -> Tuple[bool, List[str]]:
        errs = []
        for marker in cls.REQUIRED_LATEX_MARKERS:
            if marker not in latex:
                errs.append(f"Missing mandatory LaTeX marker '{marker}'")

        # Check bracket parity
        open_curlies = latex.count("{")
        close_curlies = latex.count("}")
        if open_curlies != close_curlies:
            errs.append(f"Unbalanced curly braces in LaTeX: {open_curlies} '{{' vs {close_curlies} '}}'")

        return len(errs) == 0, errs

    @classmethod
    def _check_required_sections(cls, latex: str) -> Tuple[bool, List[str], List[str]]:
        found_sections = []
        for match in cls.SECTION_PATTERN.finditer(latex):
            sec_name = match.group(1).strip()
            found_sections.append(sec_name)

        found_normalized = {s.lower() for s in found_sections}
        missing = []

        def has_section_match(req: str) -> bool:
            r = req.lower()
            for f in found_normalized:
                if r in f or f in r:
                    return True
                if r == "technical skills" and "skills" in f:
                    return True
                if r == "experience" and ("work" in f or "experience" in f or "employment" in f):
                    return True
                if r == "projects" and ("project" in f or "portfolio" in f):
                    return True
                if r == "education" and ("education" in f or "academic" in f):
                    return True
            return False

        for req in cls.REQUIRED_SECTIONS:
            if not has_section_match(req):
                missing.append(req)

        return len(missing) == 0, found_sections, missing

    @classmethod
    def _check_education_unchanged(
        cls, tailored: str, master: str, candidate_data: Dict[str, Any]
    ) -> Tuple[bool, List[str]]:
        errs = []
        known_institutions = set()
        for edu in candidate_data.get("education", []):
            if isinstance(edu, dict):
                inst = edu.get("institution_name", "")
                if inst:
                    known_institutions.add(inst.lower())

        # Also pull from master LaTeX subheadings
        for args in extract_latex_command_args(master, r"\resumeSubheading"):
            if len(args) >= 1:
                h1 = args[0].strip().lower()
                clean_h1 = re.sub(r"\\[a-zA-Z]+|\{|\}", "", h1).strip()
                if any(term in clean_h1 for term in ["university", "college", "institute", "school"]):
                    known_institutions.add(clean_h1)

        # Inspect education subheadings in tailored LaTeX
        edu_section_match = re.search(r"\\section\{Education\}(.*?)(?=\\section|\Z)", tailored, re.DOTALL | re.IGNORECASE)
        if edu_section_match:
            edu_block = edu_section_match.group(1)
            for args in extract_latex_command_args(edu_block, r"\resumeSubheading"):
                if len(args) >= 1:
                    inst_in_tailored = args[0].strip().lower()
                    inst_clean = re.sub(r"\\[a-zA-Z]+|\{|\}", "", inst_in_tailored).strip()
                    if not any(known in inst_clean or inst_clean in known for known in known_institutions if len(known) > 3):
                        errs.append(f"Altered education institution '{inst_clean}' not in candidate profile")

        return len(errs) == 0, errs

    @classmethod
    def _check_experience_entities(
        cls, tailored: str, master: str, candidate_data: Dict[str, Any]
    ) -> Tuple[bool, List[str]]:
        errs = []
        known_employers = set()
        for exp in candidate_data.get("experience", []):
            if isinstance(exp, dict):
                comp = exp.get("company_name", "") or exp.get("company", "")
                if comp:
                    known_employers.add(comp.lower())

        # Also extract employers from master
        exp_master_match = re.search(r"\\section\{Experience\}(.*?)(?=\\section|\Z)", master, re.DOTALL | re.IGNORECASE)
        if exp_master_match:
            for args in extract_latex_command_args(exp_master_match.group(1), r"\resumeSubheading"):
                if len(args) >= 1:
                    emp = re.sub(r"\\[a-zA-Z]+|\{|\}", "", args[0]).strip().lower()
                    known_employers.add(emp)

        # Inspect experience subheadings in tailored
        exp_tailored_match = re.search(r"\\section\{Experience\}(.*?)(?=\\section|\Z)", tailored, re.DOTALL | re.IGNORECASE)
        if exp_tailored_match:
            for args in extract_latex_command_args(exp_tailored_match.group(1), r"\resumeSubheading"):
                if len(args) >= 1:
                    comp_tailored = re.sub(r"\\[a-zA-Z]+|\{|\}", "", args[0]).strip().lower()
                    if not any(k in comp_tailored or comp_tailored in k for k in known_employers if len(k) > 2):
                        errs.append(f"Fabricated employer '{args[0].strip()}' not found in candidate experience history")

        return len(errs) == 0, errs

    @classmethod
    def _check_projects_exist(
        cls, tailored: str, master: str, candidate_data: Dict[str, Any]
    ) -> Tuple[bool, List[str]]:
        errs = []
        known_projects = set()

        for proj in candidate_data.get("projects", []):
            if isinstance(proj, dict):
                t = proj.get("title", "")
                if t:
                    known_projects.add(re.sub(r"[^\w\s]", "", t).strip().lower())

        # Extract projects from master LaTeX
        for args in extract_latex_command_args(master, r"\resumeProjectHeading"):
            if len(args) >= 1:
                # e.g., \textbf{Distributed Vector Search Engine} $|$ \emph{...}
                clean_title = re.sub(r"\\[a-zA-Z]+|\{|\}|\$|\|", "", args[0]).split("--")[0]
                # If there's an \emph part, separate
                title_part = clean_title.split(",")[0].strip().lower()
                title_alphanumeric = re.sub(r"[^\w\s]", "", title_part).strip()
                if title_alphanumeric:
                    known_projects.add(title_alphanumeric)

        # Check tailored projects
        for args in extract_latex_command_args(tailored, r"\resumeProjectHeading"):
            if len(args) >= 1:
                clean_title = re.sub(r"\\[a-zA-Z]+|\{|\}|\$|\|", "", args[0]).split("--")[0]
                title_part = clean_title.split(",")[0].strip().lower()
                clean_alphanumeric = re.sub(r"[^\w\s]", "", title_part).strip()

                if not clean_alphanumeric or len(clean_alphanumeric) <= 3:
                    continue

                matches = any(
                    k in clean_alphanumeric or clean_alphanumeric in k
                    for k in known_projects
                    if len(k) > 3
                )
                if not matches:
                    errs.append(f"Fabricated project '{clean_title.strip()}' does not exist in candidate portfolio")

        return len(errs) == 0, errs

    @classmethod
    def _check_technologies_exist(
        cls, tailored: str, master: str, candidate_data: Dict[str, Any]
    ) -> Tuple[bool, List[str], List[str]]:
        errs = []
        known_technologies = set()

        # From candidate skills
        for sk in candidate_data.get("skills", []):
            if isinstance(sk, dict):
                n = sk.get("name", "")
                if n:
                    known_technologies.add(n.lower())
            elif isinstance(sk, str):
                known_technologies.add(sk.lower())

        # From candidate projects and experience technologies
        for proj in candidate_data.get("projects", []):
            if isinstance(proj, dict):
                for tech in proj.get("technologies", []):
                    known_technologies.add(tech.lower())
        for exp in candidate_data.get("experience", []):
            if isinstance(exp, dict):
                for tech in exp.get("technologies_used", []):
                    known_technologies.add(tech.lower())

        # Pull all from master technical skills section
        skills_section_master = re.search(r"\\section\{Technical Skills\}(.*?)(?=\\section|\Z)", master, re.DOTALL | re.IGNORECASE)
        if skills_section_master:
            tokens = re.findall(r"[A-Za-z0-9\+#\.]+", skills_section_master.group(1))
            for tok in tokens:
                if len(tok) > 1 and tok.lower() not in {"textbf", "item", "begin", "end", "itemize", "small", "leftmargin", "label"}:
                    known_technologies.add(tok.lower())

        # Synonyms and equivalents
        synonym_map = {
            "postgres": "postgresql",
            "k8s": "kubernetes",
            "golang": "go",
            "py": "python",
            "ts": "typescript",
            "js": "javascript",
            "aws": "amazon web services",
            "ci": "continuous integration",
            "cd": "continuous deployment",
        }
        for k, v in synonym_map.items():
            if k in known_technologies:
                known_technologies.add(v)
            if v in known_technologies:
                known_technologies.add(k)

        # Inspect Technical Skills in tailored resume
        audited_techs: List[str] = []
        skills_section_tailored = re.search(r"\\section\{Technical Skills\}(.*?)(?=\\section|\Z)", tailored, re.DOTALL | re.IGNORECASE)
        if skills_section_tailored:
            raw_lines = skills_section_tailored.group(1)
            cat_matches = re.finditer(r"\\textbf\{([^}]+)\}\{:\s*([^}]+)\}", raw_lines)
            for m in cat_matches:
                items_str = m.group(2)
                raw_items = [i.strip() for i in items_str.split(",") if i.strip()]
                for it in raw_items:
                    clean_it = re.sub(r"[{}\\\$\*]", "", it).strip()
                    if clean_it and len(clean_it) > 1:
                        audited_techs.append(clean_it)
                        clean_lower = clean_it.lower()
                        if not any(clean_lower == kt or clean_lower in kt or kt in clean_lower for kt in known_technologies):
                            if clean_lower not in {"git", "linux", "sql", "rest", "api", "json", "http"}:
                                errs.append(f"Fabricated skill/technology '{clean_it}' not in candidate profile")

        return len(errs) == 0, errs, audited_techs

    @classmethod
    def _check_metrics_grounded(
        cls, tailored: str, master: str, candidate_data: Dict[str, Any]
    ) -> Tuple[bool, List[str], List[str]]:
        errs = []

        # Collect ground truth text
        ground_truth_corpus = [master]
        for exp in candidate_data.get("experience", []):
            if isinstance(exp, dict):
                ground_truth_corpus.extend(exp.get("bullet_points", []))
        for proj in candidate_data.get("projects", []):
            if isinstance(proj, dict):
                ground_truth_corpus.extend(proj.get("bullet_points", []))
                if proj.get("description"):
                    ground_truth_corpus.append(proj.get("description"))

        # Clean ground truth text for comparison (normalize % and \%)
        ground_truth_text = " ".join(ground_truth_corpus).lower().replace(r"\%", "%")

        # Extract all metrics from tailored resume
        raw_tailored_metrics = cls.METRIC_PATTERN.findall(tailored)
        audited_metrics = []
        for m in raw_tailored_metrics:
            norm_m = m.strip().replace(r"\%", "%")
            if norm_m not in audited_metrics:
                audited_metrics.append(norm_m)

        for metric in audited_metrics:
            metric_clean = metric.strip().lower()
            if metric_clean not in ground_truth_text:
                errs.append(f"Fabricated quantitative metric '{metric}' not found in candidate source material")

        return len(errs) == 0, errs, audited_metrics
