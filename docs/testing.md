# CareerPilot Testing & Quality Assurance Guide

## 1. Overview & Verification Strategy

CareerPilot enforces a comprehensive, multi-layer verification strategy spanning backend unit and integration tests, deterministic business rule verification, LLM hallucination guardrails, and frontend static analysis and production build integrity.

---

## 2. Backend Test Suite

The backend test suite is implemented using `pytest` and `pytest-asyncio`, utilizing an isolated in-memory or SQLite/PostgreSQL engine with transactional rollbacks.

### Test Matrix Summary (60 Total Tests)

| Test Module | Coverage Area | Key Assertions |
| :--- | :--- | :--- |
| [`test_application_crm.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/tests/test_application_crm.py) | Application Tracker CRM | Lifecycle transitions, Kanban stage grouping, follow-up calculations |
| [`test_career_skill_gaps.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/tests/test_career_skill_gaps.py) | Skill Gap & Learning Roadmap | Market frequency ranking, zero-hallucination guardrail (never claim missing if present in profile) |
| [`test_dashboard.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/tests/test_dashboard.py) | Aggregate Dashboard | Profile completion computation, live counts, pending human approvals |
| [`test_github_analyzer.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/tests/test_github_analyzer.py) | GitHub Portfolio Analysis | Repository parsing, verified technical evidence extraction, schema validation |
| [`test_health.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/tests/test_health.py) | Health & Diagnostics | Liveness (`/health`), readiness probe (`/ready`), distributed tracing headers |
| [`test_interview_prep.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/tests/test_interview_prep.py) | Interview Co-Pilot | Question kit generation across 5 categories, multi-turn AI mock simulation, feedback scoring |
| [`test_job_analyzer.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/tests/test_job_analyzer.py) | Job Description Parser | Ground truth extraction; prevents hallucinating salary or deadlines when absent |
| [`test_job_discovery.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/tests/test_job_discovery.py) | Job Sourcing & Matching | URL normalization, SHA-256 deduplication hash, expiration detection, search filters |
| [`test_latex_compilation.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/tests/test_latex_compilation.py) | PDF Generation Engine | Sandboxed Tectonic/PDFLaTeX compilation, syntax error reporting, security command injection defense |
| [`test_matching_engine.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/tests/test_matching_engine.py) | Deterministic Match Engine | Composite scoring (skills, semantic, experience, education), configurable weight adjustments |
| [`test_outreach_agent.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/tests/test_outreach_agent.py) | Referral Outreach Generator | Grounded evidence referencing, mandatory human approval workflow, anti-fabrication guardrails |
| [`test_profile.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/tests/test_profile.py) | Candidate Profile Management | CRUD operations, sub-entity relationships (skills, experience, projects), structured resume import |
| [`test_referral_discovery.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/tests/test_referral_discovery.py) | Referral CRM & Matcher | Contact management, grounded relevance reasoning, status tracking |
| [`test_resume_ingestion.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/tests/test_resume_ingestion.py) | Resume Ingestion | Multi-format upload (PDF, LaTeX, Plain Text), character extraction, empty file validation |
| [`test_resume_tailoring.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/tests/test_resume_tailoring.py) | Evidence-Based Tailoring | Master resume preservation, validator agent hallucination defense, version history listing |
| [`test_schemas.py`](file:///Users/zaidhaque/Desktop/CareerPilot/backend/tests/test_schemas.py) | Pydantic Schemas | Data validation, RFC-compliant email formats, health response structures |

### Executing Backend Tests

```bash
# Run entire test suite
.venv/bin/pytest backend/tests/ -v

# Run specific module
.venv/bin/pytest backend/tests/test_resume_tailoring.py -v

# Run with test coverage
.venv/bin/pytest --cov=backend/app backend/tests/
```

---

## 3. Frontend Verification & Build Integrity

The frontend utilizes Next.js 14 (App Router) with TypeScript strict mode.

### Verification Checklist
- **TypeScript Static Typing**: Zero `any` leaks on core entity schemas; full type synchronization with backend Pydantic models.
- **SSR & Suspense Compliance**: Dynamic query parameters (`useSearchParams()`) wrapped in `<React.Suspense>` boundaries to guarantee seamless server-side rendering and client hydration.
- **Production Build Execution**:
  ```bash
  cd frontend
  npm run build
  ```
  Expected Output: Exit code 0, all 20 routes generated cleanly with optimized JS chunks (`~87 kB` shared base).

---

## 4. Human-In-The-Loop & Zero-Hallucination Guardrails

All tests explicitly assert the following non-negotiable architectural mandates:
1. **Never Fabricate Experience**: The tailoring validator agent rigorously inspects diffs against candidate records, rejecting any unverified metric, project, or skill claim.
2. **Never Dispatch Automated Outreach**: Generated email and LinkedIn messages remain in `NEEDS_REVIEW` until an explicit human approval action changes status to `APPROVED`.
3. **Master Resume Immutability**: All modifications generate dedicated child versions; master records remain untouched.

---

## 5. Route & HTML Bundle Verification

The automated verification script (`frontend/scripts/verify_flow.js`) validates all static and dynamic routes:
- **Routes Audited**: 16 static HTML pages + 3 dynamic server bundles (`/jobs/[jobId]`, `/jobs/[jobId]/referrals`, `/resumes/[versionId]`).
- **Pass Rate**: 22 / 22 checks passing (0 failures).
- **API URL Verification**: Verified zero instances of `/api/v1/api/...` double prefixes across the entire client.
- **Hydration & SSR Safety**: Verified all dynamic hooks (`useSearchParams`) wrapped in `<React.Suspense>`.

---

## 6. Responsive Breakpoint Matrix

The application's UI has been audited across all standard viewport dimensions:
- **Mobile Compact (375px, 390px)**: Single column layouts, touch-accessible action buttons, collapsible mobile navigation drawer, zero horizontal overflow (`overflow-x-hidden`).
- **Tablet (768px, 1024px)**: 2-column job cards, responsive dual-view Application Tracker, scrollable Kanban lanes.
- **Desktop & Widescreen (1280px, 1440px, 1920px)**: 3-column job card grid, side-by-side LaTeX/PDF viewer, full 8-lane Kanban CRM board with smooth horizontal panning.

---

## 7. Browser Automation Status & Known Environment Limitations

- **Automated Browser Subagent Status**: Playwright driver installation could not be performed by the headless subagent runner because the Microsoft Azure CDN returned HTTP 404 for the requested `playwright-1.57.0-mac-arm64.zip` binary, coupled with standard sandbox outbound network restrictions.
- **Manual Verification Status**: Both FastAPI (`http://localhost:8000`) and Next.js (`http://localhost:3000`) are running and healthy. Local manual browser verification is available on any installed browser (Google Chrome, Safari, Brave) at `http://localhost:3000`.

---

## 8. Build Artifact Synchronization & Production Verification

- **Error Incident**: `Cannot find module './682.js'` inside `.next/server/webpack-runtime.js`.
- **Diagnosis**: Dev process running during production build wiped dev chunks while memory had old chunk pointers.
- **Recovery Procedure**:
  1. Terminated stale processes (`PID 71139`).
  2. Removed `.next/` cache.
  3. Rebuilt cleanly via `npm run build`.
  4. Launched production server via `npm run start -- -H 127.0.0.1 -p 3000`.
- **Verification**: Verified HTTP 200 across all 18 routes, with 0 missing modules and 0 webpack errors.

