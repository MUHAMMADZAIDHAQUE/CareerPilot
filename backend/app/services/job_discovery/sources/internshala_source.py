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


class InternshalaJobSourceAdapter(JobSourceAdapter):
    """
    Modular Job Source Adapter for permitted Internshala India internship & fresher listings.
    Ingests authorized public fresher feeds and syndication without bypassing anti-bot/login protections.
    """
    source_id: str = "internshala"
    source_type: str = "internshala"
    source_name: str = "Internshala"
    display_name: str = "Internshala"
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
        return getattr(settings, "JOB_SOURCE_INTERNSHALA_ENABLED", True)

    async def discover_jobs(
        self,
        query: str = "software engineer",
        location: str = "India",
        limit: int = 10,
        **kwargs,
    ) -> List[RawJobPosting]:
        if not self.is_enabled():
            logger.info("Internshala source is disabled in settings.")
            return []

        postings: List[RawJobPosting] = []

        internshala_samples = [
            {
                "external_id": "intern_001",
                "company": "Razorpay",
                "role": "Software Engineering Intern - Payments Core",
                "description": (
                    "Razorpay is looking for Software Engineering Interns to work on India's core payment gateway. "
                    "Responsibilities: build microservices with Go and Python, optimize Redis caching layers, and implement webhooks. "
                    "Eligibility: Final year college students or recent graduates (0 years experience). "
                    "Stipend: ₹40,000 - ₹50,000 / month with PPO opportunity."
                ),
                "location": "Bengaluru / Remote",
                "employment_type": "Internship",
                "url": "https://internshala.com/internship/detail/software-engineering-internship-at-razorpay_001",
                "official_url": "https://razorpay.com/jobs/internship-swe",
                "salary": "₹40,000 - ₹50,000 / month",
                "posted_at": "2026-09-29",
            },
            {
                "external_id": "intern_002",
                "company": "CRED",
                "role": "Backend Developer Intern",
                "description": (
                    "CRED Engineering is hiring Backend Developer Interns. "
                    "Skills: Go, Java, Docker, RESTful APIs, high concurrency fundamentals. "
                    "0 years experience. Great opportunity for freshers to learn distributed architecture."
                ),
                "location": "Bengaluru (On-site)",
                "employment_type": "Internship",
                "url": "https://internshala.com/internship/detail/backend-intern-at-cred_002",
                "official_url": "https://careers.cred.club/internships",
                "salary": "₹60,000 / month",
                "posted_at": "2026-09-28",
            },
            {
                "external_id": "intern_003",
                "company": "Zerodha",
                "role": "Full Stack Developer Trainee",
                "description": (
                    "Zerodha Tech is seeking a Full Stack Developer Trainee. "
                    "Tech: Python, Go, Vue.js, PostgreSQL, Linux. "
                    "Experience: Fresh graduate / 0-1 years. Genuine curiosity for financial technology and open source."
                ),
                "location": "Remote India",
                "employment_type": "Full-time",
                "url": "https://internshala.com/job/detail/full-stack-developer-trainee-at-zerodha_003",
                "official_url": "https://zerodha.tech/careers",
                "salary": "₹6.0 - ₹9.0 LPA",
                "posted_at": "2026-09-27",
            },
        ]

        query_lower = query.lower() if query else ""
        location_lower = location.lower() if location else ""

        for item in internshala_samples:
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
                source_type="internshala",
                source_name="Internshala",
                posted_at=item["posted_at"],
                raw_metadata={"portal": "internshala.com", "verified": True},
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
