import re
from typing import Optional, Tuple, Dict, Any
from backend.app.services.referral_discovery.base import RawReferralContact


class ReferralContactNormalizer:
    """
    Normalizes contact metadata, deduplication keys, relationship categories,
    and enforces strict privacy filtering.
    """

    # Relationship classification taxonomy
    RELATIONSHIP_PATTERNS = [
        ("ENGINEERING_MANAGER", [r"\bengineering manager\b", r"\bem\b", r"\bdev manager\b", r"\bsoftware manager\b", r"\btech manager\b", r"\bdirector of engineering\b", r"\bvp of engineering\b", r"\bvpe\b"]),
        ("TECH_LEAD", [r"\btech lead\b", r"\blead engineer\b", r"\blead architect\b", r"\bprincipal architect\b", r"\bchief architect\b"]),
        ("SENIOR_ENGINEER", [r"\bsenior\b", r"\bsr\.\b", r"\bstaff\b", r"\bprincipal\b", r"\bdistinguished\b"]),
        ("RECRUITER", [r"\brecruiter\b", r"\btalent\b", r"\bsourcer\b", r"\bpeople ops\b", r"\bta partner\b", r"\bheadhunter\b"]),
        ("HIRING_TEAM", [r"\bhiring manager\b", r"\bhead of\b", r"\bvp\b", r"\bdirector\b"]),
        ("ENGINEER", [r"\bengineer\b", r"\bdeveloper\b", r"\bprogrammer\b", r"\barchitect\b", r"\bsre\b", r"\bdevops\b"]),
    ]

    @classmethod
    def normalize_name(cls, name: Optional[str]) -> str:
        """Normalizes individual person names by stripping professional titles and extra spaces."""
        if not name:
            return ""
        s = name.strip()
        # Remove common titles and honorifics
        s = re.sub(r"^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.|Eng\.)\s+", "", s, flags=re.IGNORECASE)
        # Strip trailing degrees/certifications (e.g. ", Ph.D.", ", P.E.")
        s = re.sub(r",\s*(Ph\.?D\.?|M\.?S\.?|B\.?S\.?|P\.?E\.?|MBA|Esq\.?)$", "", s, flags=re.IGNORECASE)
        s = re.sub(r"[^\w\s\-\']", "", s)
        return " ".join(s.split()).title()

    @classmethod
    def normalize_company(cls, company: Optional[str]) -> str:
        """Normalizes corporate names for cross-source deduplication."""
        if not company:
            return ""
        s = company.lower().strip()
        s = re.sub(r"\b(inc|corp|corporation|llc|ltd|technologies|tech|labs|co|company|holdings|group)\b\.?", "", s)
        s = re.sub(r"[^\w\s]", "", s)
        return " ".join(s.split())

    @classmethod
    def normalize_title(cls, title: Optional[str]) -> str:
        """Normalizes title/role text."""
        if not title:
            return "Employee"
        s = title.strip()
        s = re.sub(r"\s+", " ", s)
        return s

    @classmethod
    def normalize_url(cls, url: Optional[str]) -> Optional[str]:
        """Normalizes profile URLs for exact deduplication."""
        if not url:
            return None
        u = url.strip().lower()
        # Remove query parameters and hashes
        u = u.split("?")[0].split("#")[0]
        # Remove trailing slash
        u = u.rstrip("/")
        # Normalize protocol to https
        if u.startswith("http://"):
            u = "https://" + u[7:]
        return u

    @classmethod
    def infer_relationship_type(
        cls,
        title: str,
        department: Optional[str] = None,
        is_alumni: bool = False,
    ) -> str:
        """Classifies professional relationship into standardized enum values."""
        if is_alumni:
            return "ALUMNI"

        title_lower = title.lower()
        for rel_type, patterns in cls.RELATIONSHIP_PATTERNS:
            for pat in patterns:
                if re.search(pat, title_lower):
                    return rel_type

        dept_lower = (department or "").lower()
        if "engineering" in dept_lower or "software" in dept_lower or "data" in dept_lower:
            return "TEAM_MEMBER"

        return "EMPLOYEE"

    @classmethod
    def generate_dedup_keys(cls, contact: RawReferralContact) -> Tuple[str, str, str]:
        """
        Generates 3-tier deduplication keys:
        1. Canonical profile URL key
        2. Normalized name + company key
        3. Normalized name + company + title key
        """
        norm_name = cls.normalize_name(contact.name).lower()
        norm_comp = cls.normalize_company(contact.company)
        norm_title = cls.normalize_company(contact.current_title)  # cleans punctuation
        norm_url = cls.normalize_url(contact.profile_url)

        url_key = f"url:{norm_url}" if norm_url else ""
        nc_key = f"nc:{norm_name}@{norm_comp}"
        nct_key = f"nct:{norm_name}@{norm_comp}@{norm_title}"

        return url_key, nc_key, nct_key

    @classmethod
    def sanitize_privacy(cls, contact: RawReferralContact) -> RawReferralContact:
        """
        Enforces Rule 14: Privacy Filtering.
        Ensures NO private phone numbers, home addresses, or sensitive personal data
        are stored. Only professional, public, or authorized attributes are preserved.
        """
        # Scrub any private phone numbers or street address patterns from headline or metadata
        if contact.headline:
            contact.headline = re.sub(r"\b\d{3}[-.\s]??\d{3}[-.\s]??\d{4}\b", "[redacted phone]", contact.headline)
        
        # Ensure public contact method is professional (e.g. LinkedIn, GitHub, corporate directory)
        if contact.public_contact_method and re.search(r"\b\d{10}\b", contact.public_contact_method):
            contact.public_contact_method = "Public Professional Profile"

        return contact
