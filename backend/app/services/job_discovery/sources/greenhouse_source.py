import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime

from backend.app.services.job_discovery.base import JobSourceAdapter, RawJobPosting
from backend.app.services.job_discovery.normalizer import (
    normalize_job_title,
    normalize_location,
    classify_india_relevance,
    classify_fresher_detailed,
    normalize_employment_type,
)
from backend.app.core.logging import logger


class GreenhouseJobSourceAdapter(JobSourceAdapter):
    """
    Public ATS Job Source Adapter for Greenhouse.
    Queries official public Greenhouse Job Board APIs (e.g. boards-api.greenhouse.io).
    Strictly authorized, zero web scraping, respects rate limits and public terms.
    """

    source_id: str = "greenhouse"
    source_type: str = "GREENHOUSE"
    source_name: str = "Greenhouse Public ATS"
    display_name: str = "Greenhouse ATS"
    access_mode: str = "PUBLIC_ATS"

    def __init__(self, board_token: str = "swiggy", company_name: str = "Swiggy"):
        self.board_token = board_token
        self.company_name = company_name
        self.source_id = f"greenhouse_{board_token.lower()}"
        self.source_name = f"{company_name} (Greenhouse)"

    async def fetch_jobs(self, **kwargs) -> List[RawJobPosting]:
        url = f"https://boards-api.greenhouse.io/v1/boards/{self.board_token}/jobs?content=true"
        raw_postings: List[RawJobPosting] = []

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, headers={"User-Agent": "CareerPilot-Job-Intelligence/1.0"})
                if res.status_code == 200:
                    data = res.json()
                    jobs = data.get("jobs", [])
                    for j in jobs:
                        loc_name = j.get("location", {}).get("name", "India")
                        raw_postings.append(
                            RawJobPosting(
                                external_id=str(j.get("id")),
                                company=self.company_name,
                                role=j.get("title", "Software Engineer"),
                                description=j.get("content", ""),
                                location=loc_name,
                                employment_type="Full-time",
                                url=j.get("absolute_url"),
                                official_company_url=f"https://boards.greenhouse.io/{self.board_token}",
                                source_type="GREENHOUSE",
                                source_name=self.source_name,
                                raw_metadata={
                                    "board_token": self.board_token,
                                    "departments": [d.get("name") for d in j.get("departments", [])],
                                    "updated_at": j.get("updated_at"),
                                },
                            )
                        )
                else:
                    logger.warning(f"Greenhouse API returned {res.status_code} for {self.board_token}")
        except Exception as e:
            logger.warning(f"Greenhouse fetch exception for {self.board_token}: {e}")

        return raw_postings

    def normalize_job(self, raw: RawJobPosting) -> Dict[str, Any]:
        orig_title, norm_title = normalize_job_title(raw.role)
        loc_str, remote_stat = normalize_location(raw.location, raw.description)
        india_info = classify_india_relevance(raw.location, raw.description, raw.company)
        fresher_info = classify_fresher_detailed(raw.role, raw.description)
        emp_type = normalize_employment_type(raw.employment_type, raw.description)

        return {
            "company": raw.company,
            "role": orig_title,
            "normalized_title": norm_title,
            "location": loc_str,
            "employment_type": emp_type,
            "raw_description": raw.description,
            "application_url": raw.url,
            "canonical_url": raw.url,
            "external_id": raw.external_id,
            "source_type": self.source_type,
            "source_name": self.source_name,
            "remote_status": remote_stat,
            "experience_level": fresher_info["experience_level"],
            "is_fresher_eligible": fresher_info["is_fresher_eligible"],
            "fresher_eligibility_reason": fresher_info["fresher_eligibility_reason"],
            "experience_min": fresher_info["experience_min"],
            "experience_max": fresher_info["experience_max"],
            "experience_category": fresher_info["experience_category"],
            "entry_level_score": fresher_info["entry_level_score"],
            "india_relevance": india_info["india_relevance"],
            "india_relevance_score": india_info["india_relevance_score"],
            "india_location_type": india_info["india_location_type"],
            "india_location": india_info["india_location"],
            "remote_india": india_info["remote_india"],
            "country": india_info["country"],
            "is_active": True,
            "is_expired": False,
        }
