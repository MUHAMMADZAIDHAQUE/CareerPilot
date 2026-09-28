from typing import List, Dict, Any, Optional, Set
from backend.app.services.job_discovery.base import JobSource, RawJobPosting
from backend.app.services.job_discovery.url_normalizer import (
    normalize_job_url,
    generate_job_dedup_hash,
    is_job_expired,
)
from backend.app.schemas.job import JobImportItem


class UserConfiguredSource(JobSource):
    """
    Source implementation for user-provided structured job inputs,
    manual imports, and user-configured custom feeds.
    """
    source_type: str = "user_configured"
    source_name: str = "User Configured Import"

    async def fetch_jobs(
        self,
        jobs: Optional[List[JobImportItem]] = None,
        source_name: Optional[str] = None,
        **kwargs,
    ) -> List[RawJobPosting]:
        """
        Transforms user-submitted structured job items into standardized RawJobPostings.
        """
        if not jobs:
            return []

        raw_items: List[RawJobPosting] = []
        for j in jobs:
            canon_url = normalize_job_url(j.url) if j.url else None
            expired = is_job_expired(j.deadline, j.description)

            raw_items.append(
                RawJobPosting(
                    external_id=j.external_id,
                    company=j.company,
                    role=j.role,
                    description=j.description,
                    location=j.location or "Remote",
                    employment_type=j.employment_type or "Full-time",
                    url=canon_url,
                    salary=j.salary,
                    deadline=j.deadline,
                    source_type=self.source_type,
                    source_name=source_name or self.source_name,
                    raw_metadata={
                        "required_skills": j.required_skills or [],
                        "preferred_skills": j.preferred_skills or [],
                    },
                    is_active=not expired,
                    is_expired=expired,
                )
            )

        return raw_items

    def normalize_job(self, raw: RawJobPosting) -> Dict[str, Any]:
        canon_url = normalize_job_url(raw.url) if raw.url else None
        dedup_hash = generate_job_dedup_hash(raw.company, raw.role, raw.location)

        return {
            "company": raw.company,
            "role": raw.role,
            "location": raw.location or "Remote",
            "employment_type": raw.employment_type or "Full-time",
            "raw_description": raw.description,
            "application_url": canon_url,
            "canonical_url": canon_url,
            "salary": raw.salary,
            "deadline": raw.deadline,
            "source_type": self.source_type,
            "source_name": raw.source_name,
            "external_id": raw.external_id,
            "is_active": raw.is_active,
            "is_expired": raw.is_expired,
            "dedup_hash": dedup_hash,
            "required_skills": raw.raw_metadata.get("required_skills", []),
            "preferred_skills": raw.raw_metadata.get("preferred_skills", []),
        }

    def deduplicate_job(
        self,
        normalized: Dict[str, Any],
        existing_hashes_or_urls: Set[str],
    ) -> bool:
        c_url = normalized.get("canonical_url")
        d_hash = normalized.get("dedup_hash")
        e_id = normalized.get("external_id")

        if c_url and c_url in existing_hashes_or_urls:
            return True
        if d_hash and d_hash in existing_hashes_or_urls:
            return True
        if e_id and e_id in existing_hashes_or_urls:
            return True

        return False
