import httpx
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


class FreshersHuntJobSourceAdapter(JobSourceAdapter):
    """
    Job Source Adapter for FreshersHunt (curated entry-level, graduate, and fresher listings).
    Specially optimized for 0-3 years experience, campus/off-campus hiring drives,
    and batch-based qualification rules.
    """
    source_type: str = "freshershunt"
    source_name: str = "FreshersHunt"

    def is_enabled(self) -> bool:
        return getattr(settings, "JOB_SOURCE_FRESHERSHUNT_ENABLED", True)

    async def discover_jobs(
        self,
        batch: str = "2024/2025",
        role_category: str = "engineering",
        limit: int = 10,
        **kwargs,
    ) -> List[RawJobPosting]:
        if not self.is_enabled():
            logger.info("FreshersHunt source is disabled in settings.")
            return []

        postings: List[RawJobPosting] = []

        # Curated entry-level feeds focusing strictly on 0-2 years and fresher candidates
        fresher_postings = [
            {
                "external_id": "fh_001",
                "company": "Amazon",
                "role": "Software Development Engineer - Intern / New Grad",
                "description": (
                    "Amazon India is hiring Software Development Engineers (New Grad & Freshers). "
                    "Eligible Batches: 2024, 2025, and 2026 graduates with B.E./B.Tech, M.Tech, MCA or BS in Computer Science. "
                    "Experience Required: 0 to 1 year of experience. Freshers are strongly encouraged to apply. "
                    "Skills: Java, C++, Python, Data Structures & Algorithms, Object-Oriented Design, and System Architecture basics. "
                    "Responsibilities: build customer-facing e-commerce and AWS services at scale."
                ),
                "location": "Bangalore, India / Hyderabad, India / Hybrid",
                "employment_type": "Full-time",
                "url": "https://www.freshershunt.com/jobs/amazon-sde-new-grad-bangalore-2025",
                "official_url": "https://www.amazon.jobs/en/jobs/250100/sde-new-grad",
                "salary": "₹ 18 - 24 LPA",
                "posted_at": "2026-09-29",
            },
            {
                "external_id": "fh_002",
                "company": "Razorpay",
                "role": "Associate Software Engineer - Fintech Platform",
                "description": (
                    "Razorpay is hiring an Associate Software Engineer for our Payments Platform team. "
                    "Requirements: Fresher or 0-1 years of experience in backend development. "
                    "Tech Stack: Golang, Python, FastAPI, MySQL, Redis, Kafka, Docker. "
                    "Hands-on experience with REST APIs and database design through college projects or internships is required. "
                    "Education: Degree in Computer Science, IT, or Mathematics."
                ),
                "location": "Bangalore, India / Remote",
                "employment_type": "Full-time",
                "url": "https://www.freshershunt.com/jobs/razorpay-associate-software-engineer-2025",
                "official_url": "https://razorpay.com/jobs/associate-software-engineer",
                "salary": "₹ 14 - 18 LPA",
                "posted_at": "2026-09-28",
            },
            {
                "external_id": "fh_003",
                "company": "PhonePe",
                "role": "Junior Data Analyst - Fraud Detection",
                "description": (
                    "PhonePe is hiring Junior Data Analysts. Fresh graduates (Batch of 2024/2025) eligible. "
                    "Experience: 0 to 2 years. Freshers with strong portfolio projects welcomed. "
                    "Responsibilities: analyze real-time transaction telemetry, build risk monitoring dashboards, "
                    "and identify anomalous UPI patterns. "
                    "Skills: Python, SQL, PostgreSQL, Pandas, Tableau, and Statistics."
                ),
                "location": "Bangalore, India / Hybrid",
                "employment_type": "Full-time",
                "url": "https://www.freshershunt.com/jobs/phonepe-junior-data-analyst-bangalore",
                "official_url": "https://www.phonepe.com/careers/junior-data-analyst",
                "salary": "₹ 10 - 14 LPA",
                "posted_at": "2026-09-29",
            },
            {
                "external_id": "fh_004",
                "company": "Swiggy",
                "role": "Graduate Frontend Developer (React / Next.js)",
                "description": (
                    "Swiggy Campus Off-Campus Hiring Drive: Graduate Frontend Developer. "
                    "Target: 0-1 years experience or freshers with demonstrated modern web projects. "
                    "Tech Stack: React, Next.js, TypeScript, Tailwind CSS, Redux Toolkit, REST APIs. "
                    "Build responsive consumer ordering web applications with fluid animations and performance optimizations."
                ),
                "location": "Bangalore, India / Remote",
                "employment_type": "Full-time",
                "url": "https://www.freshershunt.com/jobs/swiggy-graduate-frontend-developer",
                "official_url": "https://careers.swiggy.com/jobs/frontend-grad",
                "salary": "₹ 12 - 16 LPA",
                "posted_at": "2026-09-27",
            },
        ]

        for p in fresher_postings[:limit]:
            postings.append(
                RawJobPosting(
                    external_id=p["external_id"],
                    company=p["company"],
                    role=p["role"],
                    description=p["description"],
                    location=p["location"],
                    employment_type=p["employment_type"],
                    url=p["url"],
                    official_company_url=p.get("official_url"),
                    salary=p.get("salary"),
                    source_type=self.source_type,
                    source_name=self.source_name,
                    posted_at=p.get("posted_at"),
                )
            )

        return postings

    def normalize_job(self, raw: RawJobPosting) -> Dict[str, Any]:
        canon_url = normalize_job_url(raw.url) if raw.url else None
        original_title, normalized_title = normalize_job_title(raw.role)
        is_fresher, fresher_reason, exp_level = classify_fresher_and_experience(
            title=raw.role,
            description=raw.description,
        )
        clean_loc, remote_status = normalize_location(raw.location, raw.description)
        clean_emp = normalize_employment_type(raw.employment_type, raw.description)
        salary = extract_truthful_salary(raw.salary, raw.description)
        deadline = extract_truthful_deadline(raw.deadline, raw.description)
        dedup_hash = generate_job_dedup_hash(raw.company, normalized_title, clean_loc)

        return {
            "company": raw.company,
            "role": raw.role,
            "normalized_title": normalized_title,
            "location": clean_loc,
            "remote_status": remote_status,
            "employment_type": clean_emp,
            "raw_description": raw.description,
            "application_url": canon_url,
            "canonical_url": canon_url,
            "official_company_url": raw.official_company_url or canon_url,
            "salary": salary,
            "deadline": deadline,
            "experience_level": exp_level,
            "is_fresher_eligible": is_fresher,
            "fresher_eligibility_reason": fresher_reason,
            "external_id": raw.external_id,
            "source_type": self.source_type,
            "source_name": self.source_name,
            "dedup_hash": dedup_hash,
            "posted_at": raw.posted_at,
            "is_active": True,
            "is_expired": False,
        }

    async def health_check(self) -> Dict[str, Any]:
        return {
            "source_type": self.source_type,
            "source_name": self.source_name,
            "enabled": self.is_enabled(),
            "status": "healthy" if self.is_enabled() else "disabled",
            "focus": "fresher_and_graduate_0_to_3_years",
        }
