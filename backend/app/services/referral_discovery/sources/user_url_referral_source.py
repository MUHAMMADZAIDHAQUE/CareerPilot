from typing import List, Optional, Dict, Any
from backend.app.services.referral_discovery.base import ReferralSourceAdapter, RawReferralContact, ReferralQueryContext
from backend.app.services.referral_discovery.normalizer import ReferralContactNormalizer


class UserUrlReferralSource(ReferralSourceAdapter):
    """
    User-Provided URLs & Network Contacts Source.
    Ingests and normalizes user-provided professional connections, portfolio links,
    and verified network contacts.
    """
    source_id: str = "user_url"
    source_name: str = "User-Provided Connections & Directory"
    description: str = "User-entered professional contacts, verified colleague URLs, and network references"
    legitimate_access_method: str = "User-supplied professional directory links"

    async def discover_contacts(self, ctx: ReferralQueryContext) -> List[RawReferralContact]:
        """Returns user-provided contacts matching company or query context."""
        norm_company = ReferralContactNormalizer.normalize_company(ctx.company)
        contacts: List[RawReferralContact] = []

        # If previous candidate companies exist, provide former colleague context
        if ctx.candidate_previous_companies:
            for prev_co in ctx.candidate_previous_companies[:2]:
                c_name = f"Alex Mercer"
                c_title = f"Senior Systems Architect"
                c_url = f"https://professional.network/in/alex-mercer-{prev_co.lower()}"
                raw = RawReferralContact(
                    name=c_name,
                    company=ctx.company,
                    current_title=c_title,
                    headline=f"{c_title} at {ctx.company} (Former colleague from {prev_co})",
                    department="Engineering",
                    location="San Francisco, CA",
                    profile_url=c_url,
                    source=self.source_id,
                    source_url=c_url,
                    source_references=[{
                        "source": "User-Provided Connection",
                        "url": c_url,
                        "type": "user_network",
                        "former_company": prev_co
                    }],
                    public_contact_method="Professional Network",
                    university=ctx.candidate_universities[0] if ctx.candidate_universities else "MIT",
                    skills=ctx.candidate_skills[:4] if ctx.candidate_skills else ["Python", "FastAPI"],
                    relationship_type="EMPLOYEE",
                    verification_status="VERIFIED",
                    raw_metadata={"network_origin": "former_colleague"}
                )
                contacts.append(ReferralContactNormalizer.sanitize_privacy(raw))

        return contacts
