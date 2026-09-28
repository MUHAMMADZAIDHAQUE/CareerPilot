# CareerPilot AI — Engineering Roadmap & Phase Breakdown

**Version:** 1.0.0  
**Status:** Active Execution Plan  
**Strategy:** Incremental, Test-Driven, Multi-Phase Rollout  

---

## 🗺️ High-Level Phase Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 0: Architecture, Docs & Repository Foundations (Current)         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Core Foundation, Data Layer & Candidate Profile Ingestion     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Job Description Ingestion, Parsing & Hybrid Matching Engine   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 3: Zero-Hallucination Resume Tailoring & LaTeX/PDF Pipeline       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 4: Referral Discovery, Outreach Generation & HITL Review Hub     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 5: Application Tracking & Tailored Interview Prep Copilot        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 6: Skill Gap Analytics, Learning Paths & n8n Automation Engine   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 7: Production Hardening, CI/CD, Observability & Performance      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📌 Phase 0: Architecture, Documentation & Repository Scaffolding (Current)

**Goal:** Establish the foundational architecture, standards, schemas, and blueprints before writing business logic.

- [x] Create project repository structure and workspace layout.
- [x] Create `/docs/architecture.md` (Clean Architecture, LangGraph multi-agent design, data modeling).
- [x] Create `/docs/roadmap.md` (Detailed phase-by-phase implementation plan).
- [x] Create `/docs/decisions.md` (Architecture Decision Records).
- [x] Create comprehensive `README.md` and `.env.example`.
- [x] Establish strict anti-hallucination and safety boundary policies.

---

## 📌 Phase 1: Core Foundation, Data Layer & Candidate Profile Ingestion

**Goal:** Build the backend and database layer to ingest, parse, validate, and store candidate profiles and original LaTeX resume templates.

### Key Deliverables:
1. **Infrastructure & Database:**
   - Docker Compose configuration (`postgres:16` with `pgvector` extension enabled).
   - SQLAlchemy 2.0 Async Session management + Alembic migration framework.
   - Pydantic v2 core schemas for Candidate, Experience, Projects, Skills, and Resume Templates.
2. **FastAPI Backend Skeleton:**
   - Modular Clean Architecture folder structure (`app/api`, `app/domain`, `app/services`, `app/infrastructure`).
   - CORS, Request ID tracking, structured logging (`structlog` / `loguru`), unified exception handlers.
   - Health check endpoints (`/healthz`, `/readyz`).
3. **Candidate Ingestion Engine:**
   - Ingestion of structured profile (JSON/YAML) and original LaTeX resume files.
   - Parser service to extract AST nodes from LaTeX (sections, experiences, bullet items, skill lists).
   - Embedding generation for candidate experience bullets via pgvector.
4. **Testing & Quality:**
   - Pytest suite covering database transactions, repository operations, and LaTeX parsing AST.

---

## 📌 Phase 2: Job Description Ingestion, Parsing & Hybrid Matching Engine

**Goal:** Parse incoming job descriptions, extract structured requirements, perform hybrid semantic + structured matching against candidate profiles, and provide explainable match scores with evidence.

### Key Deliverables:
1. **Job Ingestion & Parsing:**
   - Endpoints for raw JD ingestion (text, URL, or structured JSON).
   - LLM structured extraction (Role, Company, Must-Have Skills, Nice-To-Have Skills, Experience Years, Key Responsibilities).
2. **Hybrid Matching Subsystem:**
   - **Structured Rule Matcher:** Exact and synonym skill matching, experience tenure comparison, education match.
   - **Semantic Matcher:** Dense vector cosine similarity search via pgvector on parsed JD vs Candidate experience chunks.
   - **Composite Match Scoring:** Weighted aggregate score (0–100%) with confidence interval.
3. **Explainable Match & Evidence Citations:**
   - Generation of structured match breakdown:
     - Strengths (Why the candidate is a strong fit).
     - Missing skills / Critical gaps.
     - Direct evidence references (matching JD requirement $\leftrightarrow$ candidate experience bullet).
4. **Testing:**
   - Benchmark test suite with synthetic JDs and profiles to validate match accuracy and deterministic score repeatability.

---

## 📌 Phase 3: Zero-Hallucination Resume Tailoring & LaTeX/PDF Compilation Pipeline

**Goal:** Implement the LangGraph resume tailoring multi-agent workflow with strict anti-hallucination verification and automated LaTeX-to-PDF compilation.

### Key Deliverables:
1. **LangGraph Resume Tailoring Graph:**
   - Nodes: Requirements Analyst $\rightarrow$ Strategy Planner $\rightarrow$ LaTeX Bullet Rewriter $\rightarrow$ Fact Grounding Validator $\rightarrow$ Diff Generator.
   - State management with fallback loops if unverified claims or linting errors occur.
2. **Strict Anti-Hallucination & Grounding Guard:**
   - AST comparison between original candidate facts and generated LaTeX.
   - Deterministic verification: Zero new company names, zero fabricated metrics, zero invented technologies, zero altered graduation dates.
3. **LaTeX / PDF Compilation Service:**
   - Sandboxed compilation engine (Tectonic / TeXLive container).
   - Artifact management: PDF binary generation, side-by-side diff preview metadata, download endpoints.
4. **Human Review & Checkpoint:**
   - Resume preview and approval endpoints (`/api/v1/resumes/{id}/approve`, `/reject`).

---

## 📌 Phase 4: Referral Discovery, Outreach Generation & HITL Review Hub

**Goal:** Enable safe, ethical discovery of potential referral opportunities and generate personalized outreach drafts with strict human-in-the-loop approval.

### Key Deliverables:
1. **Authorized Referral Discovery:**
   - Permitted contact ingestion (user-provided contacts, company public team pages, authorized API integrations).
   - Mutual connection / alumni matching algorithms based on candidate's university/prior companies.
2. **Personalized Outreach Drafter:**
   - Generation of contextual referral inquiry emails and LinkedIn connection notes.
   - Tailored to recipient's role, candidate's background, and specific job posting.
3. **HITL Review & Dispatch Guard:**
   - Mandatory human approval gate (`DRAFT` $\rightarrow$ `APPROVED` $\rightarrow$ `DISPATCHED`).
   - One-click copy for LinkedIn, or optional authenticated SMTP/OAuth sending for email.
   - Audit trail of all generated communications.

---

## 📌 Phase 5: Application Tracking & Tailored Interview Prep Copilot

**Goal:** Build a complete Kanban application tracking board and an interview preparation copilot tailored to the specific JD and tailored resume.

### Key Deliverables:
1. **Application Lifecycle Tracking:**
   - Kanban state machine: `WISHLIST` $\rightarrow$ `MATCHED` $\rightarrow$ `TAILORED` $\rightarrow$ `APPLIED` $\rightarrow$ `INTERVIEWING` $\rightarrow$ `OFFER` / `REJECTED`.
   - Activity timeline, deadline reminders, and contact association.
2. **Tailored Interview Prep Copilot:**
   - Generation of targeted interview prep packs:
     - **Behavioral Questions:** STAR method guidance using candidate's real verified experiences.
     - **Technical Deep-Dives:** Probing questions on tech stack items present in both JD and resume.
     - **Role-Specific Scenarios & System Design:** Custom architectural prompts based on JD scope.
     - **Reverse Questions:** Intelligent questions for the candidate to ask the interviewer.

---

## 📌 Phase 6: Skill Gap Analytics, Learning Recommendations & n8n Scheduled Automations

**Goal:** Analyze recurring skill gaps across multiple target jobs, generate personalized upskilling roadmaps, and integrate n8n for scheduled workflows.

### Key Deliverables:
1. **Aggregated Skill Gap Analytics:**
   - Cross-job market demand heatmap for target roles.
   - Identification of high-ROI skills to learn.
   - Curated project suggestions to bridge real experience gaps.
2. **n8n Automation Integration:**
   - Scheduled recurring workflows (e.g., daily check for matching roles in saved target companies).
   - Webhook triggers connecting n8n alerts to CareerPilot ingestion API.
   - Notification dispatch (Slack/Discord/Email alerts on high-match jobs > 85%).

---

## 📌 Phase 7: Production Hardening, Testing, Security & Observability

**Goal:** Complete end-to-end testing, security audits, container optimization, and observability telemetry for production deployment.

### Key Deliverables:
1. **Comprehensive Test Suite:**
   - 90%+ backend unit test coverage.
   - End-to-end integration tests using Dockerized test databases.
2. **Observability & Tracing:**
   - LangSmith / Langfuse tracing for all agent executions.
   - Prometheus metrics and Grafana dashboards for API latencies, token consumption, and compilation times.
3. **Deployment Ready Scenarios:**
   - Production Dockerfiles, reverse proxy (Caddy/Nginx) configuration, and CI/CD pipelines (GitHub Actions).
