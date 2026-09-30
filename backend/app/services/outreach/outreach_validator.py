"""
CareerPilot Phase 19: Outreach Validator Agent.
Implements the 12-point truth, safety, and hallucination validation engine
with self-healing safe repair mechanisms.
"""
import re
from typing import Dict, Any, List, Optional
from backend.app.services.outreach.risk_detector import RiskDetector
from backend.app.core.logging import logger


class OutreachValidatorAgent:
    """
    Validates outreach drafts for candidate grounding, contact veracity,
    absence of sensitive personal data, and compliance with anti-spam policies.
    Provides up to 3 automatic safe repair cycles before flagging as BLOCKED.
    """

    MAX_REPAIR_ATTEMPTS = 3

    @classmethod
    def validate_and_repair(
        cls,
        subject: Optional[str],
        body: str,
        candidate_facts: Dict[str, Any],
        job_facts: Dict[str, Any],
        contact_facts: Dict[str, Any],
        verified_evidence: List[Dict[str, Any]],
        channel: str = "LINKEDIN",
    ) -> Dict[str, Any]:
        """
        Executes multi-dimensional validation with up to 3 safe repair attempts.
        """
        current_subject = subject or ""
        current_body = body
        repair_attempts = 0
        suggested_repairs: List[Dict[str, str]] = []
        company_name = (
            contact_facts.get("company_name")
            or contact_facts.get("company")
            or job_facts.get("company_name")
            or job_facts.get("company")
            or "the team"
        )
        job_title = job_facts.get("role") or job_facts.get("title") or "the role"

        while repair_attempts <= cls.MAX_REPAIR_ATTEMPTS:
            eval_res = RiskDetector.evaluate(
                subject=current_subject,
                body=current_body,
                candidate_facts=candidate_facts,
                contact_facts=contact_facts,
                verified_evidence=verified_evidence,
            )

            # If clean or cannot be safely repaired, stop loop
            if eval_res["passed"] or not eval_res["unsupported_claims"]:
                break

            # Attempt safe repair if repairable unsupported claims exist and within limit
            if repair_attempts < cls.MAX_REPAIR_ATTEMPTS:
                repair_attempts += 1
                repaired = False

                for claim in eval_res["unsupported_claims"]:
                    # E.g. "Unverified university claim: '...'" -> Replace with neutral company mention
                    if "Unverified university" in claim or "FABRICATED_ALUMNI" in str(eval_res["risk_flags"]):
                        # Replace ungrounded alumni sentences with neutral introduction
                        pattern = r"I saw you're also a [^\n.]+ alum and currently working"
                        replacement = f"I came across your profile while researching engineering work"
                        if re.search(pattern, current_body, re.IGNORECASE):
                            current_body = re.sub(pattern, replacement, current_body, flags=re.IGNORECASE)
                            suggested_repairs.append({
                                "original": "Unverified alumni claim",
                                "replacement": replacement,
                                "reason": "Replaced unverified university relationship with neutral profile inquiry",
                            })
                            repaired = True

                        # Also replace any "graduated from" mentions
                        pattern2 = r"I noticed you (also )?graduated from [^\n.,]+"
                        replacement2 = f"I came across your profile while learning more about the engineering team at {company_name}"
                        if re.search(pattern2, current_body, re.IGNORECASE):
                            current_body = re.sub(pattern2, replacement2, current_body, flags=re.IGNORECASE)
                            suggested_repairs.append({
                                "original": "Unverified graduation mention",
                                "replacement": replacement2,
                                "reason": "Replaced ungrounded graduation reference with grounded team inquiry",
                            })
                            repaired = True

                if not repaired:
                    # No automatic repair pattern matched
                    break
            else:
                break

        # Final evaluation check
        final_eval = RiskDetector.evaluate(
            subject=current_subject,
            body=current_body,
            candidate_facts=candidate_facts,
            contact_facts=contact_facts,
            verified_evidence=verified_evidence,
        )

        return {
            "passed": final_eval["passed"],
            "risk_level": final_eval["risk_level"],
            "risk_flags": final_eval["risk_flags"],
            "unsupported_claims": final_eval["unsupported_claims"],
            "verified_claims": final_eval["verified_claims"],
            "suggested_repairs": suggested_repairs,
            "repaired_body": current_body if repair_attempts > 0 else body,
            "repaired_subject": current_subject if repair_attempts > 0 else subject,
            "repaired": repair_attempts > 0 and final_eval["passed"],
            "repair_attempts": repair_attempts,
        }
