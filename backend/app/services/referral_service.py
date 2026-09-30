import re
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc
from sqlalchemy.orm import selectinload

from backend.app.models.job import Job
from backend.app.models.candidate import Candidate, Education, Experience
from backend.app.models.referral import Contact, Referral
from backend.app.schemas.referral import (
    ContactCreate,
    ContactUpdate,
    ReferralResponse,
    ContactResponse,
    JobReferralsResponse,
)
from backend.app.core.logging import logger


class ReferralDiscoveryService:
    """
    Service for discovering and scoring referral opportunities for jobs.
    Adheres to transparent, verifiable scoring and strict safety standards
    (no unauthorized scraping, no automated messaging).
    """

    # Department classification keywords
    DEPARTMENT_TAXONOMY = {
        "Engineering": ["engineer", "developer", "architect", "devops", "sre", "platform", "infrastructure", "backend", "frontend", "fullstack", "software"],
        "Data & AI": ["data", "machine learning", "ml", "ai", "scientist", "deep learning", "nlp", "computer vision", "analytics"],
        "Product": ["product manager", "pm", "technical product", "product lead", "program manager", "product owner"],
        "Design": ["designer", "ux", "ui", "product design", "graphic design"],
        "Security": ["security", "infosec", "appsec", "cryptography", "cyber"],
    }

    # Seniority keywords for referral authority
    SENIORITY_KEYWORDS = ["senior", "staff", "principal", "lead", "manager", "director", "head", "architect", "vp", "chief"]

    @staticmethod
    def _normalize_name(text: Optional[str]) -> str:
        """Normalizes company or school names for reliable comparison."""
        if not text:
            return ""
        s = text.lower().strip()
        # Remove common business suffixes
        s = re.sub(r"\b(inc|corp|corporation|llc|ltd|technologies|tech|labs|co|company)\b\.?", "", s)
        s = re.sub(r"[^\w\s]", "", s)
        return " ".join(s.split())

    @classmethod
    def _infer_department(cls, role: str) -> Optional[str]:
        """Infers high-level department from role title."""
        role_lower = role.lower()
        for dept, keywords in cls.DEPARTMENT_TAXONOMY.items():
            if any(kw in role_lower for kw in keywords):
                return dept
        return None

    @classmethod
    def compute_referral_score(
        cls,
        contact: Contact,
        job: Job,
        candidate: Optional[Candidate] = None,
    ) -> Tuple[float, str, str, List[Dict[str, Any]], Dict[str, float]]:
        """
        Computes a deterministic, transparent referral relevance score (0-100)
        grounded solely in verifiable evidence.

        Factors:
        - same company (+35 pts for current employee, +15 for former)
        - same university (+25 pts for shared institution)
        - relevant department (+20 pts for matching functional team)
        - same field / skills (+15 pts for 2+ overlapping skills, +10 for 1)
        - role relevance (+5 pts for senior/lead/manager standing)

        Returns:
            (relevance_score, relationship_type, relevance_reason, evidence_items, score_breakdown)
        """
        score_breakdown: Dict[str, float] = {
            "same_company": 0.0,
            "same_university": 0.0,
            "relevant_department": 0.0,
            "same_field": 0.0,
            "role_relevance": 0.0,
        }
        evidence_items: List[Dict[str, Any]] = []
        relationship_types_detected: List[str] = []

        norm_job_company = cls._normalize_name(job.company)
        norm_contact_company = cls._normalize_name(contact.company)

        # ---------------------------------------------------------------------
        # 1. Company Matching (Current Employee / Company Insider)
        # ---------------------------------------------------------------------
        is_same_company = (
            bool(norm_job_company and norm_contact_company)
            and (
                norm_job_company == norm_contact_company
                or norm_job_company in norm_contact_company
                or norm_contact_company in norm_job_company
            )
        )

        if is_same_company:
            score_breakdown["same_company"] = 35.0
            relationship_types_detected.append("current employee")
            evidence_items.append({
                "factor": "same_company",
                "evidence": f"Currently works at {contact.company} (matching target company {job.company}) as {contact.role}.",
                "score_contribution": 35.0,
            })
        elif contact.relationship and "former" in contact.relationship.lower() and norm_job_company in contact.relationship.lower():
            score_breakdown["same_company"] = 15.0
            evidence_items.append({
                "factor": "same_company",
                "evidence": f"Previous connection to target company {job.company}.",
                "score_contribution": 15.0,
            })

        # ---------------------------------------------------------------------
        # 2. University / Alumni Matching
        # ---------------------------------------------------------------------
        candidate_institutions: List[Tuple[str, str]] = []
        if candidate and candidate.education:
            for edu in candidate.education:
                if edu.institution:
                    candidate_institutions.append((cls._normalize_name(edu.institution), edu.institution))

        contact_university_norm = cls._normalize_name(contact.university)
        matched_institution = None

        if contact_university_norm and candidate_institutions:
            for norm_inst, raw_inst in candidate_institutions:
                if norm_inst and (norm_inst in contact_university_norm or contact_university_norm in norm_inst):
                    matched_institution = raw_inst
                    break

        # Also inspect relationship text for explicit alumni indicator
        is_alumni_relation = bool(
            contact.relationship and "alumni" in contact.relationship.lower()
        )

        if matched_institution or is_alumni_relation:
            score_breakdown["same_university"] = 25.0
            relationship_types_detected.append("university alumni")
            inst_name = matched_institution or contact.university or "shared university"
            evidence_items.append({
                "factor": "same_university",
                "evidence": f"University Alumni: Shared alma mater at {inst_name}.",
                "score_contribution": 25.0,
            })

        # ---------------------------------------------------------------------
        # 3. Former Colleague Matching
        # ---------------------------------------------------------------------
        candidate_prev_companies: List[str] = []
        if candidate and candidate.experiences:
            for exp in candidate.experiences:
                if exp.company:
                    candidate_prev_companies.append(cls._normalize_name(exp.company))

        is_former_colleague = False
        if contact.relationship and "colleague" in contact.relationship.lower():
            is_former_colleague = True
        elif norm_contact_company and any(norm_contact_company == c or c in norm_contact_company for c in candidate_prev_companies):
            is_former_colleague = True

        if is_former_colleague:
            relationship_types_detected.append("former colleague")
            evidence_items.append({
                "factor": "former_colleague",
                "evidence": f"Professional history: Former colleague connection at {contact.company}.",
                "score_contribution": 0.0,  # Recorded as relationship context
            })

        # ---------------------------------------------------------------------
        # 4. Department Alignment
        # ---------------------------------------------------------------------
        job_dept = cls._infer_department(job.role)
        contact_dept = contact.department or cls._infer_department(contact.role)

        if job_dept and contact_dept:
            if job_dept == contact_dept:
                score_breakdown["relevant_department"] = 20.0
                evidence_items.append({
                    "factor": "relevant_department",
                    "evidence": f"Department alignment: Both in {job_dept} domain ({contact.role} vs {job.role}).",
                    "score_contribution": 20.0,
                })
            elif (job_dept in ["Engineering", "Data & AI"] and contact_dept in ["Engineering", "Data & AI"]) or \
                 (job_dept in ["Product", "Engineering"] and contact_dept in ["Product", "Engineering"]):
                score_breakdown["relevant_department"] = 10.0
                evidence_items.append({
                    "factor": "relevant_department",
                    "evidence": f"Cross-functional alignment: {contact_dept} domain closely coordinates with {job_dept}.",
                    "score_contribution": 10.0,
                })

        # ---------------------------------------------------------------------
        # 5. Same Field / Technical Skill Overlap
        # ---------------------------------------------------------------------
        job_skills = set(
            s.lower().strip() for s in (job.required_skills or []) + (job.preferred_skills or []) + (job.technologies or [])
        )
        contact_skills = set(s.lower().strip() for s in (contact.skills or []))

        overlap = contact_skills.intersection(job_skills)
        if len(overlap) >= 2:
            score_breakdown["same_field"] = 15.0
            evidence_items.append({
                "factor": "same_field",
                "evidence": f"Technical stack alignment: Shared core competencies in {', '.join(sorted(list(overlap))[:4])}.",
                "score_contribution": 15.0,
            })
        elif len(overlap) == 1:
            score_breakdown["same_field"] = 10.0
            evidence_items.append({
                "factor": "same_field",
                "evidence": f"Technical skill overlap in '{list(overlap)[0]}'.",
                "score_contribution": 10.0,
            })
        elif job.domain and contact.department and job.domain.lower() in contact.department.lower():
            score_breakdown["same_field"] = 8.0
            evidence_items.append({
                "factor": "same_field",
                "evidence": f"Domain alignment in {job.domain}.",
                "score_contribution": 8.0,
            })

        # ---------------------------------------------------------------------
        # 6. Role Relevance & Seniority
        # ---------------------------------------------------------------------
        role_lower = contact.role.lower()
        if any(kw in role_lower for kw in cls.SENIORITY_KEYWORDS):
            score_breakdown["role_relevance"] = 5.0
            evidence_items.append({
                "factor": "role_relevance",
                "evidence": f"Seniority relevance: {contact.role} holds established technical standing and referral influence.",
                "score_contribution": 5.0,
            })
        else:
            score_breakdown["role_relevance"] = 2.0

        # ---------------------------------------------------------------------
        # Determine Primary Relationship Type
        # ---------------------------------------------------------------------
        if "current employee" in relationship_types_detected:
            primary_relationship = "current employee"
        elif "university alumni" in relationship_types_detected:
            primary_relationship = "university alumni"
        elif "former colleague" in relationship_types_detected:
            primary_relationship = "former colleague"
        elif contact.source == "user_provided" or (contact.relationship and "connection" in contact.relationship.lower()):
            primary_relationship = "user-provided connection"
        else:
            primary_relationship = "known professional contact"

        # Calculate Total Relevance Score (bounded 0 - 100)
        total_score = min(100.0, sum(score_breakdown.values()))
        score_breakdown["total_score"] = round(total_score, 1)

        # ---------------------------------------------------------------------
        # Synthesize Evidence-Grounded Relevance Reason
        # ---------------------------------------------------------------------
        reason_phrases = []
        if is_same_company:
            reason_phrases.append(f"Current insider at {contact.company} ({contact.role})")
        if matched_institution or is_alumni_relation:
            reason_phrases.append(f"shared alumni connection ({matched_institution or contact.university or 'alma mater'})")
        if is_former_colleague:
            reason_phrases.append("former colleague")
        if score_breakdown.get("relevant_department", 0) > 0 and job_dept:
            reason_phrases.append(f"aligned in {job_dept}")
        if overlap:
            reason_phrases.append(f"hands-on expertise in {', '.join(sorted(list(overlap))[:2])}")

        if reason_phrases:
            relevance_reason = f"{contact.name} is a high-priority referral opportunity: " + "; ".join(reason_phrases) + "."
        else:
            relevance_reason = f"{contact.name} is a verified professional contact at {contact.company} in {contact.role}."

        return (
            round(total_score, 1),
            primary_relationship,
            relevance_reason,
            evidence_items,
            score_breakdown,
        )

    # -------------------------------------------------------------------------
    # Core Discovery Method
    # -------------------------------------------------------------------------

    @classmethod
    async def discover_referrals_for_job(
        cls,
        session: AsyncSession,
        job_id: str,
        candidate_id: Optional[str] = None,
        min_score: float = 0.0,
    ) -> JobReferralsResponse:
        """
        Identifies and ranks potential referral opportunities for a given job.
        Grounds every match in evidence and creates or updates Referral records.
        """
        # 1. Fetch Job
        stmt = select(Job).where(Job.id == job_id)
        job_result = await session.execute(stmt)
        job = job_result.scalar_one_or_none()
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
            candidate = c_res.scalar_one_or_none()
        else:
            # Default to the first available candidate in DB
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
            candidate = c_res.scalar_one_or_none()

        # 3. Fetch Contacts
        # Contacts associated with this candidate or global contacts
        contact_query = select(Contact)
        if candidate:
            contact_query = contact_query.where(
                or_(Contact.candidate_id == candidate.id, Contact.candidate_id.is_(None))
            )
        contact_res = await session.execute(contact_query)
        contacts = contact_res.scalars().all()

        logger.info(
            f"Discovering referrals for job '{job.role}' at '{job.company}' across {len(contacts)} contacts."
        )

        referral_responses: List[ReferralResponse] = []

        # 4. Score each contact against this job
        for contact in contacts:
            score, rel_type, rel_reason, evidence, breakdown = cls.compute_referral_score(
                contact=contact,
                job=job,
                candidate=candidate,
            )

            if score < min_score:
                continue

            # Check if a referral already exists for this (job_id, contact_id)
            ref_stmt = select(Referral).where(
                and_(Referral.job_id == job.id, Referral.contact_id == contact.id)
            )
            ref_res = await session.execute(ref_stmt)
            existing_ref = ref_res.scalar_one_or_none()

            if existing_ref:
                # Update existing record
                existing_ref.relationship_type = rel_type
                existing_ref.relevance_score = score
                existing_ref.relevance_reason = rel_reason
                existing_ref.evidence = evidence
                existing_ref.score_breakdown = breakdown
                if candidate and not existing_ref.candidate_id:
                    existing_ref.candidate_id = candidate.id
                referral_obj = existing_ref
            else:
                # Create new referral record
                referral_obj = Referral(
                    job_id=job.id,
                    contact_id=contact.id,
                    candidate_id=candidate.id if candidate else None,
                    relationship_type=rel_type,
                    relevance_score=score,
                    relevance_reason=rel_reason,
                    status="suggested",
                    evidence=evidence,
                    score_breakdown=breakdown,
                )
                session.add(referral_obj)

        await session.commit()

        # 5. Retrieve all referrals for this job sorted by relevance score
        fetch_stmt = (
            select(Referral)
            .options(selectinload(Referral.contact))
            .where(Referral.job_id == job.id)
            .order_by(desc(Referral.relevance_score))
        )
        all_refs_res = await session.execute(fetch_stmt)
        saved_referrals = all_refs_res.scalars().all()

        for ref in saved_referrals:
            referral_responses.append(
                ReferralResponse(
                    id=ref.id,
                    job_id=ref.job_id,
                    contact_id=ref.contact_id,
                    candidate_id=ref.candidate_id,
                    relationship_type=ref.relationship_type,
                    relevance_score=ref.relevance_score,
                    relevance_reason=ref.relevance_reason,
                    status=ref.status,
                    evidence=ref.evidence,
                    score_breakdown=ref.score_breakdown,
                    notes=ref.notes,
                    contact=ContactResponse.model_validate(ref.contact) if ref.contact else None,
                    created_at=ref.created_at,
                    updated_at=ref.updated_at,
                )
            )

        return JobReferralsResponse(
            job_id=job.id,
            company=job.company,
            role=job.role,
            total_opportunities=len(referral_responses),
            referrals=referral_responses,
        )

    # -------------------------------------------------------------------------
    # Contact CRUD Methods
    # -------------------------------------------------------------------------

    @staticmethod
    async def create_contact(
        session: AsyncSession,
        payload: ContactCreate,
    ) -> ContactResponse:
        """Manually creates a new contact."""
        contact = Contact(
            candidate_id=payload.candidate_id,
            name=payload.name,
            company=payload.company,
            role=payload.role,
            department=payload.department,
            source=payload.source,
            profile_url=payload.profile_url,
            email=payload.email,
            relationship=payload.relationship,
            notes=payload.notes,
            university=payload.university,
            skills=payload.skills,
        )
        session.add(contact)
        await session.commit()
        await session.refresh(contact)
        return ContactResponse.model_validate(contact)

    @staticmethod
    async def get_contact(
        session: AsyncSession,
        contact_id: str,
    ) -> Optional[ContactResponse]:
        """Fetches a single contact by ID."""
        stmt = select(Contact).where(Contact.id == contact_id)
        res = await session.execute(stmt)
        contact = res.scalar_one_or_none()
        if not contact:
            return None
        return ContactResponse.model_validate(contact)

    @staticmethod
    async def list_contacts(
        session: AsyncSession,
        candidate_id: Optional[str] = None,
        company: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[ContactResponse]:
        """Lists contacts with optional search and filtering."""
        stmt = select(Contact)
        conditions = []
        if candidate_id:
            conditions.append(or_(Contact.candidate_id == candidate_id, Contact.candidate_id.is_(None)))
        if company:
            conditions.append(Contact.company.ilike(f"%{company}%"))
        if search:
            conditions.append(
                or_(
                    Contact.name.ilike(f"%{search}%"),
                    Contact.company.ilike(f"%{search}%"),
                    Contact.role.ilike(f"%{search}%"),
                    Contact.university.ilike(f"%{search}%"),
                )
            )
        if conditions:
            stmt = stmt.where(and_(*conditions))

        stmt = stmt.order_by(Contact.name).offset(offset).limit(limit)
        res = await session.execute(stmt)
        contacts = res.scalars().all()
        return [ContactResponse.model_validate(c) for c in contacts]

    @staticmethod
    async def update_contact(
        session: AsyncSession,
        contact_id: str,
        payload: ContactUpdate,
    ) -> Optional[ContactResponse]:
        """Updates an existing contact."""
        stmt = select(Contact).where(Contact.id == contact_id)
        res = await session.execute(stmt)
        contact = res.scalar_one_or_none()
        if not contact:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        for key, val in update_data.items():
            setattr(contact, key, val)

        await session.commit()
        await session.refresh(contact)
        return ContactResponse.model_validate(contact)

    @staticmethod
    async def delete_contact(
        session: AsyncSession,
        contact_id: str,
    ) -> bool:
        """Deletes a contact and cascades to its referrals."""
        stmt = select(Contact).where(Contact.id == contact_id)
        res = await session.execute(stmt)
        contact = res.scalar_one_or_none()
        if not contact:
            return False

        await session.delete(contact)
        await session.commit()
        return True

    @staticmethod
    async def update_referral_status(
        session: AsyncSession,
        referral_id: str,
        new_status: str,
        notes: Optional[str] = None,
    ) -> Optional[ReferralResponse]:
        """Updates the tracking status of a referral opportunity."""
        stmt = (
            select(Referral)
            .options(selectinload(Referral.contact))
            .where(Referral.id == referral_id)
        )
        res = await session.execute(stmt)
        ref = res.scalar_one_or_none()
        if not ref:
            return None

        ref.status = new_status
        if notes is not None:
            ref.notes = notes

        await session.commit()
        await session.refresh(ref)

        return ReferralResponse(
            id=ref.id,
            job_id=ref.job_id,
            contact_id=ref.contact_id,
            candidate_id=ref.candidate_id,
            relationship_type=ref.relationship_type,
            relevance_score=ref.relevance_score,
            relevance_reason=ref.relevance_reason,
            status=ref.status,
            evidence=ref.evidence,
            score_breakdown=ref.score_breakdown,
            notes=ref.notes,
            contact=ContactResponse.model_validate(ref.contact) if ref.contact else None,
            created_at=ref.created_at,
            updated_at=ref.updated_at,
        )

    # -------------------------------------------------------------------------
    # Phase 18: Delegated 50+ Multi-Source Discovery & Selection
    # -------------------------------------------------------------------------
    @classmethod
    async def discover_referrals(cls, *args, **kwargs):
        from backend.app.services.referral_discovery.discovery_service import ReferralDiscoveryService as Engine
        return await Engine.discover_referrals(*args, **kwargs)

    @classmethod
    async def list_referral_contacts(cls, *args, **kwargs):
        from backend.app.services.referral_discovery.discovery_service import ReferralDiscoveryService as Engine
        return await Engine.list_referral_contacts(*args, **kwargs)

    @classmethod
    async def get_referral_contact_by_id(cls, *args, **kwargs):
        from backend.app.services.referral_discovery.discovery_service import ReferralDiscoveryService as Engine
        return await Engine.get_referral_contact_by_id(*args, **kwargs)

    @classmethod
    async def select_contact(cls, *args, **kwargs):
        from backend.app.services.referral_discovery.discovery_service import ReferralDiscoveryService as Engine
        return await Engine.select_contact(*args, **kwargs)

    @classmethod
    async def dismiss_contact(cls, *args, **kwargs):
        from backend.app.services.referral_discovery.discovery_service import ReferralDiscoveryService as Engine
        return await Engine.dismiss_contact(*args, **kwargs)

    @classmethod
    async def bulk_select_contacts(cls, *args, **kwargs):
        from backend.app.services.referral_discovery.discovery_service import ReferralDiscoveryService as Engine
        return await Engine.bulk_select_contacts(*args, **kwargs)

    @classmethod
    async def update_contact_notes(cls, *args, **kwargs):
        from backend.app.services.referral_discovery.discovery_service import ReferralDiscoveryService as Engine
        return await Engine.update_contact_notes(*args, **kwargs)

    @classmethod
    def get_sources_status(cls, *args, **kwargs):
        from backend.app.services.referral_discovery.discovery_service import ReferralDiscoveryService as Engine
        return Engine.get_sources_status(*args, **kwargs)

