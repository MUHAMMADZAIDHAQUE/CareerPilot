import re
import uuid
from typing import List, Optional, Dict, Any, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_, and_, func

from backend.app.models.job import Job, JobRequirement, MatchResult
from backend.app.models.candidate import Candidate
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
)
from backend.app.services.job_discovery.url_normalizer import (
    normalize_job_url,
    generate_job_dedup_hash,
    is_job_expired,
)
from backend.app.services.job_discovery.sources.url_source import UrlJobSource
from backend.app.services.job_discovery.sources.public_feed_source import PublicFeedJobSource
from backend.app.services.job_discovery.sources.career_page_source import CompanyCareerSource
from backend.app.services.job_discovery.sources.user_configured_source import UserConfiguredSource
from backend.app.services.job_analyzer_service import JobAnalyzerService
from backend.app.services.matching_service import MatchingService
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

        return JobResponse(
            id=job.id,
            company=job.company,
            role=job.role,
            location=job.location,
            employment_type=job.employment_type or "Full-time",
            raw_description=job.raw_description,
            summary=job.summary,
            domain=job.domain,
            salary=job.salary,
            application_url=job.application_url,
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
            created_at=job.created_at,
            updated_at=job.updated_at,
        )
