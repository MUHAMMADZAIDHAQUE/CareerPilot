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

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
const BASE_HOST = BACKEND_URL.replace("/api/v1", "");

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

  created_at: string;
  updated_at: string;
}

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

export interface ResumeVersion {
  id: string;
  candidate_id: string;
  job_id: string;
  source_resume_id?: string | null;
  latex_content: string;
  validation_status: "valid" | "rejected" | "regenerated";
  version_number: number;
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
    const url = new URL(`${BASE_HOST}/api/interview/prep/${encodeURIComponent(jobId)}`);
    if (candidateId) url.searchParams.append("candidate_id", candidateId);
    if (forceRegenerate) url.searchParams.append("force_regenerate", "true");

    const res = await fetch(url.toString(), {
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
    const url = new URL(`${BASE_HOST}/api/interview/sessions`);
    if (jobId) url.searchParams.append("job_id", jobId);

    const res = await fetch(url.toString(), {
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



