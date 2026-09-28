import re
import hashlib
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from typing import Optional, Set
from datetime import datetime


TRACKING_PARAMS: Set[str] = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "ref", "gh_src", "source", "trk", "fbclid", "gclid", "mc_cid", "mc_eid",
    "lever-origin", "lever-source", "si", "spm", "ref_id", "from", "tracking",
    "advertiser", "click_id", "campaign_id", "job_board", "job_source",
}

EXPIRED_PATTERNS = [
    r"\bthis (?:job|position|role|posting) (?:has been filled|is closed|is no longer available)\b",
    r"\bno longer accepting applications\b",
    r"\bapplications (?:are )?closed\b",
    r"\bthis job listing has expired\b",
    r"\bposting has ended\b",
]


def normalize_job_url(url: str) -> str:
    """
    Canonicalizes job posting URLs:
    1. Enforces lowercase scheme and host.
    2. Removes all tracking / referral query parameters (utm_*, ref, gh_src, etc.).
    3. Sorts remaining query parameters deterministically.
    4. Strips trailing slashes from path (except root /).
    5. Discards fragment identifiers (#...).
    """
    if not url:
        return ""

    url = url.strip()
    # Add scheme if missing
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url

    try:
        parsed = urlparse(url)
        scheme = parsed.scheme.lower()
        netloc = parsed.netloc.lower()

        # Remove default ports
        if netloc.endswith(":80") and scheme == "http":
            netloc = netloc[:-3]
        elif netloc.endswith(":443") and scheme == "https":
            netloc = netloc[:-4]

        # Strip trailing slash from path
        path = parsed.path
        if len(path) > 1 and path.endswith("/"):
            path = path[:-1]

        # Filter query params
        query_pairs = parse_qsl(parsed.query, keep_blank_values=False)
        clean_pairs = [
            (k, v) for k, v in query_pairs
            if k.lower() not in TRACKING_PARAMS and not k.lower().startswith("utm_")
        ]
        # Sort query params deterministically
        clean_pairs.sort(key=lambda x: x[0])
        clean_query = urlencode(clean_pairs)

        canonical = urlunparse((scheme, netloc, path, "", clean_query, ""))
        return canonical
    except Exception:
        return url.strip()


def generate_job_dedup_hash(company: str, role: str, location: Optional[str] = None) -> str:
    """
    Generates a deterministic 64-character SHA-256 fingerprint from the company, role,
    and location to detect duplicate job postings regardless of minor whitespace or casing variances.
    """
    def clean(s: Optional[str], is_company: bool = False) -> str:
        if not s:
            return ""
        # Lowercase, replace special punctuation with space, collapse whitespace
        c = re.sub(r"[^a-zA-Z0-9\s]", " ", s.lower())
        if is_company:
            c = re.sub(r"\b(inc|incorporated|llc|ltd|limited|corp|corporation|co)\b", " ", c)
        return " ".join(c.split())

    c_norm = clean(company, is_company=True)
    r_norm = clean(role)
    l_norm = clean(location) or "remote"

    key = f"{c_norm}:{r_norm}:{l_norm}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def is_job_expired(deadline_str: Optional[str] = None, text_content: Optional[str] = None) -> bool:
    """
    Determines whether a job posting is expired based on:
    1. Past deadline timestamp.
    2. Closure notices in verbatim text content.
    """
    # 1. Check explicit deadline
    if deadline_str:
        clean_d = deadline_str.strip()
        parsed_dt = None
        for fmt in (
            "%Y-%m-%d",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%m/%d/%Y",
            "%d/%m/%Y",
            "%B %d, %Y",
            "%b %d, %Y",
        ):
            try:
                parsed_dt = datetime.strptime(clean_d.split(".")[0].rstrip("Z"), fmt)
                break
            except Exception:
                continue

        if not parsed_dt:
            try:
                parsed_dt = datetime.fromisoformat(clean_d.rstrip("Z"))
            except Exception:
                pass

        if parsed_dt:
            if parsed_dt.tzinfo:
                now = datetime.now(parsed_dt.tzinfo)
            else:
                now = datetime.utcnow()
            if parsed_dt < now:
                return True

    # 2. Check text content for closure phrases
    if text_content:
        lower_text = text_content.lower()
        for pat in EXPIRED_PATTERNS:
            if re.search(pat, lower_text):
                return True

    return False
