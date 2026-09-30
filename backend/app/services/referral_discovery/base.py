from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class RawReferralContact(BaseModel):
    """
    Standard intermediate representation of a discovered potential referral contact
    before deduplication, relevance scoring, and persistence.
    """
    name: str = Field(..., description="Full name")
    company: str = Field(..., description="Target company or affiliated organization")
    current_title: str = Field(..., description="Professional title or role")
    headline: Optional[str] = Field(None, description="Public professional headline")
    department: Optional[str] = Field(None, description="Inferred or stated department")
    location: Optional[str] = Field(None, description="Geographic location")
    profile_url: Optional[str] = Field(None, description="Legitimate public profile URL")
    source: str = Field("linkedin", description="Identifier of the discovering source")
    source_url: Optional[str] = Field(None, description="Source origin URL")
    source_references: List[Dict[str, Any]] = Field(default_factory=list, description="Provenance references")
    public_contact_method: Optional[str] = Field(None, description="Legitimate public contact method")
    university: Optional[str] = Field(None, description="Educational institution or alma mater")
    graduation_year: Optional[int] = Field(None, description="Graduation year")
    skills: List[str] = Field(default_factory=list, description="Technical skills or domains")
    relationship_type: str = Field("EMPLOYEE", description="Role/relationship classification")
    verification_status: str = Field("VERIFIED", description="VERIFIED, PARTIALLY_VERIFIED, UNVERIFIED, STALE")
    raw_metadata: Dict[str, Any] = Field(default_factory=dict, description="Source-specific metadata")
    discovered_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class ReferralQueryContext(BaseModel):
    """
    Context parameters passed to referral source adapters for targeted discovery.
    """
    job_id: str
    company: str
    role: str
    department: Optional[str] = None
    technologies: List[str] = Field(default_factory=list)
    required_skills: List[str] = Field(default_factory=list)
    candidate_id: Optional[str] = None
    candidate_universities: List[str] = Field(default_factory=list)
    candidate_skills: List[str] = Field(default_factory=list)
    candidate_previous_companies: List[str] = Field(default_factory=list)
    target_count: int = 50


class ReferralSourceAdapter(ABC):
    """
    Abstract Base Class defining the contract for all modular Referral Source Adapters.
    Adheres strictly to permission, anti-scraping, and privacy constraints:
    - Never uses login automation or bot accounts.
    - Never bypasses authentication, CAPTCHAs, or paywalls.
    - Only queries legitimate public or authorized directory datasets.
    """
    source_id: str = "base"
    source_name: str = "Base Referral Source"
    description: str = "Base abstract referral source"
    legitimate_access_method: str = "Internal registry"

    def is_enabled(self) -> bool:
        """Indicates whether this source adapter is active."""
        return True

    def health_check(self) -> Dict[str, Any]:
        """Performs a health and availability check."""
        return {
            "source_id": self.source_id,
            "name": self.source_name,
            "status": "healthy" if self.is_enabled() else "disabled",
            "enabled": self.is_enabled(),
            "description": self.description,
            "legitimate_access_method": self.legitimate_access_method,
        }

    @abstractmethod
    async def discover_contacts(self, ctx: ReferralQueryContext) -> List[RawReferralContact]:
        """
        Discovers potential referral contacts associated with the target job and company.
        Must degrade gracefully and return an empty list upon failure.
        """
        pass

    async def fetch_contact(self, contact_id_or_url: str) -> Optional[RawReferralContact]:
        """Fetches a specific contact by ID or public URL if supported."""
        return None
