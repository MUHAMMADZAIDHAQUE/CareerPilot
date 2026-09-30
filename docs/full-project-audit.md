# CareerPilot AI — Complete Full Project Audit (Phase 15 -> Production)

**Audit Date:** September 29, 2026  
**Auditor:** Antigravity Autonomous Engineering Lead  
**Scope:** Full-stack inspection across Folder Structure, Backend Architecture, FastAPI Endpoints, Database Models, Alembic Migrations, Pydantic Schemas, AI Agents, Matching Engine, Resume Tailoring, LaTeX/PDF Compilation, Job & Referral Discovery, Outreach CRM, Application Tracking, Interview Prep, Skill-Gap Analysis, GitHub Analyzer, Dashboard, Frontend Architecture, Design System, UX, Performance, Accessibility, and Security.

---

## 1. Executive Summary

CareerPilot AI represents an ambitious end-to-end AI career copilot comprising 15 capability phases:
1. **Phase 1–4:** Local development setup, schema foundation, candidate profile engine, resume parser, and basic endpoints.
2. **Phase 5:** Deterministic Candidate-Job Matching Engine with configurable weighting and evidence citation.
3. **Phase 6:** Zero-Hallucination LaTeX Resume Tailoring Agent with AST fact-grounding validator.
4. **Phase 7:** Isolated LaTeX Compilation Service with secure sandbox container and PDF rendering.
5. **Phase 8:** Modular Job Discovery architecture with URL ingestion, deduplication hash, and search filters.
6. **Phase 9:** Referral Discovery Engine with transparent relationship scoring and contact management.
7. **Phase 10:** Human-in-the-Loop Referral Outreach Agent for LinkedIn & Email message generation.
8. **Phase 11:** Full Application CRM Pipeline with Kanban board and next action follow-up scheduling.
9. **Phase 12:** Interview Preparation Agent with question kits and turn-by-turn interactive mock interviewer.
10. **Phase 13:** Career Skill Gap Agent with market readiness scoring and targeted 3-phase roadmaps.
11. **Phase 14:** GitHub Career Analyzer with truthful repository proof extraction and non-fabricating resume bullets.
12. **Phase 15:** Main CareerPilot Unified Command Center Dashboard with 10 core sections and end-to-end flow stepper.

### Automated Testing & Backend Verification
- **Automated Test Suite:** 60 of 60 tests passing (`.venv/bin/pytest backend/tests/ -v`).
- **Database Resilience:** SQLAlchemy async engine supports PostgreSQL with `pgvector` HNSW indexes and automatically falls back to SQLite (`data/careerpilot_dev.db`) in local development environments.
- **REST Endpoints:** Dual-mounted at both `/api/...` and `/api/v1/...`.

---

## 2. What Currently Works

### A. Backend & Core AI Agents
- **Deterministic Match Engine (`/api/jobs/{id}/match`):** Grounded scoring rubric (35% required skills, 25% semantic similarity, 15% experience, 15% projects, 10% education) with cited candidate evidence.
- **Fact-Grounded Resume Tailoring (`/api/resume/tailor/{job_id}`):** Synthesizes LaTeX resumes grounded strictly in verified profile facts; AST validator catches any fabricated metrics or technologies.
- **LaTeX Compilation (`/api/resumes/{id}/compile`):** Subprocess-isolated compilation with security flags (`-no-shell-escape`), execution timeouts, and PDF generation.
- **Job Discovery & Ingestion (`/api/jobs`, `/api/jobs/import-url`):** URL normalization, duplicate hash computation, active/expired tracking, and career page parsing.
- **Referral Discovery & Contacts (`/api/jobs/{id}/referrals`, `/api/contacts`):** Sourcing connections based on shared alumni status, company history, and domain fit.
- **Human-in-the-Loop Outreach (`/api/outreach`):** Transparent review cycle (`NEEDS_REVIEW` → `APPROVED` / `REJECTED` / `SENT`). No automated or unsolicited spamming.
- **Application CRM (`/api/applications`, `/api/applications/kanban`):** Full stage management with drag-friendly API endpoints and follow-up scheduling.
- **Interview Preparation & Mock Interviewer (`/api/interview`):** Generates job-specific technical, behavioral, project, and company questions; handles turn-by-turn simulation with multi-attribute rubrics.
- **Career Skill Gap Agent (`/api/career/skill-gaps`):** Guardrailed gap analysis ensuring skills already present in the candidate profile are never flagged as missing.
- **GitHub Career Analyzer (`/api/github/analyze`):** Authentic GitHub repository proof extraction without hallucination.
- **Dashboard Summary API (`/api/dashboard`):** Aggregation of all pipeline counts and recent activities.

---

## 3. What Partially Works

1. **Resume Workspace:**
   - Users can upload resumes and view individual tailored versions at `/resumes/[versionId]`, but there was no top-level `/resumes` workspace allowing management of Master Resumes, listing all tailored versions, and conducting side-by-side visual diffs.
2. **Referral Workspace:**
   - Referrals were tightly bound to specific job matches (`/jobs/[jobId]/referrals`), leaving no global contact directory or standalone `/referrals` workspace.
3. **Insights & Analytics:**
   - Skill gaps were located at `/career/skill-gaps` and GitHub intelligence was at `/github`, but there was no unified `/insights` dashboard aggregating both market demand and verified code evidence.
4. **Navigation Scroll States:**
   - Nav bar lacked dynamic translucent glass backdrop blur and scroll transitions.

---

## 4. What Was Broken or Missing

1. **Missing Top-Level Frontend Pages:**
   - `/resumes`: Missing! Navigating here produced a 404 error.
   - `/referrals`: Missing! Navigating here produced a 404 error.
   - `/insights`: Missing! Navigating here produced a 404 error.
   - `/settings`: Missing! The header linked to `/settings`, but no page existed.
2. **Broken Route in `/resumes/[versionId]`:**
   - Line 55 performed raw `fetch` concatenating `BASE_HOST` (`.../api/v1`) with `/api/resumes/versions/...`, causing a doubled prefix (`/api/v1/api/resumes/...`) and a 404 network failure.
3. **Missing Resume Version Listing Endpoint:**
   - The backend had endpoints for getting a single version by ID and the latest version by Job ID, but lacked `GET /api/resume/versions` to list all generated versions for the workspace.
4. **Visual Disconnect (Dark Clutter vs. White Background):**
   - The global layout declared a crisp white background (`bg-white text-slate-900`), but numerous pages (`page.tsx`, `outreach/page.tsx`, `github/page.tsx`, `applications/page.tsx`, `jobs/page.tsx`, `interview/page.tsx`) still used hardcoded legacy dark-theme classes (`text-white`, `bg-slate-950`, `border-slate-800`, heavy neon badges, and intense purple/blue gradients). This caused severe contrast and aesthetic issues.

---

## 5. Detailed Problem Analysis

### A. Frontend Problems
- **Dark Theme Incoherence:** High contrast white text on light backgrounds or dark boxes nested inside white pages created visual fatigue.
- **Inconsistent Component Primitives:** Differing button sizes, card borders, and badge colors scattered across pages rather than using a single unified design system.
- **Missing Loading & Empty States:** Several data tables lacked consistent skeleton loaders or actionable empty states when no records existed.
- **Scroll & Transition Aesthetics:** Static page transitions lacking modern micro-interactions, smooth reveals, and backdrop-blur headers.

### B. Backend & API Observations
- All 60 pytest tests pass cleanly.
- Dual endpoint mounting (`/api/...` and `/api/v1/...`) ensures broad client compatibility.
- Needs the addition of `list_versions` to `ResumeTailorService` and `GET /api/resume/versions` + `GET /api/resumes/versions` route handlers.

### C. UX & Information Architecture
- The main flow lacked seamless interconnectedness between stages (e.g. going from a matched job directly to tailoring, finding referrals, or launching a mock interview).
- Application Tracker lacked quick toggle between Kanban board and dense list views.

---

## 6. Action Plan & Architectural Fixes

1. **Backend Extension:**
   - Add `list_versions` method to `ResumeTailorService`.
   - Mount `GET /api/resume/versions` and `GET /api/resumes/versions` in `backend/app/api/v1/resume.py`.
   - Update `frontend/lib/api.ts` with `fetchResumeVersionsApi` and `fetchResumeDocumentsApi`.
2. **Design System & Components:**
   - Expand `frontend/components/ui/` with `Metric`, `JobCard`, `Drawer`, `Select`, `Table`, `Timeline`, `Progress`, and `Toast`.
   - Standardize all existing components to use the pure white, off-white (`#fafafa` / `#f8fafc`), charcoal text (`#0f172a`), and subtle gray border (`#e2e8f0`) design system inspired by TryRote.
3. **Frontend Page Redesign & Creation:**
   - **Dashboard (`/`):** Complete redesign featuring "CAREERPILOT: Your AI copilot for the entire job search.", visual 10-step career progression flow, high-level metrics, and calm recruiter-ready cards.
   - **Job Discovery (`/jobs`):** Sourced jobs search, filters, rich cards, and clean 7-step Job Detail Experience (`/jobs/[jobId]`).
   - **Resume Workspace (`/resumes` & `/resumes/[versionId]`):** Master Resume management, tailored versions grid, AST diff viewer, and PDF compilation runner.
   - **Referral Workspace (`/referrals`):** Standalone contact CRM, relationship scoring, and 1-click outreach drafting.
   - **Application CRM (`/applications`):** Kanban board and dense list views, stage transitions, and follow-up tracking.
   - **Interview Prep (`/interview`):** AI question banks, study topics, and turn-by-turn interactive mock interview simulator.
   - **Insights & Skill Gaps (`/insights`):** Verified skills, market demand, bridge projects, and GitHub repository proof.
   - **Settings (`/settings`):** System health, environment configuration, and model preferences.
4. **Verification:**
   - Re-run full test suite (`pytest`).
   - Run production build (`next build`).
   - Browser QA via visual inspection.

---

### D. Next.js Runtime Recovery & Build Artifact Synchronization (Resolution of './682.js')
- **Symptom**: User encountered `Error: Cannot find module './682.js'` inside `frontend/.next/server/webpack-runtime.js` when accessing `http://localhost:3000`.
- **Root Cause**: Desynchronization between an existing background `next dev` server process and newly generated production build artifacts. Running `npm run build` wiped and replaced `.next` with production chunk manifests while the active dev process was still serving requests using in-memory dev chunk references (dev chunk `682.js`).
- **Exact Fix Applied**:
  1. Identified and safely terminated the stale `next dev` development process (`PID 71139`).
  2. Removed stale and mixed build artifacts (`rm -rf frontend/.next`).
  3. Verified package consistency (`npm ls next react react-dom` confirmed clean `next@14.2.5`, `react@18.3.1`, `react-dom@18.3.1` without duplicates).
  4. Executed clean production build (`npm run build`), generating fresh static and dynamic manifests.
  5. Started Next.js production server via `npm run start -- -H 127.0.0.1 -p 3000`.
  6. Verified that all 18 routes, including dynamic routes (`/jobs/1`, `/resumes/1`, `/jobs/1/referrals`), load with HTTP 200 and zero runtime errors.

### E. Backend Endpoints & Test Suite
- **Pytest Results**: **60 passed, 0 failed** in 2.85s (`.venv/bin/pytest backend/tests/ -v`).
- **Health Probes**: Root `/health` endpoint mounted at `http://localhost:8000/health`, `/api/health`, and `/api/v1/health` all returning HTTP 200 `{"status": "healthy"}`.
- **Interview Service**: Resolved `MultipleResultsFound` exception in `get_or_create_prep_kit` by safely selecting the primary tailored resume version via `.scalars().first()`.
