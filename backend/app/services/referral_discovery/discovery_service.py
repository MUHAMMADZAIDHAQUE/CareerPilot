import re
import uuid
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc, update, delete
from sqlalchemy.orm import selectinload
from datetime import datetime

from backend.app.models.job import Job
from backend.app.models.candidate import Candidate, Education, Experience, Skill
from backend.app.models.referral import ReferralContact, Contact, Referral
from backend.app.schemas.referral import (
    ReferralContactResponse,
    ReferralDiscoveryResponse,
    BulkSelectResponse,
    ReferralSourceStatus,
    ReferralSourceStatusResponse,
)
from backend.app.services.referral_discovery.base import (
    RawReferralContact,
    ReferralQueryContext,
    ReferralSourceAdapter,
)
from backend.app.services.referral_discovery.normalizer import ReferralContactNormalizer
from backend.app.services.referral_discovery.sources import AVAILABLE_REFERRAL_SOURCES
from backend.app.services.n8n import N8nService
from backend.app.core.logging import logger


class ReferralDiscoveryService:
    """
    Core engine for discovering, deduplicating, scoring, and ranking potential referral contacts.
    Targets a minimum of 50 potential contacts per job while strictly preserving truthfulness
    (zero contact fabrication) and enforcing human-in-the-loop governance (no automated messaging).
    """

    TARGET_COUNT: int = 50

    SENIORITY_ROLE_KEYWORDS = ["manager", "director", "head", "lead", "principal", "staff", "architect", "vp"]
    TECH_DEPT_KEYWORDS = ["engineer", "software", "backend", "systems", "platform", "infrastructure", "developer"]

    @classmethod
    def get_configured_sources(cls) -> List[ReferralSourceAdapter]:
        """Returns the list of all registered source adapters."""
        return AVAILABLE_REFERRAL_SOURCES

    @classmethod
    def get_sources_status(cls) -> ReferralSourceStatusResponse:
        """Returns the status and health of all referral sources."""
        statuses: List[ReferralSourceStatus] = []
        for src in cls.get_configured_sources():
            hc = src.health_check()
            statuses.append(
                ReferralSourceStatus(
                    source_id=src.source_id,
                    name=src.source_name,
                    enabled=src.is_enabled(),
                    status=hc.get("status", "healthy"),
                    description=src.description,
                    legitimate_access_method=src.legitimate_access_method,
                )
            )
        return ReferralSourceStatusResponse(
            sources=statuses,
            total_configured=len(statuses),
            total_active=sum(1 for s in statuses if s.enabled),
        )

    # -------------------------------------------------------------------------
    # Transparent Scoring Engine (0 - 100)
    # -------------------------------------------------------------------------

    @classmethod
    def compute_relevance_score(
        cls,
        contact: RawReferralContact,
        job: Job,
        candidate: Optional[Candidate] = None,
    ) -> Tuple[float, List[str], Dict[str, float]]:
        """
        Computes a deterministic, transparent relevance score grounded in verifiable facts:
        - Company association: 30%
        - Role/team relevance: 20%
        - Technical overlap: 15%
        - Alumni relationship: 15%
        - Seniority context: 10%
        - Public professional evidence: 10%

        Returns:
            (total_score, relevance_reasons, score_breakdown)
        """
        breakdown: Dict[str, float] = {
            "company_association": 0.0,
            "role_team_relevance": 0.0,
            "technical_overlap": 0.0,
            "alumni_relationship": 0.0,
            "seniority_context": 0.0,
            "public_evidence": 0.0,
        }
        reasons: List[str] = []

        norm_job_comp = ReferralContactNormalizer.normalize_company(job.company)
        norm_contact_comp = ReferralContactNormalizer.normalize_company(contact.company)

        # 1. Company Association (30 pts max)
        if norm_job_comp and norm_contact_comp and (norm_job_comp == norm_contact_comp or norm_job_comp in norm_contact_comp or norm_contact_comp in norm_job_comp):
            breakdown["company_association"] = 30.0
            reasons.append(f"Current employee at target company ({job.company})")
        elif norm_contact_comp and norm_job_comp and (norm_contact_comp in norm_job_comp or "parent" in contact.raw_metadata or "subsidiary" in contact.raw_metadata):
            breakdown["company_association"] = 15.0
            reasons.append(f"Affiliated organization or former connection to {job.company}")

        # 2. Role / Team Relevance (20 pts max)
        title_lower = contact.current_title.lower()
        dept_lower = (contact.department or "").lower()
        job_role_lower = job.role.lower()

        # Check direct role overlap or engineering department alignment
        is_tech = any(kw in title_lower or kw in dept_lower for kw in cls.TECH_DEPT_KEYWORDS)
        is_recruiter = "recruiter" in title_lower or "talent" in title_lower or "people" in dept_lower
        
        if any(word in title_lower for word in job_role_lower.split() if len(word) > 3):
            breakdown["role_team_relevance"] = 20.0
            reasons.append(f"Direct team and title alignment with target role ({job.role})")
        elif is_tech:
            breakdown["role_team_relevance"] = 16.0
            reasons.append("Technical department alignment in Software Engineering")
        elif is_recruiter:
            breakdown["role_team_relevance"] = 15.0
            reasons.append("Technical Talent & Recruiting insider at target company")
        else:
            breakdown["role_team_relevance"] = 8.0
            reasons.append(f"Professional peer in {contact.department or 'target company'}")

        # 3. Technical Overlap (15 pts max)
        job_skills = set(
            s.lower().strip() for s in (job.required_skills or []) + (job.preferred_skills or []) + (job.technologies or [])
        )
        contact_skills = set(s.lower().strip() for s in (contact.skills or []))
        overlap = contact_skills.intersection(job_skills)

        if len(overlap) >= 2:
            breakdown["technical_overlap"] = 15.0
            matched_str = ", ".join(sorted(list(overlap))[:3])
            reasons.append(f"Strong technical stack overlap in {matched_str}")
        elif len(overlap) == 1:
            breakdown["technical_overlap"] = 10.0
            reasons.append(f"Direct skill overlap in {list(overlap)[0]}")
        elif is_tech:
            breakdown["technical_overlap"] = 5.0
            reasons.append("Shared technical domain competency")

        # 4. Alumni Relationship (15 pts max)
        candidate_institutions: List[str] = []
        if candidate and candidate.education:
            for edu in candidate.education:
                if edu.institution:
                    candidate_institutions.append(ReferralContactNormalizer.normalize_company(edu.institution))

        contact_uni_norm = ReferralContactNormalizer.normalize_company(contact.university)
        is_alumni = False
        if contact_uni_norm and candidate_institutions:
            for c_uni in candidate_institutions:
                if c_uni and (c_uni in contact_uni_norm or contact_uni_norm in c_uni):
                    is_alumni = True
                    break

        if is_alumni or contact.relationship_type == "ALUMNI":
            breakdown["alumni_relationship"] = 15.0
            uni_name = contact.university or "Shared Alma Mater"
            reasons.append(f"University Alumni: Shared educational background at {uni_name}")

        # 5. Seniority Context (10 pts max)
        if any(kw in title_lower for kw in cls.SENIORITY_ROLE_KEYWORDS):
            breakdown["seniority_context"] = 10.0
            reasons.append(f"High-context technical leader / decision maker ({contact.current_title})")
        elif "senior" in title_lower or "sr." in title_lower:
            breakdown["seniority_context"] = 8.0
            reasons.append("Senior engineering practitioner with referral context")
        elif is_recruiter:
            breakdown["seniority_context"] = 8.0
            reasons.append("Recruiter with active hiring context")
        else:
            breakdown["seniority_context"] = 5.0

        # 6. Public Professional Evidence (10 pts max)
        ref_count = len(contact.source_references)
        if ref_count >= 2:
            breakdown["public_evidence"] = 10.0
            reasons.append(f"Multi-source verified provenance across {ref_count} public directories")
        elif contact.verification_status == "VERIFIED":
            breakdown["public_evidence"] = 8.0
            reasons.append("Verified public professional profile")
        else:
            breakdown["public_evidence"] = 4.0

        total_score = round(min(100.0, sum(breakdown.values())), 1)
        breakdown["total_score"] = total_score
        return total_score, reasons, breakdown

    # -------------------------------------------------------------------------
    # Deduplication & Merging Engine
    # -------------------------------------------------------------------------

    @classmethod
    def deduplicate_and_merge_contacts(
        cls,
        raw_contacts: List[RawReferralContact],
    ) -> List[RawReferralContact]:
        """
        Deduplicates contacts across sources and merges provenance.
        Rules:
        - 1 canonical contact created across LinkedIn, Company team page, GitHub, etc.
        - Merge source_references into a single combined provenance list.
        - Preserve highest verification status.
        - Merge skill lists without duplicates.
        """
        dedup_map: Dict[str, RawReferralContact] = {}

        for contact in raw_contacts:
            url_key, nc_key, nct_key = ReferralContactNormalizer.generate_dedup_keys(contact)
            
            # Find existing match
            matched_key = None
            if url_key and url_key in dedup_map:
                matched_key = url_key
            elif nc_key in dedup_map:
                matched_key = nc_key
            elif nct_key in dedup_map:
                matched_key = nct_key

            if matched_key:
                # Merge into existing record
                existing = dedup_map[matched_key]
                # Merge source references
                existing_sources = {ref.get("source") for ref in existing.source_references}
                for new_ref in contact.source_references:
                    if new_ref.get("source") not in existing_sources:
                        existing.source_references.append(new_ref)
                        existing_sources.add(new_ref.get("source"))

                # Upgrade verification status
                if contact.verification_status == "VERIFIED" or len(existing.source_references) >= 2:
                    existing.verification_status = "VERIFIED"

                # Merge skills
                all_skills = list(dict.fromkeys(existing.skills + contact.skills))
                existing.skills = all_skills

                # Fill empty fields
                if not existing.university and contact.university:
                    existing.university = contact.university
                if not existing.headline and contact.headline:
                    existing.headline = contact.headline
                if not existing.location and contact.location:
                    existing.location = contact.location
                if not existing.profile_url and contact.profile_url:
                    existing.profile_url = contact.profile_url
            else:
                # Store under both URL and name keys
                primary_key = url_key if url_key else nc_key
                dedup_map[primary_key] = contact
                if nc_key:
                    dedup_map[nc_key] = contact
                if nct_key:
                    dedup_map[nct_key] = contact

        # Return unique instances
        unique_contacts: List[RawReferralContact] = []
        seen_ids = set()
        for c in dedup_map.values():
            c_id = id(c)
            if c_id not in seen_ids:
                seen_ids.add(c_id)
                unique_contacts.append(c)

        return unique_contacts

    # -------------------------------------------------------------------------
    # Core Discovery Pipeline
    # -------------------------------------------------------------------------

    @classmethod
    async def discover_referrals(
        cls,
        session: AsyncSession,
        job_id: str,
        candidate_id: Optional[str] = None,
        target_count: int = 50,
        min_score: float = 0.0,
        sources_filter: Optional[List[str]] = None,
    ) -> ReferralDiscoveryResponse:
        """
        Executes full referral discovery pipeline for a selected job:
        1. Loads Job and Candidate profile.
        2. Constructs query intents.
        3. Queries configured source adapters with error resilience.
        4. Deduplicates and merges multi-source provenance.
        5. Computes transparent relevance scores.
        6. Ranks contacts.
        7. Evaluates against 50+ discovery target (reports shortfall, zero fabrication).
        8. Persists ReferralContact records.
        9. Dispatches non-blocking n8n event.
        """
        # 1. Fetch Job
        stmt = select(Job).where(Job.id == job_id)
        job_res = await session.execute(stmt)
        job = job_res.scalar_one_or_none()
        if not job:
            raise ValueError(f"Job with ID '{job_id}' not found.")

        # 2. Fetch Candidate profile
        candidate: Optional[Candidate] = None
        if candidate_id:
            c_stmt = (
                select(Candidate)
                .options(
                    selectinload(Candidate.education),
                    selectinload(Candidate.experiences),
                    selectinload(Candidate.skills),
                )
                .where(Candidate.id == candidate_id)
            )
            c_res = await session.execute(c_stmt)
            candidate = c_res.scalars().first()
        else:
            c_stmt = (
                select(Candidate)
                .options(
                    selectinload(Candidate.education),
                    selectinload(Candidate.experiences),
                    selectinload(Candidate.skills),
                )
                .limit(1)
            )
            c_res = await session.execute(c_stmt)
            candidate = c_res.scalars().first()

        # Build context
        cand_unis = [e.institution for e in (candidate.education or []) if e.institution] if candidate else []
        cand_skills = [s.name for s in (candidate.skills or []) if s.name] if candidate else []
        cand_comps = [exp.company for exp in (candidate.experiences or []) if exp.company] if candidate else []

        ctx = ReferralQueryContext(
            job_id=job.id,
            company=job.company,
            role=job.role,
            department=job.domain,
            technologies=job.technologies or [],
            required_skills=job.required_skills or [],
            candidate_id=candidate.id if candidate else None,
            candidate_universities=cand_unis,
            candidate_skills=cand_skills,
            candidate_previous_companies=cand_comps,
            target_count=target_count,
        )

        # 3. Query Adapters with failure resilience
        all_raw_contacts: List[RawReferralContact] = []
        sources_used: List[str] = []
        source_failures: List[Dict[str, Any]] = []

        for adapter in cls.get_configured_sources():
            if sources_filter and adapter.source_id not in sources_filter:
                continue
            if not adapter.is_enabled():
                continue

            try:
                sources_used.append(adapter.source_name)
                found = await adapter.discover_contacts(ctx)
                all_raw_contacts.extend(found)
            except Exception as e:
                logger.warning(f"Referral source '{adapter.source_id}' failed: {e}")
                source_failures.append({
                    "source_id": adapter.source_id,
                    "source_name": adapter.source_name,
                    "error": str(e),
                })

        # 4. Deduplicate and merge provenance
        merged_contacts = cls.deduplicate_and_merge_contacts(all_raw_contacts)

        # 5. Score and rank contacts
        scored_items: List[Tuple[RawReferralContact, float, List[str], Dict[str, float]]] = []
        for raw_c in merged_contacts:
            score, reasons, breakdown = cls.compute_relevance_score(raw_c, job, candidate)
            if score >= min_score:
                scored_items.append((raw_c, score, reasons, breakdown))

        # Sort descending by relevance score
        scored_items.sort(key=lambda x: x[1], reverse=True)

        # 6. Target Evaluation
        total_discovered = len(scored_items)
        verified_count = sum(1 for c, _, _, _ in scored_items if c.verification_status == "VERIFIED")
        target_reached = verified_count >= target_count
        shortfall = max(0, target_count - verified_count)

        notice = None
        if not target_reached:
            notice = "Target not reached because fewer verified/relevant contacts were discoverable from the configured sources."

        # 7. Persist to Database
        # Clear previous discovery run for this job to avoid stale duplicates
        del_stmt = delete(ReferralContact).where(ReferralContact.job_id == job.id)
        await session.execute(del_stmt)

        response_contacts: List[ReferralContactResponse] = []
        now_str = datetime.utcnow().isoformat()

        for raw_c, score, reasons, breakdown in scored_items:
            _, nc_key, _ = ReferralContactNormalizer.generate_dedup_keys(raw_c)
            contact_id = str(uuid.uuid4())

            entity = ReferralContact(
                id=contact_id,
                company_name=job.company,
                company=job.company,
                job_id=job.id,
                candidate_id=candidate.id if candidate else None,
                name=raw_c.name,
                headline=raw_c.headline,
                current_title=raw_c.current_title,
                department=raw_c.department,
                location=raw_c.location,
                profile_url=raw_c.profile_url,
                source=raw_c.source,
                source_url=raw_c.source_url,
                source_references=raw_c.source_references,
                public_contact_method=raw_c.public_contact_method,
                university=raw_c.university,
                graduation_year=raw_c.graduation_year,
                skills=raw_c.skills,
                relevance_score=score,
                relevance_reasons=reasons,
                score_breakdown=breakdown,
                relationship_type=raw_c.relationship_type,
                verification_status=raw_c.verification_status,
                last_verified_at=now_str,
                discovered_at=raw_c.discovered_at,
                duplicate_key=nc_key,
                notes=None,
                outreach_status="NOT_CONTACTED",
            )
            session.add(entity)

            response_contacts.append(
                ReferralContactResponse(
                    id=entity.id,
                    company_id=entity.company_id,
                    company_name=entity.company_name,
                    company=entity.company,
                    job_id=entity.job_id,
                    candidate_id=entity.candidate_id,
                    name=entity.name,
                    headline=entity.headline,
                    current_title=entity.current_title,
                    role=entity.current_title,
                    department=entity.department,
                    location=entity.location,
                    profile_url=entity.profile_url,
                    source=entity.source,
                    source_url=entity.source_url,
                    source_references=entity.source_references,
                    public_contact_method=entity.public_contact_method,
                    university=entity.university,
                    graduation_year=entity.graduation_year,
                    skills=entity.skills,
                    relevance_score=entity.relevance_score,
                    relevance_reasons=entity.relevance_reasons,
                    score_breakdown=entity.score_breakdown,
                    relationship_type=entity.relationship_type,
                    verification_status=entity.verification_status,
                    last_verified_at=entity.last_verified_at,
                    discovered_at=entity.discovered_at,
                    duplicate_key=entity.duplicate_key,
                    notes=entity.notes,
                    outreach_status=entity.outreach_status,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
            )

        await session.commit()

        # 8. Dispatch n8n event if configured
        if N8nService.is_enabled():
            try:
                await N8nService.dispatch_event(
                    event_name="referral-discovery",
                    payload={
                        "job_id": job.id,
                        "company": job.company,
                        "role": job.role,
                        "total_discovered": total_discovered,
                        "total_verified": verified_count,
                        "target_reached": target_reached,
                        "shortfall": shortfall,
                    },
                )
            except Exception as e:
                logger.warning(f"Failed to dispatch referral discovery event to n8n: {e}")

        return ReferralDiscoveryResponse(
            job_id=job.id,
            company=job.company,
            role=job.role,
            target_count=target_count,
            total_discovered=total_discovered,
            total_verified=verified_count,
            target_reached=target_reached,
            shortfall=shortfall,
            sources_used=sources_used,
            source_failures=source_failures,
            contacts=response_contacts,
            notice=notice,
        )

    # -------------------------------------------------------------------------
    # Contact Management & Selection (HITL Governance)
    # -------------------------------------------------------------------------

    @classmethod
    async def get_referral_contact_by_id(
        cls,
        session: AsyncSession,
        contact_id: str,
    ) -> Optional[ReferralContactResponse]:
        """Retrieves a single ReferralContact by ID."""
        stmt = select(ReferralContact).where(ReferralContact.id == contact_id)
        res = await session.execute(stmt)
        c = res.scalar_one_or_none()
        if not c:
            return None
        return ReferralContactResponse.model_validate(c)

    @classmethod
    async def list_referral_contacts(
        cls,
        session: AsyncSession,
        job_id: Optional[str] = None,
        company: Optional[str] = None,
        relationship_type: Optional[str] = None,
        verification_status: Optional[str] = None,
        outreach_status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[ReferralContactResponse]:
        """Lists referral contacts with optional filters."""
        query = select(ReferralContact)
        conditions = []

        if job_id:
            conditions.append(ReferralContact.job_id == job_id)
        if company:
            conditions.append(ReferralContact.company.ilike(f"%{company}%"))
        if relationship_type and relationship_type.upper() != "ALL":
            conditions.append(ReferralContact.relationship_type == relationship_type.upper())
        if verification_status and verification_status.upper() != "ALL":
            conditions.append(ReferralContact.verification_status == verification_status.upper())
        if outreach_status and outreach_status.upper() != "ALL":
            conditions.append(ReferralContact.outreach_status == outreach_status.upper())
        if search:
            s_pat = f"%{search}%"
            conditions.append(
                or_(
                    ReferralContact.name.ilike(s_pat),
                    ReferralContact.current_title.ilike(s_pat),
                    ReferralContact.company.ilike(s_pat),
                    ReferralContact.university.ilike(s_pat),
                    ReferralContact.department.ilike(s_pat),
                )
            )

        if conditions:
            query = query.where(and_(*conditions))

        query = query.order_by(desc(ReferralContact.relevance_score)).limit(limit).offset(offset)
        res = await session.execute(query)
        items = res.scalars().all()
        return [ReferralContactResponse.model_validate(c) for c in items]

    @classmethod
    async def select_contact(
        cls,
        session: AsyncSession,
        contact_id: str,
        notes: Optional[str] = None,
    ) -> Optional[ReferralContactResponse]:
        """
        Selects a contact for outreach preparation.
        STRICT RULE: This ONLY updates local status to 'SELECTED'.
        It NEVER sends messages, emails, or connection requests automatically.
        """
        stmt = select(ReferralContact).where(ReferralContact.id == contact_id)
        res = await session.execute(stmt)
        c = res.scalar_one_or_none()
        if not c:
            return None

        c.outreach_status = "SELECTED"
        if notes:
            c.notes = (f"{c.notes}\n{notes}").strip() if c.notes else notes
        await session.commit()
        await session.refresh(c)
        return ReferralContactResponse.model_validate(c)

    @classmethod
    async def dismiss_contact(
        cls,
        session: AsyncSession,
        contact_id: str,
    ) -> Optional[ReferralContactResponse]:
        """Marks a contact as dismissed / DO_NOT_CONTACT."""
        stmt = select(ReferralContact).where(ReferralContact.id == contact_id)
        res = await session.execute(stmt)
        c = res.scalar_one_or_none()
        if not c:
            return None

        c.outreach_status = "DO_NOT_CONTACT"
        await session.commit()
        await session.refresh(c)
        return ReferralContactResponse.model_validate(c)

    @classmethod
    async def bulk_select_contacts(
        cls,
        session: AsyncSession,
        contact_ids: List[str],
        action: str = "select",
    ) -> BulkSelectResponse:
        """
        Performs bulk selection or deselection.
        Never executes automated messaging.
        """
        target_status = "SELECTED" if action == "select" or action == "select_all_verified" else "NOT_CONTACTED"
        
        stmt = select(ReferralContact).where(ReferralContact.id.in_(contact_ids))
        res = await session.execute(stmt)
        contacts = res.scalars().all()

        updated_ids = []
        for c in contacts:
            if action == "select_all_verified" and c.verification_status != "VERIFIED":
                continue
            c.outreach_status = target_status
            updated_ids.append(c.id)

        await session.commit()
        msg = f"Successfully set {len(updated_ids)} contacts to '{target_status}'. Prepared for human review."
        return BulkSelectResponse(
            action=action,
            selected_count=len(updated_ids),
            updated_contact_ids=updated_ids,
            message=msg,
        )

    @classmethod
    async def update_contact_notes(
        cls,
        session: AsyncSession,
        contact_id: str,
        notes: str,
    ) -> Optional[ReferralContactResponse]:
        """Updates user notes on a referral contact."""
        stmt = select(ReferralContact).where(ReferralContact.id == contact_id)
        res = await session.execute(stmt)
        c = res.scalar_one_or_none()
        if not c:
            return None

        c.notes = notes
        await session.commit()
        await session.refresh(c)
        return ReferralContactResponse.model_validate(c)
