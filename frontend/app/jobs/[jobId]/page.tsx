"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Briefcase,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Building2,
  MapPin,
  Clock,
  DollarSign,
  GraduationCap,
  Layers,
  Code2,
  ExternalLink,
  ChevronRight,
  Sliders,
  ShieldCheck,
  FolderGit2,
  FileText,
  FileCode,
  Users2,
  Kanban,
  Send,
  Plus,
  ArrowRight,
} from "lucide-react";
import {
  fetchJobApi,
  matchCandidateToJobApi,
  fetchLatestMatchApi,
  tailorResumeApi,
  fetchLatestTailoredResumeApi,
  createApplicationApi,
  fetchJobReferralsApi,
  fetchInterviewPrepApi,
  Job,
  MatchResponse,
  TailorResumeResponse,
  Referral,
  InterviewPreparation,
} from "@/lib/api";
import TailoredResumeStudio from "@/components/TailoredResumeStudio";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";

export default function JobMatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = (params?.jobId as string) || "";

  const [job, setJob] = useState<Job | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tailoring state
  const [tailorData, setTailorData] = useState<TailorResumeResponse | null>(null);
  const [tailoringLoading, setTailoringLoading] = useState(false);
  const [tailoringError, setTailoringError] = useState<string | null>(null);

  // Referral state
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);

  // Interview prep preview
  const [interviewPrep, setInterviewPrep] = useState<InterviewPreparation | null>(null);

  // Application tracker feedback
  const [trackingApplication, setTrackingApplication] = useState(false);
  const [trackingSuccess, setTrackingSuccess] = useState<string | null>(null);

  const loadData = async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Job
      const jobRes = await fetchJobApi(jobId);
      if (jobRes.error || !jobRes.data) {
        setError(jobRes.error || "Job not found");
        setLoading(false);
        return;
      }
      setJob(jobRes.data);

      // 2. Fetch or compute Match
      const matchRes = await fetchLatestMatchApi(jobId);
      if (matchRes.data) {
        setMatchResult(matchRes.data);
      } else {
        const newMatch = await matchCandidateToJobApi(jobId);
        if (newMatch.data) {
          setMatchResult(newMatch.data);
        }
      }

      // 3. Check for existing tailored resume
      const tailorRes = await fetchLatestTailoredResumeApi(jobId);
      if (tailorRes.data) {
        setTailorData({
          version: tailorRes.data,
          master_resume_content: "",
          validation_report: { is_valid: true, checks: [], passed_checks: [], failed_checks: [], metrics_audited: [], technologies_audited: [], errors: [], warnings: [] },
          diff_summary: { total_sections_audited: 5, sections_modified: 1, skills_reordered: true, projects_reordered: false, bullets_tailored: 2, unsupported_claims_added: 0, section_diffs: [] },
          message: "Loaded existing tailored resume",
          retries_attempted: 0,
        });
      }

      // 4. Fetch referrals
      const refRes = await fetchJobReferralsApi(jobId);
      if (refRes.data) {
        setReferrals(refRes.data.referrals || []);
      }

      // 5. Fetch interview prep kit preview
      const prepRes = await fetchInterviewPrepApi(jobId);
      if (prepRes.data) {
        setInterviewPrep(prepRes.data);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load job details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [jobId]);

  const handleGenerateTailoredResume = async () => {
    setTailoringLoading(true);
    setTailoringError(null);
    try {
      const res = await tailorResumeApi(jobId);
      if (res.data) {
        setTailorData(res.data);
      } else {
        setTailoringError(res.error || "Failed to generate tailored resume");
      }
    } catch (err: any) {
      setTailoringError(err?.message || "Tailoring failed");
    } finally {
      setTailoringLoading(false);
    }
  };

  const handleTrackApplication = async (status: string = "SAVED") => {
    setTrackingApplication(true);
    setTrackingSuccess(null);
    try {
      const res = await createApplicationApi({
        job_id: jobId,
        status: status as any,
        notes: `Tracked from job detail page for ${job?.role} at ${job?.company}.`,
      });
      if (res.data) {
        setTrackingSuccess(`Application tracked as "${status}" in CRM!`);
      } else if (res.error) {
        setTrackingSuccess(res.error);
      }
    } catch (err: any) {
      setTrackingSuccess("Failed to track application.");
    } finally {
      setTrackingApplication(false);
    }
  };

  if (loading && !job) {
    return <LoadingState message="Loading job specifications and computing evidence alignment..." className="min-h-[50vh]" />;
  }

  if (error && !job) {
    return (
      <div className="py-12 max-w-xl mx-auto">
        <ErrorState title="Job not found" error={error} onRetry={loadData} />
      </div>
    );
  }

  const score = matchResult ? Math.round(matchResult.overall_match_score * 100) : null;

  return (
    <div className="space-y-10 pb-20">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Jobs</span>
        </Link>

        <div className="flex items-center gap-2">
          {(job?.application_url || job?.canonical_url) && (
            <a
              href={(job.application_url || job.canonical_url)!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition-colors font-medium"
            >
              <span>Original Posting</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Main Job Hero Header */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-3 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-400" />
              {job?.company}
            </span>
            {(job?.source_name || job?.source_type) && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                {job.source_name || job.source_type}
              </span>
            )}
            {job?.is_active === false && (
              <Badge variant="error" size="sm">
                Expired
              </Badge>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
            {job?.role}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            {job?.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {job.location}
              </span>
            )}
            {job?.experience_requirement && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {job.experience_requirement}
              </span>
            )}
            {job?.employment_type && (
              <span className="flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                {job.employment_type}
              </span>
            )}
            {job?.salary && (
              <span className="flex items-center gap-1 font-medium text-slate-700">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                {job.salary}
              </span>
            )}
          </div>
        </div>

        {/* Deterministic Match Badge */}
        {score !== null && (
          <div className="shrink-0 flex lg:flex-col items-center justify-between gap-2 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-center">
              <span className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight block">
                {score}%
              </span>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mt-0.5">
                Deterministic Fit
              </span>
            </div>

            <div className="text-[10px] text-emerald-700 font-medium px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-200">
              Grounded Evidence
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/70 text-xs">
        <span className="font-semibold text-slate-400 uppercase tracking-wider px-2">
          Jump To:
        </span>
        <a href="#overview" className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:border-slate-300 font-medium">
          01 Overview
        </a>
        <a href="#why-match" className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:border-slate-300 font-medium">
          02 Why You Match
        </a>
        <a href="#missing-skills" className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:border-slate-300 font-medium">
          03 Missing Skills
        </a>
        <a href="#resume-alignment" className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:border-slate-300 font-medium">
          04 Resume Alignment
        </a>
        <a href="#referrals" className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:border-slate-300 font-medium">
          05 Referral Opportunities
        </a>
        <a href="#interview" className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:border-slate-300 font-medium">
          06 Interview Prep
        </a>
        <a href="#application-status" className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:border-slate-300 font-medium">
          07 Application Status
        </a>
      </div>

      {/* 01 Overview */}
      <section id="overview" className="space-y-4 pt-4">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono font-bold text-slate-400">01</span>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Overview & Description</h2>
        </div>

        <Card>
          <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap font-sans text-xs sm:text-sm">
            {job?.raw_description || "No full description provided for this job listing."}
          </div>

          {job?.required_skills && job.required_skills.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Extracted Job Requirements ({job.required_skills.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {job.required_skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200/80"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* 02 Why You Match */}
      <section id="why-match" className="space-y-4 pt-6 border-t border-slate-100">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono font-bold text-slate-400">02</span>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Why You Match</h2>
        </div>

        {matchResult ? (
          <div className="space-y-4">
            {/* Component breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
                <span className="text-xs text-slate-500 block">Required Skills</span>
                <span className="text-lg font-semibold text-slate-900 block mt-1">
                  {Math.round((matchResult.required_skill_coverage || 0) * 100)}%
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Weight 35%</span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
                <span className="text-xs text-slate-500 block">Semantic Fit</span>
                <span className="text-lg font-semibold text-slate-900 block mt-1">
                  {Math.round((matchResult.semantic_score || 0) * 100)}%
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Weight 25%</span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
                <span className="text-xs text-slate-500 block">Experience</span>
                <span className="text-lg font-semibold text-slate-900 block mt-1">
                  {Math.round((matchResult.experience_compatibility || 0) * 100)}%
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Weight 15%</span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
                <span className="text-xs text-slate-500 block">Projects</span>
                <span className="text-lg font-semibold text-slate-900 block mt-1">
                  {Math.round((matchResult.project_relevance || 0) * 100)}%
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Weight 15%</span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
                <span className="text-xs text-slate-500 block">Education</span>
                <span className="text-lg font-semibold text-slate-900 block mt-1">
                  {Math.round((matchResult.education_compatibility || 0) * 100)}%
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Weight 10%</span>
              </div>
            </div>

            {/* Grounded Evidence List */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Strong Candidate Evidence</h3>
              {matchResult.matched_skills && matchResult.matched_skills.length > 0 ? (
                <div className="space-y-2.5">
                  {matchResult.matched_skills.map((skill, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50 flex items-start justify-between gap-4 text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-semibold text-slate-900">{skill}</span>
                      </div>
                      <span className="text-slate-500 text-[11px]">
                        Verified in candidate profile & past experience
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No direct skills matched yet.</p>
              )}
            </Card>
          </div>
        ) : (
          <EmptyState
            title="Match Score Pending"
            description="Run the match engine to compute deterministic compatibility."
            actionText="Run Match Engine"
            onAction={loadData}
          />
        )}
      </section>

      {/* 03 Missing Skills */}
      <section id="missing-skills" className="space-y-4 pt-6 border-t border-slate-100">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono font-bold text-slate-400">03</span>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Missing Skills & Gaps</h2>
        </div>

        <Card>
          {((matchResult?.missing_required_skills?.length || 0) + (matchResult?.missing_preferred_skills?.length || 0)) > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                These required competencies were specified in the JD but not found in your verified candidate profile.
              </p>
              <div className="flex flex-wrap gap-2">
                {[...(matchResult?.missing_required_skills || []), ...(matchResult?.missing_preferred_skills || [])].map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>{skill}</span>
                  </span>
                ))}
              </div>
              <div className="pt-2">
                <Link
                  href="/insights"
                  className="text-xs font-semibold text-slate-900 hover:underline inline-flex items-center gap-1"
                >
                  <span>View targeted learning roadmap in Insights</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Full requirement coverage! No critical missing skills detected.</span>
            </div>
          )}
        </Card>
      </section>

      {/* 04 Resume Alignment & Tailoring Studio */}
      <section id="resume-alignment" className="space-y-4 pt-6 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold text-slate-400">04</span>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Resume Alignment & Tailoring</h2>
          </div>

          {!tailorData && (
            <Button
              size="sm"
              variant="primary"
              onClick={handleGenerateTailoredResume}
              loading={tailoringLoading}
              icon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Generate Tailored Resume
            </Button>
          )}
        </div>

        {tailoringError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {tailoringError}
          </div>
        )}

        {tailorData ? (
          <TailoredResumeStudio
            tailorData={tailorData}
            jobRole={job?.role || "Role"}
            companyName={job?.company || "Company"}
            onRetailor={handleGenerateTailoredResume}
            isLoading={tailoringLoading}
          />
        ) : (
          <Card className="text-center py-12 space-y-3">
            <FileCode className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-900">No Tailored Resume Generated Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Our non-fabricating tailoring agent aligns your verified achievements to this exact job description, audited by an AST validator.
            </p>
            <Button
              size="md"
              variant="primary"
              onClick={handleGenerateTailoredResume}
              loading={tailoringLoading}
              icon={<Sparkles className="w-4 h-4" />}
            >
              Tailor Resume for this Job
            </Button>
          </Card>
        )}
      </section>

      {/* 05 Referral Opportunities */}
      <section id="referrals" className="space-y-4 pt-6 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold text-slate-400">05</span>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Referral Opportunities</h2>
          </div>

          <Link
            href={`/jobs/${jobId}/referrals`}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1"
          >
            <span>Explore All Contacts</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        </div>

        <Card>
          {referrals && referrals.length > 0 ? (
            <div className="space-y-3">
              {referrals.slice(0, 3).map((ref) => (
                <div
                  key={ref.id}
                  className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-900">{ref.contact?.name || "Contact"}</span>
                    <p className="text-slate-500">
                      {ref.contact?.role} at {ref.contact?.company}
                    </p>
                    <p className="text-slate-600 mt-1 italic">&quot;{ref.relevance_reason}&quot;</p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <Badge variant="neutral" size="sm">
                      {Math.round(ref.relevance_score > 1 ? ref.relevance_score : ref.relevance_score * 100)}% Match
                    </Badge>
                    <Link
                      href="/outreach"
                      className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-medium text-[11px] hover:bg-slate-800 transition-colors"
                    >
                      Draft Outreach
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center space-y-2">
              <Users2 className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-500">
                No immediate contacts mapped to {job?.company}.
              </p>
              <Link
                href="/referrals"
                className="text-xs font-semibold text-slate-900 hover:underline inline-flex items-center gap-1"
              >
                <span>Add new contact in Referrals Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </Card>
      </section>

      {/* 06 Interview Preparation */}
      <section id="interview" className="space-y-4 pt-6 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold text-slate-400">06</span>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Interview Preparation</h2>
          </div>

          <Link
            href={`/interview?job_id=${jobId}`}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1"
          >
            <span>Launch Mock Simulator</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        </div>

        <Card>
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Practice turn-by-turn mock interview simulations with questions tailored to {job?.role} at {job?.company}.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                <span className="font-semibold text-slate-900 block">Technical Architecture</span>
                <p className="text-slate-500 mt-0.5">High-throughput microservices, API contracts</p>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                <span className="font-semibold text-slate-900 block">Behavioral & Culture</span>
                <p className="text-slate-500 mt-0.5">STAR method, incident response, team alignment</p>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                <span className="font-semibold text-slate-900 block">Company Specifics</span>
                <p className="text-slate-500 mt-0.5">{job?.company} engineering philosophy</p>
              </div>
            </div>

            <div className="pt-3">
              <Link
                href={`/interview?job_id=${jobId}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-subtle"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Start Interactive Mock Interview</span>
              </Link>
            </div>
          </div>
        </Card>
      </section>

      {/* 07 Application Status */}
      <section id="application-status" className="space-y-4 pt-6 border-t border-slate-100">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono font-bold text-slate-400">07</span>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Application Status & Tracking</h2>
        </div>

        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Track Application in CRM
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Add this opportunity to your Kanban board and schedule follow-ups.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTrackApplication("SAVED")}
                loading={trackingApplication}
              >
                Save Job
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleTrackApplication("READY_TO_APPLY")}
                loading={trackingApplication}
              >
                Ready to Apply
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleTrackApplication("APPLIED")}
                loading={trackingApplication}
                icon={<Kanban className="w-3.5 h-3.5" />}
              >
                Mark as Applied
              </Button>
            </div>
          </div>

          {trackingSuccess && (
            <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
              {trackingSuccess}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
