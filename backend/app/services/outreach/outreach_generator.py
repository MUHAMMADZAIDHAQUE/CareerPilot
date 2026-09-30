"""
CareerPilot Phase 19: Outreach Generator Engine.
Coordinates context construction, verified personalization extraction,
template rendering, and validator integration.
"""
from typing import Dict, Any, List, Optional
from backend.app.services.outreach.personalization import PersonalizationEngine
from backend.app.services.outreach.templates import OutreachTemplateEngine
from backend.app.services.outreach.outreach_validator import OutreachValidatorAgent
from backend.app.models.outreach import OutreachDraftStatus, OutreachChannel, OutreachLength


class OutreachGenerator:
    """
    Generates truth-grounded, non-spammy outreach drafts for an approved referral contact.
    Enforces strict zero-hallucination policies and integrates safe validation repairs.
    """

    PROMPT_VERSION = "v1.0-evidence-grounded"

    @classmethod
    def generate_draft(
        cls,
        candidate_data: Dict[str, Any],
        job_data: Dict[str, Any],
        contact_data: Dict[str, Any],
        channel: str = OutreachChannel.LINKEDIN,
        length: str = OutreachLength.MEDIUM,
        custom_instructions: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Executes end-to-end draft generation with verified personalization and validation.
        """
        # 1. Deterministically extract verified personalization evidence
        evidence = PersonalizationEngine.extract_evidence(
            candidate_data=candidate_data,
            job_data=job_data,
            contact_data=contact_data,
        )

        # 2. Select most relevant candidate project
        candidate_projects = candidate_data.get("projects") or []
        job_skills = [
            s.lower().strip()
            for s in (job_data.get("technologies") or job_data.get("required_skills") or [])
            if s
        ]
        selected_project = None
        if candidate_projects:
            # Score projects by technology overlap with job requirements
            best_overlap = -1
            best_p = candidate_projects[0]
            for p in candidate_projects:
                p_techs = [t.lower().strip() for t in p.get("technologies", [])]
                overlap = sum(1 for t in p_techs if t in job_skills)
                if overlap > best_overlap:
                    best_overlap = overlap
                    best_p = p
            selected_project = best_p

        p_name = selected_project.get("title") if selected_project else None
        p_techs = selected_project.get("technologies") if selected_project else None

        # 3. Render initial draft using relationship-adapted templates
        candidate_name = candidate_data.get("full_name") or candidate_data.get("name") or "Candidate"
        contact_name = contact_data.get("name", "there")
        contact_title = contact_data.get("current_title") or contact_data.get("title") or "Team Member"
        company_name = (
            contact_data.get("company_name")
            or contact_data.get("company")
            or job_data.get("company_name")
            or job_data.get("company")
            or "the team"
        )
        job_title = job_data.get("role") or job_data.get("title") or "Software Engineer"
        rel_type = contact_data.get("relationship_type", "EMPLOYEE")

        rendered = OutreachTemplateEngine.render_draft(
            candidate_name=candidate_name,
            contact_name=contact_name,
            contact_title=contact_title,
            company_name=company_name,
            job_title=job_title,
            relationship_type=rel_type,
            channel=channel,
            length=length,
            evidence=evidence,
            project_name=p_name,
            project_techs=p_techs,
            custom_instructions=custom_instructions,
        )

        # 4. Run validation & automatic safe repair
        val_result = OutreachValidatorAgent.validate_and_repair(
            subject=rendered.get("subject"),
            body=rendered.get("body", ""),
            candidate_facts=candidate_data,
            job_facts=job_data,
            contact_facts=contact_data,
            verified_evidence=evidence,
            channel=channel,
        )

        final_body = val_result.get("repaired_body") or rendered.get("body", "")
        final_subject = val_result.get("repaired_subject") or rendered.get("subject")

        # 5. Determine initial status based on validation
        if val_result["passed"]:
            status = OutreachDraftStatus.REVIEW_REQUIRED
        else:
            status = OutreachDraftStatus.BLOCKED

        return {
            "channel": channel.upper(),
            "subject": final_subject,
            "body": final_body,
            "status": status,
            "prompt_version": cls.PROMPT_VERSION,
            "generation_version": 1,
            "personalization_evidence": evidence,
            "validation_results": val_result,
            "risk_flags": val_result.get("risk_flags", []),
        }
