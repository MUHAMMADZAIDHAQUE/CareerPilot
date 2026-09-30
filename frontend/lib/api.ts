export interface DatabaseHealth {
  status: "connected" | "disconnected" | "degraded";
  pgvector_enabled: boolean;
  error?: string | null;
}

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  environment: string;
  version: string;
  timestamp: string;
  database: DatabaseHealth;
  services: Record<string, string>;
}

export interface Skill {
  id?: string;
  candidate_id?: string;
  name: string;
  category: string;
  proficiency_level?: string | null;
  years_of_experience?: number | null;
  created_at?: string;
}

export interface Experience {
  id?: string;
  candidate_id?: string;
  company: string;
  role: string;
  location?: string | null;
  start_date: string;
  end_date?: string | null;
  is_current: boolean;
  bullet_points: string[];
  technologies_used: string[];
  created_at?: string;
}

export interface Education {
  id?: string;
  candidate_id?: string;
  institution: string;
  degree: string;
  field_of_study?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  gpa?: string | null;
  honors?: string[];
  coursework?: string[];
  created_at?: string;
}

export interface Project {
  id?: string;
  candidate_id?: string;
  title: string;
  description?: string | null;
  technologies: string[];
  repo_url?: string | null;
  live_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  bullet_points?: string[];
  created_at?: string;
}

export interface Certification {
  id?: string;
  candidate_id?: string;
  name: string;
  issuing_organization: string;
  issue_date?: string | null;
  expiration_date?: string | null;
  credential_id?: string | null;
  credential_url?: string | null;
}

export interface Achievement {
  id?: string;
  candidate_id?: string;
  title: string;
  description?: string | null;
  date?: string | null;
  issuer?: string | null;
}

export interface CareerPreference {
  id?: string;
  candidate_id?: string;
  preferred_roles: string[];
  preferred_locations: string[];
  work_mode: string;
  preferred_employment_type: string;
  target_salary_min?: number | null;
  target_salary_max?: number | null;
  currency: string;
}

export interface Candidate {
  id: string;
  full_name: string;
  email: string;
  headline?: string | null;
  summary?: string | null;
  location?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  created_at: string;
  updated_at: string;
  skills: Skill[];
  experiences: Experience[];
  education: Education[];
  projects: Project[];
  certifications: Certification[];
  achievements: Achievement[];
  career_preference?: CareerPreference | null;
}

export interface ResumeUploadResult {
  document_id: string;
  filename: string;
  file_type: string;
  storage_path: string;
  extracted_text: string;
  structured_candidate_data: {
    full_name: string;
    email: string;
    headline?: string;
    summary?: string;
    location?: string;
    phone?: string;
    linkedin_url?: string;
    github_url?: string;
    portfolio_url?: string;
    skills: Skill[];
    experience: Experience[];
    education: Education[];
    projects: Project[];
    certifications: Certification[];
    achievements: Achievement[];
    career_preference?: CareerPreference;
  };
  is_latex: boolean;
  master_template_saved: boolean;
  message: string;
}

export interface ApiFetchResult<T> {
  data: T | null;
  error: string | null;
  latencyMs: number;
}

export function getBaseHost(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  // If running in browser:
  if (typeof window !== "undefined" && window.location?.origin) {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!isLocalhost) {
      // In production browser, if envUrl is a valid external absolute HTTPS backend, use it
      if (
        envUrl &&
        envUrl.startsWith("https://") &&
        !envUrl.includes("localhost") &&
        !envUrl.includes("127.0.0.1")
      ) {
        return envUrl.replace(/\/api\/v1\/?$/, "").replace(/\/api\/?$/, "").replace(/\/+$/, "");
      }
      // Otherwise, use current origin (which hits Next.js /api rewrites)
      return window.location.origin.replace(/\/+$/, "");
    }
  }

  // If explicitly configured with an absolute URL
  if (envUrl && envUrl.startsWith("http")) {
    return envUrl.replace(/\/api\/v1\/?$/, "").replace(/\/api\/?$/, "").replace(/\/+$/, "");
  }

  // Browser fallback
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  // Server-side (Node.js SSR) fallback
  const internal = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL;
  if (internal && internal.startsWith("http")) {
    return internal.replace(/\/api\/v1\/?$/, "").replace(/\/api\/?$/, "").replace(/\/+$/, "");
  }

  return "http://127.0.0.1:8000";
}

export function buildApiUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  const base = getBaseHost();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const baseForUrl = (base && base.startsWith("http"))
    ? base
    : (typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "http://127.0.0.1:8000");

  const url = new URL(cleanPath, baseForUrl);

  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        url.searchParams.append(key, String(val));
      }
    });
  }

  return url.toString();
}

const BASE_HOST = {
  toString: () => getBaseHost(),
  valueOf: () => getBaseHost(),
  [Symbol.toPrimitive]: () => getBaseHost(),
} as unknown as string;

export async function fetchHealth(): Promise<ApiFetchResult<HealthResponse>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/health`, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      return {
        data: null,
        error: `Server responded with status ${res.status}: ${res.statusText}`,
        latencyMs,
      };
    }
    const data: HealthResponse = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to connect to backend", latencyMs };
  }
}

export async function fetchCandidateProfile(candidateId?: string): Promise<ApiFetchResult<Candidate>> {
  const startTime = performance.now();
  try {
    const url = candidateId
      ? `${BASE_HOST}/api/profile?candidate_id=${encodeURIComponent(candidateId)}`
      : `${BASE_HOST}/api/profile`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        data: null,
        error: errJson.detail || errJson.message || `Status ${res.status}`,
        latencyMs,
      };
    }
    const data: Candidate = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch candidate profile", latencyMs };
  }
}

export async function updateCandidateProfile(payload: any, candidateId?: string): Promise<ApiFetchResult<Candidate>> {
  const startTime = performance.now();
  try {
    const url = candidateId
      ? `${BASE_HOST}/api/profile?candidate_id=${encodeURIComponent(candidateId)}`
      : `${BASE_HOST}/api/profile`;

    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        data: null,
        error: errJson.detail || errJson.message || `Status ${res.status}`,
        latencyMs,
      };
    }
    const data: Candidate = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to update profile", latencyMs };
  }
}

export async function addSkillApi(skill: Partial<Skill>, candidateId?: string): Promise<ApiFetchResult<Skill>> {
  const startTime = performance.now();
  try {
    const url = candidateId
      ? `${BASE_HOST}/api/profile/skills?candidate_id=${encodeURIComponent(candidateId)}`
      : `${BASE_HOST}/api/profile/skills`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(skill),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: Skill = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message, latencyMs };
  }
}

export async function addProjectApi(project: Partial<Project>, candidateId?: string): Promise<ApiFetchResult<Project>> {
  const startTime = performance.now();
  try {
    const url = candidateId
      ? `${BASE_HOST}/api/profile/projects?candidate_id=${encodeURIComponent(candidateId)}`
      : `${BASE_HOST}/api/profile/projects`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: Project = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message, latencyMs };
  }
}

export async function importStructuredResumeApi(payload: any): Promise<ApiFetchResult<Candidate>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/profile/structured-import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: Candidate = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message, latencyMs };
  }
}

export async function uploadResumeFile(file: File, candidateId?: string): Promise<ApiFetchResult<ResumeUploadResult>> {
  const startTime = performance.now();
  try {
    const formData = new FormData();
    formData.append("file", file);
    if (candidateId) {
      formData.append("candidate_id", candidateId);
    }

    const res = await fetch(`${BASE_HOST}/api/resume/upload`, {
      method: "POST",
      body: formData,
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: ResumeUploadResult = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to upload resume", latencyMs };
  }
}

export async function confirmResumeImport(documentId: string, candidateData: any): Promise<ApiFetchResult<Candidate>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/resume/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_id: documentId,
        candidate_data: candidateData,
        replace_existing: true,
      }),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const resJson = await res.json();
    return { data: resJson.candidate, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to confirm resume import", latencyMs };
  }
}

// ---------------------------------------------------------------------------
// Phase 4: Job & JD Analyzer
// ---------------------------------------------------------------------------

export interface JobRequirementItem {
  id?: string;
  job_id?: string;
  name: string;
  requirement_type: "required" | "preferred" | "inferred";
  category?: string;
  context?: string | null;
  years_experience?: number | null;
}

export interface Job {
  id: string;
  company: string;
  role: string;
  location?: string | null;
  employment_type?: string | null;
  raw_description: string;
  summary?: string | null;
  domain?: string | null;
  salary?: string | null;
  application_url?: string | null;
  deadline?: string | null;
  experience_requirement?: string | null;
  education_requirements: string[];
  responsibilities: string[];
  qualifications: string[];
  technologies: string[];
  required_skills: string[];
  preferred_skills: string[];
  inferred_concepts: string[];
  requirements: JobRequirementItem[];

  // Phase 8: Discovery & Sourcing Metadata
  source_type?: string;
  source_name?: string;
  canonical_url?: string | null;
  external_id?: string | null;
  is_active?: boolean;
  is_expired?: boolean;
  match_score?: number | null;
  matched_skills?: string[];
  missing_required_skills?: string[];
  missing_preferred_skills?: string[];

  // Phase 16B: Discovery, Normalization & Eligibility
  normalized_title?: string;
  official_company_url?: string | null;
  remote_status?: string | null;
  experience_level?: string | null;
  is_fresher_eligible?: boolean;
  fresher_eligibility_reason?: string | null;
  source_references?: Array<{
    source: string;
    source_type?: string;
    url?: string;
    official_url?: string;
    external_id?: string;
    discovered_at?: string;
  }>;
  posted_at?: string | null;
  last_verified_at?: string | null;
  match_category?: "HIGH_MATCH" | "GOOD_MATCH" | "POSSIBLE_MATCH" | "LOW_MATCH" | "INELIGIBLE" | string;
  eligibility_status?: "ELIGIBLE" | "INELIGIBLE" | "BORDERLINE" | string;
  scam_score?: number | null;
  scam_reason?: string | null;
  has_safety_warnings?: boolean;
  scam_risk_level?: string;
  is_scam_likely?: boolean;

  created_at: string;
  updated_at: string;
}

export const ApplicationStatus = {
  DISCOVERED: "DISCOVERED",
  SAVED: "SAVED",
  ANALYZING: "ANALYZING",
  RESUME_PREPARED: "RESUME_PREPARED",
  RESUME_APPROVED: "RESUME_APPROVED",
  REFERRAL_RESEARCH: "REFERRAL_RESEARCH",
  OUTREACH_PREPARED: "OUTREACH_PREPARED",
  OUTREACH_APPROVED: "OUTREACH_APPROVED",
  OUTREACH_SENT: "OUTREACH_SENT",
  APPLICATION_READY: "APPLICATION_READY",
  READY_TO_APPLY: "READY_TO_APPLY",
  APPLIED: "APPLIED",
  SCREENING: "SCREENING",
  ASSESSMENT: "ASSESSMENT",
  INTERVIEW: "INTERVIEW",
  TECHNICAL: "TECHNICAL",
  FINAL_ROUND: "FINAL_ROUND",
  OFFER: "OFFER",
  REJECTED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
} as const;
export type ApplicationStatus = (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

export interface AnalyzeJobPayload {
  job_description: string;
  job_url?: string;
  company?: string;
  role?: string;
}

export interface JobFilterParams {
  role?: string;
  company?: string;
  location?: string;
  skills?: string;
  source?: string;
  is_active?: boolean;
  min_match_score?: number;
  candidate_id?: string;
  limit?: number;
  offset?: number;
}

export interface JobUrlImportPayload {
  url: string;
  company?: string;
  role?: string;
  source_name?: string;
}

export interface JobUrlImportResult {
  job: Job;
  is_duplicate: boolean;
  is_expired: boolean;
  canonical_url: string;
  message: string;
}

export interface JobImportItemPayload {
  company: string;
  role: string;
  description: string;
  location?: string;
  employment_type?: string;
  url?: string;
  salary?: string;
  deadline?: string;
  external_id?: string;
  required_skills?: string[];
  preferred_skills?: string[];
}

export interface JobBulkImportPayload {
  source_type: "url_import" | "public_feed" | "career_page" | "user_configured";
  source_name?: string;
  feed_url?: string;
  jobs?: JobImportItemPayload[];
}

export interface JobBulkImportResult {
  total_processed: number;
  imported_count: number;
  duplicate_count: number;
  expired_count: number;
  results: Array<{
    job_id?: string;
    company: string;
    role: string;
    canonical_url?: string;
    status: string;
    is_duplicate: boolean;
    message: string;
  }>;
  jobs: Job[];
}

export interface RecommendedJobItem {
  job: Job;
  overall_match_score: number;
  matched_skills: string[];
  missing_required_skills: string[];
  missing_preferred_skills: string[];
  recommendation_reason: string;
}

export interface RecommendedJobsResult {
  candidate_id?: string;
  candidate_name?: string;
  total_recommendations: number;
  recommendations: RecommendedJobItem[];
}

export async function analyzeJobApi(payload: AnalyzeJobPayload): Promise<ApiFetchResult<Job>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/jobs/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: err.detail || err.message || `Status ${res.status}`,
        latencyMs,
      };
    }
    const data: Job = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to analyze job description", latencyMs };
  }
}

export async function fetchJobApi(jobId: string): Promise<ApiFetchResult<Job>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/jobs/${encodeURIComponent(jobId)}`, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: Job = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch job", latencyMs };
  }
}

export async function fetchJobsApi(params?: JobFilterParams): Promise<ApiFetchResult<Job[]>> {
  const startTime = performance.now();
  try {
    const query = new URLSearchParams();
    if (params) {
      if (params.role) query.set("role", params.role);
      if (params.company) query.set("company", params.company);
      if (params.location) query.set("location", params.location);
      if (params.skills) query.set("skills", params.skills);
      if (params.source) query.set("source", params.source);
      if (params.is_active !== undefined) query.set("is_active", String(params.is_active));
      if (params.min_match_score !== undefined) query.set("min_match_score", String(params.min_match_score));
      if (params.candidate_id) query.set("candidate_id", params.candidate_id);
      if (params.limit !== undefined) query.set("limit", String(params.limit));
      if (params.offset !== undefined) query.set("offset", String(params.offset));
    }
    const qs = query.toString();
    const url = `${BASE_HOST}/api/jobs${qs ? `?${qs}` : ""}`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      return { data: [], error: `Status ${res.status}`, latencyMs };
    }
    const data: Job[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: [], error: err?.message || "Failed to list jobs", latencyMs };
  }
}

export async function fetchRecentJobsApi(): Promise<ApiFetchResult<Job[]>> {
  return fetchJobsApi({ limit: 30 });
}

export async function importJobUrlApi(payload: JobUrlImportPayload): Promise<ApiFetchResult<JobUrlImportResult>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/jobs/import-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: JobUrlImportResult = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to import job from URL", latencyMs };
  }
}

export async function importBulkJobsApi(payload: JobBulkImportPayload): Promise<ApiFetchResult<JobBulkImportResult>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/jobs/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: JobBulkImportResult = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to batch import jobs", latencyMs };
  }
}

export async function fetchRecommendedJobsApi(
  candidateId?: string,
  minScore = 0.0,
  limit = 30
): Promise<ApiFetchResult<RecommendedJobsResult>> {
  const startTime = performance.now();
  try {
    const query = new URLSearchParams();
    if (candidateId) query.set("candidate_id", candidateId);
    if (minScore > 0) query.set("min_score", String(minScore));
    if (limit) query.set("limit", String(limit));

    const qs = query.toString();
    const url = `${BASE_HOST}/api/jobs/recommended${qs ? `?${qs}` : ""}`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: err.detail || `Status ${res.status}`,
        latencyMs,
      };
    }
    const data: RecommendedJobsResult = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch recommendations", latencyMs };
  }
}

// ---------------------------------------------------------------------------
// Phase 16B: Multi-Source Job Discovery & AI Matching
// ---------------------------------------------------------------------------

export interface JobSourceStatus {
  source_type: string;
  source_name: string;
  enabled: boolean;
  status: string;
}

export interface JobAlertItem {
  job_id: string;
  title: string;
  normalized_title?: string;
  company: string;
  match_score: number;
  match_category: string;
  location?: string | null;
  why_it_matches: string[];
  potential_gaps: string[];
  source: string;
  job_url?: string | null;
  official_application_url?: string | null;
  deadline?: string | null;
  is_fresher_eligible: boolean;
  recommended_next_step: string;
  actions: string[];
  rendered_text: string;
}

export interface JobDiscoveryResponse {
  status: string;
  timestamp: string;
  total_discovered: number;
  imported_count: number;
  duplicate_merged_count: number;
  matched_count: number;
  sources_queried: string[];
  alerts: JobAlertItem[];
  canonical_jobs: Job[];
  source_failures: Array<{ source: string; error: string; timestamp: string }>;
}

export async function discoverJobsApi(payload?: {
  sources?: string[];
  candidate_id?: string;
  min_match_score?: number;
  limit_per_source?: number;
}): Promise<ApiFetchResult<JobDiscoveryResponse>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/jobs/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || { min_match_score: 60.0 }),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: JobDiscoveryResponse = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to execute multi-source job discovery", latencyMs };
  }
}

export async function fetchJobSourcesStatusApi(): Promise<ApiFetchResult<{ sources: JobSourceStatus[] }>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/jobs/sources/status`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      return { data: { sources: [] }, error: `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: { sources: [] }, error: err?.message || "Failed to fetch source status", latencyMs };
  }
}

// ---------------------------------------------------------------------------
// Phase 5: Matching Engine
// ---------------------------------------------------------------------------

export interface EvidenceItem {
  requirement: string;
  requirement_type: "required" | "preferred" | "inferred";
  evidence_quote: string;
  source_type: "experience" | "project" | "skill" | "education";
  source_title: string;
  confidence: number;
}

export interface RelevantProjectMatch {
  id?: string;
  title: string;
  description?: string | null;
  relevance_score: number;
  matching_skills: string[];
  key_bullet?: string | null;
}

export interface MatchResponse {
  id?: string;
  candidate_id: string;
  job_id: string;
  overall_match_score: number;
  required_skill_coverage: number;
  preferred_skill_coverage: number;
  semantic_score: number;
  experience_compatibility: number;
  education_compatibility: number;
  project_relevance: number;
  matched_skills: string[];
  missing_required_skills: string[];
  missing_preferred_skills: string[];
  relevant_projects: RelevantProjectMatch[];
  evidence: EvidenceItem[];
  explanation: string;
  weights_used: Record<string, number>;
  created_at?: string;
}

export async function matchCandidateToJobApi(
  jobId: string,
  payload?: { candidate_id?: string; weights?: any }
): Promise<ApiFetchResult<MatchResponse>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/jobs/${encodeURIComponent(jobId)}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: err.detail || err.message || `Status ${res.status}`,
        latencyMs,
      };
    }
    const data: MatchResponse = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to execute match evaluation", latencyMs };
  }
}

export async function fetchLatestMatchApi(
  jobId: string,
  candidateId?: string
): Promise<ApiFetchResult<MatchResponse>> {
  const startTime = performance.now();
  try {
    const url = candidateId
      ? `${BASE_HOST}/api/jobs/${encodeURIComponent(jobId)}/match?candidate_id=${encodeURIComponent(candidateId)}`
      : `${BASE_HOST}/api/jobs/${encodeURIComponent(jobId)}/match`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: MatchResponse = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch match evaluation", latencyMs };
  }
}

// ----------------------------------------------------------------------------
// Phase 6: Evidence-Based Resume Tailoring & Validator Interfaces
// ----------------------------------------------------------------------------

export interface ValidationCheckItem {
  check_name: string;
  passed: boolean;
  details: string;
  warnings?: string[];
}

export interface ValidationReport {
  is_valid: boolean;
  passed_checks: string[];
  failed_checks: string[];
  errors: string[];
  warnings: string[];
  checks: ValidationCheckItem[];
  metrics_audited: string[];
  technologies_audited: string[];
}

export interface SectionDiff {
  section_name: string;
  change_type: "reordered" | "tailored_bullets" | "refined" | "unchanged";
  original_snippet: string;
  tailored_snippet: string;
  rationale: string;
  traceable_evidence: string[];
}

export interface DiffSummary {
  total_sections_audited: number;
  sections_modified: number;
  skills_reordered: boolean;
  projects_reordered: boolean;
  bullets_tailored: number;
  unsupported_claims_added: number;
  section_diffs: SectionDiff[];
}

export interface ATSDetails {
  ats_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  skills_emphasized: string[];
  skills_omitted: string[];
  potential_gaps: string[];
  evidence_chain: Array<{
    jd_keyword: string;
    candidate_evidence: string;
    action: string;
  }>;
}

export interface ResumeDiffItem {
  category: "ADDED / EMPHASIZED" | "DE-EMPHASIZED" | "REORDERED" | "UNCHANGED" | "REMOVED";
  title: string;
  description: string;
  traceable_evidence?: string | null;
}

export interface ResumeDiffResponse {
  resume_version_id: string;
  job_id: string;
  candidate_id: string;
  total_changes: number;
  categories: Record<string, ResumeDiffItem[]>;
  raw_diff: string;
}

export interface ApproveResumeResponse {
  success: boolean;
  status: string;
  approved_at: string;
  message: string;
  ready_for_application: boolean;
  auto_applied: boolean;
}

export interface RejectResumeResponse {
  success: boolean;
  status: string;
  message: string;
}

export interface ResumeVersion {
  id: string;
  candidate_id: string;
  job_id: string;
  source_resume_id?: string | null;
  latex_content: string;
  validation_status: "valid" | "rejected" | "regenerated";
  version_number: number;
  status: "DRAFT" | "GENERATING" | "GENERATED" | "REVIEW_REQUIRED" | "APPROVED" | "REJECTED" | "ARCHIVED";
  pdf_path?: string | null;
  ats_score?: number | null;
  ats_details?: ATSDetails | null;
  generated_at?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  validation_details: Record<string, any>;
  diff_summary: Record<string, any>;
  created_at: string;
}

export interface TailorResumeResponse {
  version: ResumeVersion;
  master_resume_content: string;
  validation_report: ValidationReport;
  diff_summary: DiffSummary;
  message: string;
  retries_attempted: number;
}

export interface TailorResumePayload {
  job_id?: string;
  candidate_id?: string;
  master_resume_id?: string;
  custom_instructions?: string;
}

export async function tailorResumeApi(
  jobId: string,
  payload?: TailorResumePayload
): Promise<ApiFetchResult<TailorResumeResponse>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/resumes/tailor/${encodeURIComponent(jobId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: err.detail || err.message || `Status ${res.status}`,
        latencyMs,
      };
    }
    const data: TailorResumeResponse = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to tailor resume", latencyMs };
  }
}

export async function fetchLatestTailoredResumeApi(
  jobId: string,
  candidateId?: string
): Promise<ApiFetchResult<ResumeVersion>> {
  const startTime = performance.now();
  try {
    const url = candidateId
      ? `${BASE_HOST}/api/resumes/tailor/${encodeURIComponent(jobId)}?candidate_id=${encodeURIComponent(candidateId)}`
      : `${BASE_HOST}/api/resumes/tailor/${encodeURIComponent(jobId)}`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: ResumeVersion = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch tailored resume", latencyMs };
  }
}

export interface ResumeDocument {
  id: string;
  candidate_id?: string | null;
  filename: string;
  file_type: string;
  storage_path: string;
  extracted_text: string;
  version: number;
  created_at: string;
  metadata_json?: Record<string, any>;
}

export async function fetchResumeDocumentsApi(
  candidateId?: string
): Promise<ApiFetchResult<ResumeDocument[]>> {
  const startTime = performance.now();
  try {
    const url = candidateId
      ? `${BASE_HOST}/api/resume/documents?candidate_id=${encodeURIComponent(candidateId)}`
      : `${BASE_HOST}/api/resume/documents`;
    const res = await fetch(url, { cache: "no-store" });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: ResumeDocument[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch resume documents", latencyMs };
  }
}

export async function fetchResumeVersionsApi(params?: {
  candidateId?: string;
  jobId?: string;
  limit?: number;
}): Promise<ApiFetchResult<ResumeVersion[]>> {
  const startTime = performance.now();
  try {
    const query = new URLSearchParams();
    if (params?.candidateId) query.append("candidate_id", params.candidateId);
    if (params?.jobId) query.append("job_id", params.jobId);
    if (params?.limit) query.append("limit", params.limit.toString());
    const queryString = query.toString() ? `?${query.toString()}` : "";
    const res = await fetch(`${BASE_HOST}/api/resumes/versions${queryString}`, { cache: "no-store" });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: ResumeVersion[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch resume versions", latencyMs };
  }
}

export async function fetchResumeVersionApi(
  versionId: string
): Promise<ApiFetchResult<ResumeVersion>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/resumes/tailored/${encodeURIComponent(versionId)}`, {
      cache: "no-store",
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      // Fallback to legacy endpoint if needed
      const fallbackRes = await fetch(`${BASE_HOST}/api/resumes/versions/${encodeURIComponent(versionId)}`, {
        cache: "no-store",
      });
      if (!fallbackRes.ok) {
        const err = await res.json().catch(() => ({}));
        return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
      }
      const data: ResumeVersion = await fallbackRes.json();
      return { data, error: null, latencyMs };
    }
    const data: ResumeVersion = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch resume version", latencyMs };
  }
}

export async function fetchTailoredResumeByIdApi(
  versionId: string
): Promise<ApiFetchResult<ResumeVersion>> {
  return fetchResumeVersionApi(versionId);
}

export async function listTailoredResumesApi(params?: {
  candidateId?: string;
  jobId?: string;
  status?: string;
  limit?: number;
}): Promise<ApiFetchResult<ResumeVersion[]>> {
  const startTime = performance.now();
  try {
    const query = new URLSearchParams();
    if (params?.candidateId) query.append("candidate_id", params.candidateId);
    if (params?.jobId) query.append("job_id", params.jobId);
    if (params?.status) query.append("status", params.status);
    if (params?.limit) query.append("limit", params.limit.toString());
    const queryString = query.toString() ? `?${query.toString()}` : "";
    const res = await fetch(`${BASE_HOST}/api/resumes/tailored${queryString}`, { cache: "no-store" });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: ResumeVersion[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to list tailored resumes", latencyMs };
  }
}

export async function approveTailoredResumeApi(
  versionId: string,
  notes?: string
): Promise<ApiFetchResult<ApproveResumeResponse>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/resumes/tailored/${encodeURIComponent(versionId)}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: ApproveResumeResponse = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to approve resume", latencyMs };
  }
}

export async function rejectTailoredResumeApi(
  versionId: string,
  reason?: string
): Promise<ApiFetchResult<RejectResumeResponse>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/resumes/tailored/${encodeURIComponent(versionId)}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: RejectResumeResponse = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to reject resume", latencyMs };
  }
}

export async function updateTailoredResumeLatexApi(
  versionId: string,
  latexContent: string
): Promise<ApiFetchResult<ResumeVersion>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/resumes/tailored/${encodeURIComponent(versionId)}/latex`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latex_content: latexContent }),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: ResumeVersion = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to update resume LaTeX", latencyMs };
  }
}

export async function fetchTailoredResumeDiffApi(
  versionId: string
): Promise<ApiFetchResult<ResumeDiffResponse>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/resumes/tailored/${encodeURIComponent(versionId)}/diff`, {
      cache: "no-store",
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: ResumeDiffResponse = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch resume diff", latencyMs };
  }
}

// -----------------------------------------------------------------------------
// Phase 7: LaTeX Compilation & PDF Types & APIs
// -----------------------------------------------------------------------------

export interface CompilationErrorDetail {
  line_number?: number | null;
  error_type: string;
  message: string;
  snippet?: string | null;
  missing_package?: string | null;
}

export interface CompilePDFRequest {
  timeout_seconds?: number;
  force_recompile?: boolean;
}

export interface CompiledPDFResponse {
  id: string;
  resume_version_id: string;
  candidate_id: string;
  job_id: string;
  filename: string;
  file_size_bytes: number;
  compilation_status: "success" | "failed" | "timeout" | "security_violation";
  compiler_used: string;
  compilation_log: string;
  error_message?: string | null;
  error_details?: CompilationErrorDetail | null;
  compile_duration_ms: number;
  download_url: string;
  preview_url: string;
  created_at: string;
}

export async function compileResumePdfApi(
  resumeVersionId: string,
  payload?: CompilePDFRequest
): Promise<ApiFetchResult<CompiledPDFResponse>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/resumes/${encodeURIComponent(resumeVersionId)}/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: err.detail || err.message || `Status ${res.status}`,
        latencyMs,
      };
    }
    const data: CompiledPDFResponse = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to compile LaTeX to PDF", latencyMs };
  }
}

export function getResumePdfUrl(resumeVersionId: string, download = false): string {
  return `${BASE_HOST}/api/resumes/${encodeURIComponent(resumeVersionId)}/pdf${download ? "?download=true" : ""}`;
}

// -----------------------------------------------------------------------------
// Phase 9: Referral Discovery & Contact Management Types & APIs
// -----------------------------------------------------------------------------

export interface Contact {
  id?: string;
  candidate_id?: string | null;
  name: string;
  company: string;
  role: string;
  department?: string | null;
  source: string;
  profile_url?: string | null;
  email?: string | null;
  relationship?: string | null;
  notes?: string | null;
  university?: string | null;
  skills: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ReferralEvidence {
  factor: string;
  description?: string;
  evidence: string;
  score_contribution: number;
}

export interface ReferralScoreBreakdown {
  same_company?: number;
  same_university?: number;
  relevant_department?: number;
  same_field?: number;
  role_relevance?: number;
  total_score?: number;
}

export interface Referral {
  id: string;
  job_id: string;
  contact_id: string;
  candidate_id?: string | null;
  relationship_type: string;
  relevance_score: number;
  relevance_reason: string;
  status: "suggested" | "drafted" | "contacted" | "referred" | "declined" | "accepted" | string;
  evidence: ReferralEvidence[];
  score_breakdown: ReferralScoreBreakdown;
  notes?: string | null;
  contact?: Contact | null;
  created_at: string;
  updated_at: string;
}

export interface JobReferralsResult {
  job_id: string;
  company: string;
  role: string;
  total_opportunities: number;
  referrals: Referral[];
  ethical_policy_notice: string;
}

export async function fetchJobReferralsApi(jobId: string): Promise<ApiFetchResult<JobReferralsResult>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/jobs/${encodeURIComponent(jobId)}/referrals`, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: JobReferralsResult = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch job referrals", latencyMs };
  }
}

export async function discoverJobReferralsApi(
  jobId: string,
  payload?: { candidate_id?: string; min_score?: number }
): Promise<ApiFetchResult<JobReferralsResult>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/jobs/${encodeURIComponent(jobId)}/referrals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: JobReferralsResult = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to discover referrals", latencyMs };
  }
}

export async function updateReferralStatusApi(
  jobId: string,
  referralId: string,
  status: string,
  notes?: string
): Promise<ApiFetchResult<Referral>> {
  const startTime = performance.now();
  try {
    const res = await fetch(
      `${BASE_HOST}/api/jobs/${encodeURIComponent(jobId)}/referrals/${encodeURIComponent(referralId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      }
    );
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: Referral = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to update referral status", latencyMs };
  }
}

export async function fetchContactsApi(params?: {
  company?: string;
  search?: string;
}): Promise<ApiFetchResult<Contact[]>> {
  const startTime = performance.now();
  try {
    const searchParams = new URLSearchParams();
    if (params?.company) searchParams.append("company", params.company);
    if (params?.search) searchParams.append("search", params.search);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const res = await fetch(`${BASE_HOST}/api/contacts${query}`, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: Contact[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch contacts", latencyMs };
  }
}

export async function createContactApi(payload: Partial<Contact>): Promise<ApiFetchResult<Contact>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: Contact = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to create contact", latencyMs };
  }
}

export async function updateContactApi(
  contactId: string,
  payload: Partial<Contact>
): Promise<ApiFetchResult<Contact>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/contacts/${encodeURIComponent(contactId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: Contact = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to update contact", latencyMs };
  }
}

export async function deleteContactApi(
  contactId: string
): Promise<ApiFetchResult<{ success: boolean; message: string }>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/contacts/${encodeURIComponent(contactId)}`, {
      method: "DELETE",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to delete contact", latencyMs };
  }
}

// -----------------------------------------------------------------------------
// Phase 18: Multi-Source Referral Discovery Engine Types & APIs (50+ Target)
// -----------------------------------------------------------------------------

export interface ReferralContact {
  id: string;
  company_id?: string | null;
  company_name: string;
  company: string;
  job_id: string;
  candidate_id?: string | null;
  name: string;
  headline?: string | null;
  current_title: string;
  role?: string | null;
  department?: string | null;
  location?: string | null;
  profile_url?: string | null;
  source: string;
  source_url?: string | null;
  source_references: Array<{ source: string; url?: string; type?: string; institution?: string; grad_year?: number }>;
  public_contact_method?: string | null;
  university?: string | null;
  graduation_year?: number | null;
  skills: string[];
  relevance_score: number;
  relevance_reasons: string[];
  score_breakdown: {
    company_association?: number;
    role_team_relevance?: number;
    technical_overlap?: number;
    alumni_relationship?: number;
    seniority_context?: number;
    public_evidence?: number;
    total_score?: number;
    [key: string]: number | undefined;
  };
  relationship_type: "EMPLOYEE" | "ENGINEER" | "SENIOR_ENGINEER" | "ENGINEERING_MANAGER" | "RECRUITER" | "HIRING_TEAM" | "ALUMNI" | "TEAM_MEMBER" | "TECH_LEAD" | "OTHER" | string;
  verification_status: "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED" | "STALE" | string;
  last_verified_at?: string | null;
  discovered_at?: string | null;
  duplicate_key?: string | null;
  notes?: string | null;
  outreach_status: "NOT_CONTACTED" | "SELECTED" | "APPROVED" | "SENT" | "REPLIED" | "DECLINED" | "NO_RESPONSE" | "DO_NOT_CONTACT" | string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ReferralDiscoveryResult {
  job_id: string;
  company: string;
  role: string;
  target_count: number;
  total_discovered: number;
  total_verified: number;
  target_reached: boolean;
  shortfall: number;
  sources_used: string[];
  source_failures: Array<{ source_id: string; source_name?: string; error: string }>;
  contacts: ReferralContact[];
  notice?: string | null;
  ethical_notice?: string;
}

export interface ReferralSourceStatusItem {
  source_id: string;
  name: string;
  enabled: boolean;
  status: string;
  description: string;
  legitimate_access_method: string;
}

export interface ReferralSourceStatusResponse {
  sources: ReferralSourceStatusItem[];
  total_configured: number;
  total_active: number;
}

export async function discoverReferralsEngineApi(
  jobId: string,
  candidateId?: string,
  targetCount = 50,
  minScore = 0.0,
  sources?: string[]
): Promise<ApiFetchResult<ReferralDiscoveryResult>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/referrals/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: jobId,
        candidate_id: candidateId,
        target_count: targetCount,
        min_score: minScore,
        sources,
      }),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: ReferralDiscoveryResult = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to discover referral contacts", latencyMs };
  }
}

export async function fetchDiscoveredReferralsForJobApi(
  jobId: string,
  candidateId?: string
): Promise<ApiFetchResult<ReferralDiscoveryResult>> {
  const startTime = performance.now();
  try {
    const query = candidateId ? `?candidate_id=${encodeURIComponent(candidateId)}` : "";
    const res = await fetch(`${BASE_HOST}/api/referrals/job/${encodeURIComponent(jobId)}${query}`, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: ReferralDiscoveryResult = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch job referrals", latencyMs };
  }
}

export async function fetchReferralContactsApi(params?: {
  jobId?: string;
  company?: string;
  relationshipType?: string;
  verificationStatus?: string;
  outreachStatus?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ApiFetchResult<ReferralContact[]>> {
  const startTime = performance.now();
  try {
    const searchParams = new URLSearchParams();
    if (params?.jobId) searchParams.append("job_id", params.jobId);
    if (params?.company) searchParams.append("company", params.company);
    if (params?.relationshipType && params.relationshipType !== "all") searchParams.append("relationship_type", params.relationshipType);
    if (params?.verificationStatus && params.verificationStatus !== "all") searchParams.append("verification_status", params.verificationStatus);
    if (params?.outreachStatus && params.outreachStatus !== "all") searchParams.append("outreach_status", params.outreachStatus);
    if (params?.search) searchParams.append("search", params.search);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const res = await fetch(`${BASE_HOST}/api/referrals${qs}`, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: [], error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: ReferralContact[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: [], error: err?.message || "Failed to list referral contacts", latencyMs };
  }
}

export async function fetchReferralContactByIdApi(
  contactId: string
): Promise<ApiFetchResult<ReferralContact>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/referrals/${encodeURIComponent(contactId)}`, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: ReferralContact = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch referral contact", latencyMs };
  }
}

export async function selectReferralContactApi(
  contactId: string,
  notes?: string
): Promise<ApiFetchResult<ReferralContact>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/referrals/${encodeURIComponent(contactId)}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: ReferralContact = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to select contact", latencyMs };
  }
}

export async function dismissReferralContactApi(
  contactId: string
): Promise<ApiFetchResult<ReferralContact>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/referrals/${encodeURIComponent(contactId)}/dismiss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: ReferralContact = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to dismiss contact", latencyMs };
  }
}

export async function bulkSelectReferralContactsApi(
  contactIds: string[],
  action: "select" | "deselect" | "select_all_verified" = "select"
): Promise<ApiFetchResult<{ action: string; selected_count: number; updated_contact_ids: string[]; message: string }>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/referrals/bulk-select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_ids: contactIds, action }),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to bulk update contacts", latencyMs };
  }
}

export async function updateReferralContactNotesApi(
  contactId: string,
  notes: string
): Promise<ApiFetchResult<ReferralContact>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/referrals/${encodeURIComponent(contactId)}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: ReferralContact = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to update notes", latencyMs };
  }
}

export async function fetchReferralSourcesStatusApi(): Promise<ApiFetchResult<ReferralSourceStatusResponse>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/referrals/sources/status`, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: ReferralSourceStatusResponse = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch source status", latencyMs };
  }
}


// -----------------------------------------------------------------------------
// Phase 10: Outreach Agent Types & APIs
// -----------------------------------------------------------------------------

export interface OutreachMessage {
  id: string;
  job_id: string;
  contact_id: string;
  candidate_id?: string | null;
  referral_id?: string | null;
  channel: "email" | "linkedin" | string;
  subject?: string | null;
  body: string;
  status: "DRAFT" | "NEEDS_REVIEW" | "APPROVED" | "SENT" | "REJECTED" | string;
  relationship_context?: string | null;
  project_highlight?: string | null;
  metadata_json?: Record<string, any>;
  tailoring_points?: string[];
  approved_at?: string | null;
  sent_at?: string | null;
  created_at: string;
  updated_at: string;
  contact?: Contact | null;
  job?: { id: string; company: string; role: string } | null;
}

export interface OutreachGeneratePayload {
  job_id: string;
  contact_id: string;
  candidate_id?: string;
  referral_id?: string;
  relevant_project_id?: string;
  channel?: "all" | "email" | "linkedin";
  custom_instructions?: string;
}

export interface OutreachBatchResult {
  job_id: string;
  contact_id: string;
  company: string;
  contact_name: string;
  messages: OutreachMessage[];
  ethical_protocol_notice: string;
}

export interface OutreachActionResult {
  id: string;
  status: string;
  message: string;
  approved_at?: string | null;
  sent_at?: string | null;
}

export async function fetchOutreachMessagesApi(params?: {
  job_id?: string;
  contact_id?: string;
  channel?: string;
  status?: string;
}): Promise<ApiFetchResult<OutreachMessage[]>> {
  const startTime = performance.now();
  try {
    const searchParams = new URLSearchParams();
    if (params?.job_id) searchParams.append("job_id", params.job_id);
    if (params?.contact_id) searchParams.append("contact_id", params.contact_id);
    if (params?.channel) searchParams.append("channel", params.channel);
    if (params?.status) searchParams.append("status", params.status);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const res = await fetch(`${BASE_HOST}/api/outreach${query}`, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachMessage[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch outreach messages", latencyMs };
  }
}

export async function fetchOutreachMessageApi(outreachId: string): Promise<ApiFetchResult<OutreachMessage>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/outreach/${encodeURIComponent(outreachId)}`, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachMessage = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch outreach draft", latencyMs };
  }
}

export async function generateOutreachApi(payload: OutreachGeneratePayload): Promise<ApiFetchResult<OutreachBatchResult>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/outreach/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachBatchResult = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to generate outreach drafts", latencyMs };
  }
}

export async function editOutreachApi(
  outreachId: string,
  payload: { subject?: string; body?: string; status?: string }
): Promise<ApiFetchResult<OutreachMessage>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/outreach/${encodeURIComponent(outreachId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachMessage = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to update outreach draft", latencyMs };
  }
}

export async function approveOutreachApi(outreachId: string): Promise<ApiFetchResult<OutreachActionResult>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/outreach/${encodeURIComponent(outreachId)}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachActionResult = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to approve outreach draft", latencyMs };
  }
}

export async function rejectOutreachApi(outreachId: string): Promise<ApiFetchResult<OutreachActionResult>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/outreach/${encodeURIComponent(outreachId)}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachActionResult = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to reject outreach draft", latencyMs };
  }
}

export async function markOutreachSentApi(outreachId: string): Promise<ApiFetchResult<OutreachActionResult>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/outreach/${encodeURIComponent(outreachId)}/sent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachActionResult = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to mark outreach as sent", latencyMs };
  }
}

export async function deleteOutreachApi(outreachId: string): Promise<ApiFetchResult<{ success: boolean; message: string }>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/outreach/${encodeURIComponent(outreachId)}`, {
      method: "DELETE",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to delete outreach message", latencyMs };
  }
}

// -----------------------------------------------------------------------------
// Phase 11: Application CRM Types & APIs
// -----------------------------------------------------------------------------

export interface Application {
  id: string;
  job_id: string;
  candidate_id?: string | null;
  resume_version_id?: string | null;
  status:
    | "SAVED"
    | "READY_TO_APPLY"
    | "APPLIED"
    | "SCREENING"
    | "INTERVIEW"
    | "TECHNICAL"
    | "FINAL_ROUND"
    | "OFFER"
    | "REJECTED"
    | "WITHDRAWN"
    | string;
  applied_at?: string | null;
  source?: string | null;
  referral_status?: string | null;
  interview_stage?: string | null;
  notes?: string | null;
  next_action?: string | null;
  next_followup_date?: string | null;
  metadata_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
  job?: {
    id: string;
    company: string;
    role: string;
    location?: string;
    employment_type?: string;
    application_url?: string;
  } | null;
  resume_version?: {
    id: string;
    version_number: number;
    validation_status: string;
  } | null;
  match_score?: number | null;
}

export interface KanbanBoardResult {
  columns: Record<string, Application[]>;
  total_applications: number;
}

export async function fetchApplicationsApi(params?: {
  candidate_id?: string;
  job_id?: string;
  status?: string;
  search?: string;
}): Promise<ApiFetchResult<Application[]>> {
  const startTime = performance.now();
  try {
    const searchParams = new URLSearchParams();
    if (params?.candidate_id) searchParams.append("candidate_id", params.candidate_id);
    if (params?.job_id) searchParams.append("job_id", params.job_id);
    if (params?.status) searchParams.append("status", params.status);
    if (params?.search) searchParams.append("search", params.search);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const res = await fetch(`${BASE_HOST}/api/applications${query}`, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: Application[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch applications", latencyMs };
  }
}

export async function fetchKanbanBoardApi(params?: {
  candidate_id?: string;
  search?: string;
}): Promise<ApiFetchResult<KanbanBoardResult>> {
  const startTime = performance.now();
  try {
    const searchParams = new URLSearchParams();
    if (params?.candidate_id) searchParams.append("candidate_id", params.candidate_id);
    if (params?.search) searchParams.append("search", params.search);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const res = await fetch(`${BASE_HOST}/api/applications/kanban${query}`, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: KanbanBoardResult = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch Kanban board", latencyMs };
  }
}

export async function createApplicationApi(payload: Partial<Application>): Promise<ApiFetchResult<Application>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: Application = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to create application", latencyMs };
  }
}

export async function updateApplicationApi(
  applicationId: string,
  payload: Partial<Application>
): Promise<ApiFetchResult<Application>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/applications/${encodeURIComponent(applicationId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: Application = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to update application", latencyMs };
  }
}

export async function deleteApplicationApi(applicationId: string): Promise<ApiFetchResult<{ success: boolean; message: string }>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/applications/${encodeURIComponent(applicationId)}`, {
      method: "DELETE",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to delete application", latencyMs };
  }
}

// ---------------------------------------------------------------------------
// Phase 12: Interview Preparation & Simulation
// ---------------------------------------------------------------------------

export interface TechnicalQuestionItem {
  id: string;
  question: string;
  topic: string;
  difficulty?: string;
  context_source?: string;
  sample_good_points?: string[];
}

export interface ProjectQuestionItem {
  id: string;
  question: string;
  project_name: string;
  technologies?: string[];
  rationale?: string;
  context_source?: string;
}

export interface BehavioralQuestionItem {
  id: string;
  question: string;
  competency: string;
  context_source?: string;
  star_framework_tip?: {
    Situation?: string;
    Task?: string;
    Action?: string;
    Result?: string;
  };
}

export interface JDSpecificQuestionItem {
  id: string;
  question: string;
  jd_requirement: string;
  why_asked?: string;
  context_source?: string;
}

export interface ResumeSpecificQuestionItem {
  id: string;
  question: string;
  resume_claim: string;
  verification_goal?: string;
  context_source?: string;
}

export interface PreparationTopicItem {
  topic: string;
  category: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  key_concepts: string[];
  recommended_prep: string;
}

export interface InterviewPreparation {
  id: string;
  job_id: string;
  candidate_id?: string | null;
  resume_version_id?: string | null;
  company_name: string;
  role: string;
  technical_questions: TechnicalQuestionItem[];
  project_questions: ProjectQuestionItem[];
  behavioral_questions: BehavioralQuestionItem[];
  jd_specific_questions: JDSpecificQuestionItem[];
  resume_specific_questions: ResumeSpecificQuestionItem[];
  follow_up_questions: Array<{ id: string; question: string; original_category?: string; probe_direction?: string }>;
  suggested_preparation_topics: PreparationTopicItem[];
  general_questions: Array<{ id: string; question: string; category: string; note?: string }>;
  disclaimer: string;
  created_at: string;
}

export interface EvaluationDetail {
  technical_accuracy: number;
  relevance: number;
  clarity: number;
  structure: number;
  evidence: number;
  communication: number;
  overall_score: number;
  strengths: string[];
  weaknesses: string[];
  feedback: string;
  improvement_tips: string[];
}

export interface InterviewTurn {
  id: string;
  session_id: string;
  turn_index: number;
  category: string;
  question: string;
  context_source?: string | null;
  candidate_answer?: string | null;
  answered_at?: string | null;
  evaluation?: EvaluationDetail | null;
  follow_up_question?: string | null;
  is_follow_up: boolean;
  created_at: string;
}

export interface FinalFeedbackDetail {
  overall_score: number;
  category_scores: {
    technical_accuracy: number;
    relevance: number;
    clarity: number;
    structure: number;
    evidence: number;
    communication: number;
  };
  summary: string;
  strengths: string[];
  weak_areas: string[];
  recommendations: string[];
  preparation_topics_to_review: string[];
}

export interface InterviewSession {
  id: string;
  job_id: string;
  candidate_id?: string | null;
  resume_version_id?: string | null;
  company_name?: string | null;
  role?: string | null;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  current_turn_index: number;
  total_target_questions: number;
  weak_areas: string[];
  final_feedback?: FinalFeedbackDetail | null;
  started_at: string;
  completed_at?: string | null;
  current_turn?: InterviewTurn | null;
  turns: InterviewTurn[];
}

export async function fetchInterviewPrepApi(
  jobId: string,
  candidateId?: string,
  forceRegenerate: boolean = false
): Promise<ApiFetchResult<InterviewPreparation>> {
  const startTime = performance.now();
  try {
    const url = buildApiUrl(`/api/interview/prep/${encodeURIComponent(jobId)}`, {
      candidate_id: candidateId,
      force_regenerate: forceRegenerate ? "true" : undefined,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: InterviewPreparation = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch interview prep kit", latencyMs };
  }
}

export async function startInterviewSessionApi(payload: {
  job_id: string;
  candidate_id?: string;
  resume_version_id?: string;
  total_questions?: number;
}): Promise<ApiFetchResult<InterviewSession>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/interview/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: InterviewSession = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to start interview session", latencyMs };
  }
}

export async function getInterviewSessionApi(sessionId: string): Promise<ApiFetchResult<InterviewSession>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/interview/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: InterviewSession = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to get interview session", latencyMs };
  }
}

export async function listInterviewSessionsApi(jobId?: string): Promise<ApiFetchResult<InterviewSession[]>> {
  const startTime = performance.now();
  try {
    const url = buildApiUrl("/api/interview/sessions", {
      job_id: jobId,
    });

    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: InterviewSession[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to list interview sessions", latencyMs };
  }
}

export async function submitInterviewAnswerApi(
  sessionId: string,
  answer: string
): Promise<ApiFetchResult<InterviewSession>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/interview/sessions/${encodeURIComponent(sessionId)}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: InterviewSession = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to submit answer", latencyMs };
  }
}

export async function finishInterviewSessionApi(sessionId: string): Promise<ApiFetchResult<InterviewSession>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/interview/sessions/${encodeURIComponent(sessionId)}/finish`, {
      method: "POST",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: InterviewSession = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to finish interview session", latencyMs };
  }
}

// ---------------------------------------------------------------------------
// Phase 13: Career Skill Gap Agent
// ---------------------------------------------------------------------------

export interface RecommendedProjectDetail {
  title: string;
  description: string;
  key_features: string[];
  deliverables: string;
}

export interface SkillGapItem {
  skill: string;
  frequency_count: number;
  frequency_percentage: number;
  candidate_evidence: string;
  current_strength: "Strong" | "Medium" | "Weak" | "Missing";
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category?: string;
  recommended_learning_path: string[];
  recommended_project?: RecommendedProjectDetail | null;
}

export interface RoadmapPhase {
  phase_name: string;
  timeline: string;
  focus_skills: string[];
  milestones: string[];
  recommended_project?: string | null;
}

export interface SkillGapAnalysisResponse {
  candidate_id: string;
  candidate_name: string;
  target_jobs_analyzed: number;
  saved_jobs_count: number;
  applied_jobs_count: number;
  total_skills_demanded: number;
  market_readiness_score: number;
  identified_gaps_count: number;
  skills: SkillGapItem[];
  roadmap: RoadmapPhase[];
  summary: string;
}

export async function fetchCareerSkillGapsApi(
  candidateId?: string
): Promise<ApiFetchResult<SkillGapAnalysisResponse>> {
  const startTime = performance.now();
  try {
    const url = buildApiUrl("/api/career/skill-gaps", {
      candidate_id: candidateId,
    });

    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: SkillGapAnalysisResponse = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch career skill gaps", latencyMs };
  }
}

// ---------------------------------------------------------------------------
// Phase 14: GitHub Career Analyzer
// ---------------------------------------------------------------------------

export interface GitHubProfileSummary {
  username: string;
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  public_repos: number;
  followers: number;
  following: number;
  total_stars: number;
  top_languages: string[];
  profile_url: string;
}

export interface DemonstratedSkillItem {
  skill: string;
  category: string;
  confidence: "High" | "Medium" | "Emerging" | string;
  repo_sources: string[];
  evidence_summary: string;
}

export interface MissingSkillItem {
  skill: string;
  category: string;
  demanded_by_role: boolean;
  reason: string;
}

export interface RelevantProjectItem {
  name: string;
  description?: string | null;
  html_url: string;
  homepage?: string | null;
  stars: number;
  forks: number;
  primary_language?: string | null;
  topics: string[];
  role_relevance_score: number;
  architecture_highlights: string[];
  has_readme: boolean;
  has_deployment: boolean;
}

export interface ResumeEvidenceItem {
  skill_or_feature: string;
  bullet_point: string;
  repository_name: string;
  repository_url: string;
  verifiable_metrics?: string | null;
}

export interface RecommendedImprovementItem {
  category: string;
  priority: "HIGH" | "MEDIUM" | "LOW" | string;
  title: string;
  description: string;
  actionable_steps: string[];
}

export interface GitHubAnalysisResponse {
  id: string;
  candidate_id?: string | null;
  job_id?: string | null;
  target_role?: string | null;
  target_company?: string | null;
  profile_summary: GitHubProfileSummary;
  skills_demonstrated: DemonstratedSkillItem[];
  skills_missing_evidence: MissingSkillItem[];
  relevant_projects: RelevantProjectItem[];
  potential_resume_evidence: ResumeEvidenceItem[];
  recommended_improvements: RecommendedImprovementItem[];
  created_at: string;
}

export interface GitHubAnalyzeRequest {
  username: string;
  github_token?: string;
  job_id?: string;
  candidate_id?: string;
}

export async function analyzeGitHubApi(
  payload: GitHubAnalyzeRequest
): Promise<ApiFetchResult<GitHubAnalysisResponse>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/github/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: GitHubAnalysisResponse = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to analyze GitHub profile", latencyMs };
  }
}

export async function fetchLatestGitHubAnalysisApi(
  username?: string,
  candidateId?: string
): Promise<ApiFetchResult<GitHubAnalysisResponse | null>> {
  const startTime = performance.now();
  try {
    const url = buildApiUrl("/api/github/latest", {
      username: username,
      candidate_id: candidateId,
    });

    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: GitHubAnalysisResponse | null = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch latest GitHub analysis", latencyMs };
  }
}

// ---------------------------------------------------------------------------
// Phase 15: Main CareerPilot Dashboard
// ---------------------------------------------------------------------------

export interface ProfileCompletionSummary {
  score: number;
  candidate_name?: string | null;
  candidate_headline?: string | null;
  skills_count: number;
  experiences_count: number;
  education_count: number;
  projects_count: number;
  has_master_resume: boolean;
  has_github_linked: boolean;
  completed_items: string[];
  missing_items: string[];
}

export interface JobsDiscoveredSummary {
  total_jobs: number;
  active_jobs: number;
  sources_breakdown: Record<string, number>;
  recent_jobs: Array<{
    id: string;
    company: string;
    role: string;
    location: string;
    source_type: string;
    source_name: string;
    created_at?: string | null;
  }>;
}

export interface StrongMatchItem {
  job_id: string;
  company: string;
  role: string;
  location?: string | null;
  employment_type?: string | null;
  match_score: number;
  match_category?: string | null;
  matched_skills: string[];
  missing_skills: string[];
  created_at?: string | null;
}

export interface ApplicationDashboardSummary {
  total_applications: number;
  by_status: Record<string, number>;
  recent_applications: Array<{
    id: string;
    job_id: string;
    company: string;
    role: string;
    status: string;
    referral_status: string;
    next_action?: string | null;
    next_followup_date?: string | null;
  }>;
}

export interface ReferralOpportunityItem {
  job_id: string;
  job_role: string;
  job_company: string;
  contact_id: string;
  contact_name: string;
  contact_company: string;
  relationship_type: string;
  relevance_reason: string;
  status: string;
}

export interface PendingOutreachItem {
  id: string;
  job_id: string;
  job_role: string;
  job_company: string;
  contact_name: string;
  channel: string;
  subject?: string | null;
  body_snippet: string;
  status: string;
  created_at: string;
}

export interface DashboardInterviewItem {
  id: string;
  type: string;
  company: string;
  role: string;
  stage_or_status: string;
  score?: number | null;
  updated_at?: string | null;
}

export interface SkillGapSummaryItem {
  skill: string;
  category: string;
  frequency: number;
  priority: string;
  current_strength: string;
}

export interface RecommendedProjectSummaryItem {
  title: string;
  description: string;
  focus_skills: string[];
  deliverables: string;
}

export interface FollowupItem {
  application_id: string;
  job_id: string;
  company: string;
  role: string;
  next_action: string;
  followup_date: string;
  is_overdue: boolean;
  days_diff: number;
}

export interface PipelineCounts {
  jobs_count: number;
  matched_count: number;
  tailored_resumes_count: number;
  compiled_pdfs_count: number;
  referrals_count: number;
  outreaches_count: number;
  pending_approvals_count: number;
  applied_count: number;
  interviews_count: number;
}

export interface DashboardSummaryResponse {
  candidate_id?: string | null;
  generated_at: string;
  pipeline_counts: PipelineCounts;
  profile_completion: ProfileCompletionSummary;
  jobs_discovered: JobsDiscoveredSummary;
  strong_matches: StrongMatchItem[];
  applications: ApplicationDashboardSummary;
  referral_opportunities: ReferralOpportunityItem[];
  outreach_requiring_approval: PendingOutreachItem[];
  interviews: DashboardInterviewItem[];
  skill_gaps: SkillGapSummaryItem[];
  recommended_projects: RecommendedProjectSummaryItem[];
  follow_ups: FollowupItem[];
  tailored_resumes?: Array<{
    id: string;
    job_id?: string;
    job_role: string;
    job_company: string;
    version_number: number;
    pdf_compiled: boolean;
  }>;
}

export async function fetchDashboardSummaryApi(
  candidateId?: string
): Promise<ApiFetchResult<DashboardSummaryResponse>> {
  const startTime = performance.now();
  try {
    const url = buildApiUrl("/api/dashboard", {
      candidate_id: candidateId,
    });

    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: DashboardSummaryResponse = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch dashboard summary", latencyMs };
  }
}

// -----------------------------------------------------------------------------
// Phase 19: Outreach Preparation & Human Approval Engine Types & APIs
// -----------------------------------------------------------------------------

export interface PersonalizationEvidenceItem {
  type: string;
  claim: string;
  source: string;
  source_url?: string | null;
  confidence: number;
  verified_at?: string | null;
}

export interface ValidationResult {
  passed: boolean;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED" | string;
  risk_flags: string[];
  unsupported_claims: string[];
  verified_claims: string[];
  personalization_evidence: PersonalizationEvidenceItem[];
  suggested_repairs: Array<{ original: string; replacement: string; reason: string }>;
  repaired?: boolean;
  repair_attempts?: number;
  [key: string]: any;
}

export interface HumanEditRecord {
  original_body: string;
  edited_body: string;
  original_subject?: string | null;
  edited_subject?: string | null;
  edited_at: string;
  edited_by: string;
  change_summary: string;
}

export interface OutreachDraft {
  id: string;
  candidate_id?: string | null;
  job_id: string;
  referral_contact_id: string;
  resume_version_id?: string | null;
  channel: "LINKEDIN" | "EMAIL" | "OTHER" | string;
  subject?: string | null;
  body: string;
  status: "DRAFT" | "VALIDATING" | "REVIEW_REQUIRED" | "EDITED" | "APPROVED_FOR_DISPATCH" | "REJECTED" | "REGENERATE_REQUIRED" | "BLOCKED" | "DISPATCHED" | string;
  generation_version: number;
  prompt_version: string;
  personalization_evidence: PersonalizationEvidenceItem[];
  validation_results: ValidationResult;
  risk_flags: string[];
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
  rejected_at?: string | null;
  rejected_by?: string | null;
  human_edits: HumanEditRecord[];
  dispatch_status: string;
  audit_metadata: Record<string, any>;
  contact_name?: string | null;
  contact_title?: string | null;
  contact_company?: string | null;
  contact_relationship_type?: string | null;
  contact_relevance_score?: number | null;
  job_title?: string | null;
  job_company?: string | null;
  contact_profile_url?: string | null;
}

export interface OutreachDraftBulkGenerateResponse {
  job_id: string;
  total_requested: number;
  total_generated: number;
  drafts: OutreachDraft[];
  skipped_unselected?: string[];
}

export async function fetchOutreachDraftsApi(params?: {
  jobId?: string;
  contactId?: string;
  status?: string;
  channel?: string;
  riskLevel?: string;
}): Promise<ApiFetchResult<OutreachDraft[]>> {
  const startTime = performance.now();
  try {
    const url = buildApiUrl("/api/v1/outreach", {
      job_id: params?.jobId,
      contact_id: params?.contactId,
      status: params?.status && params.status !== "ALL" ? params.status : undefined,
      channel: params?.channel && params.channel !== "ALL" ? params.channel : undefined,
      risk_level: params?.riskLevel && params.riskLevel !== "ALL" ? params.riskLevel : undefined,
    });

    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachDraft[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch outreach drafts", latencyMs };
  }
}

export async function fetchOutreachDraftByIdApi(
  draftId: string
): Promise<ApiFetchResult<OutreachDraft>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/outreach/${encodeURIComponent(draftId)}`, {
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachDraft = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch outreach draft", latencyMs };
  }
}

export async function fetchOutreachDraftsByJobApi(
  jobId: string
): Promise<ApiFetchResult<OutreachDraft[]>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/outreach/job/${encodeURIComponent(jobId)}`, {
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachDraft[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch job outreach drafts", latencyMs };
  }
}

export async function generateOutreachDraftApi(payload: {
  job_id: string;
  referral_contact_id: string;
  candidate_id?: string;
  channel?: string;
  length?: string;
}): Promise<ApiFetchResult<OutreachDraft>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/outreach/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachDraft = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to generate outreach draft", latencyMs };
  }
}

export async function bulkGenerateOutreachDraftsApi(payload: {
  job_id: string;
  contact_ids: string[];
  candidate_id?: string;
  channel?: string;
  length?: string;
}): Promise<ApiFetchResult<OutreachDraftBulkGenerateResponse>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/outreach/bulk-generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachDraftBulkGenerateResponse = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to bulk generate outreach drafts", latencyMs };
  }
}

export async function validateOutreachDraftApi(
  draftId: string
): Promise<ApiFetchResult<OutreachDraft>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/outreach/${encodeURIComponent(draftId)}/validate`, {
      method: "POST",
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachDraft = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to validate outreach draft", latencyMs };
  }
}

export async function editOutreachDraftApi(
  draftId: string,
  payload: { body: string; subject?: string; change_summary?: string; editor?: string }
): Promise<ApiFetchResult<OutreachDraft>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/outreach/${encodeURIComponent(draftId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachDraft = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to edit outreach draft", latencyMs };
  }
}

export async function approveOutreachDraftApi(
  draftId: string,
  payload?: { approver?: string; notes?: string }
): Promise<ApiFetchResult<OutreachDraft>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/outreach/${encodeURIComponent(draftId)}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload || {}),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachDraft = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to approve outreach draft", latencyMs };
  }
}

export async function rejectOutreachDraftApi(
  draftId: string,
  payload?: { rejector?: string; reason?: string }
): Promise<ApiFetchResult<OutreachDraft>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/outreach/${encodeURIComponent(draftId)}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload || {}),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachDraft = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to reject outreach draft", latencyMs };
  }
}

export async function regenerateOutreachDraftApi(
  draftId: string,
  payload?: { instructions?: string; regenerate_by?: string }
): Promise<ApiFetchResult<OutreachDraft>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/outreach/${encodeURIComponent(draftId)}/regenerate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload || {}),
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachDraft = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to regenerate outreach draft", latencyMs };
  }
}

// -----------------------------------------------------------------------------
// Phase 20: Job Discovery Portal, Authorized Dispatch & CRM Types
// -----------------------------------------------------------------------------

export interface JobSafetySignal {
  category: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  description: string;
  matched_text?: string | null;
  recommendation?: string | null;
}

export interface SourceCapability {
  source_id: string;
  display_name: string;
  access_mode: string;
  health: string;
  last_checked?: string | null;
  supports_search: boolean;
  supports_filters: boolean;
  supports_pagination: boolean;
  supports_job_detail: boolean;
  supports_salary: boolean;
  supports_location: boolean;
  supports_experience: boolean;
  supports_remote: boolean;
  notes?: string | null;
}

export interface JobSearchFilterRequest {
  query?: string;
  sources?: string[];
  locations?: string[];
  location?: string;
  experience_levels?: string[];
  job_types?: string[];
  work_modes?: string[];
  salary_min?: number;
  salary_max?: number;
  skills?: string[];
  company?: string;
  posted_within_days?: number;
  min_match_score?: number;
  fresher_mode?: boolean;
  candidate_id?: string;
  limit?: number;
  offset?: number;
}

export interface JobSearchFilterResponse {
  total_found: number;
  fresher_mode_active: boolean;
  active_filters: Record<string, any>;
  jobs: Job[];
  sources_queried: string[];
  page: number;
  page_size: number;
}

export interface JobAlert {
  id: string;
  name: string;
  candidate_id?: string | null;
  roles: string[];
  locations: string[];
  sources: string[];
  experience_levels: string[];
  work_modes: string[];
  min_match_score: number;
  frequency: string;
  email_notifications: boolean;
  is_active: boolean;
  last_triggered_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutreachDispatch {
  id: string;
  draft_id: string;
  candidate_id?: string | null;
  job_id?: string | null;
  referral_contact_id?: string | null;
  channel: string;
  recipient_name: string;
  recipient_address: string;
  provider: string;
  idempotency_key: string;
  status: string;
  provider_message_id?: string | null;
  sent_at?: string | null;
  delivery_confirmed_at?: string | null;
  error_details?: string | null;
  duplicate_prevented: boolean;
  message: string;
  audit_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface InboundResponse {
  id: string;
  candidate_id?: string | null;
  job_id?: string | null;
  contact_id?: string | null;
  outreach_id?: string | null;
  channel: string;
  message_id?: string | null;
  received_at: string;
  sender: string;
  subject?: string | null;
  body_reference?: string | null;
  classification: string;
  confidence: number;
  action_required: boolean;
  assessment_detected: boolean;
  interview_detected: boolean;
  deadline_detected: boolean;
  metadata_json: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Assessment {
  id: string;
  application_id?: string | null;
  job_id?: string | null;
  candidate_id?: string | null;
  title: string;
  assessment_type: string;
  platform?: string | null;
  assessment_url?: string | null;
  deadline?: string | null;
  status: string;
  notes?: string | null;
  metadata_json: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Deadline {
  id: string;
  application_id?: string | null;
  job_id?: string | null;
  candidate_id?: string | null;
  deadline_type: string;
  title: string;
  due_date: string;
  status: "UPCOMING" | "TODAY" | "TOMORROW" | "OVERDUE" | "COMPLETED";
  is_completed: boolean;
  notes?: string | null;
  metadata_json: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface InterviewEvent {
  id: string;
  application_id?: string | null;
  job_id?: string | null;
  candidate_id?: string | null;
  interview_type: string;
  scheduled_at: string;
  duration_minutes?: number | null;
  meeting_url?: string | null;
  interviewer_names: string[];
  status: string;
  notes?: string | null;
  preparation_checklist: string[];
  metadata_json: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface NotificationItem {
  id: string;
  candidate_id?: string | null;
  title: string;
  message: string;
  category: string;
  deep_link?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ConnectedProvider {
  id: string;
  candidate_id?: string | null;
  provider: string;
  account_email: string;
  email_address?: string;
  is_active: boolean;
  status?: string;
  scopes: string[];
  connected_at: string;
  last_synced_at?: string | null;
  daily_dispatch_count?: number;
  daily_dispatch_limit?: number;
}

export interface ApplicationDetail {
  application: Application;
  job: Job;
  candidate?: Candidate | null;
  resume_version?: any | null;
  contacts: any[];
  outreach_drafts: any[];
  dispatches: OutreachDispatch[];
  responses: InboundResponse[];
  assessments: Assessment[];
  deadlines: Deadline[];
  interviews: InterviewEvent[];
  timeline: Array<{
    date: string;
    event: string;
    type: string;
    details: string;
  }>;
}

// -----------------------------------------------------------------------------
// Phase 20: API Functions
// -----------------------------------------------------------------------------

export async function searchJobsWithFiltersApi(
  payload: JobSearchFilterRequest
): Promise<ApiFetchResult<JobSearchFilterResponse>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/jobs/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: JobSearchFilterResponse = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to search jobs", latencyMs };
  }
}

export async function fetchJobSourcesApi(): Promise<ApiFetchResult<SourceCapability[]>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/jobs/sources`, {
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: SourceCapability[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch job sources", latencyMs };
  }
}

export async function saveJobApi(
  jobId: string,
  candidateId?: string,
  notes?: string
): Promise<ApiFetchResult<any>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/jobs/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ job_id: jobId, candidate_id: candidateId, notes }),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to save job", latencyMs };
  }
}

export async function ignoreJobApi(
  jobId: string,
  candidateId?: string,
  reason?: string
): Promise<ApiFetchResult<any>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/jobs/ignore`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ job_id: jobId, candidate_id: candidateId, reason }),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to ignore job", latencyMs };
  }
}

export async function fetchJobAlertsApi(candidateId?: string): Promise<ApiFetchResult<JobAlert[]>> {
  const startTime = performance.now();
  try {
    const url = candidateId
      ? `${BASE_HOST}/api/v1/job-alerts?candidate_id=${encodeURIComponent(candidateId)}`
      : `${BASE_HOST}/api/v1/job-alerts`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: JobAlert[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch job alerts", latencyMs };
  }
}

export async function createJobAlertApi(payload: Partial<JobAlert>): Promise<ApiFetchResult<JobAlert>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/job-alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: JobAlert = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to create job alert", latencyMs };
  }
}

export async function updateJobAlertApi(id: string, payload: Partial<JobAlert>): Promise<ApiFetchResult<JobAlert>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/job-alerts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: JobAlert = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to update job alert", latencyMs };
  }
}

export async function deleteJobAlertApi(id: string): Promise<ApiFetchResult<boolean>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/job-alerts/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    return { data: true, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to delete job alert", latencyMs };
  }
}

export async function sendOutreachApi(
  draftId: string,
  confirmSend: boolean,
  provider: string = "AUTHORIZED_MOCK"
): Promise<ApiFetchResult<OutreachDispatch>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/outreach/${encodeURIComponent(draftId)}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ confirm_send: confirmSend, provider }),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachDispatch = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to dispatch message", latencyMs };
  }
}

export async function bulkSendOutreachApi(
  draftIds: string[],
  confirmSend: boolean,
  provider: string = "AUTHORIZED_MOCK"
): Promise<ApiFetchResult<any>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/outreach/bulk-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ draft_ids: draftIds, confirm_send: confirmSend, provider }),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to execute bulk dispatch", latencyMs };
  }
}

export async function fetchDispatchApi(dispatchId: string): Promise<ApiFetchResult<OutreachDispatch>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/outreach/dispatch/${encodeURIComponent(dispatchId)}`, {
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: OutreachDispatch = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch dispatch", latencyMs };
  }
}

export async function fetchInboundResponsesApi(
  candidateId?: string,
  jobId?: string
): Promise<ApiFetchResult<InboundResponse[]>> {
  const startTime = performance.now();
  try {
    const params = new URLSearchParams();
    if (candidateId) params.append("candidate_id", candidateId);
    if (jobId) params.append("job_id", jobId);
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${BASE_HOST}/api/v1/responses${query}`, {
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: InboundResponse[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch responses", latencyMs };
  }
}

export async function fetchAssessmentsApi(
  candidateId?: string,
  jobId?: string
): Promise<ApiFetchResult<Assessment[]>> {
  const startTime = performance.now();
  try {
    const params = new URLSearchParams();
    if (candidateId) params.append("candidate_id", candidateId);
    if (jobId) params.append("job_id", jobId);
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${BASE_HOST}/api/v1/assessments${query}`, {
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: Assessment[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch assessments", latencyMs };
  }
}

export async function fetchDeadlinesApi(
  candidateId?: string,
  jobId?: string
): Promise<ApiFetchResult<Deadline[]>> {
  const startTime = performance.now();
  try {
    const params = new URLSearchParams();
    if (candidateId) params.append("candidate_id", candidateId);
    if (jobId) params.append("job_id", jobId);
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${BASE_HOST}/api/v1/deadlines${query}`, {
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: Deadline[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch deadlines", latencyMs };
  }
}

export async function fetchInterviewsApi(
  candidateId?: string,
  jobId?: string
): Promise<ApiFetchResult<InterviewEvent[]>> {
  const startTime = performance.now();
  try {
    const params = new URLSearchParams();
    if (candidateId) params.append("candidate_id", candidateId);
    if (jobId) params.append("job_id", jobId);
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${BASE_HOST}/api/v1/interviews${query}`, {
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: InterviewEvent[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch interviews", latencyMs };
  }
}

export async function createInterviewApi(
  payload: Partial<InterviewEvent>
): Promise<ApiFetchResult<InterviewEvent>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/interviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: InterviewEvent = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to create interview", latencyMs };
  }
}

export async function fetchApplicationDetailApi(
  applicationId: string
): Promise<ApiFetchResult<ApplicationDetail>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/applications/${encodeURIComponent(applicationId)}/detail`, {
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: ApplicationDetail = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch application details", latencyMs };
  }
}

export async function fetchNotificationsApi(
  candidateId?: string,
  unreadOnly?: boolean
): Promise<ApiFetchResult<NotificationItem[]>> {
  const startTime = performance.now();
  try {
    const params = new URLSearchParams();
    if (candidateId) params.append("candidate_id", candidateId);
    if (unreadOnly) params.append("unread_only", "true");
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${BASE_HOST}/api/v1/notifications${query}`, {
      headers: { "Accept": "application/json" },
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: NotificationItem[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch notifications", latencyMs };
  }
}

export async function markNotificationReadApi(id: string): Promise<ApiFetchResult<any>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to mark notification read", latencyMs };
  }
}

export async function fetchConnectedProvidersApi(
  candidateId?: string
): Promise<ApiFetchResult<ConnectedProvider[]>> {
  const startTime = performance.now();
  try {
    const url = candidateId
      ? `${BASE_HOST}/api/v1/providers?candidate_id=${encodeURIComponent(candidateId)}`
      : `${BASE_HOST}/api/v1/providers`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: ConnectedProvider[] = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to fetch connected providers", latencyMs };
  }
}

export async function connectProviderApi(
  provider: string,
  candidateId?: string,
  email?: string
): Promise<ApiFetchResult<ConnectedProvider>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/providers/${encodeURIComponent(provider)}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ candidate_id: candidateId, account_email: email }),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data: ConnectedProvider = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to connect provider", latencyMs };
  }
}

export async function disconnectProviderApi(
  provider: string,
  candidateId?: string
): Promise<ApiFetchResult<any>> {
  const startTime = performance.now();
  try {
    const url = candidateId
      ? `${BASE_HOST}/api/v1/providers/${encodeURIComponent(provider)}?candidate_id=${encodeURIComponent(candidateId)}`
      : `${BASE_HOST}/api/v1/providers/${encodeURIComponent(provider)}`;
    const res = await fetch(url, {
      method: "DELETE",
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { data: null, error: err?.message || "Failed to disconnect provider", latencyMs };
  }
}

// ----------------------------------------------------------------------------
// Authentication & Admin Governance APIs
// ----------------------------------------------------------------------------

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  candidate_id?: string | null;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export interface AdminDashboardKPI {
  total_users: number;
  active_users: number;
  total_candidates: number;
  total_jobs: number;
  total_applications: number;
  total_outreach_drafts: number;
  n8n_connected: boolean;
  system_status: string;
  environment: string;
}

export interface AuditLogEvent {
  id: string;
  event_type: string;
  actor: string;
  draft_id?: string | null;
  candidate_id?: string | null;
  payload: Record<string, any>;
  created_at?: string | null;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("careerpilot_token");
}

export function setAuthToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("careerpilot_token", token);
  }
}

export function clearAuthToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("careerpilot_token");
    localStorage.removeItem("careerpilot_user");
  }
}

export function getAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Accept": "application/json",
    ...extra,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function loginUser(
  email: string,
  password: string
): Promise<ApiFetchResult<AuthResponse>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    setAuthToken(data.access_token);
    if (typeof window !== "undefined") {
      localStorage.setItem("careerpilot_user", JSON.stringify(data.user));
    }
    return { data, error: null, latencyMs };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to log in", latencyMs: 0 };
  }
}

export async function registerUser(
  email: string,
  password: string,
  fullName: string,
  headline?: string
): Promise<ApiFetchResult<AuthResponse>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name: fullName, headline }),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || err.message || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    setAuthToken(data.access_token);
    if (typeof window !== "undefined") {
      localStorage.setItem("careerpilot_user", JSON.stringify(data.user));
    }
    return { data, error: null, latencyMs };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to register", latencyMs: 0 };
  }
}

export async function fetchCurrentUser(): Promise<ApiFetchResult<UserProfile>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/auth/me`, {
      headers: getAuthHeaders(),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      return { data: null, error: `Unauthorized (Status ${res.status})`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to fetch user", latencyMs: 0 };
  }
}

export async function fetchAdminDashboard(): Promise<ApiFetchResult<AdminDashboardKPI>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/admin/dashboard`, {
      headers: getAuthHeaders(),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Admin access denied (${res.status})`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to fetch admin stats", latencyMs: 0 };
  }
}

export async function fetchAdminUsers(
  search?: string,
  role?: string
): Promise<ApiFetchResult<UserProfile[]>> {
  const startTime = performance.now();
  try {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (role) params.set("role", role);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${BASE_HOST}/api/v1/admin/users${qs}`, {
      headers: getAuthHeaders(),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to fetch users", latencyMs: 0 };
  }
}

export async function updateUserStatus(
  userId: string,
  isActive?: boolean,
  role?: string
): Promise<ApiFetchResult<UserProfile>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/admin/users/${encodeURIComponent(userId)}/status`, {
      method: "PATCH",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ is_active: isActive, role }),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to update user", latencyMs: 0 };
  }
}

export async function fetchAdminAuditLogs(): Promise<ApiFetchResult<AuditLogEvent[]>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/admin/audit-logs`, {
      headers: getAuthHeaders(),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to fetch audit logs", latencyMs: 0 };
  }
}

// ---------------------------------------------------------------------------
// Phase 23: Application Queue & 100+ Source Ingestion Pipeline APIs
// ---------------------------------------------------------------------------

export interface ApplicationQueueItem {
  id: string;
  candidate_id: string;
  job_id: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: string;
  next_action: string;
  resume_version_id?: string | null;
  referral_status?: string | null;
  outreach_status?: string | null;
  application_url?: string | null;
  application_method: string;
  deadline?: string | null;
  user_confirmation: boolean;
  confirmed_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  job_company?: string | null;
  job_role?: string | null;
  job_location?: string | null;
  job_india_relevance?: string | null;
  job_is_fresher_eligible?: boolean | null;
}

export interface ApplicationQueueSummaryStats {
  total: number;
  by_status: Record<string, number>;
  confirmed: number;
  pending_review: number;
  needs_resume: number;
  needs_referral: number;
}

export interface IngestionSource {
  source_id: string;
  name: string;
  source_type: string;
  status: string;
  last_run_at?: string | null;
  last_success_at?: string | null;
  jobs_fetched_total: number;
  jobs_accepted_total: number;
  duplicates_found_total: number;
  avg_ingestion_time_ms: number;
  error_message?: string | null;
}

export interface IngestionRun {
  run_id: string;
  source_id: string;
  status: string;
  jobs_fetched: number;
  jobs_accepted: number;
  jobs_rejected: number;
  duplicates_count: number;
  duration_ms: number;
  started_at: string;
  finished_at?: string | null;
  error_details?: string | null;
}

export interface IngestionMetrics {
  total_sources_configured: number;
  active_sources: number;
  total_runs_recorded: number;
  successful_runs: number;
  failed_runs: number;
  total_jobs_ingested: number;
  india_first_jobs_count: number;
  fresher_eligible_jobs_count: number;
  scam_flagged_jobs_count: number;
  queue_pending_confirmation: number;
  queue_total_items: number;
  recent_runs: IngestionRun[];
}

export async function fetchApplicationQueue(
  candidateId: string,
  status?: string,
  priority?: string
): Promise<ApiFetchResult<ApplicationQueueItem[]>> {
  const startTime = performance.now();
  try {
    const params = new URLSearchParams({ candidate_id: candidateId });
    if (status) params.append("status", status);
    if (priority) params.append("priority", priority);

    const res = await fetch(`${BASE_HOST}/api/v1/ingestion/queue?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to fetch application queue", latencyMs: 0 };
  }
}

export async function fetchQueueSummaryStats(
  candidateId: string
): Promise<ApiFetchResult<ApplicationQueueSummaryStats>> {
  const startTime = performance.now();
  try {
    const params = new URLSearchParams({ candidate_id: candidateId });
    const res = await fetch(`${BASE_HOST}/api/v1/ingestion/queue/stats/summary?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to fetch queue stats", latencyMs: 0 };
  }
}

export async function enqueueJobToQueue(
  candidateId: string,
  jobId: string,
  priority: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM",
  notes?: string,
  applicationUrl?: string
): Promise<ApiFetchResult<ApplicationQueueItem>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/ingestion/queue`, {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        candidate_id: candidateId,
        job_id: jobId,
        priority,
        notes,
        application_url: applicationUrl,
      }),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to enqueue job", latencyMs: 0 };
  }
}

export async function updateQueueItem(
  queueItemId: string,
  updates: {
    priority?: string;
    status?: string;
    next_action?: string;
    notes?: string;
    user_confirmation?: boolean;
    application_url?: string;
  }
): Promise<ApiFetchResult<ApplicationQueueItem>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/ingestion/queue/${encodeURIComponent(queueItemId)}`, {
      method: "PATCH",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(updates),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to update queue item", latencyMs: 0 };
  }
}

export async function confirmApplyQueueItem(
  queueItemId: string,
  userConfirmed: boolean = true
): Promise<ApiFetchResult<ApplicationQueueItem>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/ingestion/queue/confirm-apply`, {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        queue_item_id: queueItemId,
        user_confirmed: userConfirmed,
      }),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to confirm apply", latencyMs: 0 };
  }
}

export async function deleteQueueItem(queueItemId: string): Promise<ApiFetchResult<boolean>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/ingestion/queue/${encodeURIComponent(queueItemId)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    return { data: true, error: null, latencyMs };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to delete queue item", latencyMs: 0 };
  }
}

export async function fetchIngestionSources(
  status?: string,
  sourceType?: string,
  limit: number = 150
): Promise<ApiFetchResult<IngestionSource[]>> {
  const startTime = performance.now();
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (status) params.append("status", status);
    if (sourceType) params.append("source_type", sourceType);

    const res = await fetch(`${BASE_HOST}/api/v1/ingestion/sources?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to fetch ingestion sources", latencyMs: 0 };
  }
}

export async function fetchIngestionMetrics(): Promise<ApiFetchResult<IngestionMetrics>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/ingestion/metrics`, {
      headers: getAuthHeaders(),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to fetch ingestion metrics", latencyMs: 0 };
  }
}

export async function fetchIngestionRuns(
  sourceId?: string,
  limit: number = 20
): Promise<ApiFetchResult<IngestionRun[]>> {
  const startTime = performance.now();
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (sourceId) params.append("source_id", sourceId);

    const res = await fetch(`${BASE_HOST}/api/v1/ingestion/runs?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to fetch ingestion runs", latencyMs: 0 };
  }
}

export async function triggerIngestionRun(
  sourceId: string,
  maxJobs: number = 50,
  dryRun: boolean = false
): Promise<ApiFetchResult<IngestionRun>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/v1/ingestion/run`, {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        source_id: sourceId,
        max_jobs: maxJobs,
        dry_run: dryRun,
      }),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.detail || `Status ${res.status}`, latencyMs };
    }
    const data = await res.json();
    return { data, error: null, latencyMs };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to trigger ingestion run", latencyMs: 0 };
  }
}








