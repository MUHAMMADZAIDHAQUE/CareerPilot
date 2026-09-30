# CareerPilot AI — n8n Orchestration Architecture & Setup

## 1. Overview & Purpose

**n8n** serves as the **automation and orchestration layer** for CareerPilot AI.
In this architecture:
- **FastAPI remains the sole SOURCE OF TRUTH**: All state, database models, business logic, authentication, and core AI processing live strictly inside FastAPI.
- **n8n is an event orchestrator only**: n8n listens for lifecycle events dispatched from FastAPI (e.g., application status updates, scheduled task triggers, notification workflows) and handles external integration pipelines.
- **Zero Business Logic in n8n**: Workflows never bypass the FastAPI API layer or mutate databases directly.

```
                    ┌─────────────────────────┐
                    │   CareerPilot Next.js   │
                    │      Frontend (:3000)   │
                    └────────────┬────────────┘
                                 │ HTTP
                                 ▼
                    ┌─────────────────────────┐
                    │    FastAPI Backend      │ ◄─── Single Source of Truth
                    │        (:8000)          │
                    └────────────┬────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
                 ▼                               ▼
      ┌──────────────────────┐        ┌──────────────────────┐
      │  PostgreSQL/SQLite   │        │   n8n Community Ed.  │
      │  & AI Agents / LLMs  │        │       (:5678)        │
      └──────────────────────┘        └──────────┬───────────┘
                                                 │
                                                 ▼
                                      External Orchestrations
                                      (Drafts, Alerts, HITL)
```

---

## 2. Why Free Self-Hosted Community Edition?

1. **Zero Cloud Dependencies**: No reliance on n8n Cloud or 15-day trial licenses. It is 100% free, forever-open Community Edition.
2. **Local Privacy & Zero Data Exfiltration**: Career candidate resumes, personal emails, match scores, and application data remain strictly local on your machine.
3. **Reproducibility & Stability**: Workflows and state are persisted locally under project-controlled storage.

---

## 3. Storage & Persistence Architecture

All n8n runtime configuration, workflow definitions, credentials, and execution logs persist in:
```
CareerPilot/data/n8n/.n8n/database.sqlite
```
- **Directory Structure**:
  ```
  CareerPilot/
  ├── data/
  │   └── n8n/
  │       └── .n8n/
  │           ├── config
  │           └── database.sqlite      <-- SQLite persistent database (~1.5 MB)
  ├── workflows/
  │   ├── health_check_workflow.json   <-- Versioned workflow definitions
  │   └── webhook_test_workflow.json
  └── scripts/
      └── start_n8n.sh                 <-- Automated launcher
  ```
- **Survives Restarts**: Stopping and restarting the process retains all installed workflows, execution histories, and settings.
- **Git Safety**: The `data/n8n/` directory and `.n8n/` paths are excluded in `.gitignore` to prevent committing runtime states or local secrets.

---

## 4. How to Start & Stop n8n

### Starting n8n Locally
Run the self-hosted launcher script from the project root:
```bash
./scripts/start_n8n.sh
```
Or via npm/npx:
```bash
N8N_USER_FOLDER="$(pwd)/data/n8n" N8N_PORT=5678 node /Users/zaidhaque/.npm/_npx/a8a7eec953f1f314/node_modules/n8n/bin/n8n start
```

### Stopping n8n
If running in the foreground:
Press `Ctrl+C`.

If running as a background service:
```bash
pkill -f "node.*n8n.*start"
```

---

## 5. Docker Compose Service

For environments with Docker installed, n8n is pre-configured in `docker-compose.yml`:

```yaml
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: careerpilot-n8n
    restart: unless-stopped
    ports:
      - "${N8N_PORT:-5678}:5678"
    environment:
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://localhost:5678/
      - N8N_DEFAULT_BINARY_DATA_MODE=filesystem
      - N8N_DIAGNOSTICS_ENABLED=false
      - N8N_VERSION_NOTIFICATIONS_ENABLED=false
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - careerpilot-network
    depends_on:
      backend:
        condition: service_healthy
```

Volume:
```yaml
volumes:
  n8n_data:
    driver: local
```

---

## 6. URLs & Access Points

| Component | URL | Description |
| :--- | :--- | :--- |
| **n8n Web UI** | `http://localhost:5678` | n8n Visual Workflow Canvas & Management |
| **n8n Health** | `http://localhost:5678/healthz` | System health probe (returns `{"status":"ok"}`) |
| **CareerPilot Webhook** | `http://localhost:5678/webhook/careerpilot-test` | Verified test webhook endpoint |
| **CareerPilot Health Workflow**| `http://localhost:5678/webhook/careerpilot-health-check` | Workflow that queries FastAPI `/health` |
| **FastAPI Backend Health** | `http://localhost:8000/health` | CareerPilot core backend health |
| **FastAPI n8n Status API** | `http://localhost:8000/api/v1/n8n/status` | FastAPI status check against n8n |
| **FastAPI n8n Dispatch Test** | `http://localhost:8000/api/v1/n8n/dispatch-test` | Triggers test webhook from FastAPI |

---

## 7. CareerPilot ↔ n8n Connection Architecture

### FastAPI Client Service (`backend/app/services/n8n.py`)
Provides methods:
- `N8nService.check_health()`: Pings `http://localhost:5678/healthz`.
- `N8nService.dispatch_event(event_name, payload, webhook_path)`: Sends JSON to n8n webhook with header `X-CareerPilot-Event` and optional secret signing.
- `N8nService.enforce_hitl_guardrail(action, human_approved, approver_id)`: Enforces strict safety rules.
- `N8nService.verify_webhook_secret(header_secret)`: Validates incoming webhook authenticity.

### Webhook Verification Flow
1. **Health Verification Workflow (`CPHealthCheck001`)**:
   `Trigger` ➔ `HTTP Request (http://127.0.0.1:8000/health)` ➔ `Success Response`.
   Verified via:
   ```bash
   curl http://localhost:5678/webhook/careerpilot-health-check
   ```
2. **Event Dispatch Workflow (`CPWebhookTest001`)**:
   `POST /webhook/careerpilot-test` ➔ `Receive JSON` ➔ `Return Acknowledged JSON`.
   Verified via:
   ```bash
   curl -X POST http://localhost:8000/api/v1/n8n/dispatch-test
   ```

---

## 8. Environment Variables

Configured in `.env` and documented in `.env.example`:

```bash
# n8n Community Edition Local Orchestration
N8N_ENABLED=true
N8N_PORT=5678
N8N_BASE_URL=http://localhost:5678
N8N_WEBHOOK_BASE_URL=http://localhost:5678/webhook
N8N_WEBHOOK_SECRET=cp_n8n_local_webhook_secret_dev
```

---

## 9. Security & Safety (HITL Guardrails)

### Zero Public Exposure
- Binds strictly to `127.0.0.1` / `localhost`.
- No ngrok, cloud tunneling, or external exposure is configured.

### Secret Isolation
- All secrets are loaded through environment variables.
- Production/real secrets must never be placed in `.env.example` or git.

### Strict HITL (Human-in-the-Loop) Guardrails
Under **Rule 11**, n8n must **NEVER** autonomously:
- Submit job applications
- Send LinkedIn messages
- Send referral requests
- Dispatch cold emails

The enforced architectural flow is strictly:
```
Automation Trigger ➔ Prepare Draft ➔ Notify Candidate ➔ Explicit Human Approval ➔ Dispatch
```
Any incoming request targeting protected actions without `human_approved=True` is rejected immediately by `backend/app/services/n8n.py` with HTTP 403 / `REJECTED_HITL_REQUIRED`.
