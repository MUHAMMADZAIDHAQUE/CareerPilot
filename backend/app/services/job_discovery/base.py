from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Set
from pydantic import BaseModel, Field
from datetime import datetime


class RawJobPosting(BaseModel):
    """
    Standard intermediate representation of an ingested raw job posting
    before being normalized into the common Job database schema.
    """
    external_id: Optional[str] = None
    company: str
    role: str
    description: str
    location: Optional[str] = "Remote"
    employment_type: Optional[str] = "Full-time"
    url: Optional[str] = None
    salary: Optional[str] = None
    deadline: Optional[str] = None
    source_type: str = "direct"
    source_name: str = "Direct Entry"
    raw_metadata: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    is_expired: bool = False
    fetched_at: datetime = Field(default_factory=datetime.utcnow)


class JobSource(ABC):
    """
    Abstract Base Class defining the contract for all modular Job Sources.
    Ensures safe, permitted, standardized ingestion across all sources.
    """
    source_type: str = "base"
    source_name: str = "Base Source"

    @abstractmethod
    async def fetch_jobs(self, **kwargs) -> List[RawJobPosting]:
        """
        Fetches job postings from the authorized source/endpoint.
        Must not perform unauthorized scraping.
        """
        pass

    @abstractmethod
    def normalize_job(self, raw: RawJobPosting) -> Dict[str, Any]:
        """
        Normalizes raw job data into the common Job schema fields.
        Standardizes employment types, locations, and clears tracking.
        """
        pass

    @abstractmethod
    def deduplicate_job(
        self,
        normalized: Dict[str, Any],
        existing_hashes_or_urls: Set[str],
    ) -> bool:
        """
        Evaluates whether a normalized job posting is already present.
        Returns True if duplicate, False if unique.
        """
        pass
