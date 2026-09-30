"""
CareerPilot Job Safety and Scam Signal Detection Engine.

Analyzes job postings for potential quality risks, upfront fee demands,
unrealistic claims, and suspicious application instructions without
automatically blocking jobs, empowering users with transparent risk evidence.
"""

from typing import List, Dict, Any, Optional
import re


SUSPICIOUS_PAYMENT_PATTERNS = [
    (r"\b(registration|processing|onboarding|training|laptop|security|interview)\s*(fee|deposit|charge|amount)\b", "Upfront payment or deposit language detected"),
    (r"\b(pay|transfer|deposit|send)\s*(money|rupees|inr|\$|amount|advance)\b", "Request for monetary payment or advance detected"),
    (r"\bupi\s*(id|transfer|payment)\b", "Direct personal UPI payment reference detected"),
    (r"\bcrypto(currency)?\s*(payment|wallet|transfer)\b", "Cryptocurrency payment requirement detected"),
]

SUSPICIOUS_COMMUNICATION_PATTERNS = [
    (r"\b(whatsapp|telegram)\s*(chat|group|number|link|msg|message)\b", "Recruiter directing communication exclusively to private chat/messenger"),
    (r"\bbit\.ly|tinyurl\.com|t\.me\b", "Shortened/masked external link used for application"),
]

FINANCIAL_INFO_PATTERNS = [
    (r"\b(bank\s*account\s*number|credit\s*card|debit\s*card|net\s*banking|cvv|otp)\b", "Direct financial details or banking credential request"),
]

VAGUE_EMPLOYER_NAMES = {
    "confidential", "undisclosed", "unknown", "hiring company", "client company", "top client", "anonymous", ""
}

FREE_EMAIL_DOMAINS = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "rediffmail.com"}


class JobSafetyAnalysis:
    def __init__(
        self,
        risk_score: float,  # 0.0 to 100.0 (higher = riskier)
        risk_level: str,    # LOW, MEDIUM, HIGH
        signals: List[Dict[str, str]],
        recommendation: str,
    ):
        self.risk_score = risk_score
        self.risk_level = risk_level
        self.signals = signals
        self.recommendation = recommendation

    def to_dict(self) -> Dict[str, Any]:
        return {
            "risk_score": round(self.risk_score, 1),
            "risk_level": self.risk_level,
            "has_warnings": len(self.signals) > 0,
            "signals": self.signals,
            "recommendation": self.recommendation,
        }


def detect_scam_signals(
    role: str,
    company: str,
    description: str,
    application_url: Optional[str] = None,
    salary: Optional[str] = None,
) -> JobSafetyAnalysis:
    """
    Evaluates safety & quality signals on a job posting.
    Does NOT permanently declare fraud, but surfaces transparent warnings with evidence.
    """
    signals: List[Dict[str, str]] = []
    text_corpus = f"{role} {company} {description} {salary or ''}".lower()
    
    # 1. Upfront Payment Language
    for pattern, warning in SUSPICIOUS_PAYMENT_PATTERNS:
        match = re.search(pattern, text_corpus, re.IGNORECASE)
        if match:
            signals.append({
                "category": "UPFRONT_PAYMENT",
                "warning": warning,
                "evidence": match.group(0),
            })
            break

    # 2. Banking / Financial Info Demands
    for pattern, warning in FINANCIAL_INFO_PATTERNS:
        match = re.search(pattern, text_corpus, re.IGNORECASE)
        if match:
            signals.append({
                "category": "FINANCIAL_REQUEST",
                "warning": warning,
                "evidence": match.group(0),
            })
            break

    # 3. Private Messaging or Shortlink Redirects
    for pattern, warning in SUSPICIOUS_COMMUNICATION_PATTERNS:
        match = re.search(pattern, text_corpus, re.IGNORECASE)
        if match:
            signals.append({
                "category": "SUSPICIOUS_COMMUNICATION",
                "warning": warning,
                "evidence": match.group(0),
            })
            break

    # 4. Vague Employer Identity
    comp_clean = (company or "").strip().lower()
    if comp_clean in VAGUE_EMPLOYER_NAMES or len(comp_clean) < 2:
        signals.append({
            "category": "VAGUE_EMPLOYER",
            "warning": "Vague or missing company identity",
            "evidence": company or "Empty company field",
        })

    # 5. Free Email Domain for Corporate Hiring
    email_matches = re.findall(r"[\w\.-]+@([\w\.-]+)", text_corpus)
    for domain in email_matches:
        if domain.lower() in FREE_EMAIL_DOMAINS and comp_clean not in VAGUE_EMPLOYER_NAMES and len(comp_clean) > 3:
            signals.append({
                "category": "FREE_EMAIL_DOMAIN",
                "warning": f"Corporate recruitment conducted via free email domain (@{domain})",
                "evidence": domain,
            })
            break

    # 6. Unrealistic Fresher Compensation Claims
    if "fresher" in text_corpus or "0 years" in text_corpus or "entry" in text_corpus:
        # e.g., claiming 80 LPA or $200k for zero experience without specific technical proof
        unrealistic_match = re.search(r"\b([5-9]\d|\d{3})\s*(lpa|lakhs?)\b", text_corpus, re.IGNORECASE)
        if unrealistic_match:
            signals.append({
                "category": "UNREALISTIC_COMPENSATION",
                "warning": "Unusually high compensation claim for fresher/entry-level posting",
                "evidence": unrealistic_match.group(0),
            })

    # Calculate risk level
    if any(s["category"] in {"UPFRONT_PAYMENT", "FINANCIAL_REQUEST"} for s in signals):
        risk_score = 85.0
        risk_level = "HIGH"
        recommendation = "High risk detected: Legitimate employers never charge application fees or ask for bank details."
    elif len(signals) >= 2:
        risk_score = 60.0
        risk_level = "MEDIUM"
        recommendation = "Exercise caution: Verify company identity on official domain before sharing personal details."
    elif len(signals) == 1:
        risk_score = 35.0
        risk_level = "LOW"
        recommendation = "Minor signal detected: Verify standard official application channels."
    else:
        risk_score = 5.0
        risk_level = "SAFE"
        recommendation = "Standard job posting: No adverse safety signals detected."

    return JobSafetyAnalysis(
        risk_score=risk_score,
        risk_level=risk_level,
        signals=signals,
        recommendation=recommendation,
    )
