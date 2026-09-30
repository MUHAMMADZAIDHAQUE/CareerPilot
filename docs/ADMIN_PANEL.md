# CareerPilot Admin Panel & Role-Based Governance System

## 1. Executive Summary & Security Model
CareerPilot enforces a strict, cryptographically verified backend authorization boundary for all administrative functionalities.
Administrative identity is **NEVER** determined by:
- Frontend email string comparison
- Hardcoded user IDs or emails in JavaScript client bundles
- LocalStorage flags or URL parameters
- Secret client environment variables

Instead, administrative governance is enforced by **Authenticated JWT Claims + Database Verified `ADMIN` Role** via FastAPI dependency injection:
```python
# backend/app/api/deps.py
async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required. Access denied.",
        )
    return current_user
```

When a standard candidate attempts to access any `/api/v1/admin/*` endpoint or route, the backend immediately halts execution and returns `HTTP 403 Forbidden`.

---

## 2. Admin API Endpoints

All admin endpoints reside under the `/api/v1/admin` prefix and require `Depends(get_current_admin)`:

| Method | Endpoint | Description | Query Parameters | Response Model |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/dashboard` | Aggregated KPI counts across 8 core domain tables | None | `AdminDashboardKPI` |
| `GET` | `/api/v1/admin/users` | List user accounts, roles, statuses, and candidate links | `search`, `role`, `limit`, `offset` | `List[UserProfile]` |
| `PATCH` | `/api/v1/admin/users/{user_id}/status` | Activate/suspend user or toggle ADMIN/CANDIDATE role | Path: `user_id` | `UserProfile` |
| `GET` | `/api/v1/admin/candidates` | Inspect real candidate profiles, resume counts, and applications | `search`, `limit`, `offset` | `List[AdminCandidateItem]` |
| `GET` | `/api/v1/admin/jobs` | Inspect active job catalog, source ATS, location, and applicant counts | `search`, `source`, `limit`, `offset` | `List[AdminJobItem]` |
| `GET` | `/api/v1/admin/applications` | Review CRM applications across all 16 Kanban lifecycle stages | `status`, `limit`, `offset` | `List[AdminApplicationItem]` |
| `GET` | `/api/v1/admin/resumes` | Inspect uploaded resume documents and tailored LaTeX versions | `limit`, `offset` | `List[AdminResumeItem]` |
| `GET` | `/api/v1/admin/referrals` | Review referral outreach drafts, channels, and risk scores | `status`, `limit`, `offset` | `List[AdminReferralItem]` |
| `GET` | `/api/v1/admin/interviews` | Inspect mock interview sessions, turn counts, and overall scores | `limit`, `offset` | `List[AdminInterviewItem]` |
| `GET` | `/api/v1/admin/audit-logs` | Immutable security and outreach dispatch event ledger | `limit` | `List[AuditLogEvent]` |

---

## 3. Frontend Architecture (`/admin`)

The Admin area is hosted at `/admin` (`frontend/app/admin/page.tsx`) and is completely segregated from candidate views:
1. **Header & Navigation Isolation**:
   - The `/admin` button in the header is guarded by `isAdmin`: `{isAdmin && (<Link href="/admin">Admin</Link>)}`.
   - Normal candidates never see admin options in desktop navigation or mobile menus.
2. **Access-Denied Screen**:
   - If a non-admin directly navigates to `/admin`, the page checks `!isAdmin` and immediately renders a secure locked screen ("Administrator Access Required").
3. **11 Dedicated Oversight Tabs**:
   - **Overview**: High-level real-time KPI metrics and infrastructure connectivity status.
   - **Users**: Account search, status toggles (Suspend/Activate), role toggles (Demote/Promote).
   - **Candidates**: Profile inspect, resume counts, and application statistics.
   - **Job Catalog**: Real jobs catalog oversight with source ATS identification.
   - **Applications CRM**: Full applicant tracking oversight across 16 stages.
   - **Resumes**: Uploaded master documents and generated tailored LaTeX versions.
   - **Referrals & Outreach**: Discovered contacts, generated AI drafts, and risk analysis.
   - **Mock Interviews**: Interactive interview sessions, question turns, and evaluated scores.
   - **System Health**: FastAPI, Supabase PostgreSQL, pgvector, and n8n status.
   - **100+ ATS Pipeline**: Manual dispatcher for Greenhouse, Lever, and RSS boards.
   - **Security Audit Ledger**: Timestamped immutable log of governance actions.

---

## 4. Real Data Enforcement & Empty States
In accordance with Section 47 ("PRODUCTION DATA RULE"):
- Every metric and table row is queried directly from live database tables.
- If a table has 0 records, the UI displays an explicit, clean empty state (e.g., *"No applications recorded yet."*, *"No resume documents uploaded yet."*).
- Zero fake mockups, zero demo fallbacks, and zero synthetic statistics.

---

## 5. Automated Verification & Test Coverage
Automated test suite `backend/tests/test_auth_and_admin.py` verifies:
1. User registration & login generates valid signed JWT.
2. Standard candidate calling `/api/v1/admin/dashboard` $\to$ `403 Forbidden`.
3. Standard candidate calling `/api/v1/admin/candidates` $\to$ `403 Forbidden`.
4. Standard candidate calling `/api/v1/admin/jobs` $\to$ `403 Forbidden`.
5. Standard candidate calling `/api/v1/admin/applications` $\to$ `403 Forbidden`.
6. Standard candidate calling `/api/v1/admin/resumes` $\to$ `403 Forbidden`.
7. Standard candidate calling `/api/v1/admin/referrals` $\to$ `403 Forbidden`.
8. Standard candidate calling `/api/v1/admin/interviews` $\to$ `403 Forbidden`.
9. Admin calling all above endpoints $\to$ `200 OK` with valid data structures.
