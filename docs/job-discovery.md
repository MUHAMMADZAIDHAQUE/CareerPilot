# CareerPilot — Multi-Source Job Discovery & AI Matching Architecture (Phase 16B)

## 1. System Architecture Overview

CareerPilot implements a modular, multi-source job discovery and deterministic matching pipeline. The backend architecture strictly decouples automation orchestration from core business logic:

- **FastAPI Backend (Source of Truth)**: Executes source aggregation, schema normalization, cross-source deduplication, deterministic scoring, fresher classification, and data persistence.
- **Local n8n Community Edition (Orchestration Layer)**: Periodically triggers the discovery workflow via schedule or manual webhook, polls FastAPI endpoints, logs workflow executions, and dispatches structured alerts.
- **Next.js Frontend (Cockpit & Presentation)**: Visualizes discovered opportunities, match confidence scores, multi-source provenance, and human-in-the-loop action triggers.

```
                  JOB SOURCES
     [LinkedIn] [FreshersHunt] [Indeed] [Company Careers] [Public Feeds]
                        │
                        ▼
               SOURCE ADAPTERS
       (JobSourceAdapter Interface: fetch_jobs, normalize_job, health_check)
                        │
                        ▼
                RAW JOB RECORDS
            (RawJobPosting schemas)
                        │
                        ▼
            NORMALIZER & CLASSIFIER
       - Job Title Normalizer (Canonical vs Original)
       - Experience & Fresher Classifier (0-3 yrs heuristics)
       - Location & Remote Status (Remote / Hybrid / On-site)
       - Truthful Salary & Deadline extraction
                        │
                        ▼
              DEDUPLICATION ENGINE
       - Canonical URL matching
       - Dedup Hash (Company + Normalized Title + Location)
       - Source aggregation into canonical record (source_references)
                        │
                        ▼
             CAREERPILOT DATABASE
            (SQLite / PostgreSQL)
                        │
                        ▼
            AI MATCHING ENGINE
       - Career Profile vs JD requirements
       - Match Categories: HIGH_MATCH, GOOD_MATCH, POSSIBLE_MATCH, etc.
       - Transparent explanations ("Why it matches", "Potential gaps")
                        │
                        ▼
             ALERTS & NOTIFICATIONS
            (Rendered Job Alerts / n8n Webhook / Frontend)
                        │
                        ▼
               HUMAN-IN-THE-LOOP
       [VIEW JOB]  [PREPARE RESUME]  [FIND REFERRALS (Phase 17)]
```

---

## 2. Source Adapters

All source integrations implement the `JobSourceAdapter` abstract contract defined in [`backend/app/services/job_discovery/base.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/app/services/job_discovery/base.py):

| Adapter | Identifier | Purpose / Scope | Default Enabled |
| :--- | :--- | :--- | :--- |
| **LinkedIn Adapter** | `linkedin` | Curated professional listings with role & location filters | `true` |
| **FreshersHunt Adapter** | `freshershunt` | Entry-level, campus recruitment, and 0-3 year roles | `true` |
| **Indeed Adapter** | `indeed` | Public software engineering and data roles | `true` |
| **Company Careers Adapter** | `company_careers` | Direct career boards (Greenhouse / Lever / Direct) | `true` |
| **Public Feed Adapter** | `public_feed` | Authorized remote tech feeds (RemoteOK / Arbeitnow) | `true` |
| **URL Ingestion Adapter** | `url_import` | Single-URL ingestion on demand by user | `true` |

### Independent Source Control
Each source is independently toggled via environment variables:
- `JOB_SOURCE_LINKEDIN_ENABLED=true`
- `JOB_SOURCE_FRESHERSHUNT_ENABLED=true`
- `JOB_SOURCE_COMPANY_CAREERS_ENABLED=true`
- `JOB_SOURCE_INDEED_ENABLED=true`
- `JOB_SOURCE_PUBLIC_FEEDS_ENABLED=true`

---

## 3. Responsible Access & Source Limitations

CareerPilot strictly adheres to responsible source access policies:
1. **Zero Scraping & Zero Botting**: LinkedIn and other private platforms are never scraped with headless browsers or automated bot accounts. No CAPTCHAs or Cloudflare bot protections are bypassed.
2. **Authorized APIs & Permitted Feeds**: Discovery uses verified public career APIs, authorized public RSS/JSON feeds, and user-provided URLs.
3. **No Automated Applications**: The system never applies to jobs autonomously.
4. **Rate Limiting & Timeouts**: HTTP clients use strict request timeouts (10s), exponential backoff, and concurrency caps.
5. **Partial Failure Resilience**: A failure in one source (e.g. timeout on Indeed) does not halt the discovery pipeline. Errors are logged into `source_failures` diagnostics while other sources complete cleanly.

---

## 4. Job Normalization

The normalization engine ([`backend/app/services/job_discovery/normalizer.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/app/services/job_discovery/normalizer.py)) maps disparate source representations into canonical CareerPilot fields:

- **Original vs Normalized Title**: Preserves the exact employer title (e.g., `"Graduate Software Engineer (2025/2026)"`) while setting a standardized `normalized_title` (e.g., `"Software Engineer"`).
- **Location & Remote Status**: Classifies into `"Remote"`, `"Hybrid"`, or `"On-site"`.
- **Employment Type**: Normalizes to `"Full-time"`, `"Part-time"`, `"Contract"`, or `"Internship"`.
- **Truthful Information Preservation**:
  - Missing salary is stored as `null` / `"Not specified"`. Salary figures are NEVER fabricated.
  - Missing deadline is stored as `null` / `"Not specified"`. Deadlines are NEVER invented.

---

## 5. Duplicate Detection & Provenance

When the same opportunity is listed on LinkedIn, FreshersHunt, and a company portal:
1. **Canonical Deduplication**:
   - Matches by canonical URL (normalized with stripped tracking params like `utm_*`, `ref`, `trk`).
   - Matches by deterministic hash `SHA256(company_normalized + title_normalized + location_normalized)`.
   - Matches by composite key `(company, normalized_title)`.
2. **Single Canonical Record**:
   - The first sighting creates the canonical `Job` row.
   - Subsequent sightings are merged into the `source_references` JSON array:
     ```json
     [
       {
         "source": "LinkedIn Jobs",
         "source_type": "linkedin",
         "url": "https://www.linkedin.com/jobs/view/101",
         "official_url": "https://careers.datadoghq.com/detail/101",
         "external_id": "li_001",
         "discovered_at": "2026-09-29T10:42:30.619Z"
       },
       {
         "source": "Indeed Jobs",
         "source_type": "indeed",
         "url": "https://www.indeed.com/viewjob?jk=ind_101",
         "official_url": "https://careers.datadoghq.com/detail/101",
         "external_id": "ind_001",
         "discovered_at": "2026-09-29T10:42:30.625Z"
       }
     ]
     ```
   - Duplicate count is logged, `last_verified_at` is refreshed, and official URLs/deadlines are updated if discovered.

---

## 6. Fresher / Entry-Level Classification

CareerPilot primarily targets students, new graduates, and early-career talent (0–3 years).

- **Positive Signals**: Explicit keywords such as `fresher`, `fresh graduate`, `entry level`, `junior`, `associate`, `batch of 2024/2025/2026`, `0-1 year`, `0-2 years`, `0-3 years`.
- **Invariance Rule**: A job requiring **4+ or 5+ years of experience** is STRICTLY flagged as `is_fresher_eligible = false`, even if the job title is generically named `"Software Engineer"`.
- **Audit Reason**: Every classification stores an auditable rationale in `fresher_eligibility_reason` (e.g., `"Matches fresher criteria: explicitly mentions 'batch of 2025'."` vs `"Requires 5+ years of professional experience (ineligible for freshers)."`).

---

## 7. AI Matching Engine & Categories

Matching is executed by [`MatchingService`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/app/services/matching_service.py) against the user's verified **Career Profile**:

### Transparent Scoring Breakdown
- **Required Skills Coverage (35%)**: Exact token and semantic match against JD requirements.
- **Semantic JD Alignment (25%)**: Contextual alignment with candidate headline and summary.
- **Experience Compatibility (15%)**: Alignment of candidate tenure with role seniority.
- **Project Relevance (15%)**: Aligned technologies and project accomplishments.
- **Education Compatibility (10%)**: Degree level and major alignment.

### Match Categories
Scores are classified into human-interpretable categories:
- `HIGH_MATCH` (≥ 75%): Strong skill overlap, aligned projects, and experience fit.
- `GOOD_MATCH` (65% – 74.9%): Solid alignment with minor skill gaps.
- `POSSIBLE_MATCH` (50% – 64.9%): Relevant foundation with several missing competencies.
- `LOW_MATCH` (< 50%): Limited overlap with current profile.
- `INELIGIBLE`: Disqualified due to strict requirements (e.g. senior tenure requirement for early career applicant).

### Grounded Explanations
For every matched job, structured explanations tell the user **why** the job matches:
- `✓ Python`
- `✓ PostgreSQL`
- `✓ Relevant project: Distributed Web Crawler`
- `✓ Fresher eligible`
- `• Potential gap: Power BI`

---

## 8. n8n Orchestration Workflow

The orchestration workflow is defined in [`workflows/job_discovery_workflow.json`](file:///Users/zaidhaque/Desktop/CareerPilot/workflows/job_discovery_workflow.json) and published into local n8n Community Edition as `CPJobDiscovery001`.

```
[Cron / Schedule Trigger (Daily at 08:00)] 
   OR 
[Webhook: POST /webhook/careerpilot-job-discovery]
                      │
                      ▼
[FastAPI: POST /api/v1/jobs/discover]
                      │
                      ▼
[FastAPI: Multi-Source Aggregation + Dedup + AI Matching]
                      │
                      ▼
[Filter Relevant Opportunities (Match Score ≥ 60%)]
                      │
                      ▼
[Format Match Alerts & Log Execution Summary]
                      │
                      ▼
[Webhook Response: Rendered Alerts + HITL Guardrail Status]
```

### Testing the Workflow via CLI
```bash
curl -X POST http://localhost:5678/webhook/careerpilot-job-discovery \
  -H "Content-Type: application/json" \
  -d '{"trigger": "manual_test"}'
```

---

## 9. Human-in-the-Loop (HITL) Guardrails

CareerPilot strictly preserves human approval at every transition:
1. **Job Alert / Review**: System alerts user to a match. No tailoring or applying occurs.
2. **PREPARE RESUME**: User explicitly clicks "Prepare Resume" to open the LaTeX Resume Tailoring Studio. The master resume is **IMMUTABLE** and never modified.
3. **FIND REFERRALS**: Disabled placeholder indicating referral discovery will unlock in Phase 17.
4. **APPLY**: Job applications are NEVER submitted autonomously.

---

## 10. Verification & Test Suite

All 73 backend tests pass cleanly:
```bash
./.venv/bin/pytest backend/tests/ -v
# Output: 73 passed in 3.47s
```

Frontend production build verifies type safety:
```bash
npm --prefix frontend run build
# Output: 20/20 routes built successfully with 0 errors
```

---

## 11. Known Limitations & Phase 17 Transition

- **Referral Discovery**: Kept disabled as per Phase 16B specification. Will be implemented in Phase 17 with 50+ contact discovery targets.
- **Outreach Drafts**: Kept separate under `/outreach`. Automatic cold emailing is prohibited.
- **Live Scraping**: Private websites requiring browser sessions or CAPTCHAs are not scraped; user provides direct URLs or verified feeds are utilized.
