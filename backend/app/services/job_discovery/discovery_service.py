import re
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_, and_, func

from backend.app.models.job import Job, JobRequirement, MatchResult, JobAlert
from backend.app.models.candidate import Candidate
from backend.app.models.application import Application, ApplicationStatus
from backend.app.schemas.job import (
    JobResponse,
    JobRequirementResponse,
    JobUrlImportRequest,
    JobUrlImportResponse,
    JobBulkImportRequest,
    JobBulkImportResponse,
    JobImportResultItem,
    RecommendedJobsResponse,
    RecommendedJobItem,
    JobDiscoveryRequest,
    JobAlertItem,
    JobDiscoveryResponse,
    JobSearchFilterRequest,
    JobSearchFilterResponse,
    SourceCapabilityResponse,
    JobSaveRequest,
    JobIgnoreRequest,
    JobAlertCreate,
    JobAlertUpdate,
    JobAlertResponse,
)
from backend.app.services.job_discovery.url_normalizer import (
    normalize_job_url,
    generate_job_dedup_hash,
    is_job_expired,
)
from backend.app.services.job_discovery.normalizer import (
    normalize_job_title,
    classify_fresher_and_experience,
    normalize_location,
    normalize_employment_type,
    extract_truthful_salary,
    extract_truthful_deadline,
)
from backend.app.services.job_discovery.scam_detector import detect_scam_signals
from backend.app.services.job_discovery.sources.url_source import UrlJobSource
from backend.app.services.job_discovery.sources.public_feed_source import PublicFeedJobSource
from backend.app.services.job_discovery.sources.career_page_source import CompanyCareerSource
from backend.app.services.job_discovery.sources.user_configured_source import UserConfiguredSource
from backend.app.services.job_discovery.sources.linkedin_source import LinkedInJobSourceAdapter
from backend.app.services.job_discovery.sources.freshershunt_source import FreshersHuntJobSourceAdapter
from backend.app.services.job_discovery.sources.indeed_source import IndeedJobSourceAdapter
from backend.app.services.job_discovery.sources.naukri_source import NaukriJobSourceAdapter
from backend.app.services.job_discovery.sources.internshala_source import InternshalaJobSourceAdapter
from backend.app.services.job_discovery.sources.freshersworld_source import FreshersworldJobSourceAdapter
from backend.app.services.job_discovery.sources.wellfound_source import WellfoundJobSourceAdapter
from backend.app.services.job_discovery.sources.foundit_source import FounditJobSourceAdapter
from backend.app.services.job_discovery.sources.glassdoor_source import GlassdoorJobSourceAdapter
from backend.app.services.job_analyzer_service import JobAnalyzerService
from backend.app.services.matching_service import MatchingService
from backend.app.services.n8n import N8nService
from backend.app.core.config import settings
from backend.app.core.logging import logger


class JobDiscoveryService:
    """
    Core orchestrator for Job Discovery, ingestion, deduplication, URL normalization,
    expired job filtering, and candidate-tailored recommendations.
    """

    @classmethod
    async def import_job_from_url(
        cls,
        session: AsyncSession,
        request: JobUrlImportRequest,
    ) -> JobUrlImportResponse:
        """
        Ingests and analyzes a single job posting from a user-provided URL:
        1. Normalizes and canonicalizes the URL (strips tracking params).
        2. Detects existing duplicates via canonical URL or content hash.
        3. Safely extracts job details (JSON-LD or HTML text).
        4. Detects expiration.
        5. Normalizes into common Job schema and saves to database.
        """
        canon_url = normalize_job_url(request.url)

        # 1. Duplicate check via canonical URL
        existing_stmt = select(Job).where(Job.canonical_url == canon_url)
        existing_res = await session.execute(existing_stmt)
        existing_job = existing_res.scalars().first()
        if existing_job:
            logger.info(f"Duplicate job detected by canonical URL: {canon_url}")
            return JobUrlImportResponse(
                job=cls._job_model_to_response(existing_job),
                is_duplicate=True,
                is_expired=existing_job.is_expired,
                canonical_url=canon_url,
                message="Job already imported in database (duplicate URL detected).",
            )

        # 2. Fetch using UrlJobSource
        source = UrlJobSource()
        raw_postings = await source.fetch_jobs(
            url=canon_url,
            company_hint=request.company,
            role_hint=request.role,
            source_name=request.source_name,
        )

        if not raw_postings:
            raise ValueError(f"No job content could be retrieved from '{canon_url}'")

        raw_job = raw_postings[0]
        normalized = source.normalize_job(raw_job)

        # 3. Duplicate check via content dedup_hash
        dedup_hash = normalized["dedup_hash"]
        hash_stmt = select(Job).where(Job.dedup_hash == dedup_hash)
        hash_res = await session.execute(hash_stmt)
        existing_by_hash = hash_res.scalars().first()
        if existing_by_hash:
            logger.info(f"Duplicate job detected by dedup hash: {normalized['company']} - {normalized['role']}")
            return JobUrlImportResponse(
                job=cls._job_model_to_response(existing_by_hash),
                is_duplicate=True,
                is_expired=existing_by_hash.is_expired,
                canonical_url=canon_url,
                message="Duplicate job posting detected (identical company, role, and location).",
            )

        # 4. Analyze and store into common Job schema via JobAnalyzerService
        # Ensures itemized requirements, required vs preferred skills, and embeddings are created
        analyzed_job = await JobAnalyzerService.analyze_and_store_job(
            session=session,
            job_description=normalized["raw_description"],
            job_url=canon_url,
            company=normalized["company"],
            role=normalized["role"],
        )

        # Update Phase 8 discovery metadata
        analyzed_job.source_type = normalized["source_type"]
        analyzed_job.source_name = normalized["source_name"]
        analyzed_job.canonical_url = canon_url
        analyzed_job.is_active = normalized["is_active"]
        analyzed_job.is_expired = normalized["is_expired"]
        analyzed_job.dedup_hash = dedup_hash

        await session.commit()
        await session.refresh(analyzed_job)

        return JobUrlImportResponse(
            job=cls._job_model_to_response(analyzed_job),
            is_duplicate=False,
            is_expired=analyzed_job.is_expired,
            canonical_url=canon_url,
            message="Job successfully imported and structured into common schema.",
        )

    @classmethod
    async def import_bulk_jobs(
        cls,
        session: AsyncSession,
        request: JobBulkImportRequest,
    ) -> JobBulkImportResponse:
        """
        Batch imports job opportunities from public authorized feeds, company career portals,
        or user-configured sources. Automatically normalizes, deduplicates, and checks expiration.
        """
        source_type = request.source_type or "user_configured"

        # Select appropriate source handler
        if source_type == "public_feed":
            source = PublicFeedJobSource()
            raw_jobs = await source.fetch_jobs(feed_url=request.feed_url)
        elif source_type == "career_page":
            source = CompanyCareerSource()
            raw_jobs = await source.fetch_jobs(company=request.source_name or "Company")
        else:
            source = UserConfiguredSource()
            raw_jobs = await source.fetch_jobs(jobs=request.jobs, source_name=request.source_name)

        if not raw_jobs:
            return JobBulkImportResponse(
                total_processed=0,
                imported_count=0,
                duplicate_count=0,
                expired_count=0,
                results=[],
                jobs=[],
            )

        # Collect existing canonical URLs and dedup hashes for batch deduplication
        existing_urls_stmt = select(Job.canonical_url).where(Job.canonical_url.is_not(None))
        urls_res = await session.execute(existing_urls_stmt)
        existing_urls = set(urls_res.scalars().all())

        existing_hashes_stmt = select(Job.dedup_hash).where(Job.dedup_hash.is_not(None))
        hashes_res = await session.execute(existing_hashes_stmt)
        existing_hashes = set(hashes_res.scalars().all())

        seen_in_batch: Set[str] = set()

        imported_jobs: List[Job] = []
        results: List[JobImportResultItem] = []
        dup_count = 0
        exp_count = 0

        for raw in raw_jobs:
            normalized = source.normalize_job(raw)
            c_url = normalized.get("canonical_url")
            d_hash = normalized.get("dedup_hash")

            # Check duplicate
            is_dup = (
                (c_url and c_url in existing_urls)
                or (d_hash and d_hash in existing_hashes)
                or (d_hash and d_hash in seen_in_batch)
                or (c_url and c_url in seen_in_batch)
            )

            if is_dup:
                dup_count += 1
                results.append(
                    JobImportResultItem(
                        company=normalized["company"],
                        role=normalized["role"],
                        canonical_url=c_url,
                        status="duplicate",
                        is_duplicate=True,
                        message="Skipped: job already exists in database.",
                    )
                )
                continue

            if c_url:
                seen_in_batch.add(c_url)
            if d_hash:
                seen_in_batch.add(d_hash)

            if normalized.get("is_expired"):
                exp_count += 1

            # Create Job record in common schema
            job_record = Job(
                company=normalized["company"],
                role=normalized["role"],
                location=normalized["location"],
                employment_type=normalized["employment_type"],
                raw_description=normalized["raw_description"],
                summary=normalized["raw_description"][:300] + "...",
                salary=normalized.get("salary"),
                deadline=normalized.get("deadline"),
                application_url=c_url,
                canonical_url=c_url,
                external_id=normalized.get("external_id"),
                source_type=normalized["source_type"],
                source_name=normalized["source_name"],
                is_active=normalized.get("is_active", True),
                is_expired=normalized.get("is_expired", False),
                dedup_hash=d_hash,
                required_skills=normalized.get("required_skills", []),
                preferred_skills=normalized.get("preferred_skills", []),
                technologies=list(set(normalized.get("required_skills", []) + normalized.get("preferred_skills", []))),
            )
            session.add(job_record)
            await session.flush()

            # Add basic JobRequirements from required/preferred skills
            for req_skill in job_record.required_skills:
                req = JobRequirement(
                    job_id=job_record.id,
                    name=req_skill,
                    requirement_type="required",
                    category="skill",
                )
                session.add(req)

            for pref_skill in job_record.preferred_skills:
                pref = JobRequirement(
                    job_id=job_record.id,
                    name=pref_skill,
                    requirement_type="preferred",
                    category="skill",
                )
                session.add(pref)

            imported_jobs.append(job_record)
            results.append(
                JobImportResultItem(
                    job_id=job_record.id,
                    company=job_record.company,
                    role=job_record.role,
                    canonical_url=c_url,
                    status="imported",
                    is_duplicate=False,
                    message="Imported successfully.",
                )
            )

        await session.commit()
        for j in imported_jobs:
            await session.refresh(j)

        return JobBulkImportResponse(
            total_processed=len(raw_jobs),
            imported_count=len(imported_jobs),
            duplicate_count=dup_count,
            expired_count=exp_count,
            results=results,
            jobs=[cls._job_model_to_response(j) for j in imported_jobs],
        )

    @classmethod
    async def list_jobs(
        cls,
        session: AsyncSession,
        role: Optional[str] = None,
        company: Optional[str] = None,
        location: Optional[str] = None,
        skills: Optional[str] = None,
        source: Optional[str] = None,
        is_active: Optional[bool] = None,
        min_match_score: Optional[float] = None,
        candidate_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[JobResponse]:
        """
        Searches, filters, and paginates jobs across:
        - role keyword
        - company keyword
        - location keyword
        - required/preferred skills
        - source type or source name
        - active / expired status
        - candidate match score threshold
        """
        query = select(Job)

        conditions = []
        if role:
            conditions.append(Job.role.ilike(f"%{role.strip()}%"))
        if company:
            conditions.append(Job.company.ilike(f"%{company.strip()}%"))
        if location:
            conditions.append(Job.location.ilike(f"%{location.strip()}%"))
        if source:
            conditions.append(
                or_(
                    Job.source_type.ilike(f"%{source.strip()}%"),
                    Job.source_name.ilike(f"%{source.strip()}%"),
                )
            )
        if is_active is not None:
            conditions.append(Job.is_active == is_active)

        if conditions:
            query = query.where(and_(*conditions))

        query = query.order_by(desc(Job.created_at))
        res = await session.execute(query)
        all_matching_jobs = res.scalars().all()

        # Filter by skills in Python for JSON array flexibility
        if skills:
            target_skills = {s.strip().lower() for s in skills.split(",") if s.strip()}
            filtered = []
            for j in all_matching_jobs:
                job_skills = {
                    s.lower() for s in (j.required_skills or []) + (j.preferred_skills or []) + (j.technologies or [])
                }
                if target_skills.intersection(job_skills):
                    filtered.append(j)
            all_matching_jobs = filtered

        # Fetch candidate for match score enrichment if requested or available
        candidate = None
        if candidate_id or min_match_score is not None:
            if candidate_id:
                cand_res = await session.execute(select(Candidate).where(Candidate.id == candidate_id))
            else:
                cand_res = await session.execute(select(Candidate).order_by(desc(Candidate.created_at)).limit(1))
            candidate = cand_res.scalars().first()

        # Load existing match results for these jobs
        match_map: Dict[str, MatchResult] = {}
        if candidate and all_matching_jobs:
            job_ids = [j.id for j in all_matching_jobs]
            mr_stmt = select(MatchResult).where(
                MatchResult.candidate_id == candidate.id,
                MatchResult.job_id.in_(job_ids),
            )
            mr_res = await session.execute(mr_stmt)
            for mr in mr_res.scalars().all():
                match_map[mr.job_id] = mr

        # Enrich responses with match score
        enriched: List[JobResponse] = []
        for j in all_matching_jobs:
            resp = cls._job_model_to_response(j)
            mr = match_map.get(j.id)
            if mr:
                resp.match_score = mr.overall_match_score
                resp.matched_skills = mr.matched_skills
                resp.missing_required_skills = mr.missing_required_skills
                resp.missing_preferred_skills = mr.missing_preferred_skills

            # Filter by min_match_score
            if min_match_score is not None and (resp.match_score is None or resp.match_score < min_match_score):
                continue

            enriched.append(resp)

        return enriched[offset : offset + limit]

    @classmethod
    async def get_recommended_jobs(
        cls,
        session: AsyncSession,
        candidate_id: Optional[str] = None,
        min_score: float = 0.0,
        limit: int = 30,
    ) -> RecommendedJobsResponse:
        """
        Ranks active jobs based on candidate profile compatibility.
        Returns deterministic match scores, matched skills, and missing skills.
        """
        # 1. Resolve Candidate
        if candidate_id:
            cand_res = await session.execute(select(Candidate).where(Candidate.id == candidate_id))
        else:
            cand_res = await session.execute(select(Candidate).order_by(desc(Candidate.created_at)).limit(1))
        candidate = cand_res.scalars().first()

        if not candidate:
            return RecommendedJobsResponse(
                candidate_id=None,
                candidate_name=None,
                total_recommendations=0,
                recommendations=[],
            )

        # 2. Fetch Active Jobs
        jobs_stmt = select(Job).where(Job.is_active == True).order_by(desc(Job.created_at)).limit(60)
        jobs_res = await session.execute(jobs_stmt)
        active_jobs = jobs_res.scalars().all()

        recommendations: List[RecommendedJobItem] = []

        for job in active_jobs:
            try:
                # Retrieve or calculate MatchResult
                match_res = await MatchingService.match_candidate_to_job(
                    session=session,
                    job_id=job.id,
                    candidate_id=candidate.id,
                )

                score = match_res.overall_match_score
                if score < min_score:
                    continue

                matched = match_res.matched_skills or []
                missing_req = match_res.missing_required_skills or []
                missing_pref = match_res.missing_preferred_skills or []

                # Build rationale explanation
                if score >= 80:
                    reason = f"Strong match ({score:.0f}%): candidate matches core competencies ({', '.join(matched[:3])})."
                elif score >= 60:
                    reason = f"Moderate match ({score:.0f}%): candidate has foundational skills; gap in {', '.join(missing_req[:2]) or 'requirements'}."
                else:
                    reason = f"Partial alignment ({score:.0f}%): significant skill expansion needed in {', '.join(missing_req[:2]) or 'required stack'}."

                job_resp = cls._job_model_to_response(job)
                job_resp.match_score = score
                job_resp.matched_skills = matched
                job_resp.missing_required_skills = missing_req
                job_resp.missing_preferred_skills = missing_pref

                recommendations.append(
                    RecommendedJobItem(
                        job=job_resp,
                        overall_match_score=score,
                        matched_skills=matched,
                        missing_required_skills=missing_req,
                        missing_preferred_skills=missing_pref,
                        recommendation_reason=reason,
                    )
                )
            except Exception as e:
                logger.warning(f"Error evaluating recommendation for job '{job.id}': {e}")
                continue

        # Sort descending by match score
        recommendations.sort(key=lambda x: x.overall_match_score, reverse=True)

        return RecommendedJobsResponse(
            candidate_id=candidate.id,
            candidate_name=candidate.full_name,
            total_recommendations=len(recommendations),
            recommendations=recommendations[:limit],
        )

    @staticmethod
    def _job_model_to_response(job: Job) -> JobResponse:
        """Helper to construct JobResponse from Job model."""
        reqs = [
            JobRequirementResponse(
                id=r.id,
                job_id=r.job_id,
                name=r.name,
                requirement_type=r.requirement_type,
                category=r.category,
                context=r.context,
                years_experience=r.years_experience,
                created_at=r.created_at,
            )
            for r in (job.requirements or [])
        ]

        safety = detect_scam_signals(
            role=job.role,
            company=job.company,
            description=job.raw_description or "",
            application_url=job.application_url,
            salary=job.salary,
        )

        return JobResponse(
            id=job.id,
            company=job.company,
            role=job.role,
            normalized_title=getattr(job, "normalized_title", None) or job.role,
            location=job.location,
            remote_status=getattr(job, "remote_status", "Unknown") or "Unknown",
            experience_level=getattr(job, "experience_level", "Unknown") or "Unknown",
            is_fresher_eligible=getattr(job, "is_fresher_eligible", False) or False,
            fresher_eligibility_reason=getattr(job, "fresher_eligibility_reason", None),
            source_references=getattr(job, "source_references", []) or [],
            posted_at=getattr(job, "posted_at", None),
            last_verified_at=getattr(job, "last_verified_at", None),
            employment_type=job.employment_type or "Full-time",
            raw_description=job.raw_description,
            summary=job.summary,
            domain=job.domain,
            salary=job.salary,
            application_url=job.application_url,
            official_company_url=getattr(job, "official_company_url", None) or job.application_url,
            deadline=job.deadline,
            experience_requirement=job.experience_requirement,
            education_requirements=job.education_requirements or [],
            responsibilities=job.responsibilities or [],
            qualifications=job.qualifications or [],
            technologies=job.technologies or [],
            required_skills=job.required_skills or [],
            preferred_skills=job.preferred_skills or [],
            inferred_concepts=job.inferred_concepts or [],
            requirements=reqs,
            source_type=getattr(job, "source_type", "direct"),
            source_name=getattr(job, "source_name", "Direct Entry"),
            canonical_url=getattr(job, "canonical_url", None),
            external_id=getattr(job, "external_id", None),
            is_active=getattr(job, "is_active", True),
            is_expired=getattr(job, "is_expired", False),
            safety_signals=safety.to_dict(),
            scam_risk_level=safety.risk_level,
            has_safety_warnings=(safety.risk_level in {"MEDIUM", "HIGH"}),
            created_at=job.created_at,
            updated_at=job.updated_at,
        )

    @classmethod
    def get_source_registry(cls) -> Dict[str, Any]:
        """Returns map of all modular job source adapters."""
        return {
            "linkedin": LinkedInJobSourceAdapter(),
            "naukri": NaukriJobSourceAdapter(),
            "internshala": InternshalaJobSourceAdapter(),
            "freshersworld": FreshersworldJobSourceAdapter(),
            "indeed": IndeedJobSourceAdapter(),
            "company_careers": CompanyCareerSource(),
            "company_ats": CompanyCareerSource(),
            "career_page": CompanyCareerSource(),
            "wellfound": WellfoundJobSourceAdapter(),
            "foundit": FounditJobSourceAdapter(),
            "glassdoor": GlassdoorJobSourceAdapter(),
            "public_feed": PublicFeedJobSource(),
            "user_url": UrlJobSource(),
            "url_import": UrlJobSource(),
            "freshershunt": FreshersHuntJobSourceAdapter(),
        }

    @classmethod
    def get_all_source_capabilities(cls) -> List[SourceCapabilityResponse]:
        """Returns capability descriptors across all 11 India & Global fresher job sources."""
        registry = cls.get_source_registry()
        canonical_keys = [
            "linkedin",
            "naukri",
            "internshala",
            "freshersworld",
            "indeed",
            "company_careers",
            "wellfound",
            "foundit",
            "glassdoor",
            "public_feed",
            "user_url",
        ]
        capabilities: List[SourceCapabilityResponse] = []
        for k in canonical_keys:
            adapter = registry.get(k)
            if adapter:
                cap = adapter.source_capabilities()
                capabilities.append(SourceCapabilityResponse(**cap))
        return capabilities

    @classmethod
    async def get_source_adapters_status(cls) -> Dict[str, Any]:
        """Returns health and configuration status across all modular job source adapters."""
        registry = cls.get_source_registry()
        canonical_keys = [
            "linkedin",
            "naukri",
            "internshala",
            "freshersworld",
            "freshershunt",
            "indeed",
            "company_careers",
            "wellfound",
            "foundit",
            "glassdoor",
            "public_feed",
            "user_url",
        ]
        statuses = {}
        active_count = 0
        for k in canonical_keys:
            adapter = registry[k]
            st = await adapter.health_check()
            statuses[k] = st
            if adapter.is_enabled():
                active_count += 1

        return {
            "total_adapters": len(canonical_keys),
            "active_adapters": active_count,
            "adapters": statuses,
        }

    @classmethod
    async def discover_multi_source(
        cls,
        session: AsyncSession,
        sources: Optional[List[str]] = None,
        candidate_id: Optional[str] = None,
        min_match_score: float = 65.0,
        batch_limit: int = 10,
    ) -> JobDiscoveryResponse:
        """
        Executes modular multi-source job discovery, normalization, deduplication,
        JD requirements extraction, candidate profile matching, and alert generation.
        """
        all_adapters = cls.get_source_registry()

        # Determine which sources to query
        active_sources = sources or [
            "linkedin",
            "naukri",
            "internshala",
            "freshersworld",
            "indeed",
            "company_careers",
            "wellfound",
            "foundit",
            "public_feed",
        ]
        
        diagnostics: Dict[str, Any] = {}
        all_raw_postings = []

        for src_key in active_sources:
            adapter = all_adapters.get(src_key.lower().strip())
            if not adapter:
                diagnostics[src_key] = {"status": "skipped", "error": f"Unknown source '{src_key}'"}
                continue
            if not adapter.is_enabled():
                diagnostics[src_key] = {"status": "disabled", "message": "Source adapter disabled via config"}
                continue

            try:
                raw_list = await adapter.discover_jobs(limit=batch_limit)
                all_raw_postings.extend(raw_list)
                diagnostics[src_key] = {
                    "status": "success",
                    "jobs_discovered": len(raw_list),
                    "timestamp": datetime.utcnow().isoformat(),
                }
            except Exception as e:
                logger.error(f"Source adapter '{src_key}' encountered an error: {e}")
                diagnostics[src_key] = {
                    "status": "error",
                    "error": str(e),
                    "timestamp": datetime.utcnow().isoformat(),
                }

        # Retrieve existing jobs for deduplication
        existing_jobs_stmt = select(Job)
        existing_res = await session.execute(existing_jobs_stmt)
        existing_jobs = list(existing_res.scalars().all())

        # Build lookup tables
        url_map: Dict[str, Job] = {}
        hash_map: Dict[str, Job] = {}
        role_comp_map: Dict[Tuple[str, str], Job] = {}

        for j in existing_jobs:
            if j.canonical_url:
                url_map[j.canonical_url.lower().rstrip("/")] = j
            if j.application_url:
                url_map[j.application_url.lower().rstrip("/")] = j
            if j.dedup_hash:
                hash_map[j.dedup_hash] = j
            norm_title = (getattr(j, "normalized_title", None) or j.role).lower().strip()
            comp_norm = j.company.lower().strip()
            role_comp_map[(comp_norm, norm_title)] = j

        processed_jobs: List[Job] = []
        imported_count = 0
        duplicate_merged_count = 0

        for raw in all_raw_postings:
            adapter = all_adapters.get(raw.source_type, all_adapters["public_feed"])
            norm = adapter.normalize_job(raw)

            # Defensive fallbacks for complete normalization schema
            if "normalized_title" not in norm or not norm["normalized_title"]:
                norm_title, orig_title = normalize_job_title(norm.get("role", raw.role or ""))
                norm["normalized_title"] = norm_title
                norm["original_title"] = orig_title
            if "remote_status" not in norm:
                _, r_status = normalize_location(norm.get("location", raw.location))
                norm["remote_status"] = r_status
            if "is_fresher_eligible" not in norm or "experience_level" not in norm:
                is_fresher, fresher_reason, exp_lvl = classify_fresher_and_experience(
                    norm.get("role", raw.role or ""),
                    norm.get("raw_description", raw.description or "")
                )
                norm["experience_level"] = exp_lvl
                norm["is_fresher_eligible"] = is_fresher
                norm["fresher_eligibility_reason"] = fresher_reason
            if "official_company_url" not in norm:
                norm["official_company_url"] = norm.get("canonical_url")

            c_url = norm.get("canonical_url")
            c_url_key = c_url.lower().rstrip("/") if c_url else None
            d_hash = norm.get("dedup_hash")
            comp_key = norm.get("company", "").lower().strip()
            title_key = norm["normalized_title"].lower().strip()

            # Check duplicate
            matched_existing: Optional[Job] = None
            if c_url_key and c_url_key in url_map:
                matched_existing = url_map[c_url_key]
            elif d_hash and d_hash in hash_map:
                matched_existing = hash_map[d_hash]
            elif (comp_key, title_key) in role_comp_map:
                matched_existing = role_comp_map[(comp_key, title_key)]

            new_ref = {
                "source": norm["source_name"],
                "source_type": norm["source_type"],
                "url": c_url,
                "official_url": norm.get("official_company_url"),
                "external_id": norm.get("external_id"),
                "discovered_at": datetime.utcnow().isoformat(),
            }

            if matched_existing:
                # Merge duplicate source reference into existing canonical job
                duplicate_merged_count += 1
                current_refs = list(getattr(matched_existing, "source_references", []) or [])
                already_has_ref = any(
                    r.get("source") == new_ref["source"] or (r.get("url") and r.get("url") == new_ref["url"])
                    for r in current_refs
                )
                if not already_has_ref:
                    current_refs.append(new_ref)
                    matched_existing.source_references = current_refs

                matched_existing.last_verified_at = datetime.utcnow().isoformat()
                if not matched_existing.official_company_url and norm.get("official_company_url"):
                    matched_existing.official_company_url = norm.get("official_company_url")
                if not matched_existing.salary and norm.get("salary"):
                    matched_existing.salary = norm.get("salary")
                if not matched_existing.deadline and norm.get("deadline"):
                    matched_existing.deadline = norm.get("deadline")

                if matched_existing not in processed_jobs:
                    processed_jobs.append(matched_existing)
            else:
                # Create brand new canonical job record
                imported_count += 1
                job_record = Job(
                    company=norm["company"],
                    role=norm["role"],
                    normalized_title=norm["normalized_title"],
                    location=norm["location"],
                    remote_status=norm["remote_status"],
                    experience_level=norm["experience_level"],
                    is_fresher_eligible=norm["is_fresher_eligible"],
                    fresher_eligibility_reason=norm["fresher_eligibility_reason"],
                    source_references=[new_ref],
                    raw_description=norm["raw_description"],
                    summary=norm["raw_description"][:300] + "...",
                    salary=norm.get("salary"),
                    deadline=norm.get("deadline"),
                    application_url=c_url,
                    canonical_url=c_url,
                    official_company_url=norm.get("official_company_url") or c_url,
                    external_id=norm.get("external_id"),
                    source_type=norm["source_type"],
                    source_name=norm["source_name"],
                    posted_at=norm.get("posted_at"),
                    last_verified_at=datetime.utcnow().isoformat(),
                    dedup_hash=d_hash,
                    is_active=True,
                    is_expired=False,
                )
                session.add(job_record)
                await session.flush()

                # Add basic requirements
                skill_candidates = ["python", "golang", "go", "fastapi", "react", "next.js", "typescript", "javascript", "docker", "kubernetes", "aws", "postgresql", "sql", "redis", "kafka", "tableau", "ruby", "c++", "rust"]
                desc_lower = norm["raw_description"].lower()
                detected_reqs = [s.title() for s in skill_candidates if s in desc_lower]
                job_record.required_skills = detected_reqs[:4]
                job_record.preferred_skills = detected_reqs[4:7]
                job_record.technologies = detected_reqs

                for req_s in job_record.required_skills:
                    session.add(JobRequirement(job_id=job_record.id, name=req_s, requirement_type="required", category="skill"))
                for pref_s in job_record.preferred_skills:
                    session.add(JobRequirement(job_id=job_record.id, name=pref_s, requirement_type="preferred", category="skill"))

                # Register in local maps for intra-batch deduplication
                if c_url_key:
                    url_map[c_url_key] = job_record
                if d_hash:
                    hash_map[d_hash] = job_record
                role_comp_map[(comp_key, title_key)] = job_record

                processed_jobs.append(job_record)

        await session.commit()
        for j in processed_jobs:
            await session.refresh(j)

        # 3. Candidate Profile Matching & Alert Generation
        if candidate_id:
            cand_stmt = select(Candidate).where(Candidate.id == candidate_id)
        else:
            cand_stmt = select(Candidate).order_by(desc(Candidate.created_at)).limit(1)

        cand_res = await session.execute(cand_stmt)
        candidate = cand_res.scalars().first()

        alerts: List[JobAlertItem] = []
        response_jobs: List[JobResponse] = []
        matched_count = 0

        for j in processed_jobs:
            job_resp = cls._job_model_to_response(j)
            if candidate:
                try:
                    match_res = await MatchingService.match_candidate_to_job(
                        session=session,
                        job_id=j.id,
                        candidate_id=candidate.id,
                    )
                    job_resp.match_score = match_res.overall_match_score
                    job_resp.match_category = match_res.match_category
                    job_resp.eligibility_status = match_res.eligibility_status
                    job_resp.matched_skills = match_res.matched_skills
                    job_resp.missing_required_skills = match_res.missing_required_skills
                    job_resp.missing_preferred_skills = match_res.missing_preferred_skills
                    matched_count += 1

                    # Check alert eligibility
                    if match_res.overall_match_score >= min_match_score:
                        why_lines = "\n".join(f"✓ {item}" if not item.startswith("✓") else item for item in match_res.why_it_matches) or "✓ Aligned profile background"
                        gap_lines = "\n".join(f"• {item}" if not item.startswith("•") else item for item in match_res.potential_gaps) or "• None identified"

                        rendered_text = (
                            "---------------------------------\n"
                            "CAREERPILOT JOB MATCH\n"
                            "---------------------------------\n\n"
                            f"{j.role}\n"
                            f"{j.company}\n\n"
                            f"Match: {int(match_res.overall_match_score)}% ({match_res.match_category})\n\n"
                            f"Location:\n{j.location or 'Remote'}\n\n"
                            f"Why it matches:\n{why_lines}\n\n"
                            f"Potential gap:\n{gap_lines}\n\n"
                            f"Source:\n{j.source_name}\n\n"
                            f"Job URL:\n{j.canonical_url or j.application_url or 'N/A'}\n\n"
                            f"Official Application:\n{j.official_company_url or j.application_url or 'N/A'}\n\n"
                            f"Deadline:\n{j.deadline or 'Not specified'}\n\n"
                            "Recommended next step:\n\nReview opportunity\n\n"
                            "[VIEW JOB]\n[PREPARE RESUME]\n"
                            "---------------------------------"
                        )

                        alert_item = JobAlertItem(
                            job_id=j.id,
                            title=j.role,
                            normalized_title=getattr(j, "normalized_title", None) or j.role,
                            company=j.company,
                            match_score=match_res.overall_match_score,
                            match_category=match_res.match_category,
                            location=j.location,
                            why_it_matches=match_res.why_it_matches,
                            potential_gaps=match_res.potential_gaps,
                            source=j.source_name,
                            job_url=j.canonical_url or j.application_url,
                            official_application_url=getattr(j, "official_company_url", None) or j.application_url,
                            deadline=j.deadline,
                            is_fresher_eligible=getattr(j, "is_fresher_eligible", False),
                            recommended_next_step="Review opportunity",
                            actions=["VIEW_JOB", "PREPARE_RESUME"],
                            rendered_text=rendered_text,
                        )
                        alerts.append(alert_item)
                except Exception as e:
                    logger.warning(f"Could not compute match for job '{j.id}': {e}")

            response_jobs.append(job_resp)

        # Sort jobs descending by match score
        response_jobs.sort(key=lambda x: (x.match_score or 0.0), reverse=True)
        alerts.sort(key=lambda a: a.match_score, reverse=True)

        return JobDiscoveryResponse(
            total_discovered=len(all_raw_postings),
            imported_count=imported_count,
            duplicate_merged_count=duplicate_merged_count,
            matched_count=matched_count,
            alerts_generated_count=len(alerts),
            sources_queried=active_sources,
            diagnostics=diagnostics,
            alerts=alerts,
            jobs=response_jobs,
        )

    @classmethod
    async def search_jobs_with_filters(
        cls,
        session: AsyncSession,
        filter_req: JobSearchFilterRequest,
    ) -> JobSearchFilterResponse:
        """
        Unified Multi-Source Job Search & Filter Engine for India Freshers & Global Tech Roles.
        Supports full faceted filtering:
        - Source selection (LinkedIn, Naukri, Internshala, Freshersworld, Indeed, etc.)
        - Fresher Mode (prioritizing 0-exp, graduate trainees, interns, entry-level)
        - India Location Mode (Cities: Bengaluru, Hyderabad, Pune, Mumbai, Delhi NCR, etc. / Remote India / Free-text)
        - Experience level, Job type (Internship/Full-time), Work mode (Remote/Hybrid/Onsite)
        - Match score thresholding against candidate profile
        - Safety & Scam signal analysis
        """
        # 1. Fetch Candidate for matching if available
        if filter_req.candidate_id:
            cand_stmt = select(Candidate).where(Candidate.id == filter_req.candidate_id)
        else:
            cand_stmt = select(Candidate).order_by(desc(Candidate.created_at)).limit(1)
        cand_res = await session.execute(cand_stmt)
        candidate = cand_res.scalars().first()

        # 2. Build SQL query
        query = select(Job).where(Job.is_active == True)

        # Keyword / Role query
        if filter_req.query and filter_req.query.strip():
            q_clean = filter_req.query.strip()
            query = query.where(
                or_(
                    Job.role.ilike(f"%{q_clean}%"),
                    Job.company.ilike(f"%{q_clean}%"),
                    Job.raw_description.ilike(f"%{q_clean}%"),
                    Job.normalized_title.ilike(f"%{q_clean}%"),
                )
            )

        # Company filter
        if filter_req.company and filter_req.company.strip():
            query = query.where(Job.company.ilike(f"%{filter_req.company.strip()}%"))

        # Location filter (support India city tokens & free-text)
        loc_candidates = list(filter_req.locations)
        if filter_req.location and filter_req.location.strip():
            loc_candidates.append(filter_req.location.strip())

        if loc_candidates:
            loc_clauses = []
            for loc in loc_candidates:
                loc_clean = loc.strip().lower()
                if not loc_clean:
                    continue
                if loc_clean in {"india", "all india"}:
                    loc_clauses.extend([
                        Job.location.ilike("%india%"),
                        Job.location.ilike("%bengaluru%"),
                        Job.location.ilike("%bangalore%"),
                        Job.location.ilike("%hyderabad%"),
                        Job.location.ilike("%pune%"),
                        Job.location.ilike("%mumbai%"),
                        Job.location.ilike("%delhi%"),
                        Job.location.ilike("%noida%"),
                        Job.location.ilike("%gurugram%"),
                        Job.location.ilike("%gurgaon%"),
                        Job.location.ilike("%chennai%"),
                        Job.location.ilike("%kolkata%"),
                        Job.location.ilike("%remote%"),
                    ])
                elif loc_clean in {"remote", "remote india"}:
                    loc_clauses.extend([
                        Job.remote_status.ilike("%remote%"),
                        Job.location.ilike("%remote%"),
                    ])
                else:
                    loc_clauses.append(Job.location.ilike(f"%{loc_clean}%"))
            if loc_clauses:
                query = query.where(or_(*loc_clauses))

        # Sources filter
        if filter_req.sources:
            src_clauses = []
            for s in filter_req.sources:
                s_clean = s.strip().lower()
                src_clauses.append(Job.source_type.ilike(f"%{s_clean}%"))
                src_clauses.append(Job.source_name.ilike(f"%{s_clean}%"))
            if src_clauses:
                query = query.where(or_(*src_clauses))

        # Experience levels filter
        if filter_req.experience_levels:
            exp_clauses = []
            for el in filter_req.experience_levels:
                el_clean = el.strip().lower()
                exp_clauses.append(Job.experience_level.ilike(f"%{el_clean}%"))
                if "fresher" in el_clean or "0" in el_clean:
                    exp_clauses.append(Job.is_fresher_eligible == True)
            if exp_clauses:
                query = query.where(or_(*exp_clauses))

        # Job Types
        if filter_req.job_types:
            jt_clauses = [Job.employment_type.ilike(f"%{jt.strip()}%") for jt in filter_req.job_types if jt.strip()]
            if jt_clauses:
                query = query.where(or_(*jt_clauses))

        # Work Modes
        if filter_req.work_modes:
            wm_clauses = []
            for wm in filter_req.work_modes:
                wm_clean = wm.strip()
                wm_clauses.append(Job.remote_status.ilike(f"%{wm_clean}%"))
                wm_clauses.append(Job.location.ilike(f"%{wm_clean}%"))
            if wm_clauses:
                query = query.where(or_(*wm_clauses))

        # Posted within days
        if filter_req.posted_within_days:
            cutoff = datetime.utcnow() - timedelta(days=filter_req.posted_within_days)
            query = query.where(Job.created_at >= cutoff)

        # Fresher Mode: Prioritize entry-level / trainee / intern / 0-exp
        if filter_req.fresher_mode:
            fresher_clauses = [
                Job.is_fresher_eligible == True,
                Job.experience_level.in_(["Fresher", "0 years", "0-1 years", "0-2 years", "Entry Level", "Internship", "Graduate Program"]),
                Job.role.ilike("%fresher%"),
                Job.role.ilike("%trainee%"),
                Job.role.ilike("%graduate%"),
                Job.role.ilike("%intern%"),
                Job.role.ilike("%associate%"),
                Job.role.ilike("%junior%"),
                Job.raw_description.ilike("%0 years%"),
                Job.raw_description.ilike("%freshers%"),
            ]
            query = query.where(or_(*fresher_clauses))

        query = query.order_by(desc(Job.created_at))
        exec_res = await session.execute(query)
        db_jobs = exec_res.scalars().all()

        # If zero jobs found and specific sources were requested, auto-discover to hydrate DB
        if len(db_jobs) == 0 and filter_req.sources:
            logger.info("Hydrating job store for requested sources...")
            await cls.discover_multi_source(
                session=session,
                sources=filter_req.sources,
                candidate_id=candidate.id if candidate else None,
            )
            exec_res = await session.execute(query)
            db_jobs = exec_res.scalars().all()

        # Score matching and convert to JobResponse for the candidate pool
        # Avoid unbounded sequential LLM/embedding network calls across thousands of DB records
        max_pool = max(filter_req.limit * 2, 20)
        jobs_pool = db_jobs[filter_req.offset : filter_req.offset + max_pool]

        scored_jobs: List[JobResponse] = []
        for j in jobs_pool:
            job_resp = cls._job_model_to_response(j)

            # Down-rank senior roles in fresher mode unless explicitly eligible
            if filter_req.fresher_mode:
                role_lower = j.role.lower()
                is_senior_role = any(s in role_lower for s in ["senior", "staff", "principal", "lead", "director", "5+ years", "10+ years"])
                if is_senior_role and not j.is_fresher_eligible:
                    continue

            # Candidate profile match scoring
            if candidate:
                try:
                    match_res = await MatchingService.match_candidate_to_job(
                        session=session,
                        job_id=j.id,
                        candidate_id=candidate.id,
                    )
                    job_resp.match_score = match_res.overall_match_score
                    job_resp.match_category = match_res.match_category
                    job_resp.eligibility_status = match_res.eligibility_status
                    job_resp.matched_skills = match_res.matched_skills
                    job_resp.missing_required_skills = match_res.missing_required_skills
                    job_resp.missing_preferred_skills = match_res.missing_preferred_skills
                except Exception as e:
                    logger.debug(f"Could not compute match for search job {j.id}: {e}")

            # Min match score filter
            if filter_req.min_match_score is not None:
                if (job_resp.match_score or 0.0) < filter_req.min_match_score:
                    continue

            # Skill filters
            if filter_req.skills:
                job_skills_lower = [s.lower() for s in (j.required_skills or []) + (j.preferred_skills or []) + (j.technologies or [])]
                desc_lower = (j.raw_description or "").lower()
                if not any(req_s.lower() in job_skills_lower or req_s.lower() in desc_lower for req_s in filter_req.skills):
                    continue

            scored_jobs.append(job_resp)

        # Sort by match score descending (default)
        scored_jobs.sort(key=lambda x: (x.match_score or 0.0), reverse=True)

        total_found = len(db_jobs)
        paged_jobs = scored_jobs[: filter_req.limit]

        return JobSearchFilterResponse(
            total_found=total_found,
            jobs=paged_jobs,
            active_filters={
                "query": filter_req.query,
                "location": filter_req.location,
                "locations": filter_req.locations,
                "sources": filter_req.sources,
                "experience_levels": filter_req.experience_levels,
                "job_types": filter_req.job_types,
                "work_modes": filter_req.work_modes,
                "fresher_mode": filter_req.fresher_mode,
                "min_match_score": filter_req.min_match_score,
                "skills": filter_req.skills,
                "company": filter_req.company,
                "posted_within_days": filter_req.posted_within_days,
            },
            available_sources=cls.get_all_source_capabilities(),
            available_locations=[
                "India",
                "Remote India",
                "Bengaluru",
                "Hyderabad",
                "Pune",
                "Mumbai",
                "Delhi NCR",
                "Gurugram",
                "Noida",
                "Chennai",
                "Kolkata",
                "Ahmedabad",
                "Durgapur",
                "Bhubaneswar",
                "Remote",
            ],
            fresher_mode_active=filter_req.fresher_mode,
        )

    @classmethod
    async def save_job(
        cls,
        session: AsyncSession,
        req: JobSaveRequest,
    ) -> Dict[str, Any]:
        """Saves a job opportunity into candidate Application CRM with SAVED status."""
        job_res = await session.execute(select(Job).where(Job.id == req.job_id))
        job = job_res.scalars().first()
        if not job:
            raise ValueError(f"Job with ID '{req.job_id}' not found.")

        cand_id = req.candidate_id
        if not cand_id:
            c_res = await session.execute(select(Candidate).order_by(desc(Candidate.created_at)).limit(1))
            cand = c_res.scalars().first()
            cand_id = cand.id if cand else None

        # Check existing application
        app_stmt = select(Application).where(Application.job_id == req.job_id)
        if cand_id:
            app_stmt = app_stmt.where(Application.candidate_id == cand_id)
        app_res = await session.execute(app_stmt)
        app = app_res.scalars().first()

        if app:
            app.status = ApplicationStatus.SAVED
            if req.notes:
                app.notes = f"{app.notes or ''}\n{req.notes}".strip()
        else:
            app = Application(
                id=str(uuid.uuid4()),
                job_id=req.job_id,
                candidate_id=cand_id,
                status=ApplicationStatus.SAVED,
                notes=req.notes,
                source=job.source_type or "direct",
                metadata_json={"saved_via": "job_portal"},
            )
            session.add(app)

        await session.commit()
        await session.refresh(app)
        return {
            "status": "saved",
            "job_id": req.job_id,
            "application_id": app.id,
            "message": f"Job at {job.company} saved to your application tracking board.",
        }

    @classmethod
    async def ignore_job(
        cls,
        session: AsyncSession,
        req: JobIgnoreRequest,
    ) -> Dict[str, Any]:
        """Marks a job opportunity as ignored for the candidate."""
        job_res = await session.execute(select(Job).where(Job.id == req.job_id))
        job = job_res.scalars().first()
        if not job:
            raise ValueError(f"Job with ID '{req.job_id}' not found.")

        cand_id = req.candidate_id
        if not cand_id:
            c_res = await session.execute(select(Candidate).order_by(desc(Candidate.created_at)).limit(1))
            cand = c_res.scalars().first()
            cand_id = cand.id if cand else None

        app_stmt = select(Application).where(Application.job_id == req.job_id)
        if cand_id:
            app_stmt = app_stmt.where(Application.candidate_id == cand_id)
        app_res = await session.execute(app_stmt)
        app = app_res.scalars().first()

        if app:
            app.status = ApplicationStatus.WITHDRAWN
            app.notes = f"{app.notes or ''}\nIgnored: {req.reason or 'User ignored from portal'}".strip()
        else:
            app = Application(
                id=str(uuid.uuid4()),
                job_id=req.job_id,
                candidate_id=cand_id,
                status=ApplicationStatus.WITHDRAWN,
                notes=f"Ignored: {req.reason or 'User ignored from portal'}",
                source=job.source_type or "direct",
                metadata_json={"ignored": True, "reason": req.reason},
            )
            session.add(app)

        await session.commit()
        return {
            "status": "ignored",
            "job_id": req.job_id,
            "message": f"Job at {job.company} marked as ignored.",
        }

    @classmethod
    async def create_job_alert(
        cls,
        session: AsyncSession,
        alert_in: JobAlertCreate,
    ) -> JobAlertResponse:
        cand_id = alert_in.candidate_id
        if not cand_id:
            c_res = await session.execute(select(Candidate).order_by(desc(Candidate.created_at)).limit(1))
            cand = c_res.scalars().first()
            cand_id = cand.id if cand else None

        alert = JobAlert(
            id=str(uuid.uuid4()),
            candidate_id=cand_id,
            alert_name=alert_in.alert_name,
            roles=alert_in.roles,
            locations=alert_in.locations,
            sources=alert_in.sources,
            experience_levels=alert_in.experience_levels,
            work_modes=alert_in.work_modes,
            min_match_score=alert_in.min_match_score,
            frequency=alert_in.frequency,
            is_active=alert_in.is_active,
            metadata_json=alert_in.metadata_json,
        )
        session.add(alert)
        await session.commit()
        await session.refresh(alert)
        return JobAlertResponse.model_validate(alert)

    @classmethod
    async def list_job_alerts(
        cls,
        session: AsyncSession,
        candidate_id: Optional[str] = None,
    ) -> List[JobAlertResponse]:
        query = select(JobAlert).order_by(desc(JobAlert.created_at))
        if candidate_id:
            query = query.where(JobAlert.candidate_id == candidate_id)
        res = await session.execute(query)
        alerts = res.scalars().all()
        return [JobAlertResponse.model_validate(a) for a in alerts]

    @classmethod
    async def update_job_alert(
        cls,
        session: AsyncSession,
        alert_id: str,
        alert_up: JobAlertUpdate,
    ) -> Optional[JobAlertResponse]:
        res = await session.execute(select(JobAlert).where(JobAlert.id == alert_id))
        alert = res.scalars().first()
        if not alert:
            return None
        if alert_up.alert_name is not None:
            alert.alert_name = alert_up.alert_name
        if alert_up.roles is not None:
            alert.roles = alert_up.roles
        if alert_up.locations is not None:
            alert.locations = alert_up.locations
        if alert_up.sources is not None:
            alert.sources = alert_up.sources
        if alert_up.experience_levels is not None:
            alert.experience_levels = alert_up.experience_levels
        if alert_up.work_modes is not None:
            alert.work_modes = alert_up.work_modes
        if alert_up.min_match_score is not None:
            alert.min_match_score = alert_up.min_match_score
        if alert_up.frequency is not None:
            alert.frequency = alert_up.frequency
        if alert_up.is_active is not None:
            alert.is_active = alert_up.is_active

        await session.commit()
        await session.refresh(alert)
        return JobAlertResponse.model_validate(alert)

    @classmethod
    async def delete_job_alert(
        cls,
        session: AsyncSession,
        alert_id: str,
    ) -> bool:
        res = await session.execute(select(JobAlert).where(JobAlert.id == alert_id))
        alert = res.scalars().first()
        if not alert:
            return False
        await session.delete(alert)
        await session.commit()
        return True


