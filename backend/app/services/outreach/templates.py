"""
CareerPilot Phase 19: Outreach Templates & Phrasing Adaptation.
Provides concise, human-grounded, professional communication drafts
adapted strictly by relationship classification and channel.
"""
from typing import Dict, Any, List, Optional


class OutreachTemplateEngine:
    """
    Renders tailored outreach drafts adapted to recipient seniority,
    engineering discipline, communication channel, and verified evidence.
    """

    @classmethod
    def _extract_first_name(cls, full_name: str) -> str:
        clean = (full_name or "").strip()
        parts = clean.split()
        if not parts:
            return "there"
        first = parts[0]
        if first.lower() in {"dr.", "dr", "prof.", "prof", "mr.", "ms.", "mrs."} and len(parts) > 1:
            return parts[1]
        return first

    @classmethod
    def render_draft(
        cls,
        candidate_name: str,
        contact_name: str,
        contact_title: str,
        company_name: str,
        job_title: str,
        relationship_type: str,
        channel: str,
        length: str,
        evidence: List[Dict[str, Any]],
        project_name: Optional[str] = None,
        project_techs: Optional[List[str]] = None,
        custom_instructions: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Renders subject and body for the selected channel and contact type.
        """
        first_name = cls._extract_first_name(contact_name)
        rel_upper = (relationship_type or "EMPLOYEE").upper()
        chan_upper = (channel or "LINKEDIN").upper()
        is_short = (length or "MEDIUM").upper() == "SHORT"

        # Check for verified evidence tags
        has_alumni = any(e.get("type") == "ALUMNI" for e in evidence)
        alumni_item = next((e for e in evidence if e.get("type") == "ALUMNI"), None)
        tech_item = next((e for e in evidence if e.get("type") == "TECHNOLOGY"), None)
        has_github = any(e.get("type") == "GITHUB" for e in evidence)

        tech_phrase = ""
        if tech_item:
            # E.g. "Python, Kubernetes, Distributed Systems"
            tech_phrase = tech_item.get("claim", "").replace("Shared technical focus in ", "")

        # ---------------------------------------------------------------------
        # Subject Generation (Email & LinkedIn title)
        # ---------------------------------------------------------------------
        if has_alumni and alumni_item:
            uni_name = alumni_item.get("claim", "").split("Fellow alumni of ")[-1].split("(")[0].strip()
            subject = f"{uni_name} Alum — {job_title} at {company_name}"
        elif rel_upper in {"RECRUITER", "HIRING_TEAM"}:
            subject = f"{job_title} Opportunity at {company_name} — {candidate_name}"
        elif rel_upper in {"ENGINEERING_MANAGER", "TECH_LEAD"}:
            subject = f"{job_title} inquiry — {company_name} engineering"
        else:
            subject = f"Software Engineering at {company_name} — {job_title}"

        # ---------------------------------------------------------------------
        # Body Generation by Relationship Type & Channel
        # ---------------------------------------------------------------------
        body_lines: List[str] = []

        # 1. Polite, conversational opening
        if has_alumni and alumni_item:
            uni_name = alumni_item.get("claim", "").split("Fellow alumni of ")[-1].split("(")[0].strip()
            body_lines.append(f"Hi {first_name},")
            body_lines.append(
                f"I hope you're having a great week! I saw you're also a {uni_name} alum and currently working as {contact_title} at {company_name}."
            )
        elif rel_upper in {"RECRUITER", "HIRING_TEAM"}:
            body_lines.append(f"Hi {first_name},")
            body_lines.append(
                f"I hope you're doing well. I came across your profile while exploring the {job_title} opening at {company_name}."
            )
        elif rel_upper in {"ENGINEERING_MANAGER", "TECH_LEAD"}:
            body_lines.append(f"Hi {first_name},")
            body_lines.append(
                f"I came across your profile while researching the engineering team at {company_name}. I noticed your leadership as {contact_title}."
            )
        else:
            # Engineer / Senior Engineer / Employee
            body_lines.append(f"Hi {first_name},")
            body_lines.append(
                f"I came across your profile while researching engineering work at {company_name}."
            )

        # 2. Context & Technical Alignment
        if not is_short:
            if tech_phrase and project_name:
                tech_snippet = f" working with {', '.join(project_techs[:3])}" if project_techs else ""
                body_lines.append(
                    f"I'm an engineer specializing in {tech_phrase}. Recently, I built {project_name}{tech_snippet}, focusing on performance and distributed reliability."
                )
            elif tech_phrase:
                body_lines.append(
                    f"My background centers on {tech_phrase}, and I've been following how {company_name} approaches distributed infrastructure."
                )
            elif project_name:
                body_lines.append(
                    f"I recently developed {project_name}, which aligns closely with the technical challenges outlined in the {job_title} role."
                )
            else:
                body_lines.append(
                    f"My engineering background aligns closely with the core requirements of the {job_title} opening."
                )
        else:
            if tech_phrase:
                body_lines.append(
                    f"I specialize in {tech_phrase} and recently saw the {job_title} opening at {company_name}."
                )
            else:
                body_lines.append(
                    f"I'm interested in the {job_title} role on your team at {company_name}."
                )

        # 3. Purpose & Call to Action (Respectful, Non-Demanding)
        if rel_upper in {"RECRUITER", "HIRING_TEAM"}:
            body_lines.append(
                f"I'd love to learn if my background might be a fit for what you're seeking for the {job_title} position. If convenient, I'd welcome the opportunity to share my resume for consideration."
            )
        elif has_alumni:
            body_lines.append(
                f"I'm currently preparing an application for the {job_title} position. If you have a few minutes for a brief piece of guidance on the team or referral process, I'd genuinely appreciate your perspective."
            )
        elif rel_upper in {"ENGINEERING_MANAGER", "TECH_LEAD"}:
            body_lines.append(
                f"If you have a quick moment, I'd greatly appreciate any insight into what your team prioritizes for this role, or whether my profile would be worth connecting on for a referral."
            )
        else:
            body_lines.append(
                f"If you're open to it, I'd love to hear a bit about your experience on the team, or ask if you'd be comfortable offering guidance on the referral process."
            )

        # 4. Sign-off
        body_lines.append("Thanks for your time and consideration,")
        body_lines.append(candidate_name)

        full_body = "\n\n".join(body_lines)
        return {
            "subject": subject if chan_upper == "EMAIL" else None,
            "body": full_body,
        }
