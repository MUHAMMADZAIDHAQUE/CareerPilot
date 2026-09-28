"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Briefcase,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Sparkles,
  Send,
  FileCheck2,
  FileText,
  ExternalLink,
  ChevronRight,
  Check,
  X,
  ShieldCheck,
  TrendingUp,
  FolderGit2,
  Calendar,
  Target,
  Award,
  Users2,
  Layers,
  GraduationCap,
  Kanban,
  Github,
  Mail,
  Linkedin,
  Cpu,
  BadgeAlert,
} from "lucide-react";
import {
  fetchDashboardSummaryApi,
  approveOutreachApi,
  rejectOutreachApi,
  DashboardSummaryResponse,
} from "@/lib/api";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    const res = await fetchDashboardSummaryApi();
    setLoading(false);
    if (res.data) {
      setData(res.data);
    } else {
      setError(res.error || "Failed to load dashboard data");
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleApproveOutreach = async (id: string) => {
    setApprovingId(id);
    const res = await approveOutreachApi(id);
    setApprovingId(null);
    if (res.data) {
      // Refresh dashboard data seamlessly
      loadDashboard();
    }
  };

  const handleRejectOutreach = async (id: string) => {
    setApprovingId(id);
    const res = await rejectOutreachApi(id);
    setApprovingId(null);
    if (res.data) {
      loadDashboard();
    }
  };

  const pCounts = data?.pipeline_counts;

  // Pipeline Stepper configuration representing the Main Flow:
  // Job → Match → Tailor Resume → Generate PDF → Find Referral → Generate Outreach → Approve → Apply → Track → Interview Prep
  const pipelineSteps = [
    { num: 1, label: "Job", href: "/jobs", count: pCounts?.jobs_count || 0 },
    { num: 2, label: "Match", href: "/jobs", count: pCounts?.matched_count || 0 },
    { num: 3, label: "Tailor Resume", href: "/resumes", count: pCounts?.tailored_resumes_count || 0 },
    { num: 4, label: "Generate PDF", href: "/resumes", count: pCounts?.compiled_pdfs_count || 0 },
    { num: 5, label: "Find Referral", href: "/jobs", count: pCounts?.referrals_count || 0 },
    { num: 6, label: "Generate Outreach", href: "/outreach", count: pCounts?.outreaches_count || 0 },
    {
      num: 7,
      label: "Approve",
      href: "/outreach",
      count: pCounts?.pending_approvals_count || 0,
      highlight: (pCounts?.pending_approvals_count || 0) > 0,
    },
    { num: 8, label: "Apply", href: "/applications", count: pCounts?.applied_count || 0 },
    { num: 9, label: "Track", href: "/applications", count: data?.applications.total_applications || 0 },
    { num: 10, label: "Interview Prep", href: "/interview", count: pCounts?.interviews_count || 0 },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">CareerPilot Command Center</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 font-medium">
              Phase 15 Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {data?.profile_completion.candidate_name
              ? `Logged in as ${data.profile_completion.candidate_name}${
                  data.profile_completion.candidate_headline
                    ? ` • ${data.profile_completion.candidate_headline}`
                    : ""
                }`
              : "End-to-end career copilot & application pipeline"}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-brand-400" : ""}`} />
            <span>Sync Dashboard</span>
          </button>

          <Link
            href="/jobs/analyze"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors shadow-sm"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Analyze New JD</span>
          </Link>
        </div>
      </div>

      {/* Main Flow Stepper (Job → Match → Tailor → PDF → Referral → Outreach → Approve → Apply → Track → Interview) */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            End-to-End Career Progression Flow
          </span>
          <span className="text-[11px] text-slate-500">Click any step to jump to its workflow</span>
        </div>

        <div className="flex items-center overflow-x-auto py-1 space-x-2 text-xs">
          {pipelineSteps.map((step, idx) => (
            <React.Fragment key={step.num}>
              <Link
                href={step.href}
                className={`group flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border whitespace-nowrap transition-colors ${
                  step.highlight
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300 font-semibold"
                    : "bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-200 text-[10px] flex items-center justify-center font-mono">
                  {step.num}
                </span>
                <span>{step.label}</span>
                <span className="text-[10px] font-mono px-1 rounded bg-slate-800/80 text-slate-400">
                  {step.count}
                </span>
              </Link>

              {idx < pipelineSteps.length - 1 && (
                <span className="text-slate-600 shrink-0 font-mono text-xs">&rarr;</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* High-Level KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Profile Score */}
        <Link
          href="/profile"
          className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Profile Readiness</span>
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          </div>
          <div className="mt-1 flex items-baseline space-x-1">
            <span className="text-xl font-bold text-white">
              {data?.profile_completion.score || 0}%
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-brand-500 h-full rounded-full"
              style={{ width: `${data?.profile_completion.score || 0}%` }}
            />
          </div>
        </Link>

        {/* Metric 2: Discovered Jobs */}
        <Link
          href="/jobs"
          className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Jobs Sourced</span>
            <Briefcase className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="mt-1">
            <span className="text-xl font-bold text-white">
              {data?.jobs_discovered.total_jobs || 0}
            </span>
            <span className="text-[11px] text-emerald-400 ml-1.5 font-medium">
              {data?.jobs_discovered.active_jobs || 0} active
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 truncate">From verified feeds & portals</p>
        </Link>

        {/* Metric 3: Active Applications */}
        <Link
          href="/applications"
          className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>CRM Pipeline</span>
            <Kanban className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="mt-1">
            <span className="text-xl font-bold text-white">
              {data?.applications.total_applications || 0}
            </span>
            <span className="text-[11px] text-slate-400 ml-1.5">applications</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 truncate">
            {data?.applications.by_status?.INTERVIEW || 0} in interview stages
          </p>
        </Link>

        {/* Metric 4: Outreach Pending Approval */}
        <Link
          href="/outreach"
          className={`p-3.5 rounded-xl border transition-colors ${
            (data?.outreach_requiring_approval.length || 0) > 0
              ? "bg-amber-500/10 border-amber-500/30"
              : "bg-slate-900/70 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className={(data?.outreach_requiring_approval.length || 0) > 0 ? "text-amber-300 font-semibold" : ""}>
              Outreach Review
            </span>
            <Send className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-1">
            <span className="text-xl font-bold text-white">
              {data?.outreach_requiring_approval.length || 0}
            </span>
            <span className="text-[11px] text-amber-400 ml-1.5 font-medium">pending</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 truncate">Human approval required</p>
        </Link>

        {/* Metric 5: Interviews */}
        <Link
          href="/interview"
          className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Interview Prep</span>
            <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-1">
            <span className="text-xl font-bold text-white">
              {data?.interviews.length || 0}
            </span>
            <span className="text-[11px] text-slate-400 ml-1.5">sessions</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 truncate">STAR & tech question kits</p>
        </Link>

        {/* Metric 6: Actionable Follow-ups */}
        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Pending Follow-ups</span>
            <Clock className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="mt-1">
            <span className="text-xl font-bold text-white">
              {data?.follow_ups.length || 0}
            </span>
            {data?.follow_ups.some((f) => f.is_overdue) ? (
              <span className="text-[11px] text-rose-400 ml-1.5 font-medium">action due</span>
            ) : (
              <span className="text-[11px] text-slate-400 ml-1.5">on schedule</span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-2 truncate">Recruiter & referral touches</p>
        </div>
      </div>

      {/* Main 10-Section High-Density Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Primary Actionables & Job Intelligence */}
        <div className="lg:col-span-7 space-y-6">
          {/* SECTION 6: OUTREACH REQUIRING APPROVAL (High Priority Alert Card if items exist) */}
          {data && data.outreach_requiring_approval.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center justify-between pb-3 border-b border-amber-500/20 mb-3">
                <div className="flex items-center space-x-2">
                  <BadgeAlert className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">
                    Section 6: Outreach Drafts Requiring Human-in-the-Loop Approval ({data.outreach_requiring_approval.length})
                  </h3>
                </div>
                <Link
                  href="/outreach"
                  className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
                >
                  <span>Open Outreach Hub</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="space-y-2.5">
                {data.outreach_requiring_approval.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-semibold text-white">{item.contact_name}</span>
                        <span className="text-slate-400">@ {item.job_company}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded uppercase bg-slate-800 text-slate-300">
                          {item.channel}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] line-clamp-1 italic">
                        &quot;{item.body_snippet}&quot;
                      </p>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        onClick={() => handleApproveOutreach(item.id)}
                        disabled={approvingId === item.id}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-[11px] flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleRejectOutreach(item.id)}
                        disabled={approvingId === item.id}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 3: STRONG JOB MATCHES */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-emerald-400" />
                  Section 3: Strong Job Matches
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ranked deterministically by required skill coverage & dense semantic alignment
                </p>
              </div>
              <Link
                href="/jobs"
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
              >
                <span>All Jobs</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {data?.strong_matches && data.strong_matches.length > 0 ? (
              <div className="space-y-2.5">
                {data.strong_matches.map((job) => (
                  <div
                    key={job.job_id}
                    className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-sm">{job.role}</span>
                        <span className="text-slate-400 font-medium">@ {job.company}</span>
                        {job.location && (
                          <span className="text-[10px] text-slate-500">({job.location})</span>
                        )}
                      </div>

                      {/* Skill tags */}
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {job.matched_skills.map((s) => (
                          <span
                            key={s}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          >
                            &check; {s}
                          </span>
                        ))}
                        {job.missing_skills.map((s) => (
                          <span
                            key={s}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          >
                            &times; {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {Math.round(job.match_score)}% Match
                      </span>
                      <Link
                        href={`/jobs`}
                        className="px-2.5 py-1 rounded bg-brand-600 hover:bg-brand-500 text-white font-medium text-[11px] flex items-center gap-1 shadow-sm"
                      >
                        <span>Tailor & Apply</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-3">
                No matching jobs found. Analyze a new JD or import jobs to calculate deterministic match scores.
              </p>
            )}
          </div>

          {/* SECTION 4: APPLICATIONS (CRM Pipeline) */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Kanban className="w-4 h-4 text-purple-400" />
                  Section 4: Applications CRM Pipeline ({data?.applications.total_applications || 0})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Stage tracking across Saved, Applied, Screening, Interview, and Offer
                </p>
              </div>
              <Link
                href="/applications"
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
              >
                <span>Kanban Board</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Status breakdown pills */}
            {data?.applications.by_status && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {Object.entries(data.applications.by_status).map(([statusKey, count]) => {
                  if (count === 0) return null;
                  return (
                    <span
                      key={statusKey}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono"
                    >
                      {statusKey.replace("_", " ")}:{" "}
                      <strong className="text-white ml-0.5">{count}</strong>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Recent active applications */}
            <div className="space-y-2">
              {data?.applications.recent_applications.slice(0, 4).map((app) => (
                <div
                  key={app.id}
                  className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-white">{app.role}</span>
                    <span className="text-slate-400 ml-1.5">@ {app.company}</span>
                    {app.next_action && (
                      <p className="text-[11px] text-slate-400 mt-0.5">Next: {app.next_action}</p>
                    )}
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase bg-purple-500/10 text-purple-300 border border-purple-500/30">
                    {app.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 2: JOBS DISCOVERED */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-blue-400" />
                  Section 2: Discovered Jobs ({data?.jobs_discovered.total_jobs || 0})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Authorized company career page imports and verified listings
                </p>
              </div>
              <Link
                href="/jobs"
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
              >
                <span>Explore Sourced</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {data?.jobs_discovered.recent_jobs.slice(0, 4).map((job) => (
                <div
                  key={job.id}
                  className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col justify-between"
                >
                  <div>
                    <span className="font-semibold text-white block truncate">{job.role}</span>
                    <span className="text-slate-400 text-[11px]">{job.company}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span>{job.location}</span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                      {job.source_type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 5: REFERRAL OPPORTUNITIES */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Users2 className="w-4 h-4 text-cyan-400" />
                  Section 5: Referral Opportunities
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verified alumni, former colleagues, and legitimate professional connections
                </p>
              </div>
              <Link
                href="/outreach"
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
              >
                <span>Draft Messages</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {data?.referral_opportunities && data.referral_opportunities.length > 0 ? (
              <div className="space-y-2">
                {data.referral_opportunities.slice(0, 3).map((ref, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-semibold text-white">{ref.contact_name}</span>
                        <span className="text-slate-400">@ {ref.contact_company}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {ref.relationship_type} &bull; {ref.relevance_reason}
                      </p>
                    </div>

                    <Link
                      href="/outreach"
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-medium"
                    >
                      Outreach Draft
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-2">
                No referral connections discovered for current jobs yet. Add contacts to link connections.
              </p>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Profile, Readiness, Gaps & Follow-ups */}
        <div className="lg:col-span-5 space-y-6">
          {/* SECTION 1: PROFILE COMPLETION */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-brand-400" />
                  Section 1: Profile Completion
                </h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                {data?.profile_completion.score || 0}% Complete
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                {data?.profile_completion.completed_items.map((item, idx) => (
                  <div key={idx} className="flex items-center space-x-1.5 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {data?.profile_completion.missing_items && data.profile_completion.missing_items.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block">
                    Action Required To Reach 100%:
                  </span>
                  {data.profile_completion.missing_items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                        {item}
                      </span>
                      <Link href="/profile" className="text-brand-400 hover:underline">
                        Add &rarr;
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 10: ACTIONABLE FOLLOW-UPS */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-rose-400" />
                  Section 10: Actionable Follow-ups ({data?.follow_ups.length || 0})
                </h3>
              </div>
              <Link href="/applications" className="text-xs text-brand-400 hover:text-brand-300">
                Manage
              </Link>
            </div>

            {data?.follow_ups && data.follow_ups.length > 0 ? (
              <div className="space-y-2">
                {data.follow_ups.slice(0, 4).map((f, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-semibold text-white">{f.company}</span>
                        <span className="text-slate-400">({f.role})</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">{f.next_action}</p>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase shrink-0 ${
                        f.is_overdue
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      }`}
                    >
                      {f.is_overdue ? "Overdue" : "Scheduled"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-2">
                No immediate follow-up tasks due today. All active applications are on schedule.
              </p>
            )}
          </div>

          {/* SECTION 7: INTERVIEWS */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-emerald-400" />
                  Section 7: Interviews & Mock Preps ({data?.interviews.length || 0})
                </h3>
              </div>
              <Link
                href="/interview"
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
              >
                <span>Launch Mock Prep</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {data?.interviews && data.interviews.length > 0 ? (
              <div className="space-y-2">
                {data.interviews.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-white">{item.role}</span>
                      <span className="text-slate-400 ml-1.5">@ {item.company}</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">Stage: {item.stage_or_status}</p>
                    </div>

                    {item.score !== null && item.score !== undefined && (
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {Math.round(item.score)}% Score
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-3 text-center">
                <p className="text-xs text-slate-400 mb-2">No active mock interview session</p>
                <Link
                  href="/interview"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  Start Turn-by-Turn Mock Interview
                </Link>
              </div>
            )}
          </div>

          {/* SECTION 8: SKILL GAPS */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  Section 8: Skill Gaps Across Target Jobs
                </h3>
              </div>
              <Link
                href="/career/skill-gaps"
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
              >
                <span>Roadmap</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-1.5 text-xs">
              {data?.skill_gaps.slice(0, 5).map((gap) => (
                <div
                  key={gap.skill}
                  className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between"
                >
                  <span className="font-semibold text-white">{gap.skill}</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] text-slate-500">Demanded in {gap.frequency} jobs</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        gap.current_strength === "Strong"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : gap.priority === "CRITICAL"
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {gap.current_strength === "Strong" ? "Verified" : gap.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 9: RECOMMENDED PROJECTS */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <FolderGit2 className="w-4 h-4 text-violet-400" />
                  Section 9: Recommended Portfolio Projects
                </h3>
              </div>
              <Link
                href="/github"
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
              >
                <span>Analyze Repo</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {data?.recommended_projects.slice(0, 2).map((proj, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-xs space-y-1.5"
                >
                  <div className="font-bold text-white text-xs">{proj.title}</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">{proj.description}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {proj.focus_skills.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
