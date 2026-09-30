import re
import json
import httpx
from typing import List, Dict, Any, Optional, Set
from html.parser import HTMLParser
from html import unescape

from backend.app.services.job_discovery.base import JobSource, RawJobPosting
from backend.app.services.job_discovery.url_normalizer import (
    normalize_job_url,
    generate_job_dedup_hash,
    is_job_expired,
)
from backend.app.services.job_discovery.normalizer import (
    normalize_job_title,
    classify_fresher_and_experience,
    normalize_location,
    normalize_employment_type,
    extract_truthful_salary,
    extract_truthful_deadline,
)
from backend.app.core.logging import logger


class CleanTextExtractor(HTMLParser):
    """Standard library HTML to clean text extractor."""
    def __init__(self):
        super().__init__()
        self.text_parts = []
        self.ignore = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "nav", "footer", "header", "noscript", "svg", "form"):
            self.ignore = True
        elif tag in ("p", "div", "br", "li", "h1", "h2", "h3", "h4", "h5", "h6"):
            self.text_parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "nav", "footer", "header", "noscript", "svg", "form"):
            self.ignore = False
        elif tag in ("p", "div", "li"):
            self.text_parts.append("\n")

    def handle_data(self, data):
        if not self.ignore:
            self.text_parts.append(data)

    def get_clean_text(self) -> str:
        raw = "".join(self.text_parts)
        lines = [line.strip() for line in raw.splitlines() if line.strip()]
        return "\n".join(lines)


def strip_html_tags(html_content: str) -> str:
    """Strips HTML tags using CleanTextExtractor."""
    if not html_content:
        return ""
    parser = CleanTextExtractor()
    try:
        parser.feed(html_content)
        return unescape(parser.get_clean_text())
    except Exception:
        # Fallback to regex tag stripping
        clean = re.sub(r"<[^>]+>", " ", html_content)
        return unescape(" ".join(clean.split()))


class UrlJobSource(JobSource):
    """
    Source implementation for single user-provided job URLs.
    Safely fetches permitted job postings, parses HTML or JSON-LD JobPosting metadata,
    and returns normalized raw job posting objects.
    """
    source_id: str = "user_url"
    source_type: str = "url_import"
    source_name: str = "URL Direct Import"
    display_name: str = "User URL"
    access_mode: str = "USER_URL_REQUIRED"

    HEADERS = {
        "User-Agent": "CareerPilot-JobDiscovery/1.0 (+https://github.com/careerpilot-ai; job assistant)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
    }

    FORBIDDEN_HOSTS = {
        "localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254", "metadata.google.internal"
    }

    async def fetch_jobs(
        self,
        url: str,
        company_hint: Optional[str] = None,
        role_hint: Optional[str] = None,
        source_name: Optional[str] = None,
        **kwargs,
    ) -> List[RawJobPosting]:
        """
        Fetches a job posting directly from a user-supplied URL.
        Guarded against SSRF attacks on internal/cloud metadata networks.
        """
        if not url:
            return []

        canon_url = normalize_job_url(url)
        from urllib.parse import urlparse
        parsed = urlparse(canon_url)
        host = (parsed.hostname or "").lower()

        # SSRF Protection
        if (
            host in self.FORBIDDEN_HOSTS
            or host.startswith("10.")
            or host.startswith("192.168.")
            or (host.startswith("172.") and any(host.startswith(f"172.{i}.") for i in range(16, 32)))
            or parsed.scheme not in ("http", "https")
        ):
            logger.warning(f"SSRF attempt blocked for host: {host}")
            raise ValueError(f"Access to private, loopback, or metadata network address '{host}' is forbidden.")

        logger.info(f"Fetching job posting from URL: {canon_url}")

        timeout = httpx.Timeout(12.0, connect=5.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=self.HEADERS) as client:
            try:
                response = await client.get(canon_url)
                if response.status_code in (404, 410):
                    logger.warning(f"Job URL returned {response.status_code} (Expired/Removed): {canon_url}")
                    return [
                        RawJobPosting(
                            company=company_hint or "Unknown Company",
                            role=role_hint or "Position",
                            description="Job listing has been removed or closed by the employer.",
                            url=canon_url,
                            source_type=self.source_type,
                            source_name=source_name or self.source_name,
                            is_active=False,
                            is_expired=True,
                        )
                    ]
                response.raise_for_status()
                html = response.text
            except Exception as e:
                logger.error(f"Failed to fetch job URL '{canon_url}': {e}")
                raise ValueError(f"Unable to access job URL: {str(e)}")

        # 1. Look for Schema.org JobPosting in JSON-LD
        extracted = self._extract_json_ld_job_posting(html)

        company = company_hint or extracted.get("company")
        role = role_hint or extracted.get("role")
        location = extracted.get("location") or "Remote"
        employment_type = extracted.get("employment_type") or "Full-time"
        salary = extracted.get("salary")
        deadline = extracted.get("deadline")
        desc = extracted.get("description")

        # 2. Fallback to HTML text parsing if JSON-LD was absent or incomplete
        if not desc:
            desc = strip_html_tags(html)

        if not role:
            role = self._extract_title_from_html(html) or "Software Engineer"

        if not company:
            company = self._extract_company_from_html(html, canon_url) or "Company"

        # Check expiration
        expired = is_job_expired(deadline, desc)

        return [
            RawJobPosting(
                company=company.strip(),
                role=role.strip(),
                description=desc.strip(),
                location=location.strip() if location else "Remote",
                employment_type=employment_type.strip() if employment_type else "Full-time",
                url=canon_url,
                salary=salary,
                deadline=deadline,
                source_type=self.source_type,
                source_name=source_name or self._infer_source_name(canon_url),
                raw_metadata=extracted,
                is_active=not expired,
                is_expired=expired,
            )
        ]

    def normalize_job(self, raw: RawJobPosting) -> Dict[str, Any]:
        """
        Standardizes raw job posting into common Job schema attributes.
        """
        canon_url = normalize_job_url(raw.url) if raw.url else None
        dedup_hash = generate_job_dedup_hash(raw.company, raw.role, raw.location)
        norm_title, orig_title = normalize_job_title(raw.role)
        norm_loc, remote_status = normalize_location(raw.location)
        emp_type = normalize_employment_type(raw.employment_type, raw.description)
        is_fresher, fresher_reason, exp_level = classify_fresher_and_experience(raw.role, raw.description)
        salary = extract_truthful_salary(raw.salary, raw.description)
        deadline = extract_truthful_deadline(raw.deadline, raw.description)

        return {
            "company": raw.company,
            "role": raw.role,
            "original_title": orig_title,
            "normalized_title": norm_title,
            "location": norm_loc,
            "remote_status": remote_status,
            "employment_type": emp_type,
            "experience_level": exp_level,
            "is_fresher_eligible": is_fresher,
            "fresher_eligibility_reason": fresher_reason,
            "raw_description": raw.description,
            "application_url": canon_url,
            "canonical_url": canon_url,
            "official_company_url": canon_url,
            "salary": salary,
            "deadline": deadline,
            "source_type": raw.source_type,
            "source_name": raw.source_name,
            "external_id": raw.external_id,
            "is_active": raw.is_active,
            "is_expired": raw.is_expired,
            "dedup_hash": dedup_hash,
            "posted_at": getattr(raw, "posted_at", None),
        }

    def deduplicate_job(
        self,
        normalized: Dict[str, Any],
        existing_hashes_or_urls: Set[str],
    ) -> bool:
        """
        Checks if canonical URL or dedup_hash exists in existing set.
        """
        c_url = normalized.get("canonical_url")
        d_hash = normalized.get("dedup_hash")

        if c_url and c_url in existing_hashes_or_urls:
            return True
        if d_hash and d_hash in existing_hashes_or_urls:
            return True

        return False

    def _extract_json_ld_job_posting(self, html: str) -> Dict[str, Any]:
        """Extracts Schema.org JobPosting microdata from script tags via regex and JSON parser."""
        result: Dict[str, Any] = {}
        scripts = re.findall(
            r"<script[^>]*type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
            html,
            re.DOTALL | re.IGNORECASE,
        )
        for s_content in scripts:
            try:
                data = json.loads(s_content.strip())
                items = data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []

                for item in items:
                    if isinstance(item, dict) and item.get("@type") == "JobPosting":
                        result["role"] = item.get("title")
                        hiring_org = item.get("hiringOrganization")
                        if isinstance(hiring_org, dict):
                            result["company"] = hiring_org.get("name")
                        elif isinstance(hiring_org, str):
                            result["company"] = hiring_org

                        # Location
                        job_loc = item.get("jobLocation")
                        if isinstance(job_loc, dict):
                            address = job_loc.get("address", {})
                            if isinstance(address, dict):
                                loc_parts = [
                                    address.get("addressLocality"),
                                    address.get("addressRegion"),
                                    address.get("addressCountry"),
                                ]
                                result["location"] = ", ".join([p for p in loc_parts if p])
                        elif isinstance(job_loc, list) and job_loc:
                            result["location"] = "Multiple Locations"

                        # Description
                        desc_html = item.get("description")
                        if desc_html:
                            result["description"] = strip_html_tags(desc_html)

                        # Employment type & dates
                        result["employment_type"] = item.get("employmentType")
                        result["deadline"] = item.get("validThrough")
                        base_sal = item.get("baseSalary")
                        if isinstance(base_sal, dict):
                            value = base_sal.get("value", {})
                            if isinstance(value, dict):
                                min_v = value.get("minValue")
                                max_v = value.get("maxValue")
                                curr = base_sal.get("currency", "USD")
                                if min_v and max_v:
                                    result["salary"] = f"{curr} {min_v:,} - {max_v:,}"
                        return result
            except Exception:
                continue
        return result

    def _extract_title_from_html(self, html: str) -> Optional[str]:
        h1_m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.DOTALL | re.IGNORECASE)
        if h1_m:
            clean_h1 = strip_html_tags(h1_m.group(1)).strip()
            if clean_h1:
                return clean_h1

        t_m = re.search(r"<title[^>]*>(.*?)</title>", html, re.DOTALL | re.IGNORECASE)
        if t_m:
            t = strip_html_tags(t_m.group(1)).strip()
            parts = re.split(r"[-|–—]", t)
            return parts[0].strip() if parts else t
        return None

    def _extract_company_from_html(self, html: str, url: str) -> Optional[str]:
        og_m = re.search(r'<meta[^>]*property=["\']og:site_name["\'][^>]*content=["\']([^"\']+)["\']', html, re.IGNORECASE)
        if og_m:
            return unescape(og_m.group(1).strip())

        # Parse from hostname (e.g. jobs.lever.co/stripe -> Stripe)
        match = re.search(r"(?:boards\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com)/([^/]+)", url)
        if match:
            return match.group(1).replace("-", " ").title()

        return None

    def _infer_source_name(self, url: str) -> str:
        if "greenhouse.io" in url:
            return "Greenhouse Board"
        elif "lever.co" in url:
            return "Lever Board"
        elif "ashbyhq.com" in url:
            return "Ashby Board"
        elif "workday.com" in url:
            return "Workday Portal"
        elif "remoteok.com" in url:
            return "RemoteOK Feed"
        return "Company Careers"
