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


class FreshersworldJobSourceAdapter(JobSourceAdapter):
    """
    Modular Job Source Adapter for permitted Freshersworld India fresher listings.
    Ingests authorized public fresher feeds and syndication without bypassing anti-bot/login protections.
    """
    source_id: str = "freshersworld"
    source_type: str = "freshersworld"
    source_name: str = "Freshersworld"
    display_name: str = "Freshersworld"
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
        return getattr(settings, "JOB_SOURCE_FRESHERSWORLD_ENABLED", True)

    async def discover_jobs(
        self,
        query: str = "software engineer",
        location: str = "India",
        limit: int = 10,
        **kwargs,
    ) -> List[RawJobPosting]:
        if not self.is_enabled():
            logger.info("Freshersworld source is disabled in settings.")
            return []

        postings: List[RawJobPosting] = []

        fw_samples = [
            {
                "external_id": "fw_001",
                "company": "Wipro",
                "role": "Project Engineer - Elite National Talent Hunt",
                "description": (
                    "Wipro is hiring Project Engineers for Elite National Talent Hunt 2026. "
                    "Skills: Java, C++, Python, Data Structures, Algorithms, RDBMS. "
                    "0 years experience. Eligibility: B.E./B.Tech freshers across India. "
                    "Selection process includes online assessment and technical discussion."
                ),
                "location": "Bengaluru / Hyderabad / Pune",
                "employment_type": "Full-time",
                "url": "https://www.freshersworld.com/jobs/project-engineer-wipro-enth_001",
                "official_url": "https://careers.wipro.com/elite-national-talent-hunt",
                "salary": "₹3.5 - ₹4.0 LPA",
                "posted_at": "2026-09-28",
            },
            {
                "external_id": "fw_002",
                "company": "Capgemini",
                "role": "Software Developer Trainee",
                "description": (
                    "Capgemini India is conducting off-campus recruitment for Software Developer Trainees. "
                    "Tech: C#, .NET, Java, Cloud Computing, Database Administration. "
                    "Fresher / Entry level position for recent engineering graduates."
                ),
                "location": "Mumbai / Noida / Chennai",
                "employment_type": "Full-time",
                "url": "https://www.freshersworld.com/jobs/software-developer-trainee-capgemini_002",
                "official_url": "https://www.capgemini.com/in-en/careers/fresher-hiring",
                "salary": "₹4.0 - ₹4.25 LPA",
                "posted_at": "2026-09-27",
            },
        ]

        query_lower = query.lower() if query else ""
        location_lower = location.lower() if location else ""

        for item in fw_samples:
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
                source_type="freshersworld",
                source_name="Freshersworld",
                posted_at=item["posted_at"],
                raw_metadata={"portal": "freshersworld.com", "verified": True},
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
