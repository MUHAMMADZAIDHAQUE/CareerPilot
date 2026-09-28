# CareerPilot AI — Architecture Decision Records (ADRs)

**Version:** 1.0.0  
**Status:** Approved  
**Standard:** MADR 3.0.0 / Architecture Decision Log  

---

## Index of Architectural Decisions

- [ADR-001: Selection of Clean Architecture with FastAPI and Next.js](#adr-001-selection-of-clean-architecture-with-fastapi-and-nextjs)
- [ADR-002: PostgreSQL with pgvector as Unified Relational and Vector Store](#adr-002-postgresql-with-pgvector-as-unified-relational-and-vector-store)
- [ADR-003: LangGraph for Multi-Agent Orchestration, State Persistence & HITL](#adr-003-langgraph-for-multi-agent-orchestration-state-persistence--hitl)
- [ADR-004: Zero-Hallucination & Fact-Grounding Verification Subsystem](#adr-004-zero-hallucination--fact-grounding-verification-subsystem)
- [ADR-005: LaTeX Compilation Strategy via Isolated Tectonic/TeXLive Engine](#adr-005-latex-compilation-strategy-via-isolated-tectonictexlive-engine)
- [ADR-006: Ethical Outreach Policy and Mandatory Human Approval Gate](#adr-006-ethical-outreach-policy-and-mandatory-human-approval-gate)
- [ADR-007: n8n Integration for Asynchronous and Scheduled Workflow Automation](#adr-007-n8n-integration-for-asynchronous-and-scheduled-workflow-automation)

---

## ADR-001: Selection of Clean Architecture with FastAPI and Next.js

### Context
CareerPilot AI requires a robust backend capable of running complex async LLM pipelines, mathematical matching algorithms, and file compilation, paired with an interactive, responsive frontend for reviewing resume diffs, viewing match score breakdowns, and managing a Kanban board.

### Decision
- **Backend:** Python 3.11+ with **FastAPI** using **Clean Architecture** (Domain, Application Services, Infrastructure Adapters, API Presentation).
- **Frontend:** **Next.js 14+** (React, TypeScript, Tailwind CSS, TanStack Query, Lucide Icons).

### Rationale & Consequences
- **Pros:**
  - Python is the primary ecosystem for LLM orchestration (LangChain, LangGraph, Pydantic, pgvector clients).
  - FastAPI offers native async concurrency, automatic OpenAPI documentation, and high performance.
  - Clean Architecture isolates core business logic and matching math from external frameworks or database drivers.
  - Next.js provides excellent developer experience, server rendering capabilities, and clean modular UI components.
- **Cons:**
  - Managing two language ecosystems (Python backend + TypeScript frontend) requires maintaining clear API contracts via typed Pydantic DTOs and OpenAPI-generated TypeScript types.

---

## ADR-002: PostgreSQL with pgvector as Unified Relational and Vector Store

### Context
The application needs to store relational entities (candidates, applications, interview logs, audit records) as well as vector embeddings for semantic search over job descriptions and experience bullet points.

### Decision
Use **PostgreSQL 16** with the **`pgvector`** extension as the single database for both transactional data and vector indexing (HNSW).

### Rationale & Consequences
- **Pros:**
  - Eliminates the operational complexity, cost, and eventual consistency issues of running a dedicated vector DB (e.g., Pinecone, Milvus, Qdrant) alongside a relational DB.
  - Enables unified ACID transactions: inserting a candidate profile and its vector embeddings in a single atomic commit.
  - pgvector HNSW indexing provides sub-millisecond similarity search at the scale of candidate portfolios and target job postings.
  - Standard backup, replication, and migration workflows (Alembic) apply to both relational tables and vector columns.
- **Cons:**
  - For billion-scale vector indexes, specialized distributed vector DBs may offer higher raw throughput, but for a career copilot with thousands to millions of embeddings, PostgreSQL + pgvector is optimal.

---

## ADR-003: LangGraph for Multi-Agent Orchestration, State Persistence & HITL

### Context
Resume tailoring, match explanation, and interview prep require multi-step reasoning, cyclic refinement loops (e.g., if a claim fails grounding verification), and pausing execution for user review (Human-in-the-Loop).

### Decision
Use **LangGraph** (part of the LangChain ecosystem) to construct cyclic state graphs with explicit checkpointers and validation gates.

### Rationale & Consequences
- **Pros:**
  - LangGraph represents agent execution as a state machine (`StateGraph`), making transitions deterministic, testable, and debuggable.
  - Built-in support for checkpoints (`MemorySaver` or PostgreSQL checkpointing) allows graphs to pause at a review node, yield control to the user interface, and resume seamlessly upon approval.
  - Facilitates structured error recovery: if the anti-hallucination guard catches an ungrounded claim, the graph routes back to the rewriter node with explicit feedback.
- **Cons:**
  - Requires learning graph-state semantics and writing typed state transitions.

---

## ADR-004: Zero-Hallucination & Fact-Grounding Verification Subsystem

### Context
AI resume tailoring carries severe career and ethical risks if an LLM hallucinates unearned skills, inflated metrics, fake certifications, or unverified experiences.

### Decision
Implement a **Strict Zero-Hallucination Policy** enforced by a two-stage verification pipeline:
1. **Prompt-Level Hard Constraints:** Strict instructions disallowing the creation of any new factual entities.
2. **Deterministic AST & Fact-Checking Guard Node:** An independent validator parses the tailored LaTeX, extracts every skill, company, metric, and title, and cross-references them against the candidate's canonical fact database. Any unmatched entity halts compilation and triggers a refinement cycle.

### Rationale & Consequences
- **Pros:**
  - Guarantees 100% truthful resumes that withstand background checks and technical interviews.
  - Protects user reputation and builds trust.
- **Cons:**
  - Rejection of invalid drafts introduces slight LLM latency for refinement loops, which is mitigated through clear prompt design and structured JSON output.

---

## ADR-005: LaTeX Compilation Strategy via Isolated Tectonic/TeXLive Engine

### Context
To produce pristine, ATS-friendly PDF resumes, CareerPilot modifies the candidate's existing LaTeX source code and compiles it into a PDF binary. Direct execution of arbitrary LaTeX code carries security and dependency concerns.

### Decision
Use **Tectonic** (a modern, self-contained, Rust-based XeTeX engine) or a containerized **TeXLive** sandbox to compile LaTeX files into PDFs with strict timeouts and resource limits.

### Rationale & Consequences
- **Pros:**
  - Tectonic downloads required TeX packages automatically on demand without requiring a 5GB+ local TeX distribution.
  - Sandboxed execution prevents command injection or filesystem access vulnerabilities during compilation (`\write18` disabled).
  - Produces standard, vector-crisp, ATS-parsable PDF outputs matching industry standards.
- **Cons:**
  - First-time compilation of rare packages requires internet access to TeX package repositories unless cached in the local Docker image.

---

## ADR-006: Ethical Outreach Policy and Mandatory Human Approval Gate

### Context
Automated scraping and mass messaging on platforms like LinkedIn violate platform terms of service and harm professional relationships.

### Decision
1. **No Automated LinkedIn Scraping or Bot Messaging:** Prohibit unauthorized headless browser automation on LinkedIn.
2. **Authorized Sources Only:** Utilize permitted APIs, public contact directories (e.g., Hunter.io, official public company directories), or user-provided contacts.
3. **Mandatory Human-in-the-Loop (HITL) Gate:** All connection notes, referral requests, and email drafts remain in `DRAFT` status until explicitly reviewed, edited, and approved by the user in the UI.

### Rationale & Consequences
- **Pros:**
  - Full compliance with legal regulations, anti-spam laws (CAN-SPAM / GDPR), and platform terms of service.
  - Ensures every outreach message is personalized, authentic, and human-verified.
- **Cons:**
  - Prevents "one-click blast" automation, which aligns with our core focus on high-quality, targeted referrals rather than low-conversion spam.

---

## ADR-007: n8n Integration for Asynchronous and Scheduled Workflow Automation

### Context
The platform needs to handle background tasks such as periodic checking of authorized job feeds, daily match digests, and scheduled reminders without cluttering core domain code.

### Decision
Integrate **n8n** as an external workflow orchestration engine communicating with CareerPilot's FastAPI backend via authenticated webhooks and REST endpoints.

### Rationale & Consequences
- **Pros:**
  - Decouples scheduled cron jobs and external webhooks from the core application logic.
  - Provides a visual workflow editor to configure custom notification channels (Slack, Telegram, Email, Discord).
  - Easily scalable and self-hostable via Docker Compose.
- **Cons:**
  - Adds one additional Docker service to the ecosystem, which is enabled as an optional module in later phases.
