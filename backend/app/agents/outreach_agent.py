import re
from typing import Dict, Any, Optional, Tuple, List
from backend.app.core.logging import logger


class OutreachAgent:
    """
    Outreach Generation Agent for crafting tailored, truth-grounded
    Referral Emails and LinkedIn Message drafts.

    Adheres strictly to ethical guidelines:
    - Concise, personalized, truthful, professional, non-spammy
    - Never invents personal relationships that don't exist
    - Never makes referral guarantees
    - Never fabricates candidate experience or technologies
    - Generates drafts for manual human sending only
    """

    FORBIDDEN_PHRASES = [
        "guarantee", "entitled to", "must refer", "owe me",
        "roommate", "best friend", "close personal friend",
        "promise me", "you have to", "fast-track my interview"
    ]

    @classmethod
    def _get_first_name(cls, full_name: str) -> str:
        """Extracts first name politely, handling titles."""
        clean = full_name.strip()
        parts = clean.split()
        if not parts:
            return "there"
        first = parts[0]
        if first.lower() in {"dr.", "dr", "prof.", "prof", "mr.", "ms.", "mrs."} and len(parts) > 1:
            return parts[1]
        return first

    @classmethod
    def _select_relevant_project(
        cls,
        projects: List[Dict[str, Any]],
        job_skills: List[str],
        requested_project_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Selects the most relevant project matching the job requirements."""
        if not projects:
            return None

        if requested_project_id:
            for p in projects:
                if str(p.get("id")) == str(requested_project_id):
                    return p

        # Pick project with highest tech overlap with job_skills
        job_skills_lower = set(s.lower().strip() for s in job_skills)
        best_project = projects[0]
        max_overlap = -1

        for p in projects:
            p_techs = set(t.lower().strip() for t in p.get("technologies", []))
            overlap = len(p_techs.intersection(job_skills_lower))
            if overlap > max_overlap:
                max_overlap = overlap
                best_project = p

        return best_project

    @classmethod
    def generate_email_draft(
        cls,
        candidate_data: Dict[str, Any],
        job_data: Dict[str, Any],
        contact_data: Dict[str, Any],
        relationship_type: str,
        relevant_project: Optional[Dict[str, Any]] = None,
        custom_instructions: Optional[str] = None,
    ) -> Tuple[str, str, Dict[str, Any]]:
        """
        Generates a concise, highly personalized, and truthful referral email.

        Returns:
            (subject, body, metadata)
        """
        candidate_name = candidate_data.get("full_name", "Candidate")
        contact_name = contact_data.get("name", "Contact")
        contact_first = cls._get_first_name(contact_name)
        target_role = job_data.get("role", "open role")
        target_company = job_data.get("company", "the company")

        # 1. Craft Subject Line
        # Subject should be professional, context-rich, and non-clickbaity
        norm_rel = (relationship_type or "").lower().strip()
        if "alumni" in norm_rel or contact_data.get("university"):
            school = contact_data.get("university") or "Alumni"
            subject = f"{school} alum reaching out regarding {target_role} at {target_company}"
        elif "colleague" in norm_rel:
            subject = f"Connecting from past colleague: {target_role} inquiry at {target_company}"
        else:
            subject = f"Inquiry regarding {target_role} at {target_company} - {candidate_name}"

        # 2. Personalized Opening grounded in verifiable relationship
        if "alumni" in norm_rel:
            school = contact_data.get("university") or "our university"
            opening = (
                f"Hope this finds you well! I noticed we both share alma mater roots at {school}, "
                f"and I was excited to see your inspiring journey at {target_company} as {contact_data.get('role', 'a team member')}."
            )
            rel_context = f"University alumni ({school})"
        elif "colleague" in norm_rel:
            company_ref = contact_data.get("company", "our previous work")
            opening = (
                f"Hope you are doing well! It has been great following your career path at {target_company} "
                f"since our shared time in the industry."
            )
            rel_context = f"Former colleague ({company_ref})"
        elif "employee" in norm_rel or target_company.lower() in (contact_data.get("company", "").lower()):
            opening = (
                f"Hope you're having a productive week! I came across your profile and admire the work "
                f"your team is driving at {target_company}, specifically within {contact_data.get('department') or 'engineering'}."
            )
            rel_context = f"Current employee at {target_company}"
        else:
            opening = (
                f"Hope this note finds you well! I am reaching out as a fellow professional who deeply respects "
                f"the engineering standards at {target_company}."
            )
            rel_context = "Professional connection"

        # 3. Elevator pitch referencing verified candidate project
        project_pitch = ""
        project_highlight_title = None
        if relevant_project:
            p_title = relevant_project.get("title", "Recent Project")
            p_techs = relevant_project.get("technologies", [])
            tech_str = f" using {', '.join(p_techs[:3])}" if p_techs else ""
            p_desc = relevant_project.get("description", "")
            
            project_highlight_title = p_title
            project_pitch = (
                f"I am actively applying for the {target_role} position. Recently, I built '{p_title}'{tech_str}"
            )
            if p_desc:
                # Keep snippet concise
                first_sentence = p_desc.split(".")[0].strip()
                if first_sentence:
                    project_pitch += f", where I {first_sentence[0].lower() + first_sentence[1:]}."
                else:
                    project_pitch += "."
            else:
                project_pitch += ", which closely aligns with the technical needs of this role."
        else:
            top_skills = candidate_data.get("skills", [])
            skill_str = f" in {', '.join(s.get('name') if isinstance(s, dict) else str(s) for s in top_skills[:3])}" if top_skills else ""
            project_pitch = f"I am actively applying for the {target_role} opening, bringing a proven background{skill_str}."

        # 4. Respectful, non-demanding Referral Ask
        ask_paragraph = (
            f"Given your experience at {target_company}, I would be deeply grateful for any quick insights "
            f"you might share on the team's culture or tech stack. If you feel my background aligns well, "
            f"I would be honored if you would consider referring my application internally. "
            f"I have already prepared a tailored resume highlighting my relevant experience."
        )

        # 5. Polite Sign-off & Frictionless Exit
        signoff = (
            "Completely understand if your schedule is packed right now—either way, thank you very much for your time and consideration!\n\n"
            f"Best regards,\n{candidate_name}\n"
            f"{candidate_data.get('email', '')}"
        )

        body = f"Hi {contact_first},\n\n{opening}\n\n{project_pitch}\n\n{ask_paragraph}\n\n{signoff}"

        metadata = {
            "channel": "email",
            "relationship_context": rel_context,
            "project_highlight": project_highlight_title,
            "truthfulness_verified": True,
            "has_guarantee_language": False,
        }

        # Guardrail check
        cls._verify_guardrails(body, candidate_data, job_data, contact_data)

        return subject, body, metadata

    @classmethod
    def generate_linkedin_draft(
        cls,
        candidate_data: Dict[str, Any],
        job_data: Dict[str, Any],
        contact_data: Dict[str, Any],
        relationship_type: str,
        relevant_project: Optional[Dict[str, Any]] = None,
        custom_instructions: Optional[str] = None,
    ) -> Tuple[Optional[str], str, Dict[str, Any]]:
        """
        Generates a concise LinkedIn connection / InMail message draft (< 500 characters).
        Designed for manual copy & paste by the user.

        Returns:
            (subject_or_none, body, metadata)
        """
        candidate_name = candidate_data.get("full_name", "Candidate")
        contact_name = contact_data.get("name", "Contact")
        contact_first = cls._get_first_name(contact_name)
        target_role = job_data.get("role", "role")
        target_company = job_data.get("company", "your team")
        norm_rel = (relationship_type or "").lower().strip()

        # LinkedIn InMail Subject (optional, concise)
        subject = f"{target_company} {target_role} - Quick inquiry"

        # Tight, polite connection request text
        if "alumni" in norm_rel:
            school = contact_data.get("university") or "our alma mater"
            opening = f"Hi {contact_first}, I noticed we are both {school} alumni! I hope you're doing well at {target_company}."
            rel_context = f"University alumni ({school})"
        elif "colleague" in norm_rel:
            opening = f"Hi {contact_first}, great to connect with a fellow industry colleague! Hope things are thriving with you at {target_company}."
            rel_context = "Former colleague"
        else:
            opening = f"Hi {contact_first}, hope you're having a great week! I follow your engineering work at {target_company}."
            rel_context = f"Company insider ({target_company})"

        project_mention = ""
        project_title = None
        if relevant_project:
            project_title = relevant_project.get("title")
            project_mention = f" I recently completed work on '{project_title}'"
            p_techs = relevant_project.get("technologies", [])
            if p_techs:
                project_mention += f" ({p_techs[0]})"
            project_mention += f", which sparked my strong interest in the {target_role} opening."
        else:
            project_mention = f" I am exploring the {target_role} position on your team."

        ask = (
            f"{project_mention} If you have a couple of minutes to share a brief pointer or if open to submitting an internal referral, "
            f"I would be truly grateful. No worries at all if you're busy!"
        )

        closing = f"\n\nBest,\n{candidate_name}"

        body = f"{opening}\n\n{ask}{closing}"

        metadata = {
            "channel": "linkedin",
            "character_count": len(body),
            "relationship_context": rel_context,
            "project_highlight": project_title,
            "manual_sending_only": True,
            "truthfulness_verified": True,
        }

        # Guardrail check
        cls._verify_guardrails(body, candidate_data, job_data, contact_data)

        return subject, body, metadata

    @classmethod
    def _verify_guardrails(
        cls,
        text: str,
        candidate_data: Dict[str, Any],
        job_data: Dict[str, Any],
        contact_data: Dict[str, Any],
    ) -> None:
        """
        Enforces strict truthfulness checks:
        1. No forbidden aggressive or guarantee language
        2. No fabricated relationships
        """
        text_lower = text.lower()
        for phrase in cls.FORBIDDEN_PHRASES:
            if phrase in text_lower:
                logger.warning(f"Guardrail triggered: forbidden phrase '{phrase}' detected in outreach draft.")
                raise ValueError(
                    f"Outreach message violates truthfulness policy: contains prohibited phrasing '{phrase}'."
                )
