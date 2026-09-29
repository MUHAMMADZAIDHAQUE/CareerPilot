# 🚀 CareerPilot AI
> **AI-Powered Job Search, Resume Tailoring, Referral & Interview Copilot**

[![Architecture: Clean Architecture](https://img.shields.io/badge/Architecture-Clean%20Architecture-blue.svg)](docs/architecture.md)
[![Backend: FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Frontend: Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black.svg?logo=next.js&logoColor=white)](https://nextjs.org)
[![Database: PostgreSQL + pgvector](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20pgvector-336791.svg?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Orchestration: LangGraph](https://img.shields.io/badge/Orchestration-LangGraph-orange.svg)](https://langchain-ai.github.io/langgraph/)
[![Safety: Zero Hallucination](https://img.shields.io/badge/Safety-Zero%20Hallucination%20Guaranteed-brightgreen.svg)](docs/decisions.md#adr-004-zero-hallucination--fact-grounding-verification-subsystem)
[![Design: TryRote Minimalist](https://img.shields.io/badge/Design-TryRote%20Inspired%20Clean%20White-slate.svg)](docs/design-system.md)

---

## 📖 Overview

**CareerPilot AI** is an enterprise-grade, end-to-end intelligent career assistant that manages the full lifecycle of modern job hunting. It transforms how professionals navigate their job search by combining:

1. **Executive White Minimalist UI:** Complete redesign inspired by [TryRote](https://tryrote.com/) featuring pristine white surfaces, deep charcoal typography, subtle borders, translucent glass navbar, and micro-interactions.
2. **Deep Candidate Understanding:** Ingests structured profiles, projects, skills, GitHub repositories, and existing LaTeX/PDF resumes.
3. **Deterministic & Semantic Matching:** Evaluates job descriptions using deterministic structured rules and dense semantic vector search via `pgvector` with evidence citations.
4. **Strict Zero-Hallucination Resume Tailoring:** Reorganizes, rewords, and emphasizes genuine candidate achievements into customized LaTeX resumes with automated fact-checking that guarantees **zero fabricated claims or metrics**.
5. **Automated LaTeX-to-PDF Compilation:** Generates ATS-compliant PDF resumes with side-by-side diff previews.
6. **Ethical Referral & Outreach Copilot:** Identifies permitted referral opportunities and generates personalized email/LinkedIn connection drafts with mandatory **Human-in-the-Loop (HITL)** approval.
7. **Application Tracker & CRM:** Full dual Kanban (8 stages) and List view with follow-up scheduling.
8. **Interview Co-Pilot:** 5-category interview prep kit and interactive multi-turn AI mock interview simulator.
9. **Market Skill Gap Analytics:** Analyzes recurring market requirements and outputs 3-phase strategic learning roadmaps grounded by GitHub evidence.

---

## 🏛️ System Architecture

```mermaid
flowchart TB
    subgraph Frontend ["Next.js 14 Frontend (TryRote Minimalist)"]
        Dashboard["Dashboard & Progression Pipeline"]
        JobDiscovery["Job Discovery & 7-Section Inspector"]
        TailorStudio["Resume Studio & Visual Diff Viewer"]
        ReferralCRM["Referral Network & Contact Manager"]
        OutreachHub["Outreach Drafter (HITL Approval Gate)"]
        KanbanCRM["Application Tracker (Dual Kanban & List)"]
        InterviewRoom["Interview Simulator & Prep Kit"]
        InsightsHub["Skill Gaps & Strategic Learning Roadmap"]
    end

    subgraph Backend ["FastAPI Backend (Clean Architecture)"]
        APIGateway["FastAPI v1 API Gateway"]
        AuthLayer["JWT Auth & Security Guards"]
        LangGraphEngine["LangGraph Multi-Agent Orchestrator"]
        PDFCompiler["LaTeX Compilation Worker (Tectonic / TeXLive)"]
        MatchingService["Deterministic + Semantic Match Engine"]
    end

    subgraph Storage ["Unified Data Layer"]
        Postgres[("PostgreSQL 16")]
        PgVector["pgvector (HNSW Indexing)"]
        DevSqlite["Dev SQLite Fallback Engine"]
        BlobStore["Object Storage (Source LaTeX & PDFs)"]
    end

    subgraph External ["External Services"]
        LLMs["Multi-Provider LLMs (OpenAI, Anthropic, Gemini)"]
        N8N["n8n Automation Engine"]
    end

    Frontend <--> APIGateway
    APIGateway --> AuthLayer
    AuthLayer --> LangGraphEngine
    LangGraphEngine --> MatchingService
    LangGraphEngine --> PDFCompiler
    MatchingService <--> PgVector
    MatchingService <--> Postgres
    MatchingService <--> DevSqlite
    PDFCompiler --> BlobStore
    LangGraphEngine <--> LLMs
    N8N <--> APIGateway
```

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons, Glassmorphic Backdrop Blur |
| **Backend** | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0 (Async), Alembic |
| **Multi-Agent Orchestration** | LangGraph, LangChain, Structured Output Parsers |
| **Database & Vector Store** | PostgreSQL 16 with `pgvector` extension (with automatic SQLite fallback for dev) |
| **Document Processing** | Tectonic / TeXLive (Sandboxed LaTeX compilation), PyMuPDF / pdfplumber |
| **Automation & Scheduling** | n8n Workflow Automation Engine |
| **Testing & QA** | Pytest, Pytest-Asyncio (60 tests passed), Next.js Typecheck & Production Build |

---

## 🛡️ Non-Negotiable Safety & Integrity Invariants

### 1. Strict Anti-Hallucination Policy (ADR-004)
The resume tailoring and interview agents **NEVER** fabricate:
- ❌ Work experience or previous employers
- ❌ Projects or product initiatives
- ❌ Technologies or programming languages
- ❌ Certifications or licenses
- ❌ Educational degrees or institutions
- ❌ Achievements or quantitative metrics
- ❌ Job titles or promotion timelines

Every output is checked against the candidate's canonical fact records before PDF compilation.

### 2. Mandatory Human-In-The-Loop Approval (ADR-006)
- ❌ No unauthorized scraping or bot credential automation.
- ❌ No automatic transmission of job applications or cold outreach messages.
- ✅ All email and LinkedIn messages are staged as drafts in `NEEDS_REVIEW` until approved by the candidate.

---

## 🚀 Running the Application Locally

### 1. Backend Setup

```bash
# From repository root
cd /Users/zaidhaque/Desktop/CareerPilot

# Activate virtual environment
source .venv/bin/activate

# Install dependencies (if needed)
pip install -r backend/requirements.txt

# Start FastAPI server
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be available at: `http://localhost:8000/docs`

### 2. Frontend Setup

```bash
# From repository root
cd frontend

# Install dependencies (if needed)
npm install

# Start Next.js development server
npm run dev
```
Application will be available at: `http://localhost:3000`

### 3. Production Build & Verification

```bash
# Verify all 60 backend unit & integration tests
.venv/bin/pytest backend/tests/ -v

# Verify frontend production build
cd frontend
npm run build
```

---

## 📚 Documentation Index

- [Full Project Audit Report](docs/full-project-audit.md)
- [Design System & UI Specification](docs/design-system.md)
- [System Architecture](docs/architecture.md)
- [Testing & Quality Assurance Guide](docs/testing.md)
- [Architecture Decision Records (ADRs)](docs/decisions.md)
- [Implementation Roadmap](docs/roadmap.md)
