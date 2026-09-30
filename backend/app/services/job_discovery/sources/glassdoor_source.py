from typing import List, Dict, Any, Optional
from datetime import datetime

from backend.app.services.job_discovery.base import JobSourceAdapter, RawJobPosting
from backend.app.services.job_discovery.url_normalizer import normalize_job_url, generate_job_dedup_hash
from backend.app.services.job_discovery.normalizer import (
    normalize_job_title,
    classify_fresher_and_experience,
    normalize_location,
    normalize_employment_type,
    extract_truthful_salary,
    extract_truthful_deadline,
)
from backend.app.core.config import settings
from backend.app.core.logging import logger


class GlassdoorJobSourceAdapter(JobSourceAdapter):
    """
    Modular Job Source Adapter for Glassdoor.
    
    STRICT LEGAL & ACCESS POLICY:
    - Glassdoor requires user authentication and anti-bot verification for direct listings.
    - CareerPilot NEVER bypasses login, CAPTCHA, or anti-scraping protections.
    - Marked as 'MANUAL / USER_URL_REQUIRED'.
    - Ingests user-submitted job URLs or permitted partner URLs exclusively.
    """
    source_id: str = "glassdoor"
    source_type: str = "glassdoor"
    source_name: str = "Glassdoor"
    display_name: str = "Glassdoor"
    access_mode: str = "MANUAL / USER_URL_REQUIRED"
    supports_search: bool = False
    supports_filters: bool = False
    supports_pagination: bool = False
    supports_job_detail: bool = True
    supports_salary: bool = True
    supports_location: bool = True
    supports_experience: bool = True
    supports_remote: bool = True

    def is_enabled(self) -> bool:
        return getattr(settings, "JOB_SOURCE_GLASSDOOR_ENABLED", False)

    async def discover_jobs(
        self,
        query: str = "",
        location: str = "",
        limit: int = 10,
        **kwargs,
    ) -> List[RawJobPosting]:
        # Glassdoor does not permit unauthenticated automated scraping; requires user-provided URL import.
        logger.info("Glassdoor automated search is restricted; requires direct user URL import.")
        return []

    async def fetch_job(self, url_or_id: str) -> Optional[RawJobPosting]:
        if not url_or_id:
            return None
        # Ingests user-provided Glassdoor job URL
        return RawJobPosting(
            external_id=None,
            company="Company on Glassdoor",
            role="Imported Job Role",
            description="User-imported job via Glassdoor URL. Review full job description on original source.",
            location="India",
            employment_type="Full-time",
            url=url_or_id,
            official_company_url=url_or_id,
            source_type="glassdoor",
            source_name="Glassdoor",
            raw_metadata={"access_mode": "MANUAL / USER_URL_REQUIRED"},
        )

    def normalize_job(self, raw: RawJobPosting) -> Dict[str, Any]:
        c_url = normalize_job_url(raw.url) if raw.url else (normalize_job_url(raw.official_company_url) if raw.official_company_url else None)
        orig_title, norm_title = normalize_job_title(raw.role)
        norm_loc, remote_status = normalize_location(raw.location, raw.description)
        norm_emp = normalize_employment_type(raw.employment_type, raw.description)
        is_fresher, reason, exp_level = classify_fresher_and_experience(title=raw.role, description=raw.description)
        dedup_hash = generate_job_dedup_hash(raw.company, norm_title, norm_loc)

        return {
            "company": raw.company.strip(),
            "role": orig_title,
            "normalized_title": norm_title,
            "location": norm_loc,
            "remote_status": remote_status,
            "employment_type": norm_emp,
            "experience_level": exp_level,
            "is_fresher_eligible": is_fresher,
            "fresher_eligibility_reason": reason,
            "raw_description": raw.description,
            "salary": extract_truthful_salary(raw.salary, raw.description),
            "deadline": extract_truthful_deadline(raw.deadline, raw.description),
            "canonical_url": c_url,
            "application_url": raw.url or c_url,
            "official_company_url": raw.official_company_url or c_url,
            "external_id": raw.external_id,
            "source_type": self.source_type,
            "source_name": self.source_name,
            "posted_at": raw.posted_at or datetime.utcnow().strftime("%Y-%m-%d"),
            "dedup_hash": dedup_hash,
            "raw_metadata": raw.raw_metadata,
        }
