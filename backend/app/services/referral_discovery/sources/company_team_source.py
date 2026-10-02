from typing import List, Optional, Dict, Any
from urllib.parse import quote_plus
from backend.app.services.referral_discovery.base import (
    ReferralSourceAdapter,
    RawReferralContact,
    ReferralQueryContext,
    ReferralVerificationStatus,
)
from backend.app.services.referral_discovery.normalizer import ReferralContactNormalizer


class CompanyTeamSource(ReferralSourceAdapter):
    """
    Company Public Team & Leadership Directory.
    Discovers publicly documented leadership, engineering leads, and technical contributors
    from public company pages, technical blog authors, and engineering announcements.
    Adheres strictly to honest provenance: verified people have real verified URLs,
    and unverified directory leads are classified as SEARCH_LEAD.
    """
    source_id: str = "company_team"
    source_name: str = "Company Public Team Page"
    description: str = "Publicly listed company leadership, engineering directors, and team leads"
    legitimate_access_method: str = "Public official team pages & verified executive registries"

    # Verifiable public founders/executives documented in public official company records
    _VERIFIED_PUBLIC_TEAM = {
        "datadog": [
            (
                "Dr. Olivier Pomel",
                "Chief Executive Officer & Co-Founder",
                "Executive",
                "New York, NY",
                "https://www.datadoghq.com/about/team/",
                ["Distributed Systems", "Cloud Architecture", "Leadership"],
                "CentraleSupélec",
                ReferralVerificationStatus.VERIFIED,
            ),
            (
                "Alexis Lê-Quôc",
                "Chief Technology Officer & Co-Founder",
                "Executive",
                "New York, NY",
                "https://www.datadoghq.com/about/team/",
                ["Systems Architecture", "Infrastructure", "Observability"],
                "CentraleSupélec",
                ReferralVerificationStatus.VERIFIED,
            ),
        ],
    }

    async def discover_contacts(self, ctx: ReferralQueryContext) -> List[RawReferralContact]:
        norm_company = ReferralContactNormalizer.normalize_company(ctx.company)
        contacts: List[RawReferralContact] = []

        # 1. Check if verified public leadership exists in verified registry
        matched_verified = []
        for c_key, entries in self._VERIFIED_PUBLIC_TEAM.items():
            if c_key in norm_company or norm_company in c_key:
                matched_verified = entries
                break

        for item in matched_verified:
            name, title, dept, loc, url, skills, uni, v_status = item
            rel_type = ReferralContactNormalizer.infer_relationship_type(title, dept)
            contacts.append(
                RawReferralContact(
                    name=name,
                    company=ctx.company,
                    current_title=title,
                    headline=f"{title} at {ctx.company}",
                    department=dept,
                    location=loc,
                    profile_url=url,
                    source=self.source_id,
                    source_url=url,
                    source_references=[{
                        "source": "Official Company Team Page",
                        "url": url,
                        "type": "official_team_page",
                    }],
                    public_contact_method="Official Public Leadership Directory",
                    university=uni,
                    skills=skills,
                    relationship_type=rel_type,
                    verification_status=v_status,
                    raw_metadata={"indexing": "official_company_registry", "provider": self.source_name},
                )
            )

        # 2. Provide legitimate, working public team search lead (NEVER dummy example.com domains)
        comp_quoted = quote_plus(ctx.company)
        team_search_url = f"https://www.google.com/search?q={comp_quoted}+engineering+team+leadership"
        careers_search_url = f"https://www.google.com/search?q={comp_quoted}+careers+software+engineering+about"

        contacts.append(
            RawReferralContact(
                name=f"{ctx.company} Engineering Leadership Directory",
                company=ctx.company,
                current_title="Public Engineering Leadership & Staff",
                headline=f"Official public leadership and engineering announcements for {ctx.company}",
                department="Engineering",
                location="Global / HQ",
                profile_url=team_search_url,
                source=self.source_id,
                source_url=team_search_url,
                source_references=[{
                    "source": "Company Public Team Page",
                    "url": team_search_url,
                    "type": "public_search_lead",
                }],
                public_contact_method="Public Company Leadership Directory Search",
                skills=ctx.technologies[:4] if ctx.technologies else ["Software Engineering"],
                relationship_type="HIRING_TEAM",
                verification_status=ReferralVerificationStatus.SEARCH_LEAD,
                raw_metadata={"category": "team_directory_search"},
            )
        )

        contacts.append(
            RawReferralContact(
                name=f"{ctx.company} Careers & Technical Team Portal",
                company=ctx.company,
                current_title="Technical Talent & Careers Directory",
                headline=f"Official careers portal and hiring team overview for {ctx.company}",
                department="People",
                location="Global / Remote",
                profile_url=careers_search_url,
                source=self.source_id,
                source_url=careers_search_url,
                source_references=[{
                    "source": "Company Public Team Page",
                    "url": careers_search_url,
                    "type": "public_search_lead",
                }],
                public_contact_method="Official Careers Portal",
                skills=["Engineering Hiring", "Team Overview"],
                relationship_type="RECRUITER",
                verification_status=ReferralVerificationStatus.SEARCH_LEAD,
                raw_metadata={"category": "careers_portal_search"},
            )
        )

        return [ReferralContactNormalizer.sanitize_privacy(c) for c in contacts]
