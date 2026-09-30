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
    official_company_url: Optional[str] = None
    salary: Optional[str] = None
    deadline: Optional[str] = None
    source_type: str = "direct"
    source_name: str = "Direct Entry"
    raw_metadata: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    is_expired: bool = False
    fetched_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Phase 16B: Discovery, Normalization & Fresher signals
    normalized_title: Optional[str] = None
    remote_status: Optional[str] = None
    experience_level: Optional[str] = None
    is_fresher_eligible: Optional[bool] = None
    fresher_eligibility_reason: Optional[str] = None
    posted_at: Optional[str] = None


class JobSourceAdapter(ABC):
    """
    Abstract Base Class defining the contract for all modular Job Source Adapters.
    Ensures safe, permitted, standardized ingestion across all sources.
    Adheres strictly to permission, anti-scraping, and security constraints.
    """
    source_id: str = "base"
    source_type: str = "base"
    source_name: str = "Base Source"
    display_name: str = "Base Source"
    access_mode: str = "AUTHORIZED_FEED"  # API, PUBLIC_FEED, AUTHORIZED_FEED, MANUAL / USER_URL_REQUIRED
    supports_search: bool = True
    supports_filters: bool = True
    supports_pagination: bool = True
    supports_job_detail: bool = True
    supports_salary: bool = False
    supports_location: bool = True
    supports_experience: bool = True
    supports_remote: bool = True
    last_checked: Optional[str] = None

    async def discover_jobs(self, **kwargs) -> List[RawJobPosting]:
        """
        Discovers job postings from the authorized source/endpoint.
        Default implementation delegates to fetch_jobs for backward compatibility.
        """
        return await self.fetch_jobs(**kwargs)

    async def fetch_jobs(self, **kwargs) -> List[RawJobPosting]:
        """
        Fetches job postings from the authorized source/endpoint.
        Must not perform unauthorized scraping.
        """
        return []

    async def fetch_job(self, url_or_id: str) -> Optional[RawJobPosting]:
        """Fetches a single job posting by URL or external ID if supported."""
        return None

    @abstractmethod
    def normalize_job(self, raw: RawJobPosting) -> Dict[str, Any]:
        """
        Normalizes raw job data into the common Job schema fields.
        Standardizes titles, companies, locations, employment types, and extracts fresher signals.
        """
        pass

    def deduplicate_job(
        self,
        normalized: Dict[str, Any],
        existing_hashes_or_urls: Set[str],
    ) -> bool:
        """
        Evaluates whether a normalized job posting is already present.
        Returns True if duplicate, False if unique.
        """
        c_url = normalized.get("canonical_url")
        d_hash = normalized.get("dedup_hash")
        return bool((c_url and c_url in existing_hashes_or_urls) or (d_hash and d_hash in existing_hashes_or_urls))

    def is_enabled(self) -> bool:
        """Returns whether this source adapter is currently enabled via configuration."""
        return True

    def source_capabilities(self) -> Dict[str, Any]:
        """Returns capabilities and operational parameters of this source."""
        s_id = getattr(self, "source_id", None) or getattr(self, "source_type", "base")
        d_name = getattr(self, "display_name", None) or getattr(self, "source_name", "Base Source")
        return {
            "source_id": s_id,
            "display_name": d_name,
            "access_mode": getattr(self, "access_mode", "AUTHORIZED_FEED"),
            "health": "healthy" if self.is_enabled() else "disabled",
            "last_checked": getattr(self, "last_checked", None) or datetime.utcnow().isoformat(),
            "supports_search": getattr(self, "supports_search", True),
            "supports_filters": getattr(self, "supports_filters", True),
            "supports_pagination": getattr(self, "supports_pagination", False),
            "supports_job_detail": getattr(self, "supports_job_detail", True),
            "supports_salary": getattr(self, "supports_salary", False),
            "supports_location": getattr(self, "supports_location", True),
            "supports_experience": getattr(self, "supports_experience", True),
            "supports_remote": getattr(self, "supports_remote", True),
            "is_enabled": self.is_enabled(),
        }

    async def health_check(self) -> Dict[str, Any]:
        """Returns operational health diagnostics for this source adapter."""
        return {
            "source_id": getattr(self, "source_id", self.source_type),
            "source_type": self.source_type,
            "source_name": self.source_name,
            "enabled": self.is_enabled(),
            "status": "healthy" if self.is_enabled() else "disabled",
            "capabilities": self.source_capabilities(),
        }


# Alias for backward compatibility across existing services and tests
JobSource = JobSourceAdapter
