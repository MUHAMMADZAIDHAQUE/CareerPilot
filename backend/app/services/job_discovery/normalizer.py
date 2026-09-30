import re
from typing import Tuple, Optional, List, Dict, Any


# Standard tech title mapping table
NORMALIZED_ROLE_MAPPINGS: Dict[str, str] = {
    "software developer": "Software Engineer",
    "software development engineer": "Software Engineer",
    "sde": "Software Engineer",
    "sde 1": "Software Engineer",
    "sde-1": "Software Engineer",
    "sde i": "Software Engineer",
    "graduate software engineer": "Software Engineer",
    "junior software developer": "Software Engineer",
    "junior software engineer": "Software Engineer",
    "entry level software engineer": "Software Engineer",
    "associate software engineer": "Software Engineer",
    "full stack developer": "Full-Stack Engineer",
    "full stack engineer": "Full-Stack Engineer",
    "fullstack developer": "Full-Stack Engineer",
    "fullstack engineer": "Full-Stack Engineer",
    "frontend developer": "Frontend Engineer",
    "frontend engineer": "Frontend Engineer",
    "front end developer": "Frontend Engineer",
    "front-end developer": "Frontend Engineer",
    "ui developer": "Frontend Engineer",
    "backend developer": "Backend Engineer",
    "backend engineer": "Backend Engineer",
    "back end developer": "Backend Engineer",
    "back-end developer": "Backend Engineer",
    "data analyst": "Data Analyst",
    "junior data analyst": "Data Analyst",
    "graduate data analyst": "Data Analyst",
    "data engineer": "Data Engineer",
    "junior data engineer": "Data Engineer",
    "data scientist": "Data Scientist",
    "machine learning engineer": "Machine Learning Engineer",
    "ml engineer": "Machine Learning Engineer",
    "ai engineer": "Machine Learning Engineer",
    "devops engineer": "DevOps Engineer",
    "cloud engineer": "Cloud Engineer",
    "infrastructure engineer": "Infrastructure Engineer",
    "systems engineer": "Systems Engineer",
    "site reliability engineer": "Site Reliability Engineer",
    "sre": "Site Reliability Engineer",
    "qa engineer": "QA Engineer",
    "quality assurance engineer": "QA Engineer",
    "sdet": "QA Engineer",
    "software test engineer": "QA Engineer",
    "product manager": "Product Manager",
    "associate product manager": "Product Manager",
    "apm": "Product Manager",
}

# Legal suffixes to strip for normalized matching
LEGAL_SUFFIXES = [
    r",?\s+(?:inc\.?|incorporated)$",
    r",?\s+(?:llc\.?|l\.l\.c\.?)$",
    r",?\s+(?:ltd\.?|limited)$",
    r",?\s+(?:pvt\.?\s+ltd\.?|private\s+limited)$",
    r",?\s+(?:corp\.?|corporation)$",
    r",?\s+(?:co\.?|company)$",
    r",?\s+(?:gmbh)$",
]


def normalize_job_title(raw_title: str) -> Tuple[str, str]:
    """
    Normalizes a job title while preserving the original.
    Example:
    'Graduate Software Engineer - Fullstack' -> ('Graduate Software Engineer - Fullstack', 'Software Engineer')
    'Software Engineer - Entry Level' -> ('Software Engineer - Entry Level', 'Software Engineer')
    """
    if not raw_title or not raw_title.strip():
        return "Unknown Role", "Software Engineer"

    original_title = raw_title.strip()
    clean = original_title

    # Remove remote/contract/location parentheticals or dash trailers
    clean = re.sub(r"\s*[\(\[\{].*?[\)\]\}]", "", clean)  # remove (Remote), [Fresher], etc.
    clean = re.sub(r"\s*[-–—|/]\s*(?:remote|full[\s-]?time|entry[\s-]?level|fresher|india|usa|bangalore|hybrid|batch\s+of\s+\d{4}).*$", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\s*[-–—|]\s*$", "", clean).strip()

    clean_lower = clean.lower()

    # Direct dictionary lookup
    if clean_lower in NORMALIZED_ROLE_MAPPINGS:
        return original_title, NORMALIZED_ROLE_MAPPINGS[clean_lower]

    # Strip prefixes like Junior, Senior, Graduate, Lead, etc. for root matching
    stripped = re.sub(
        r"^(?:junior|jr\.?|senior|sr\.?|lead|staff|principal|associate|graduate|entry[\s-]?level|trainee|intern)\s+",
        "",
        clean_lower,
        flags=re.IGNORECASE,
    ).strip()

    if stripped in NORMALIZED_ROLE_MAPPINGS:
        return original_title, NORMALIZED_ROLE_MAPPINGS[stripped]

    # Keyword heuristics
    if "software" in clean_lower and ("engineer" in clean_lower or "developer" in clean_lower):
        return original_title, "Software Engineer"
    if "data" in clean_lower and "analyst" in clean_lower:
        return original_title, "Data Analyst"
    if "data" in clean_lower and "engineer" in clean_lower:
        return original_title, "Data Engineer"
    if "data" in clean_lower and "scientist" in clean_lower:
        return original_title, "Data Scientist"
    if "frontend" in clean_lower or "front-end" in clean_lower:
        return original_title, "Frontend Engineer"
    if "backend" in clean_lower or "back-end" in clean_lower:
        return original_title, "Backend Engineer"
    if "fullstack" in clean_lower or "full-stack" in clean_lower or "full stack" in clean_lower:
        return original_title, "Full-Stack Engineer"
    if "machine learning" in clean_lower or "ml" in clean_lower.split() or "ai" in clean_lower.split():
        return original_title, "Machine Learning Engineer"
    if "devops" in clean_lower or "sre" in clean_lower.split():
        return original_title, "DevOps Engineer"
    if "qa" in clean_lower.split() or "quality assurance" in clean_lower or "testing" in clean_lower:
        return original_title, "QA Engineer"
    if "product manager" in clean_lower:
        return original_title, "Product Manager"

    # Fallback to Title-Cased clean string
    normalized = " ".join(word.capitalize() for word in clean.split() if word)
    return original_title, normalized or "Software Engineer"


def classify_fresher_and_experience(
    title: str,
    description: str,
    experience_req: Optional[str] = None,
) -> Tuple[bool, str, str]:
    """
    Evaluates whether a job posting is eligible for freshers / entry-level candidates (0-3 years),
    and determines experience level ('Entry-Level' | 'Mid-Level' | 'Senior' | 'Executive').

    CRITICAL RULE (Prompt Section 7 & 19):
    A job requiring 5+ years of experience MUST NOT be classified as fresher-eligible
    simply because the title says 'Software Engineer'.
    """
    text_corpus = f"{title}\n{experience_req or ''}\n{description}".lower()

    # 1. Check for explicit numerical years of experience
    # Pattern A: "5+ years", "4+ yrs", "5 years of experience", "minimum 5 years"
    min_years: Optional[float] = None
    max_years: Optional[float] = None

    range_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:[-–to]+|\s+to\s+)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)", text_corpus)
    if range_match:
        min_years = float(range_match.group(1))
        max_years = float(range_match.group(2))
    else:
        single_match = re.search(r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)(?:\s+(?:of\s+)?experience)?", text_corpus)
        if single_match:
            min_years = float(single_match.group(1))

    # Senior / Lead in title or experience >= 5 years
    title_lower = title.lower()
    is_senior_title = any(
        s in title_lower
        for s in ["senior", "sr.", "lead", "staff", "principal", "architect", "head of", "director", "vp"]
    )

    if min_years is not None and min_years >= 4.0:
        return (
            False,
            f"Requires {int(min_years)}+ years of professional experience (ineligible for freshers).",
            "Senior" if min_years >= 5.0 else "Mid-Level",
        )

    if is_senior_title and (min_years is None or min_years >= 3.0):
        return (
            False,
            f"Senior/Lead role based on job title '{title}'.",
            "Senior",
        )

    # 2. Check for explicit Fresher / Entry-Level signals
    fresher_signals = [
        "fresher",
        "freshers",
        "fresh graduate",
        "entry level",
        "entry-level",
        "junior",
        "associate",
        "trainee",
        "intern",
        "internship",
        "new grad",
        "new graduate",
        "college graduate",
        "campus recruitment",
        "off campus",
        "off-campus",
        "batch of 2024",
        "batch of 2025",
        "batch of 2026",
        "0-1 year",
        "0-2 year",
        "0-3 year",
        "0 to 1 year",
        "0 to 2 year",
        "0 to 3 year",
        "0+ year",
        "no experience required",
    ]

    for signal in fresher_signals:
        if signal in text_corpus:
            return (
                True,
                f"Matches fresher criteria: explicitly mentions '{signal}'.",
                "Entry-Level",
            )

    # 3. Check numerical range explicitly indicating 0 to 3 years
    if min_years is not None and min_years <= 2.0:
        return (
            True,
            f"Accepts candidates with {min_years}–{max_years or min_years} years of experience.",
            "Entry-Level",
        )

    # 4. If 3 to 4 years
    if min_years is not None and min_years == 3.0:
        return (
            False,
            "Requires 3+ years of experience (borderline mid-level).",
            "Mid-Level",
        )

    # 5. Default heuristic: Check general title
    if any(k in title_lower for k in ["engineer", "developer", "analyst"]) and not is_senior_title:
        # Standard professional role without explicit fresher mention
        return (
            False,
            "Standard role; does not explicitly mention fresher or entry-level eligibility.",
            "Mid-Level",
        )

    return (
        False,
        "Experience requirements not explicitly entry-level.",
        "Mid-Level",
    )


def normalize_location(location: Optional[str], description: str = "") -> Tuple[str, str]:
    """
    Normalizes location text and extracts remote status ('Remote' | 'Hybrid' | 'On-site' | 'Unknown').
    """
    if not location or not location.strip():
        # Check description
        desc_lower = description.lower()
        if "remote" in desc_lower and "not remote" not in desc_lower:
            return "Remote", "Remote"
        return "Unknown", "Unknown"

    loc_clean = location.strip()
    loc_lower = loc_clean.lower()

    if "remote" in loc_lower and "hybrid" not in loc_lower:
        return loc_clean, "Remote"
    if "hybrid" in loc_lower:
        return loc_clean, "Hybrid"
    if "on-site" in loc_lower or "onsite" in loc_lower or "in-office" in loc_lower:
        return loc_clean, "On-site"

    # Check description for clarification
    desc_lower = description.lower()[:500]
    if "remote" in desc_lower and "hybrid" not in desc_lower:
        return loc_clean, "Remote"
    if "hybrid" in desc_lower:
        return loc_clean, "Hybrid"

    return loc_clean, "On-site"


def normalize_employment_type(emp_type: Optional[str], description: str = "") -> str:
    """
    Normalizes employment type into canonical:
    'Full-time' | 'Part-time' | 'Contract' | 'Internship' | 'Unknown'
    """
    text = f"{emp_type or ''} {description[:300]}".lower()
    if "intern" in text:
        return "Internship"
    if "contract" in text or "freelance" in text or "temporary" in text:
        return "Contract"
    if "part-time" in text or "part time" in text:
        return "Part-time"
    if "full-time" in text or "full time" in text or "permanent" in text:
        return "Full-time"
    return "Full-time"  # Sensible industry default for tech postings


def normalize_company_name(company: str) -> str:
    """
    Cleans company name, stripping legal suffixes for deduplication matching.
    """
    if not company:
        return "Unknown Company"
    name = company.strip()
    for pattern in LEGAL_SUFFIXES:
        name = re.sub(pattern, "", name, flags=re.IGNORECASE)
    return name.strip()


def extract_truthful_salary(salary: Optional[str], description: str = "") -> Optional[str]:
    """
    Extracts salary strictly truthfully. Never invents missing salary.
    """
    if salary and salary.strip() and salary.strip().lower() not in ("none", "n/a", "not disclosed", "competitive"):
        return salary.strip()

    # Search verbatim salary mentions in JD
    match = re.search(r"(\$\s*\d{2,3}(?:,\d{3})*(?:\s*-\s*\$?\s*\d{2,3}(?:,\d{3})*)?\s*(?:usd|per\s+year|/yr|annual|k)?)", description, re.IGNORECASE)
    if match and len(match.group(1)) > 4:
        return match.group(1).strip()

    inr_match = re.search(r"(₹\s*\d+(?:\.\d+)?\s*(?:lpa|lakhs?|cr)?(?:\s*-\s*₹?\s*\d+(?:\.\d+)?\s*(?:lpa|lakhs?)?)?)", description, re.IGNORECASE)
    if inr_match and len(inr_match.group(1)) > 3:
        return inr_match.group(1).strip()

    return None


def extract_truthful_deadline(deadline: Optional[str], description: str = "") -> Optional[str]:
    """
    Extracts application deadline strictly truthfully. Never invents missing deadlines.
    """
    if deadline and deadline.strip() and deadline.strip().lower() not in ("none", "n/a"):
        return deadline.strip()

    # Look for verbatim deadline dates e.g. "Deadline: 2026-10-31" or "Apply before October 15, 2026"
    match = re.search(r"(?:deadline|apply before|closing date|last date)[:\s]+([a-zA-Z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})", description, re.IGNORECASE)
    if match:
        return match.group(1).strip()

    return None


# -----------------------------------------------------------------------------
# Phase 23: India-First Intelligence & Deduplication Hashing
# -----------------------------------------------------------------------------

INDIAN_CITIES_TIER1 = {
    "bengaluru", "bangalore", "hyderabad", "pune", "mumbai", "delhi", "new delhi",
    "noida", "gurugram", "gurgaon", "chennai", "kolkata"
}

INDIAN_CITIES_TIER2_3 = {
    "ahmedabad", "jaipur", "indore", "coimbatore", "bhubaneswar", "chandigarh",
    "lucknow", "patna", "durgapur", "kochi", "cochin", "thiruvananthapuram",
    "trivandrum", "visakhapatnam", "vizag", "nagpur", "surat", "vadodara",
    "bhopal", "ludhiana", "agra", "nashik", "mysuru", "mysore", "mohali",
    "greater noida", "ghaziabad", "faridabad", "mangaluru", "mangalore",
    "dehradun", "ranchi", "raipur", "guwahati", "gwalior", "vijayawada",
    "jodhpur", "amritsar", "varanasi", "madurai", "hubli", "dharwad", "tiruchirappalli"
}

INDIAN_STATES = {
    "karnataka", "telangana", "maharashtra", "tamil nadu", "delhi ncr", "delhi",
    "uttar pradesh", "west bengal", "gujarat", "rajasthan", "kerala", "andhra pradesh",
    "odisha", "bihar", "punjab", "haryana", "madhya pradesh", "assam", "goa",
    "uttarakhand", "jharkhand", "chhattisgarh", "himachal pradesh"
}

NON_INDIA_LOCATIONS = {
    "united states", "usa", "us", "u.s.", "u.s.a.", "united kingdom", "uk", "u.k.",
    "london", "san francisco", "new york", "seattle", "austin", "berlin", "germany",
    "canada", "toronto", "vancouver", "australia", "sydney", "melbourne", "singapore",
    "tokyo", "japan", "dublin", "ireland", "amsterdam", "netherlands", "paris",
    "france", "zurich", "switzerland", "poland", "warsaw", "israel", "tel aviv"
}


def classify_india_relevance(
    location: Optional[str],
    description: str = "",
    company: str = "",
) -> Dict[str, Any]:
    """
    Deterministic India-relevance classification engine (Phase 23 Part D).
    Returns classification, score, location type, and India work arrangement.
    Classifications: 'INDIA' | 'REMOTE_INDIA' | 'INDIA_POSSIBLE' | 'NON_INDIA' | 'UNKNOWN'
    """
    loc_clean = (location or "").strip()
    loc_lower = loc_clean.lower()
    desc_sample = description[:800].lower()
    combined_text = f"{loc_lower} {desc_sample}"

    # 1. Check for explicit Remote India phrases
    remote_india_patterns = [
        "remote - india", "remote (india)", "remote, india", "remote india",
        "work from india", "pan-india", "pan india", "anywhere in india",
        "india remote", "remote in india", "india-wide"
    ]
    for pattern in remote_india_patterns:
        if pattern in combined_text:
            return {
                "india_relevance": "REMOTE_INDIA",
                "india_relevance_score": 1.0,
                "india_location_type": "REMOTE",
                "india_location": "Remote — India",
                "remote_india": True,
                "country": "India",
            }

    # 2. Check for Indian Tier 1 Metro Cities
    matched_tier1 = [c for c in INDIAN_CITIES_TIER1 if c in loc_lower or c in desc_sample]
    if matched_tier1:
        city_name = matched_tier1[0].title()
        return {
            "india_relevance": "INDIA",
            "india_relevance_score": 1.0,
            "india_location_type": "METRO_TIER1",
            "india_location": loc_clean or city_name,
            "remote_india": "remote" in loc_lower,
            "country": "India",
        }

    # 3. Check for Indian Tier 2/3 Cities
    matched_tier2 = [c for c in INDIAN_CITIES_TIER2_3 if c in loc_lower or c in desc_sample]
    if matched_tier2:
        city_name = matched_tier2[0].title()
        return {
            "india_relevance": "INDIA",
            "india_relevance_score": 0.95,
            "india_location_type": "TIER2",
            "india_location": loc_clean or city_name,
            "remote_india": "remote" in loc_lower,
            "country": "India",
        }

    # 4. Check for Indian States / "India" explicit mention
    matched_state = [s for s in INDIAN_STATES if s in loc_lower or s in desc_sample]
    if matched_state or "india" in loc_lower or ", in" in loc_lower or "in-office in india" in desc_sample:
        state_name = matched_state[0].title() if matched_state else "India"
        return {
            "india_relevance": "INDIA",
            "india_relevance_score": 0.90,
            "india_location_type": "STATE" if matched_state else "COUNTRY_LEVEL",
            "india_location": loc_clean or state_name,
            "remote_india": "remote" in loc_lower,
            "country": "India",
        }

    # 5. Check INR currency or LPA salary signals
    if any(k in description.lower() for k in ["₹", "inr", "lpa", "lakhs", "per month inr"]):
        return {
            "india_relevance": "INDIA_POSSIBLE",
            "india_relevance_score": 0.75,
            "india_location_type": "COUNTRY_LEVEL",
            "india_location": loc_clean or "India (Compensation in INR)",
            "remote_india": "remote" in loc_lower,
            "country": "India",
        }

    # 6. Check for confirmed Non-India locations
    matched_non_india = [c for c in NON_INDIA_LOCATIONS if c in loc_lower]
    if matched_non_india:
        return {
            "india_relevance": "NON_INDIA",
            "india_relevance_score": 0.0,
            "india_location_type": "NON_INDIA",
            "india_location": loc_clean,
            "remote_india": False,
            "country": matched_non_india[0].title(),
        }

    # 7. Unspecified or Global Remote
    if "remote" in loc_lower:
        return {
            "india_relevance": "INDIA_POSSIBLE",
            "india_relevance_score": 0.50,
            "india_location_type": "REMOTE",
            "india_location": loc_clean or "Global Remote",
            "remote_india": False,
            "country": "Unknown",
        }

    return {
        "india_relevance": "UNKNOWN",
        "india_relevance_score": 0.20,
        "india_location_type": "UNKNOWN",
        "india_location": loc_clean or "Unspecified",
        "remote_india": False,
        "country": "Unknown",
    }


def classify_fresher_detailed(
    title: str,
    description: str,
    experience_req: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Granular fresher & entry-level evaluation (Phase 23 Part E).
    Extracts min/max numerical years, assigns category, and computes entry_level_score.
    """
    is_fresher, reason, exp_level = classify_fresher_and_experience(title, description, experience_req)
    text = f"{title}\n{experience_req or ''}\n{description}".lower()

    # Extract numerical years
    min_years: Optional[float] = None
    max_years: Optional[float] = None

    range_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:[-–to]+|\s+to\s+)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)", text)
    if range_match:
        min_years = float(range_match.group(1))
        max_years = float(range_match.group(2))
    else:
        single_match = re.search(r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)(?:\s+(?:of\s+)?experience)?", text)
        if single_match:
            min_years = float(single_match.group(1))

    # Determine category
    if min_years is not None:
        if min_years <= 1.0:
            category = "FRESHER"
        elif min_years <= 3.0:
            category = "1_TO_3"
        elif min_years <= 5.0:
            category = "3_TO_5"
        else:
            category = "SENIOR_5_PLUS"
    else:
        if is_fresher:
            category = "FRESHER"
        elif exp_level == "Senior":
            category = "SENIOR_5_PLUS"
        else:
            category = "1_TO_3"

    # Compute entry_level_score (0.0 to 1.0)
    if category == "FRESHER":
        score = 1.0
    elif category == "1_TO_3":
        score = 0.65
    elif category == "3_TO_5":
        score = 0.25
    else:
        score = 0.0

    return {
        "is_fresher_eligible": is_fresher,
        "fresher_eligibility_reason": reason,
        "experience_level": exp_level,
        "experience_min": min_years,
        "experience_max": max_years,
        "experience_category": category,
        "entry_level_score": score,
    }


def generate_job_hashes(
    canonical_url: Optional[str],
    source: str,
    source_job_id: Optional[str],
    company: str,
    normalized_title: str,
    normalized_location: str,
    description: str,
) -> Dict[str, str]:
    """
    Multi-level deduplication hashes (Phase 23 Part G).
    Level 1: Canonical URL
    Level 2: Source + source_job_id
    Level 3: Company + normalized title + normalized location
    Level 4: Content hash
    """
    import hashlib

    norm_comp = normalize_company_name(company).lower()
    norm_title = normalized_title.lower()
    norm_loc = (normalized_location or "remote").lower()

    # Clean description snippet for content similarity
    clean_desc = re.sub(r"\s+", " ", description.strip().lower())[:600]
    content_hash = hashlib.sha256(clean_desc.encode("utf-8")).hexdigest()

    # Level 1
    url_hash = hashlib.sha256((canonical_url or "").lower().encode("utf-8")).hexdigest() if canonical_url else ""

    # Level 2
    source_ext_hash = hashlib.sha256(f"{source.lower()}:{source_job_id or ''}".encode("utf-8")).hexdigest()

    # Level 3
    level3_key = f"{norm_comp}::{norm_title}::{norm_loc}"
    level3_hash = hashlib.sha256(level3_key.encode("utf-8")).hexdigest()

    # Composite dedup_hash prioritizes level 3 (company + role + location) or level 1
    primary_dedup = level3_hash

    return {
        "canonical_url_hash": url_hash,
        "source_external_hash": source_ext_hash,
        "company_title_location_hash": level3_hash,
        "content_hash": content_hash,
        "dedup_hash": primary_dedup,
    }

