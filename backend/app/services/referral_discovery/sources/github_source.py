from typing import List, Optional, Dict, Any
from urllib.parse import quote_plus
from backend.app.services.referral_discovery.base import (
    ReferralSourceAdapter,
    RawReferralContact,
    ReferralQueryContext,
    ReferralVerificationStatus,
)
from backend.app.services.referral_discovery.normalizer import ReferralContactNormalizer


class GitHubReferralSource(ReferralSourceAdapter):
    """
    GitHub Public Open Source Contributor & Maintainer Source.
    Discovers public repository committers, package maintainers, and public GitHub
    organization members affiliated with the target company.
    Adheres strictly to honest provenance: NO fake handles, NO fabricated profiles.
    Generates legitimate, functional GitHub search destinations for company contributors.
    """
    source_id: str = "github"
    source_name: str = "GitHub Public Contributor Directory"
    description: str = "Public GitHub organization members, project maintainers, and repository contributors"
    legitimate_access_method: str = "Public GitHub search & public organization membership"

    async def discover_contacts(self, ctx: ReferralQueryContext) -> List[RawReferralContact]:
        contacts: List[RawReferralContact] = []
        company = ctx.company.strip()
        comp_slug = ReferralContactNormalizer.normalize_company(company).replace(" ", "")

        # 1. Official GitHub Organization / Public Members Search
        org_search_url = f"https://github.com/search?q=org%3A{comp_slug}+type%3Ausers"
        contacts.append(
            RawReferralContact(
                name=f"GitHub Public Contributors: {company}",
                company=company,
                current_title=f"Open Source Contributor & Maintainer at {company}",
                headline=f"Search public GitHub organization members and active repository contributors for {company}",
                department="Engineering",
                location="Global / Open Source",
                profile_url=org_search_url,
                source=self.source_id,
                source_url=org_search_url,
                source_references=[{
                    "source": "GitHub Public Contributor Directory",
                    "url": org_search_url,
                    "type": "github_org_search",
                }],
                public_contact_method="Live GitHub Search",
                skills=ctx.technologies[:4] if ctx.technologies else ["Git", "Open Source"],
                relationship_type="TEAM_MEMBER",
                verification_status=ReferralVerificationStatus.SEARCH_LEAD,
                raw_metadata={"indexing": "github_public_org_search", "org": comp_slug},
            )
        )

        # 2. Technology-Specific Committer Searches
        for tech in (ctx.technologies or ["Python", "Kubernetes"])[:2]:
            tech_search_url = f"https://github.com/search?q=org%3A{comp_slug}+{quote_plus(tech)}&type=commits"
            contacts.append(
                RawReferralContact(
                    name=f"GitHub {tech} Committers: {company}",
                    company=company,
                    current_title=f"Active {tech} Committer / Maintainer at {company}",
                    headline=f"Search public {tech} repositories and committers for {company}",
                    department="Engineering",
                    location="Global / Remote",
                    profile_url=tech_search_url,
                    source=self.source_id,
                    source_url=tech_search_url,
                    source_references=[{
                        "source": "GitHub Public Contributor Directory",
                        "url": tech_search_url,
                        "type": "github_commit_search",
                    }],
                    public_contact_method="Live GitHub Commit Search",
                    skills=[tech, "Open Source"],
                    relationship_type="ENGINEER",
                    verification_status=ReferralVerificationStatus.SEARCH_LEAD,
                    raw_metadata={"indexing": "github_tech_commits", "tech": tech},
                )
            )

        return [ReferralContactNormalizer.sanitize_privacy(c) for c in contacts]
