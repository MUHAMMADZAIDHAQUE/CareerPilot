"""
CareerPilot Phase 19: Outreach Risk & Fabrication Detector.
Detects hard blocking violations, sensitive data leaks, fabricated claims,
and spam/manipulative phrasing in generated or human-edited outreach drafts.
"""
import re
from typing import Dict, Any, List, Set


class RiskDetector:
    """
    Evaluates outreach drafts against strict ethical, privacy, and truthfulness guardrails.
    Returns risk level and specific actionable flags.
    """

    # Prohibited spam, manipulative, or demanding language
    SPAM_PATTERNS = [
        r"dear\s+sir[\s/]+madam",
        r"respected\s+sir",
        r"i\s+hope\s+this\s+message\s+finds\s+you\s+in\s+the\s+best\s+of\s+health",
        r"you\s+are\s+my\s+only\s+hope",
        r"urgently\s+need\s+(a\s+)?referral",
        r"desperately\s+need",
        r"please\s+refer\s+me\s+immediately",
        r"fast-?track\s+my\s+(interview|application)",
        r"guarantee\s+me",
        r"owe\s+me",
        r"entitled\s+to",
    ]

    # Fabricated relationship or mutual connection patterns
    FABRICATED_RELATIONSHIP_PATTERNS = [
        r"referred\s+(to\s+you\s+)?by\s+[A-Z][a-z]+",
        r"was\s+referred\s+by\s+[A-Z][a-z]+",
        r"mutual\s+friend(\s+[A-Z][a-z]+)?",
        r"we\s+met\s+at\s+",
        r"we\s+worked\s+together\s+at\s+",
        r"roommate",
        r"close\s+personal\s+friend",
        r"best\s+friend",
    ]

    # Sensitive personal information patterns (phone numbers, addresses)
    PHONE_PATTERNS = [
        r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}",
        r"\b\d{10}\b",
    ]

    ADDRESS_PATTERNS = [
        r"\b\d{1,5}\s+[A-Za-z0-9.\s]+(?:Avenue|Ave|Street|St|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Way)\b",
        r"home\s+address",
        r"residential\s+address",
    ]

    # Automated action / bypass patterns
    AUTOMATION_BYPASS_PATTERNS = [
        r"automatically\s+send\s+this",
        r"auto-?send",
        r"bypass\s+(linkedin|platform|access)\s+rules",
        r"bot\s+action",
    ]

    @classmethod
    def evaluate(
        cls,
        subject: str,
        body: str,
        candidate_facts: Dict[str, Any],
        contact_facts: Dict[str, Any],
        verified_evidence: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Scans message content for risk flags, policy violations, and ungrounded claims.
        """
        combined_text = f"{subject or ''} {body}".strip()
        risk_flags: List[str] = []
        unsupported_claims: List[str] = []
        verified_claims: List[str] = []
        is_blocked = False

        # 1. Check Spam / Manipulative Phrasing
        for pattern in cls.SPAM_PATTERNS:
            if re.search(pattern, combined_text, re.IGNORECASE):
                matched = re.search(pattern, combined_text, re.IGNORECASE).group(0)
                risk_flags.append(f"SPAM_OR_MANIPULATIVE_LANGUAGE: '{matched}'")
                is_blocked = True

        # 2. Check Fabricated Mutual Connection / Relationship
        for pattern in cls.FABRICATED_RELATIONSHIP_PATTERNS:
            if re.search(pattern, combined_text, re.IGNORECASE):
                # Check if any verified evidence specifically allows this relationship
                matched = re.search(pattern, combined_text, re.IGNORECASE).group(0)
                has_verified_rel = any(
                    e.get("type") in {"REFERRAL_INTRO", "MUTUAL_CONNECTION"}
                    and matched.lower() in e.get("claim", "").lower()
                    for e in verified_evidence
                )
                if not has_verified_rel:
                    risk_flags.append(f"FABRICATED_RELATIONSHIP: Claim '{matched}' has no verified evidence")
                    unsupported_claims.append(f"Unverified relationship claim: '{matched}'")
                    is_blocked = True

        # 3. Check Sensitive / Private Information
        for pattern in cls.PHONE_PATTERNS:
            if re.search(pattern, combined_text):
                risk_flags.append("PRIVATE_DATA_LEAK: Phone number pattern detected in message")
                is_blocked = True
                break

        if re.search(r"send\s+me\s+your\s+(personal\s+)?phone\s+number", combined_text, re.IGNORECASE):
            risk_flags.append("SOLICITING_PRIVATE_DATA: Requesting personal phone number is prohibited")
            is_blocked = True

        for pattern in cls.ADDRESS_PATTERNS:
            if re.search(pattern, combined_text, re.IGNORECASE):
                risk_flags.append("PRIVATE_DATA_LEAK: Physical residential address pattern detected")
                is_blocked = True
                break

        # 4. Check Automation / Rule Bypass
        for pattern in cls.AUTOMATION_BYPASS_PATTERNS:
            if re.search(pattern, combined_text, re.IGNORECASE):
                risk_flags.append("PROHIBITED_AUTOMATION_INSTRUCTION: Instructions to automatically send or bypass rules")
                is_blocked = True

        # 5. Check Alumni Claims Grounding
        alumni_evidence = next((e for e in verified_evidence if e.get("type") == "ALUMNI"), None)
        alumni_mentions = re.findall(r"(?:also\s+)?(?:graduated\s+from|alum(?:nus|na|ni)?\s+(?:of|at)?)\s+([A-Za-z\s]+)", combined_text, re.IGNORECASE)
        for mention in alumni_mentions:
            clean_mention = mention.strip().rstrip(".,")
            if not alumni_evidence or clean_mention.lower() not in alumni_evidence.get("claim", "").lower():
                risk_flags.append(f"FABRICATED_ALUMNI_CLAIM: Unverified university affiliation '{clean_mention}'")
                unsupported_claims.append(f"Unverified university claim: '{clean_mention}'")
                is_blocked = True

        # 6. Check Candidate Degree & University Grounding
        candidate_edus = [
            (e.get("institution") or "").lower() for e in candidate_facts.get("education", [])
        ]
        claimed_universities = re.findall(r"(?:my\s+degree\s+from|graduated\s+from)\s+([A-Za-z\s]+)", combined_text, re.IGNORECASE)
        for cu in claimed_universities:
            cu_clean = cu.strip().lower()
            if not any(cu_clean in edu or edu in cu_clean for edu in candidate_edus):
                risk_flags.append(f"FABRICATED_CANDIDATE_EDUCATION: '{cu}' not in candidate verified record")
                unsupported_claims.append(f"Unverified candidate education: '{cu}'")
                is_blocked = True

        # 7. Check Verified Evidence Grounding
        for ev in verified_evidence:
            ev_claim = ev.get("claim", "")
            verified_claims.append(ev_claim)

        # Determine overall risk level
        if is_blocked:
            risk_level = "BLOCKED"
        elif len(risk_flags) > 0 or len(unsupported_claims) > 0:
            risk_level = "HIGH"
        else:
            risk_level = "LOW"

        return {
            "passed": not is_blocked and len(unsupported_claims) == 0,
            "risk_level": risk_level,
            "risk_flags": risk_flags,
            "unsupported_claims": unsupported_claims,
            "verified_claims": verified_claims,
            "is_blocked": is_blocked,
        }
