# CareerPilot — Referral Discovery Engine (Phase 18)

## 1. System Architecture & Overview

CareerPilot's Referral Discovery Engine provides verified, multi-source professional contact discovery for candidates who have had their tailored resume approved for a target role.

The discovery pipeline follows the end-to-end human-governed progression:

```mermaid
flowchart TD
    subgraph PREV [Preceding Verified Phases]
        J[Job Discovered & Analyzed] --> R[User Reviews & Approves Job]
        R --> T[Tailored LaTeX Resume Generated]
        T --> A[User Reviews & Approves Resume]
    end

    subgraph ENGINE [Referral Discovery Engine - Phase 18]
        A -->|Click FIND REFERRALS| TRG[POST /api/v1/referrals/discover]
        TRG --> CTX[ReferralQueryContext Builder\nTarget Company, Role, Department, Tech, Location, Alma Mater]
        
        CTX --> ADAPT[Source Adapters Multi-Source Discovery]
        ADAPT --> S1[LinkedIn Public Index]
        ADAPT --> S2[Company Public Team Pages]
        ADAPT --> S3[University Alumni Network]
        ADAPT --> S4[GitHub Public Org & Contributors]
        ADAPT --> S5[Tech Speakers & Authors Directory]
        ADAPT --> S6[User-Supplied URLs]

        S1 & S2 & S3 & S4 & S5 & S6 --> NORM[Normalization & Privacy Sanitization\nStrip PII / Scrub phone numbers]
        NORM --> DEDUP[3-Tier Deduplication & Provenance Merging\nCanonical URL, Name+Company, Name+Company+Title]
        DEDUP --> SCORE[Deterministic 100-Point Transparent Scoring\n30% Co, 20% Role, 15% Tech, 15% Alumni, 10% Seniority, 10% Evidence]
        SCORE --> RANK[Deterministic Sorting & Ranking]
        SCORE --> EVAL[50-Contact Target Evaluation\nTarget: 50 | Shortfall Calculation | Zero-Fabrication Invariant]
        EVAL --> PERSIST[(referral_contacts SQLite Table\n25+ Schema Fields & Relations)]
    end

    subgraph ORCH [n8n Automation Layer]
        PERSIST -.->|Webhook Event\nreferral.discovered| N8N[CPReferralDiscovery001 Workflow]
    end

    subgraph HITL [Frontend Referral Studio & Human Governance]
        PERSIST --> DASH[Next.js Referral Studio\n/referrals & /referrals/contactId]
        DASH --> FILTER[Filters: Engineers, Managers, Recruiters, Alumni, Hiring Team]
        DASH --> SEL[Human Selection & Bulk Actions\nSELECT / DISMISS / BULK SELECT]
        DASH --> PREP[Continue to Outreach\nStatus: APPROVED\nNO AUTOMATED MESSAGING]
    end
```

---

## 2. Non-Negotiable Core Invariants

### 2.1 50-Contact Discovery Target & Shortfall Reporting
- **Target Definition**: The system establishes a baseline target of **50 potential referral contacts** per approved job posting.
- **Discovery Target, Not Referral Guarantee**: Contacts are recorded as *potential referral contacts*, never guaranteed referral providers.
- **Legitimate Count Reporting**:
  - If 50+ contacts are legitimately discovered: all verified, relevant contacts are returned (`target_reached = true`, `shortfall = 0`).
  - If fewer than 50 contacts can legitimately be discovered: all discoverable relevant contacts are returned, and the engine explicitly reports:
    ```json
    {
      "target_count": 50,
      "total_discovered": 31,
      "total_verified": 24,
      "target_reached": false,
      "shortfall": 26,
      "shortfall_reason": "Target not reached because fewer verified/relevant contacts were discoverable from the configured sources."
    }
    ```
- **Zero Fabrication Guarantee**: The system **NEVER** fabricates, synthesizes, or invents mock contacts to artificially satisfy the 50-contact threshold.

### 2.2 Master Resume & Candidate Fact Safety
- Referral discovery operates in a strictly read-only mode regarding candidate profile data and master resume files.
- Candidate university, degree, and verified technical skills are ingested solely for alumni matching and technical overlap calculations.
- Master resume files (`resume/master/sample_master_resume.tex`) and verified career facts are immutable across all referral discovery workflows.

### 2.3 Strict Human-in-the-Loop Governance
- Discovery can be executed automatically or on user demand.
- Contact selection requires explicit user interaction (`NOT_CONTACTED -> SELECTED`).
- Moving to outreach (`CONTINUE TO OUTREACH`) transitions contacts to `APPROVED` for human review.
- **Absolute Prohibition**: CareerPilot **NEVER** automatically:
  - Sends LinkedIn InMail, direct messages, or connection requests
  - Sends automated cold emails or recruiting outreach
  - Automates account actions or browser session manipulation
  - Submits job applications or referrals on behalf of the user

---

## 3. Supported Sources & Access Restrictions

CareerPilot interfaces exclusively through legitimate, permitted, and public/authorized discovery channels:

| Source Adapter | Implementation | Permitted Data Scope | Access Method |
| :--- | :--- | :--- | :--- |
| **LinkedIn Public Index** | `linkedin_referral_source.py` | Public profile URLs, headlines, public names, verified company association | Public authorized search index / Authorized API |
| **Company Team Pages** | `company_team_source.py` | Public "About Us", engineering blogs, team rosters, leadership announcements | HTTP GET public web pages |
| **University Alumni Network** | `alumni_source.py` | Public alumni directories, campus tech club fellows, verified graduation years | Public institutional directories |
| **GitHub Public Contributors** | `github_source.py` | Public org members, repository contributors, public GitHub handles | GitHub Public REST API |
| **Public Tech Profiles** | `public_profile_source.py` | Conference speakers (PyCon, KubeCon, AWS re:Invent), tech authors | Public conference schedules & listings |
| **User-Provided URLs** | `user_url_referral_source.py` | Professional links provided directly by the candidate | Explicit user submission |

### Strict Source Access Rules
- **No Authentication Bypass**: No credential stuffing, session hijacking, or private profile access.
- **No CAPTCHA Bypass**: Systems encountering CAPTCHAs degrade gracefully without evasion attempts.
- **No Cookie Scraping**: No automated browser session cookie extraction or browser automation targeting LinkedIn.
- **Graceful Degradation**: If an individual adapter encounters a network timeout, rate limit (HTTP 429), or unavailable upstream service, the error is isolated in `source_failures` while all surviving adapters continue execution.

---

## 4. Multi-Source Deduplication & Provenance Merging

When an individual professional is identified across multiple channels (e.g. found on LinkedIn, listed on the company team roster, and contributing to the company's GitHub repository), CareerPilot consolidates them into a single canonical `ReferralContact`.

### 3-Tier Deduplication Key Strategy
1. **Tier 1 (Canonical Profile URL)**: Normalized URL scheme (e.g., `url:linkedin.com/in/sarah-chen`).
2. **Tier 2 (Normalized Name + Company)**: Alphanumeric lowercase tokenization (e.g., `nc:sarahchen|datadog`).
3. **Tier 3 (Normalized Name + Company + Title)**: Distinguishes individuals with shared names (e.g., `nct:sarahchen|datadog|seniordataengineer`).

### Provenance Merging Behavior
When a duplicate is recognized:
- The canonical record retains the highest-confidence title, department, location, and relationship classification.
- The `source_references` array aggregates each discovering source with timestamp and verification state:
  ```json
  [
    { "source": "linkedin", "source_url": "https://linkedin.com/in/sarah-chen", "verification_status": "VERIFIED" },
    { "source": "company_website", "source_url": "https://datadog.com/team/engineering", "verification_status": "VERIFIED" },
    { "source": "github", "source_url": "https://github.com/sarahchen-datadog", "verification_status": "VERIFIED" }
  ]
  ```
- Technical skills, notes, and relationship tags are unified without data loss.

---

## 5. Transparent Deterministic Relevance Scoring

Relevance scores represent **"How relevant this person appears as a potential contact"**, not an arbitrary or misleading probability that they will agree to refer the candidate.

The scoring model allocates 100 maximum points across six transparent, auditable dimensions:

| Dimension | Max Points | Weight | Scoring Criteria |
| :--- | :---: | :---: | :--- |
| **Company Association** | 30 pts | 30% | Exact target company match (30 pts), parent/subsidiary match (20 pts), past company affiliation (10 pts) |
| **Role & Team Relevance** | 20 pts | 20% | Direct team match (Engineering Manager / Tech Lead: 20 pts, Senior Engineer / Engineer: 18 pts, Recruiter / Hiring Team: 16 pts, Other technical role: 10 pts) |
| **Technical Overlap** | 15 pts | 15% | Jaccard overlap between candidate's verified skills, job tech requirements, and contact's public skills (3 pts per overlapping skill, capped at 15 pts) |
| **Alumni Relationship** | 15 pts | 15% | Shared university alma mater between candidate and contact (15 pts if exact match, 0 pts otherwise) |
| **Seniority Relevance** | 10 pts | 10% | Capacity to provide meaningful context (Director/VP/Head: 10 pts, Manager/Lead: 9 pts, Staff/Senior: 8 pts, Mid: 6 pts) |
| **Public Professional Evidence** | 10 pts | 10% | Multiple verified public sources (2+ sources: 10 pts, 1 verified profile: 7 pts, unverified: 3 pts) |

### Detailed Breakdown Storage
Every contact record stores both human-readable `relevance_reasons` and machine-readable `score_breakdown`:
```json
{
  "relevance_score": 88,
  "relevance_reasons": [
    "Confirmed employee at target company Datadog (+30 pts)",
    "Senior engineering role aligned with target opening (+18 pts)",
    "Shared technical skills: Python, Distributed Systems, Docker (+9 pts)",
    "Fellow alumni of University of California, Berkeley (+15 pts)",
    "Multi-source verified public professional profile (+10 pts)"
  ],
  "score_breakdown": {
    "company_match": 30,
    "role_relevance": 18,
    "technical_overlap": 9,
    "alumni_match": 15,
    "seniority_weight": 6,
    "public_evidence": 10
  }
}
```

---

## 6. Privacy & Data Minimization Guardrails

To protect professional privacy, CareerPilot strictly limits stored attributes:
- **Stored Attributes**: Full name, current professional title, department, company name, location, public professional profile URL, university name, graduation year, public technical skills.
- **Active Sanitization**: The normalizer proactively scrubs personal identifiers:
  - Phone numbers are deleted (`None`)
  - Physical residential addresses are deleted (`None`)
  - Government IDs, private email addresses, and personal messaging accounts are rejected.

---

## 7. Data Model Reference (`ReferralContact`)

| Column Name | SQLite / SQLAlchemy Type | Description |
| :--- | :--- | :--- |
| `id` | `VARCHAR(36)` (PK) | UUID identifier |
| `company_name` | `VARCHAR(255)` (Indexed) | Target company name |
| `company` | `VARCHAR(255)` | Normalized target company |
| `job_id` | `VARCHAR(36)` (FK -> `jobs.id`) | Foreign key linking to target job |
| `candidate_id` | `VARCHAR(36)` (FK -> `candidates.id`) | Foreign key linking to candidate |
| `name` | `VARCHAR(255)` (Indexed) | Professional name |
| `headline` | `TEXT` | Professional headline |
| `current_title` | `VARCHAR(255)` | Current job title |
| `department` | `VARCHAR(255)` | Department or division |
| `location` | `VARCHAR(255)` | Geographic location |
| `profile_url` | `VARCHAR(1024)` | Primary canonical profile URL |
| `source` | `VARCHAR(100)` | Primary discovery source identifier |
| `source_url` | `VARCHAR(1024)` | Primary discovery source URL |
| `source_references` | `JSON` | List of all provenance records across merged sources |
| `public_contact_method`| `VARCHAR(255)` | Public contact channel (e.g. LinkedIn InMail, Twitter handle) |
| `university` | `VARCHAR(255)` (Indexed) | Alma mater university |
| `graduation_year` | `INTEGER` | Graduation year |
| `skills` | `JSON` | List of public technical skills |
| `relevance_score` | `INTEGER` (Indexed) | 0–100 relevance score |
| `relevance_reasons` | `JSON` | List of human-readable explanation bullet points |
| `score_breakdown` | `JSON` | Object detailing point allocation per dimension |
| `relationship_type` | `VARCHAR(50)` (Indexed) | `ENGINEERING_MANAGER`, `SENIOR_ENGINEER`, `RECRUITER`, `ALUMNI`, etc. |
| `verification_status`| `VARCHAR(50)` (Indexed) | `VERIFIED`, `PARTIALLY_VERIFIED`, `UNVERIFIED`, `STALE` |
| `last_verified_at` | `DATETIME` | Timestamp of last source verification |
| `discovered_at` | `DATETIME` | Timestamp of initial discovery |
| `duplicate_key` | `VARCHAR(255)` (Indexed) | Normalized deduplication key |
| `notes` | `TEXT` | User-editable internal notes |
| `outreach_status` | `VARCHAR(50)` (Indexed) | `NOT_CONTACTED`, `SELECTED`, `APPROVED`, `SENT`, `DECLINED`, etc. |

---

## 8. REST API Reference

All endpoints are versioned under `/api/v1/referrals`:

### `POST /api/v1/referrals/discover`
Discovers potential referral contacts for an approved job posting across all configured sources.
- **Request Body**:
  ```json
  {
    "job_id": "job-uuid-123",
    "target_count": 50,
    "user_urls": ["https://linkedin.com/in/custom-contact"]
  }
  ```
- **Response**: `ReferralDiscoveryResponse`
  ```json
  {
    "job_id": "job-uuid-123",
    "company_name": "Datadog",
    "target_count": 50,
    "total_discovered": 64,
    "total_verified": 58,
    "target_reached": true,
    "shortfall": 0,
    "shortfall_reason": null,
    "sources_used": ["linkedin", "company_website", "alumni", "github", "public_profiles"],
    "source_failures": [],
    "contacts": [...]
  }
  ```

### `GET /api/v1/referrals/job/{job_id}`
Retrieves all discovered contacts for a specific job, with optional filters for `relationship_type`, `verification_status`, and `outreach_status`.

### `GET /api/v1/referrals`
Global listing across all jobs with pagination and status filters.

### `GET /api/v1/referrals/{id}`
Retrieves complete profile, score breakdown, source provenance, and notes for a single contact.

### `POST /api/v1/referrals/{id}/select`
Marks a contact as `SELECTED` (or custom status) for outreach planning.

### `POST /api/v1/referrals/{id}/dismiss`
Dismisses a contact (`DO_NOT_CONTACT`).

### `POST /api/v1/referrals/bulk-select`
Bulk selects, dismisses, or approves a batch of contact IDs.

### `PATCH /api/v1/referrals/{id}/notes`
Updates internal candidate notes on a contact.

### `GET /api/v1/referrals/sources/status`
Returns real-time health, rate limit status, and discovery capability for all 6 source adapters.

---

## 9. n8n Workflow Integration (`CPReferralDiscovery001`)

The n8n orchestration workflow is defined in [`workflows/referral_discovery_workflow.json`](file:///Users/zaidhaque/Desktop/CareerPilot/workflows/referral_discovery_workflow.json).

### Node Structure
1. **Webhook Trigger (`/webhook/referral-discovery`)**: Listens for `POST` triggers containing `job_id`, `company_name`, and `target_count`.
2. **Schedule Trigger**: Runs periodic recurring discovery audits for approved jobs lacking referral rosters.
3. **Execute FastAPI Discovery Node (`POST /api/v1/referrals/discover`)**: Dispatches discovery execution to the FastAPI backend.
4. **Target Evaluation Switch Node**:
   - `target_reached == true`: Routes to success summary notification.
   - `target_reached == false`: Captures exact shortfall metric and routes to shortfall alert.
5. **Notification & Audit Log Node**: Logs discovery metrics and notifies user without sending external outreach.

---

## 10. Automated Test Coverage

The Phase 18 referral discovery test suite is located in [`backend/tests/test_phase18_referral_discovery.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/tests/test_phase18_referral_discovery.py):

| Test Name | Verifications |
| :--- | :--- |
| `test_normalization_and_privacy_filtering` | Validates contact name cleaning, URL normalization, relationship auto-classification, and stripping of phone numbers and physical addresses. |
| `test_deduplication_and_provenance_merging` | Validates merging of 3 source sightings (LinkedIn, company page, GitHub) into 1 canonical contact with aggregated `source_references`. |
| `test_relevance_scoring_breakdown` | Validates deterministic 100-point formula across company, role, tech overlap, alumni, seniority, and public evidence. |
| `test_50_contact_target_evaluation_success` | Tests discovery exceeding target (55 discovered >= 50 target, `target_reached=True`, `shortfall=0`). |
| `test_shortfall_handling_no_fabrication` | **Critical Invariant**: When only 27 contacts exist, exactly 27 are returned with `shortfall=23`. Zero mock contacts are fabricated. |
| `test_source_failure_resilience` | Validates graceful degradation when 2 adapters fail (HTTP 500 / 429); surviving adapters discover contacts without crashing pipeline. |
| `test_api_referral_discovery_and_selection_lifecycle` | End-to-end API test covering discovery, listing, single selection, bulk selection, notes patching, dismiss, and sources status. |
| `test_master_resume_immutability_during_referral_discovery` | Cryptographic SHA-256 test asserting candidate master resume file is 100% unchanged before and after discovery. |

Total test suite status: **87 of 87 backend tests passing**.

---

## 11. Known Limitations & Future Considerations

1. **Public Profile Availability**: Smaller startups or stealth companies may have fewer than 50 discoverable employees in public registries; the engine correctly halts and reports the true count and shortfall.
2. **Dynamic Web Scraping Restrictions**: In accordance with the system's strict anti-bot and privacy principles, private or authenticated LinkedIn pages are never scraped. Discovery relies on public indexes, authorized APIs, and user-provided connections.
3. **Outreach Execution**: Automated dispatch of emails, LinkedIn messages, or connection requests is strictly reserved for a subsequent user-governed phase. Phase 18 halts after user contact selection.
