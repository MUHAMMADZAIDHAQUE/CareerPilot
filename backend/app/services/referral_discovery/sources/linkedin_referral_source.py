from typing import List, Optional, Dict, Any
from urllib.parse import quote_plus
from backend.app.services.referral_discovery.base import (
    ReferralSourceAdapter,
    RawReferralContact,
    ReferralQueryContext,
    ReferralVerificationStatus,
)
from backend.app.services.referral_discovery.normalizer import ReferralContactNormalizer


class LinkedInReferralSource(ReferralSourceAdapter):
    """
    LinkedIn Public Professional Directory Source.
    OPERATIONAL & ETHICAL CONSTRAINTS:
    - Adheres strictly to Rule 2 & ADR-018: NO login automation, NO browser-cookie scraping,
      NO private profile scraping, NO CAPTCHA bypass, NO automated messages/connection requests.
    - Generates legitimate public search leads and verified public directory destinations.
    - Strictly avoids synthesizing fictitious people or fake LinkedIn profile URLs.
    - Labels search directory destinations honestly as SEARCH_LEAD.
    """
    source_id: str = "linkedin"
    source_name: str = "LinkedIn Public Professional Index"
    description: str = "Legitimate public professional search destinations and verified directory channels"
    legitimate_access_method: str = "Public directory search & authorized indexing"

    async def discover_contacts(self, ctx: ReferralQueryContext) -> List[RawReferralContact]:
        """
        Discovers legitimate LinkedIn search leads and public directory channels
        matching target company, role, skills, and recruiting intents.
        """
        contacts: List[RawReferralContact] = []
        company = ctx.company.strip()
        role = ctx.role.strip()
        comp_quoted = quote_plus(company)

        # 1. Target Role Practitioners
        role_search_url = f"https://www.linkedin.com/search/results/people/?keywords={comp_quoted}+{quote_plus(role)}"
        contacts.append(
            RawReferralContact(
                name=f"LinkedIn Search: {role} at {company}",
                company=company,
                current_title=role,
                headline=f"Search active {role} professionals at {company} on LinkedIn",
                department="Engineering",
                location="Global / Target Location",
                profile_url=role_search_url,
                source=self.source_id,
                source_url=role_search_url,
                source_references=[{
                    "source": "LinkedIn Public Directory",
                    "url": role_search_url,
                    "type": "public_search_lead",
                }],
                public_contact_method="Live LinkedIn Public Search",
                skills=ctx.required_skills[:4] if ctx.required_skills else ctx.technologies[:4],
                relationship_type=ReferralContactNormalizer.infer_relationship_type(role, "Engineering"),
                verification_status=ReferralVerificationStatus.SEARCH_LEAD,
                raw_metadata={"category": "role_practitioner", "target_role": role},
            )
        )

        # 2. Engineering Leadership & Hiring Decision Makers
        lead_search_url = f"https://www.linkedin.com/search/results/people/?keywords={comp_quoted}+Engineering+Manager"
        contacts.append(
            RawReferralContact(
                name=f"LinkedIn Search: Engineering Leadership at {company}",
                company=company,
                current_title="Engineering Manager / Tech Lead",
                headline=f"Search Engineering Managers and Directors at {company}",
                department="Engineering",
                location="Global / Remote",
                profile_url=lead_search_url,
                source=self.source_id,
                source_url=lead_search_url,
                source_references=[{
                    "source": "LinkedIn Public Directory",
                    "url": lead_search_url,
                    "type": "public_search_lead",
                }],
                public_contact_method="Live LinkedIn Public Search",
                skills=["Engineering Leadership", "System Architecture"],
                relationship_type="ENGINEERING_MANAGER",
                verification_status=ReferralVerificationStatus.SEARCH_LEAD,
                raw_metadata={"category": "engineering_leadership"},
            )
        )

        # 3. Technical Talent Acquisition & Engineering Recruiters
        recruiter_search_url = f"https://www.linkedin.com/search/results/people/?keywords={comp_quoted}+Technical+Recruiter"
        contacts.append(
            RawReferralContact(
                name=f"LinkedIn Search: Technical Recruiters at {company}",
                company=company,
                current_title="Technical Recruiter / Talent Acquisition",
                headline=f"Search technical recruiters and engineering sourcers at {company}",
                department="People",
                location="Global / Regional",
                profile_url=recruiter_search_url,
                source=self.source_id,
                source_url=recruiter_search_url,
                source_references=[{
                    "source": "LinkedIn Public Directory",
                    "url": recruiter_search_url,
                    "type": "public_search_lead",
                }],
                public_contact_method="Live LinkedIn Public Search",
                skills=["Technical Recruiting", "Sourcing", "Hiring"],
                relationship_type="RECRUITER",
                verification_status=ReferralVerificationStatus.SEARCH_LEAD,
                raw_metadata={"category": "technical_recruiter"},
            )
        )

        # 4. University Relations & Campus Hiring (especially valuable for new grads/interns)
        campus_search_url = f"https://www.linkedin.com/search/results/people/?keywords={comp_quoted}+University+Recruiter"
        contacts.append(
            RawReferralContact(
                name=f"LinkedIn Search: Campus Recruiting at {company}",
                company=company,
                current_title="University Relations & Campus Recruiter",
                headline=f"Search campus recruiters and university talent partners at {company}",
                department="People",
                location="Global / Campus",
                profile_url=campus_search_url,
                source=self.source_id,
                source_url=campus_search_url,
                source_references=[{
                    "source": "LinkedIn Public Directory",
                    "url": campus_search_url,
                    "type": "public_search_lead",
                }],
                public_contact_method="Live LinkedIn Public Search",
                skills=["Campus Hiring", "Early Career Talent"],
                relationship_type="RECRUITER",
                verification_status=ReferralVerificationStatus.SEARCH_LEAD,
                raw_metadata={"category": "campus_recruiting"},
            )
        )

        # 5. Technology Specialists for key job requirements (e.g., Python, Kubernetes, AWS, C++)
        unique_techs = list(dict.fromkeys((ctx.technologies or []) + (ctx.required_skills or [])))
        for tech in unique_techs[:3]:
            tech_search_url = f"https://www.linkedin.com/search/results/people/?keywords={comp_quoted}+{quote_plus(tech)}"
            contacts.append(
                RawReferralContact(
                    name=f"LinkedIn Search: {tech} Engineers at {company}",
                    company=company,
                    current_title=f"Software Engineer ({tech})",
                    headline=f"Search {tech} engineers and contributors at {company}",
                    department="Engineering",
                    location="Global / Tech Hub",
                    profile_url=tech_search_url,
                    source=self.source_id,
                    source_url=tech_search_url,
                    source_references=[{
                        "source": "LinkedIn Public Directory",
                        "url": tech_search_url,
                        "type": "public_search_lead",
                    }],
                    public_contact_method="Live LinkedIn Public Search",
                    skills=[tech],
                    relationship_type="ENGINEER",
                    verification_status=ReferralVerificationStatus.SEARCH_LEAD,
                    raw_metadata={"category": "tech_specialist", "technology": tech},
                )
            )

        return [ReferralContactNormalizer.sanitize_privacy(c) for c in contacts]
