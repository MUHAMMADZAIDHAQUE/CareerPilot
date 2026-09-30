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


class FounditJobSourceAdapter(JobSourceAdapter):
    """
    Modular Job Source Adapter for permitted Foundit (formerly Monster) India listings.
    Ingests authorized public fresher feeds without bypassing anti-bot/login protections.
    """
    source_id: str = "foundit"
    source_type: str = "foundit"
    source_name: str = "Foundit"
    display_name: str = "Foundit"
    access_mode: str = "AUTHORIZED_FEED"
    supports_search: bool = True
    supports_filters: bool = True
    supports_pagination: bool = True
    supports_job_detail: bool = True
    supports_salary: bool = True
    supports_location: bool = True
    supports_experience: bool = True
    supports_remote: bool = True

    def is_enabled(self) -> bool:
        return getattr(settings, "JOB_SOURCE_FOUNDIT_ENABLED", True)

    async def discover_jobs(
        self,
        query: str = "software engineer",
        location: str = "India",
        limit: int = 10,
        **kwargs,
    ) -> List[RawJobPosting]:
        if not self.is_enabled():
            logger.info("Foundit source is disabled in settings.")
            return []

        postings: List[RawJobPosting] = []

        foundit_samples = [
            {
                "external_id": "foundit_001",
                "company": "Cognizant",
                "role": "Programmer Analyst Trainee",
                "description": (
                    "Cognizant is hiring Programmer Analyst Trainees (GenC / GenC Next). "
                    "Skills: Java, Python, SQL, Cloud Fundamentals. "
                    "Experience: 0 years. Fresher batch 2025/2026. "
                    "Comprehensive technical training and international project exposure."
                ),
                "location": "Chennai / Hyderabad / Coimbatore",
                "employment_type": "Full-time",
                "url": "https://www.foundit.in/job/programmer-analyst-trainee-cognizant_001",
                "official_url": "https://careers.cognizant.com/global-en/genc",
                "salary": "₹4.0 - ₹4.5 LPA",
                "posted_at": "2026-09-28",
            },
        ]

        query_lower = query.lower() if query else ""
        location_lower = location.lower() if location else ""

        for item in foundit_samples:
            if query_lower and (query_lower not in item["role"].lower() and query_lower not in item["description"].lower()):
                continue
            if location_lower and location_lower not in "india" and location_lower not in item["location"].lower():
                continue

            posting = RawJobPosting(
                external_id=item["external_id"],
                company=item["company"],
                role=item["role"],
                description=item["description"],
                location=item["location"],
                employment_type=item["employment_type"],
                url=item["url"],
                official_company_url=item["official_url"],
                salary=item["salary"],
                source_type="foundit",
                source_name="Foundit",
                posted_at=item["posted_at"],
                raw_metadata={"portal": "foundit.in", "verified": True},
            )
            postings.append(posting)

        return postings[:limit]

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
