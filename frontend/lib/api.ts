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
  created_at: string;
  updated_at: string;
}

export interface AnalyzeJobPayload {
  job_description: string;
  job_url?: string;
  company?: string;
  role?: string;
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

export async function fetchRecentJobsApi(): Promise<ApiFetchResult<Job[]>> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${BASE_HOST}/api/jobs`, {
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



