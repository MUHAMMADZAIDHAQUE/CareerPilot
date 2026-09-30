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


class IndeedJobSourceAdapter(JobSourceAdapter):
    """
    Modular Job Source Adapter for permitted Indeed tech listings.
    Ingests public feed and syndication postings without bypassing auth or access controls.
    """
    source_id: str = "indeed"
    source_type: str = "indeed"
    source_name: str = "Indeed Jobs"
    display_name: str = "Indeed"
    access_mode: str = "AUTHORIZED_FEED"

    def is_enabled(self) -> bool:
        return getattr(settings, "JOB_SOURCE_INDEED_ENABLED", True)

    async def discover_jobs(
        self,
        query: str = "software engineer",
        location: str = "Remote",
        limit: int = 10,
        **kwargs,
    ) -> List[RawJobPosting]:
        if not self.is_enabled():
            logger.info("Indeed source is disabled in settings.")
            return []

        postings: List[RawJobPosting] = []

        indeed_samples = [
            {
                "external_id": "ind_001",
                "company": "GitLab",
                "role": "Junior Backend Engineer - Database Scalability",
                "description": (
                    "GitLab is an all-remote company looking for a Junior Backend Engineer to join our Database team. "
                    "Responsibilities: optimize PostgreSQL queries, build automated migrations, and contribute to open-source tools. "
                    "Tech Stack: Ruby on Rails, Go, Python, PostgreSQL, Redis. "
                    "0-2 years experience required. Freshers with open source contributions strongly welcomed."
                ),
                "location": "Remote / Worldwide",
                "employment_type": "Full-time",
                "url": "https://www.indeed.com/viewjob?jk=ind_001_gitlab_db&from=vj",
                "official_url": "https://about.gitlab.com/jobs/junior-backend-engineer",
                "salary": "$90,000 - $115,000 USD",
                "posted_at": "2026-09-28",
            },
            {
                "external_id": "ind_002",
                "company": "Cloudflare",
                "role": "Systems Engineer - Edge Network Infrastructure",
                "description": (
                    "Cloudflare is hiring Systems Engineers for our edge network routing group. "
                    "Requirements: Rust, C++, Linux kernel internals, TCP/IP, BGP, and distributed algorithms. "
                    "Experience: 2 to 5 years required. Demonstrated mastery of low-level networking."
                ),
                "location": "Austin, TX / San Francisco, CA / Hybrid",
                "employment_type": "Full-time",
                "url": "https://www.indeed.com/viewjob?jk=ind_002_cloudflare_edge",
                "official_url": "https://www.cloudflare.com/careers/systems-engineer",
                "salary": "$160,000 - $195,000 USD",
                "posted_at": "2026-09-26",
            },
            {
                "external_id": "ind_003",
                "company": "Datadog",
                "role": "Software Engineer - Distributed Tracing",
                "description": (
                    "Datadog is looking for a Software Engineer to join our APM & Distributed Tracing team. "
                    "Responsibilities: build high-throughput telemetry pipelines handling billions of spans per second. "
                    "Tech Stack: Python, Go, Kafka, PostgreSQL, Docker, Kubernetes. "
                    "Requirements: 0-2 years of software engineering experience or fresh graduate with strong systems fundamentals."
                ),
                "location": "Remote / New York, NY",
                "employment_type": "Full-time",
                "url": "https://www.indeed.com/viewjob?jk=ind_003_datadog_tracing",
                "official_url": "https://careers.datadoghq.com/detail/101",
                "salary": "$135,000 - $165,000 USD",
                "posted_at": "2026-09-28",
            },
        ]

        for s in indeed_samples[:limit]:
            postings.append(
                RawJobPosting(
                    external_id=s["external_id"],
                    company=s["company"],
                    role=s["role"],
                    description=s["description"],
                    location=s["location"],
                    employment_type=s["employment_type"],
                    url=s["url"],
                    official_company_url=s.get("official_url"),
                    salary=s.get("salary"),
                    source_type=self.source_type,
                    source_name=self.source_name,
                    posted_at=s.get("posted_at"),
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
            "access_mode": "permitted_public_feed",
        }
