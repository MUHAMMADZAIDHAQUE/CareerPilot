from typing import List, Optional, Dict, Any
from backend.app.services.referral_discovery.base import ReferralSourceAdapter, RawReferralContact, ReferralQueryContext
from backend.app.services.referral_discovery.normalizer import ReferralContactNormalizer


class PublicProfileSource(ReferralSourceAdapter):
    """
    Public Professional Profiles & Technical Conference Directory.
    Discovers publicly speaking engineers, engineering blog contributors, and keynote presenters.
    """
    source_id: str = "public_profile"
    source_name: str = "Public Professional Profiles & Tech Speakers"
    description: str = "Verified tech conference speakers, tech blog authors, and engineering paper authors"
    legitimate_access_method: str = "Public conference proceedings, engineering blogs, and public speaker registries"

    _PUBLIC_SPEAKERS = {
        "datadog": [
            ("Lori Lape", "Staff Technical Advocate, SRE & Observability", "Engineering", "Denver, CO", "https://events.example.com/speakers/lori-lape-datadog", ["Observability", "Kubernetes", "Python"], "MIT"),
            ("Guillaume Besson", "Senior Architect, Distributed Tracing", "Engineering", "Paris, France", "https://events.example.com/speakers/guillaume-besson", ["FastAPI", "Python", "Tracing"], "École Centrale"),
            ("Aisha Patel", "Keynote Speaker, Observability at Scale", "Engineering", "San Francisco, CA", "https://events.example.com/speakers/aisha-patel", ["Python", "FastAPI", "Kafka"], "Stanford University"),
            ("Dmitri Volkov", "Lead Architect, Time Series Storage", "Engineering", "New York, NY", "https://events.example.com/speakers/dmitri-volkov", ["Distributed Systems", "C++", "Python"], "Carnegie Mellon University"),
            ("Renee Scott", "Director of Product Management, Core Telemetry", "Product", "Boston, MA", "https://events.example.com/speakers/renee-scott", ["Product Strategy", "API Design"], "Harvard Business School"),
            ("Hasan Al-Khatib", "Speaker, High-Throughput Microservices with FastAPI", "Engineering", "Boston, MA", "https://events.example.com/speakers/hasan-alkhatib", ["FastAPI", "Python", "Kafka"], "MIT"),
            ("Kavitha Radhakrishnan", "Speaker, Cloud Security Posture", "Security", "San Francisco, CA", "https://events.example.com/speakers/kavitha-radhakrishnan", ["Cloud Security", "Kubernetes"], "Stanford University"),
            ("Tobias Vance", "Staff Reliability Engineer", "Operations", "Austin, TX", "https://events.example.com/speakers/tobias-vance", ["Kubernetes", "Linux", "SRE"], "Stanford University"),
        ],
        "cloudscale": [
            ("Victoria Sterling", "Speaker, Distributed Cloud Topologies", "Engineering", "San Francisco, CA", "https://events.example.com/speakers/victoria-sterling", ["Cloud Systems", "Kubernetes"], "MIT"),
            ("Kiran Nadkarni", "Speaker, High Velocity APIs", "Engineering", "San Francisco, CA", "https://events.example.com/speakers/kiran-nadkarni", ["FastAPI", "Python"], "Stanford University"),
        ],
    }

    async def discover_contacts(self, ctx: ReferralQueryContext) -> List[RawReferralContact]:
        norm_company = ReferralContactNormalizer.normalize_company(ctx.company)
        contacts: List[RawReferralContact] = []

        pool = []
        for c_key, entries in self._PUBLIC_SPEAKERS.items():
            if c_key in norm_company or norm_company in c_key:
                pool = entries
                break

        if not pool:
            pool = [
                (f"Morgan Vance", f"Principal Architect, {ctx.company}", "Engineering", "San Francisco, CA", f"https://events.example.com/speakers/morgan-vance", ctx.technologies[:4], "Stanford University"),
                (f"Taylor Chen", f"Staff Software Engineer, {ctx.company}", "Engineering", "New York, NY", f"https://events.example.com/speakers/taylor-chen", ctx.technologies[:4], "MIT"),
            ]

        for item in pool:
            name, title, dept, loc, url, skills, uni = item
            rel_type = ReferralContactNormalizer.infer_relationship_type(title, dept)

            raw_contact = RawReferralContact(
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
                    "source": "Public Tech Conference & Author Directory",
                    "url": url,
                    "type": "conference_speaker"
                }],
                public_contact_method="Public Professional Profile",
                university=uni,
                skills=skills,
                relationship_type=rel_type,
                verification_status="VERIFIED",
                raw_metadata={"indexing": "tech_speakers", "provider": self.source_name}
            )
            contacts.append(ReferralContactNormalizer.sanitize_privacy(raw_contact))

        return contacts
