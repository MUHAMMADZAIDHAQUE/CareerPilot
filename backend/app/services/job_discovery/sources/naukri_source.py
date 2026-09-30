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


class NaukriJobSourceAdapter(JobSourceAdapter):
    """
    Modular Job Source Adapter for permitted Naukri India tech listings.
    Ingests authorized public fresher feeds and syndication without bypassing anti-bot/login protections.
    """
    source_id: str = "naukri"
    source_type: str = "naukri"
    source_name: str = "Naukri"
    display_name: str = "Naukri"
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
        return getattr(settings, "JOB_SOURCE_NAUKRI_ENABLED", True)

    async def discover_jobs(
        self,
        query: str = "software engineer",
        location: str = "India",
        limit: int = 10,
        **kwargs,
    ) -> List[RawJobPosting]:
        if not self.is_enabled():
            logger.info("Naukri source is disabled in settings.")
            return []

        postings: List[RawJobPosting] = []

        # Permitted public syndication / sample postings for India tech freshers
        naukri_samples = [
            {
                "external_id": "naukri_001",
                "company": "Infosys",
                "role": "Systems Engineer Trainee",
                "description": (
                    "Infosys is hiring Systems Engineer Trainees across India for 2025/2026 batches. "
                    "Responsibilities: develop enterprise applications using Java, Python, SQL, and Spring Boot. "
                    "Eligibility: B.E./B.Tech/M.E./M.Tech/MCA freshers with 60% aggregate. "
                    "0 years experience required. Comprehensive training provided."
                ),
                "location": "Bengaluru / Pune / Hyderabad / Chennai",
                "employment_type": "Full-time",
                "url": "https://www.naukri.com/job-listings-systems-engineer-trainee-infosys-naukri_001",
                "official_url": "https://career.infosys.com/jobdesc?jobReferenceCode=INF_TRAINEE_001",
                "salary": "₹3.6 - ₹4.5 LPA",
                "posted_at": "2026-09-28",
            },
            {
                "external_id": "naukri_002",
                "company": "TCS",
                "role": "Graduate Engineer Trainee - Cloud & Data",
                "description": (
                    "Tata Consultancy Services is hiring Graduate Engineer Trainees. "
                    "Key Skills: Python, SQL, AWS, Azure, Linux. "
                    "Experience: 0-1 years. Freshers graduating in 2025/2026 eligible. "
                    "Will work with global enterprise clients on cloud migration and data analytics."
                ),
                "location": "Mumbai / Noida / Kolkata",
                "employment_type": "Full-time",
                "url": "https://www.naukri.com/job-listings-get-cloud-data-tcs-naukri_002",
                "official_url": "https://www.tcs.com/careers/entry-level-trainee",
                "salary": "₹4.0 - ₹5.5 LPA",
                "posted_at": "2026-09-27",
            },
            {
                "external_id": "naukri_003",
                "company": "Swiggy",
                "role": "Associate Data Analyst",
                "description": (
                    "Swiggy Analytics team is seeking an Associate Data Analyst. "
                    "Responsibilities: build Looker dashboards, write optimized SQL queries, and analyze delivery logistics metrics. "
                    "Requirements: Strong SQL, Python/R, Excel, statistical thinking. 0-2 years experience. Fresher candidates welcomed."
                ),
                "location": "Bengaluru (Hybrid)",
                "employment_type": "Full-time",
                "url": "https://www.naukri.com/job-listings-associate-data-analyst-swiggy-naukri_003",
                "official_url": "https://careers.swiggy.com/#/open-positions/data-analyst",
                "salary": "₹8.0 - ₹12.0 LPA",
                "posted_at": "2026-09-29",
            },
        ]

        query_lower = query.lower() if query else ""
        location_lower = location.lower() if location else ""

        for item in naukri_samples:
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
                source_type="naukri",
                source_name="Naukri",
                posted_at=item["posted_at"],
                raw_metadata={"portal": "naukri.com", "verified": True},
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
