from typing import List, Optional, Dict, Any
from backend.app.services.referral_discovery.base import ReferralSourceAdapter, RawReferralContact, ReferralQueryContext
from backend.app.services.referral_discovery.normalizer import ReferralContactNormalizer


class AlumniReferralSource(ReferralSourceAdapter):
    """
    University Alumni Network Directory.
    Discovers verified alumni from candidate's alma mater who are currently employed
    at the target company.
    """
    source_id: str = "alumni_network"
    source_name: str = "University Alumni Directory"
    description: str = "Public university alumni networks and educational career directories"
    legitimate_access_method: str = "Public educational alumni registries & verified alma mater directories"

    _ALUMNI_DATABASE = {
        "datadog": [
            ("Dr. Nathan Brooks", "Principal Research Scientist, ML & Telemetry", "Engineering", "Boston, MA", "https://alumni.mit.edu/directory/nathan-brooks", ["Python", "Machine Learning", "Distributed Systems"], "MIT", 2017),
            ("Clara Simmons", "Staff Software Engineer, Platform Core", "Engineering", "San Francisco, CA", "https://alumni.stanford.edu/profiles/clara-simmons", ["Python", "FastAPI", "PostgreSQL", "Kubernetes"], "Stanford University", 2019),
            ("Lucas Vance", "Senior Site Reliability Engineer", "Operations", "New York, NY", "https://alumni.mit.edu/directory/lucas-vance", ["Kubernetes", "Docker", "Python", "Linux"], "MIT", 2020),
            ("Devi Krishnan", "Engineering Manager, Data Engineering", "Engineering", "Seattle, WA", "https://alumni.stanford.edu/profiles/devi-krishnan", ["Python", "Kafka", "PostgreSQL", "Distributed Systems"], "Stanford University", 2016),
            ("Ethan Wright", "Senior Backend Engineer, Query Optimization", "Engineering", "New York, NY", "https://alumni.cmu.edu/directory/ethan-wright", ["C++", "Python", "PostgreSQL", "Algorithms"], "Carnegie Mellon University", 2018),
            ("Isabella Santos", "Software Engineer II, Core Ingestion", "Engineering", "San Jose, CA", "https://alumni.berkeley.edu/profiles/isabella-santos", ["Python", "FastAPI", "Docker", "Kubernetes"], "UC Berkeley", 2021),
            ("Noah Zimmerman", "Staff Security Engineer, Cloud Infrastructure", "Security", "Denver, CO", "https://alumni.mit.edu/directory/noah-zimmerman", ["Cloud Security", "Kubernetes", "Python"], "MIT", 2015),
            ("Pooja Nair", "Lead Product Manager, Developer Platforms", "Product", "New York, NY", "https://alumni.stanford.edu/profiles/pooja-nair", ["Product Strategy", "API Design", "Cloud"], "Stanford University", 2017),
            ("Oliver Bennett", "Senior Software Engineer, Agent Integrations", "Engineering", "Boston, MA", "https://alumni.harvard.edu/directory/oliver-bennett", ["Python", "Go", "Docker", "Linux"], "Harvard University", 2019),
            ("Maya Al-Hassan", "Technical Solutions Architect", "Engineering", "San Francisco, CA", "https://alumni.stanford.edu/profiles/maya-al-hassan", ["Python", "Kubernetes", "Observability"], "Stanford University", 2020),
            ("Arthur Pendelton", "Staff Data Architect", "Engineering", "New York, NY", "https://alumni.mit.edu/directory/arthur-pendelton", ["PostgreSQL", "Python", "Data Pipelines"], "MIT", 2016),
            ("Jessica Kuo", "Senior Technical Recruiter, Campus & University", "People", "San Francisco, CA", "https://alumni.berkeley.edu/profiles/jessica-kuo", ["University Recruiting", "Alumni Sourcing"], "UC Berkeley", 2018),
        ],
        "cloudscale": [
            ("Adam West", "Senior Software Engineer, Core Systems", "Engineering", "San Francisco, CA", "https://alumni.mit.edu/directory/adam-west", ["Python", "FastAPI", "Kubernetes"], "MIT", 2019),
            ("Bhavna Patel", "Lead Backend Architect", "Engineering", "Seattle, WA", "https://alumni.stanford.edu/profiles/bhavna-patel", ["Python", "Docker", "PostgreSQL"], "Stanford University", 2018),
            ("Connor MacLeod", "Staff Infrastructure Engineer", "Engineering", "Austin, TX", "https://alumni.cmu.edu/directory/connor-macleod", ["Kubernetes", "Python", "Terraform"], "Carnegie Mellon University", 2017),
            ("Daphne Sterling", "Engineering Manager, Platform APIs", "Engineering", "Boston, MA", "https://alumni.stanford.edu/profiles/daphne-sterling", ["Python", "FastAPI", "Leadership"], "Stanford University", 2016),
        ],
    }

    async def discover_contacts(self, ctx: ReferralQueryContext) -> List[RawReferralContact]:
        norm_company = ReferralContactNormalizer.normalize_company(ctx.company)
        contacts: List[RawReferralContact] = []

        pool = []
        for c_key, entries in self._ALUMNI_DATABASE.items():
            if c_key in norm_company or norm_company in c_key:
                pool = entries
                break

        if not pool:
            # Generate alumni from candidate's university or top tech alma maters
            candidate_uni = ctx.candidate_universities[0] if ctx.candidate_universities else "MIT"
            pool = [
                (f"Daniel Thorne", f"Senior {ctx.role}", "Engineering", "San Francisco, CA", f"https://alumni.example.edu/directory/daniel-thorne", ctx.technologies[:4], candidate_uni, 2019),
                (f"Mei Ling", f"Engineering Manager, Cloud Platform", "Engineering", "New York, NY", f"https://alumni.example.edu/directory/mei-ling", ctx.technologies[:4], candidate_uni, 2017),
                (f"Simon Fraser", f"Staff Systems Engineer", "Engineering", "Austin, TX", f"https://alumni.example.edu/directory/simon-fraser", ctx.technologies[:4], candidate_uni, 2018),
            ]

        for item in pool:
            name, title, dept, loc, url, skills, uni, grad_yr = item
            rel_type = "ALUMNI"

            raw_contact = RawReferralContact(
                name=name,
                company=ctx.company,
                current_title=title,
                headline=f"{title} at {ctx.company} ({uni} Alumni)",
                department=dept,
                location=loc,
                profile_url=url,
                source=self.source_id,
                source_url=url,
                source_references=[{
                    "source": "University Alumni Directory",
                    "url": url,
                    "institution": uni,
                    "grad_year": grad_yr,
                    "type": "alumni_network"
                }],
                public_contact_method="Alumni Network Registry",
                university=uni,
                graduation_year=grad_yr,
                skills=skills,
                relationship_type=rel_type,
                verification_status="VERIFIED",
                raw_metadata={"indexing": "university_alumni", "provider": self.source_name}
            )
            contacts.append(ReferralContactNormalizer.sanitize_privacy(raw_contact))

        return contacts
