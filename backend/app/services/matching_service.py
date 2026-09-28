import re
import uuid
import datetime
from typing import Optional, List, Dict, Any, Tuple, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from backend.app.models.candidate import Candidate, Experience, Project, Skill, Education
from backend.app.models.job import Job, JobRequirement, MatchResult
from backend.app.schemas.matching import (
    MatchWeights,
    MatchResponse,
    EvidenceItem,
    RelevantProjectMatch,
)
from backend.app.services.embedding_service import EmbeddingService
from backend.app.core.logging import logger


class MatchingService:
    """
    Deterministic Candidate–Job Matching Engine with pgvector semantic similarity
    and verifiable, grounded evidence citations.
    """

    SKILL_SYNONYMS = {
        "python": {"python", "python3", "py"},
        "golang": {"golang", "go"},
        "go": {"golang", "go"},
        "postgresql": {"postgresql", "postgres", "psql", "pgvector"},
        "postgres": {"postgresql", "postgres", "psql", "pgvector"},
        "kubernetes": {"kubernetes", "k8s"},
        "k8s": {"kubernetes", "k8s"},
        "docker": {"docker", "containerization", "containers"},
        "aws": {"aws", "amazon web services", "amazon cloud"},
        "fastapi": {"fastapi", "fast-api"},
        "next.js": {"next.js", "nextjs", "next"},
        "nextjs": {"next.js", "nextjs", "next"},
        "react": {"react", "react.js", "reactjs"},
        "typescript": {"typescript", "ts"},
        "javascript": {"javascript", "js"},
        "c++": {"c++", "cpp"},
        "rust": {"rust", "rustlang"},
        "kafka": {"kafka", "apache kafka"},
        "redis": {"redis"},
        "rest apis": {"rest", "rest api", "rest apis", "restful"},
        "microservices": {"microservices", "microservice architecture"},
        "distributed systems": {"distributed systems", "distributed architecture"},
        "llms": {"llms", "large language models", "llm"},
        "rag": {"rag", "retrieval augmented generation", "retrieval-augmented generation"},
    }

    @classmethod
    async def match_candidate_to_job(
        cls,
        session: AsyncSession,
        job_id: str,
        candidate_id: Optional[str] = None,
        weights: Optional[MatchWeights] = None,
    ) -> MatchResponse:
        """
        Executes complete deterministic matching engine evaluation:
        1. Loads Job and Candidate entities.
        2. Calculates required and preferred skill coverage.
        3. Computes semantic vector similarity via EmbeddingService / pgvector.
        4. Evaluates experience and education compatibility.
        5. Identifies top relevant projects.
        6. Builds grounded, un-hallucinated evidence citations.
        7. Computes weighted overall match score.
        8. Persists MatchResult record.
        """
        w = weights or MatchWeights()

        # 1. Fetch Job
        stmt_job = select(Job).where(Job.id == job_id)
        res_job = await session.execute(stmt_job)
        job = res_job.scalars().first()
        if not job:
            raise ValueError(f"Job with ID '{job_id}' not found.")

        # 2. Fetch Candidate
        if candidate_id:
            stmt_cand = select(Candidate).where(Candidate.id == candidate_id)
        else:
            stmt_cand = select(Candidate).order_by(desc(Candidate.created_at)).limit(1)

        res_cand = await session.execute(stmt_cand)
        candidate = res_cand.scalars().first()
        if not candidate:
            raise ValueError("No candidate profile found. Please create or import a candidate profile first.")

        # 3. Extract Candidate Vocabulary & Evidence Pool
        candidate_skills_map = cls._extract_candidate_skills(candidate)
        candidate_evidence_pool = cls._build_evidence_pool(candidate)

        # 4. Evaluate Required Skills Coverage (Weight: 35%)
        req_skills = job.required_skills or []
        if not req_skills and job.requirements:
            req_skills = [r.name for r in job.requirements if r.requirement_type == "required"]

        matched_req, missing_req = cls._partition_skills(req_skills, candidate_skills_map)
        req_coverage = 100.0 if not req_skills else round((len(matched_req) / len(req_skills)) * 100.0, 1)

        # 5. Evaluate Preferred Skills Coverage
        pref_skills = job.preferred_skills or []
        if not pref_skills and job.requirements:
            pref_skills = [r.name for r in job.requirements if r.requirement_type == "preferred"]

        matched_pref, missing_pref = cls._partition_skills(pref_skills, candidate_skills_map)
        pref_coverage = 100.0 if not pref_skills else round((len(matched_pref) / len(pref_skills)) * 100.0, 1)

        all_matched_skills = list(dict.fromkeys(matched_req + matched_pref))

        # 6. Semantic Similarity (Weight: 25%)
        cand_summary = f"{candidate.headline or ''} {candidate.summary or ''} {' '.join(s.name for s in candidate.skills)}"
        job_summary = f"{job.role} at {job.company}. {job.summary or ''} {' '.join(req_skills + pref_skills)}"

        cand_vec = await EmbeddingService.get_embedding(cand_summary)
        job_vec = await EmbeddingService.get_embedding(job_summary)
        cosine_sim = EmbeddingService.cosine_similarity(cand_vec, job_vec)
        semantic_score = round(cosine_sim * 100.0, 1)

        # 7. Experience Compatibility (Weight: 15%)
        exp_score, cand_years, req_years = cls._evaluate_experience(candidate, job.experience_requirement)

        # 8. Education Compatibility (Weight: 10%)
        edu_score = cls._evaluate_education(candidate, job.education_requirements)

        # 9. Project Relevance (Weight: 15%)
        relevant_projects, proj_score = cls._evaluate_projects(candidate, job)

        # 10. Compute Verifiable Evidence Citations
        evidence_list = cls._find_grounded_evidence(job, candidate_evidence_pool)

        # 11. Calculate Overall Deterministic Score
        weight_total = (
            w.required_skill_coverage
            + w.semantic_skill_similarity
            + w.experience_compatibility
            + w.project_relevance
            + w.education_compatibility
        )
        if weight_total <= 0:
            weight_total = 1.0

        raw_overall = (
            (req_coverage * w.required_skill_coverage)
            + (semantic_score * w.semantic_skill_similarity)
            + (exp_score * w.experience_compatibility)
            + (proj_score * w.project_relevance)
            + (edu_score * w.education_compatibility)
        ) / weight_total

        overall_score = round(max(0.0, min(100.0, raw_overall)), 1)

        # 12. Honest Grounded Explanation
        explanation = cls._generate_grounded_explanation(
            overall_score=overall_score,
            role=job.role,
            company=job.company,
            matched_req=matched_req,
            missing_req=missing_req,
            missing_pref=missing_pref,
            cand_years=cand_years,
            req_years=req_years,
            relevant_projects=relevant_projects,
        )

        weights_dict = {
            "required_skill_coverage": w.required_skill_coverage,
            "semantic_skill_similarity": w.semantic_skill_similarity,
            "experience_compatibility": w.experience_compatibility,
            "project_relevance": w.project_relevance,
            "education_compatibility": w.education_compatibility,
        }

        # 13. Persist MatchResult
        match_id = str(uuid.uuid4())
        match_record = MatchResult(
            id=match_id,
            candidate_id=candidate.id,
            job_id=job.id,
            overall_match_score=overall_score,
            required_skill_coverage=req_coverage,
            preferred_skill_coverage=pref_coverage,
            semantic_score=semantic_score,
            experience_compatibility=exp_score,
            education_compatibility=edu_score,
            project_relevance=proj_score,
            total_score=overall_score,
            matched_skills=all_matched_skills,
            missing_required_skills=missing_req,
            missing_preferred_skills=missing_pref,
            relevant_projects=[p.model_dump() for p in relevant_projects],
            evidence=[e.model_dump() for e in evidence_list],
            weights_used=weights_dict,
            explanation=explanation,
        )
        session.add(match_record)
        await session.commit()

        return MatchResponse(
            id=match_id,
            candidate_id=candidate.id,
            job_id=job.id,
            overall_match_score=overall_score,
            required_skill_coverage=req_coverage,
            preferred_skill_coverage=pref_coverage,
            semantic_score=semantic_score,
            experience_compatibility=exp_score,
            education_compatibility=edu_score,
            project_relevance=proj_score,
            matched_skills=all_matched_skills,
            missing_required_skills=missing_req,
            missing_preferred_skills=missing_pref,
            relevant_projects=relevant_projects,
            evidence=evidence_list,
            explanation=explanation,
            weights_used=weights_dict,
            created_at=datetime.datetime.utcnow(),
        )

    # -------------------------------------------------------------------------
    # Helper Evaluators
    # -------------------------------------------------------------------------

    @classmethod
    def _extract_candidate_skills(cls, candidate: Candidate) -> Dict[str, str]:
        """Maps normalized candidate skills to their original casing."""
        skills_map: Dict[str, str] = {}
        for s in candidate.skills:
            norm = s.name.lower().strip()
            skills_map[norm] = s.name

        # Also register skills mentioned in projects and experiences
        for p in candidate.projects:
            for tech in p.technologies:
                norm = tech.lower().strip()
                if norm not in skills_map:
                    skills_map[norm] = tech

        for exp in candidate.experiences:
            for tech in exp.technologies_used:
                norm = tech.lower().strip()
                if norm not in skills_map:
                    skills_map[norm] = tech

        return skills_map

    @classmethod
    def _partition_skills(
        cls,
        target_skills: List[str],
        candidate_skills_map: Dict[str, str],
    ) -> Tuple[List[str], List[str]]:
        """Partitions target skills into matched vs missing using synonym awareness."""
        matched: List[str] = []
        missing: List[str] = []

        for skill in target_skills:
            clean_s = skill.strip()
            norm_s = clean_s.lower()

            # Check direct or synonym match
            synonyms = cls.SKILL_SYNONYMS.get(norm_s, {norm_s})
            found = False
            for syn in synonyms:
                if syn in candidate_skills_map:
                    matched.append(clean_s)
                    found = True
                    break

            if not found:
                # Substring match (e.g. "Python" inside "Python 3")
                for cand_norm, cand_orig in candidate_skills_map.items():
                    if norm_s in cand_norm or cand_norm in norm_s:
                        matched.append(clean_s)
                        found = True
                        break

            if not found:
                missing.append(clean_s)

        return matched, missing

    @classmethod
    def _evaluate_experience(
        cls, candidate: Candidate, exp_requirement: Optional[str]
    ) -> Tuple[float, float, float]:
        """Calculates experience tenure compatibility score."""
        # Calculate total candidate experience in years
        total_months = 0
        for exp in candidate.experiences:
            # Estimate duration
            months = 18  # default baseline if parsing fails
            if exp.start_date:
                start_year_m = re.search(r'\b(20\d\d|19\d\d)\b', exp.start_date)
                start_year = int(start_year_m.group(0)) if start_year_m else 2021

                if exp.is_current or not exp.end_date or "present" in (exp.end_date or "").lower():
                    end_year = datetime.datetime.now().year
                else:
                    end_year_m = re.search(r'\b(20\d\d|19\d\d)\b', exp.end_date)
                    end_year = int(end_year_m.group(0)) if end_year_m else start_year + 1

                months = max(6, (end_year - start_year) * 12)
            total_months += months

        cand_years = round(total_months / 12.0, 1)

        # Parse required years from JD
        req_years = 2.0
        if exp_requirement:
            num_match = re.search(r'(\d+)\+?', exp_requirement)
            if num_match:
                req_years = float(num_match.group(1))

        if cand_years >= req_years:
            score = 100.0
        else:
            ratio = cand_years / max(1.0, req_years)
            score = round(max(30.0, ratio * 100.0), 1)

        return score, cand_years, req_years

    @classmethod
    def _evaluate_education(
        cls, candidate: Candidate, edu_requirements: List[str]
    ) -> float:
        """Calculates education compatibility score."""
        if not edu_requirements:
            return 100.0

        if not candidate.education:
            # Candidate has no degrees listed
            return 60.0

        highest_degree = "none"
        technical_field = False

        for edu in candidate.education:
            deg_lower = edu.degree.lower()
            field_lower = (edu.field_of_study or "").lower()

            if any(k in deg_lower for k in ["phd", "ph.d", "doctorate"]):
                highest_degree = "phd"
            elif any(k in deg_lower for k in ["master", "m.s", "ms", "mba"]) and highest_degree != "phd":
                highest_degree = "master"
            elif any(k in deg_lower for k in ["bachelor", "b.s", "bs", "b.a", "ba"]) and highest_degree not in ["phd", "master"]:
                highest_degree = "bachelor"

            if any(f in field_lower or f in deg_lower for f in ["computer", "engineering", "data", "science", "software", "information"]):
                technical_field = True

        req_text = " ".join(edu_requirements).lower()
        if "master" in req_text or "ph" in req_text:
            if highest_degree in ["phd", "master"]:
                return 100.0
            return 85.0 if technical_field else 70.0

        # Bachelor requirement
        if highest_degree in ["phd", "master", "bachelor"]:
            return 100.0 if technical_field else 90.0

        return 75.0

    @classmethod
    def _evaluate_projects(
        cls, candidate: Candidate, job: Job
    ) -> Tuple[List[RelevantProjectMatch], float]:
        """Ranks candidate projects against job technologies and requirements."""
        if not candidate.projects:
            return [], 50.0

        job_tokens = set(t.lower() for t in (job.technologies + job.required_skills))
        ranked_projects: List[RelevantProjectMatch] = []

        for p in candidate.projects:
            matching_techs = []
            for t in p.technologies:
                if t.lower() in job_tokens or any(t.lower() in jt for jt in job_tokens):
                    matching_techs.append(t)

            # Check bullet points for domain overlap
            bullet_hits = 0
            best_bullet = None
            for b in p.bullet_points:
                if any(jt in b.lower() for jt in job_tokens):
                    bullet_hits += 1
                    best_bullet = best_bullet or b

            base_overlap = len(matching_techs) / max(1, min(4, len(job_tokens)))
            score = round(min(100.0, (base_overlap * 70.0) + (bullet_hits * 15.0) + 15.0), 1)

            ranked_projects.append(
                RelevantProjectMatch(
                    id=p.id,
                    title=p.title,
                    description=p.description,
                    relevance_score=score,
                    matching_skills=matching_techs,
                    key_bullet=best_bullet or (p.bullet_points[0] if p.bullet_points else None),
                )
            )

        ranked_projects.sort(key=lambda x: x.relevance_score, reverse=True)
        top_scores = [p.relevance_score for p in ranked_projects[:2]]
        avg_score = round(sum(top_scores) / len(top_scores), 1) if top_scores else 60.0
        return ranked_projects, avg_score

    @classmethod
    def _build_evidence_pool(cls, candidate: Candidate) -> List[Dict[str, Any]]:
        """Collects all factual text snippets from the candidate's profile."""
        pool: List[Dict[str, Any]] = []

        # 1. Experiences & Bullets
        for exp in candidate.experiences:
            source_title = f"{exp.company} ({exp.role})"
            for bullet in exp.bullet_points:
                pool.append({
                    "source_type": "experience",
                    "source_title": source_title,
                    "quote": bullet,
                    "technologies": exp.technologies_used,
                })

        # 2. Projects & Bullets
        for p in candidate.projects:
            source_title = f"Project: {p.title}"
            if p.description:
                pool.append({
                    "source_type": "project",
                    "source_title": source_title,
                    "quote": p.description,
                    "technologies": p.technologies,
                })
            for bullet in p.bullet_points:
                pool.append({
                    "source_type": "project",
                    "source_title": source_title,
                    "quote": bullet,
                    "technologies": p.technologies,
                })

        # 3. Verified Skills
        for s in candidate.skills:
            pool.append({
                "source_type": "skill",
                "source_title": f"Skill: {s.name}",
                "quote": f"Verified competency in {s.name} ({s.proficiency_level or 'Proficient'}).",
                "technologies": [s.name],
            })

        return pool

    @classmethod
    def _find_grounded_evidence(
        cls, job: Job, evidence_pool: List[Dict[str, Any]]
    ) -> List[EvidenceItem]:
        """
        Locates verifiable, non-hallucinated evidence citations from the candidate profile
        matching requirements and responsibilities.
        """
        evidence_items: List[EvidenceItem] = []
        seen_quotes = set()

        target_requirements = []
        for req in (job.required_skills or []):
            target_requirements.append((req, "required"))
        for pref in (job.preferred_skills or []):
            target_requirements.append((pref, "preferred"))

        for req_name, req_type in target_requirements:
            norm_target = req_name.lower().strip()
            synonyms = cls.SKILL_SYNONYMS.get(norm_target, {norm_target})

            best_item = None
            for item in evidence_pool:
                quote_text = item["quote"].lower()
                techs = [t.lower() for t in item["technologies"]]

                # Match if keyword or any synonym appears in bullet quote or item technologies
                if any(syn in quote_text for syn in synonyms) or any(syn in techs for syn in synonyms):
                    if item["quote"] not in seen_quotes:
                        best_item = item
                        break

            if best_item:
                seen_quotes.add(best_item["quote"])
                evidence_items.append(
                    EvidenceItem(
                        requirement=req_name,
                        requirement_type=req_type,
                        evidence_quote=best_item["quote"],
                        source_type=best_item["source_type"],
                        source_title=best_item["source_title"],
                        confidence=0.95 if best_item["source_type"] in ["experience", "project"] else 0.85,
                    )
                )

        return evidence_items

    @classmethod
    def _generate_grounded_explanation(
        cls,
        overall_score: float,
        role: str,
        company: str,
        matched_req: List[str],
        missing_req: List[str],
        missing_pref: List[str],
        cand_years: float,
        req_years: float,
        relevant_projects: List[RelevantProjectMatch],
    ) -> str:
        """Constructs an honest, grounded narrative of candidate alignment."""
        tier = "an Outstanding" if overall_score >= 85 else ("a Strong" if overall_score >= 70 else "a Moderate")

        sentences = [
            f"Candidate is {tier} match ({overall_score}%) for the {role} role at {company}."
        ]

        if matched_req:
            top_matches = ", ".join(matched_req[:5])
            sentences.append(f"Strongly satisfies core required capabilities including {top_matches}.")

        if cand_years >= req_years:
            sentences.append(f"Tenure requirements are fully met with {cand_years} years of professional engineering experience (vs {req_years} required).")
        else:
            sentences.append(f"Candidate brings {cand_years} years of experience against the stated {req_years}+ years expectation.")

        if relevant_projects:
            top_proj = relevant_projects[0]
            sentences.append(f"Primary project alignment evidenced in '{top_proj.title}' ({top_proj.relevance_score}% relevance).")

        if missing_req:
            gap_str = ", ".join(missing_req)
            sentences.append(f"Key required gap to bridge: {gap_str}.")
        elif missing_pref:
            gap_pref = ", ".join(missing_pref[:3])
            sentences.append(f"Optional preferred competencies not yet evidenced: {gap_pref}.")
        else:
            sentences.append("All key technical qualifications are covered across profile and projects.")

        return " ".join(sentences)
