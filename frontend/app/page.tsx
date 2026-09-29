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
  FileCheck2,
  FileText,
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
  GraduationCap,
  Kanban,
  FileCode,
  Sliders,
  ExternalLink,
} from "lucide-react";
import {
  fetchDashboardSummaryApi,
  approveOutreachApi,
  rejectOutreachApi,
  DashboardSummaryResponse,
} from "@/lib/api";
import { Metric } from "@/components/ui/Metric";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { JobCard } from "@/components/ui/JobCard";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/States";

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

  // 10-step Career Workflow specified in prompt
  const workflowSteps = [
    { label: "Discover Jobs", href: "/jobs", count: pCounts?.jobs_count || 0 },
    { label: "Analyze", href: "/jobs/analyze", count: data?.jobs_discovered.active_jobs || 0 },
    { label: "Match", href: "/jobs", count: pCounts?.matched_count || 0 },
    { label: "Tailor Resume", href: "/resumes", count: pCounts?.tailored_resumes_count || 0 },
    { label: "Find Referrals", href: "/referrals", count: pCounts?.referrals_count || 0 },
    { label: "Apply", href: "/applications", count: pCounts?.applied_count || 0 },
    { label: "Prepare", href: "/interview", count: pCounts?.interviews_count || 0 },
    { label: "Improve", href: "/insights", count: data?.skill_gaps?.length || 0 },
  ];

  if (loading && !data) {
    return <LoadingState message="Loading your career copilot workspace..." className="min-h-[50vh]" />;
  }

  if (error && !data) {
    return (
      <div className="py-12 max-w-xl mx-auto">
        <ErrorState
          title="Could not load dashboard data"
          error={error}
          onRetry={loadDashboard}
        />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-16">
      {/* 1. Hero Experience */}
      <section className="pt-6 sm:pt-10 pb-4 border-b border-slate-100">
        <div className="max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>AI Copilot Active • Zero Hallucination Mode</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 leading-tight">
            CAREERPILOT
          </h1>
          <p className="text-xl sm:text-2xl text-slate-500 font-normal tracking-tight">
            Your AI copilot for the entire job search.
          </p>
        </div>

        {/* Visual Workflow Stream */}
        <div className="mt-8 pt-6 border-t border-slate-100/80">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Core Career Progression Flow
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {workflowSteps.map((step, idx) => (
              <Link
                key={idx}
                href={step.href}
                className="group p-3 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-subtle transition-all flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-slate-400 group-hover:text-slate-700">
                  <span className="text-[11px] font-mono font-medium">0{idx + 1}</span>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-3">
                  <span className="text-xs font-semibold text-slate-900 block truncate group-hover:text-blue-600 transition-colors">
                    {step.label}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                    {step.count} items
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Key Live Career Metrics */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Live Career Metrics
          </h2>
          <button
            onClick={loadDashboard}
            className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <Metric
            label="Active Applications"
            value={data?.applications.total_applications || 0}
            subtext={`${data?.pipeline_counts.applied_count || 0} submitted`}
            icon={<Kanban className="w-4 h-4 text-slate-400" />}
          />
          <Metric
            label="Strong Matches"
            value={data?.pipeline_counts.matched_count || 0}
            subtext="Ready to apply & tailor"
            icon={<Sparkles className="w-4 h-4 text-slate-400" />}
          />
          <Metric
            label="Interview Preps"
            value={data?.pipeline_counts.interviews_count || 0}
            subtext="Active mock sessions"
            icon={<GraduationCap className="w-4 h-4 text-slate-400" />}
          />
          <Metric
            label="Referral Opportunities"
            value={data?.pipeline_counts.referrals_count || 0}
            subtext={`${data?.pipeline_counts.pending_approvals_count || 0} review needed`}
            icon={<Users2 className="w-4 h-4 text-slate-400" />}
          />
          <Metric
            label="Resume Versions"
            value={data?.pipeline_counts.tailored_resumes_count || 0}
            subtext={`${data?.pipeline_counts.compiled_pdfs_count || 0} PDFs compiled`}
            icon={<FileText className="w-4 h-4 text-slate-400" />}
          />
        </div>
      </section>

      {/* 3. Human-in-the-Loop Action Required Banner */}
      {data?.outreach_requiring_approval && data.outreach_requiring_approval.length > 0 && (
        <section className="rounded-2xl border border-amber-200/90 bg-amber-50/40 p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-amber-900 tracking-tight">
                  Human Approval Required ({data.outreach_requiring_approval.length} Outreach Drafts)
                </h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  CareerPilot never auto-sends messages. Review the AI-generated outreach drafts before copying or sending.
                </p>
              </div>
            </div>
            <Link
              href="/outreach"
              className="text-xs font-semibold text-amber-900 hover:underline shrink-0"
            >
              View All Drafts →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {data.outreach_requiring_approval.slice(0, 2).map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-amber-200/80 p-4 shadow-subtle flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">{item.contact_name}</span>
                    <span className="text-[11px] font-mono text-slate-500 uppercase px-1.5 py-0.5 rounded bg-slate-100">
                      {item.channel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.job_company} • {item.job_role || "Referral Outreach"}
                  </p>
                  <p className="text-xs text-slate-700 mt-2.5 line-clamp-2 bg-slate-50 p-2 rounded-lg font-mono">
                    &quot;{item.body_snippet}&quot;
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRejectOutreach(item.id)}
                    disabled={approvingId === item.id}
                    icon={<X className="w-3.5 h-3.5 text-slate-500" />}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleApproveOutreach(item.id)}
                    loading={approvingId === item.id}
                    icon={<Check className="w-3.5 h-3.5" />}
                  >
                    Approve Draft
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Strong Matches & Next Actions */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
              Strong Job Matches
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Jobs with deterministic skill and project evidence alignment.
            </p>
          </div>
          <Link
            href="/jobs"
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 transition-colors"
          >
            <span>Explore All Jobs</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        </div>

        {data?.strong_matches && data.strong_matches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.strong_matches.slice(0, 6).map((job) => (
              <JobCard
                key={job.job_id}
                id={job.job_id}
                role={job.role}
                company={job.company}
                location={job.location}
                matchScore={job.match_score}
                requiredSkills={job.matched_skills}
                missingSkills={job.missing_skills}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Strong Matches Yet"
            description="Upload your resume or discover new jobs to compute deterministic match scores."
            actionText="Discover Jobs"
            onAction={() => window.location.assign("/jobs")}
          />
        )}
      </section>

      {/* 5. Split Section: Applications CRM & Interview Prep */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Applications */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader
              title="Application Pipeline"
              subtitle="Active stages across your job search"
              action={
                <Link
                  href="/applications"
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1"
                >
                  <span>Kanban Board</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              }
            />

            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-base font-semibold text-slate-900 block">
                  {data?.applications.by_status?.SAVED || 0}
                </span>
                <span className="text-[11px] text-slate-500">Saved</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-base font-semibold text-slate-900 block">
                  {data?.applications.by_status?.APPLIED || 0}
                </span>
                <span className="text-[11px] text-slate-500">Applied</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-base font-semibold text-slate-900 block">
                  {data?.applications.by_status?.INTERVIEW || 0}
                </span>
                <span className="text-[11px] text-slate-500">Interviewing</span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                <span className="text-base font-semibold block">
                  {data?.applications.by_status?.OFFER || 0}
                </span>
                <span className="text-[11px] text-emerald-700">Offers</span>
              </div>
            </div>

            {data?.applications.recent_applications && data.applications.recent_applications.length > 0 ? (
              <div className="mt-4 divide-y divide-slate-100">
                {data.applications.recent_applications.slice(0, 3).map((app) => (
                  <div key={app.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900">{app.role}</span>
                      <p className="text-slate-500">{app.company}</p>
                    </div>
                    <Badge variant={app.status === "OFFER" ? "success" : "neutral"} size="sm">
                      {app.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-400">No applications tracked yet.</p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <Link
              href="/applications"
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center justify-between"
            >
              <span>Manage Application CRM</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Card>

        {/* Interview Preparation */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader
              title="Interview Readiness"
              subtitle="Targeted questions and mock interview simulation"
              action={
                <Link
                  href="/interview"
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1"
                >
                  <span>Practice</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              }
            />

            {data?.interviews && data.interviews.length > 0 ? (
              <div className="mt-4 space-y-3">
                {data.interviews.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{item.role}</span>
                      <p className="text-slate-500">{item.company} • {item.stage_or_status}</p>
                    </div>
                    <Link
                      href="/interview"
                      className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-medium text-[11px] hover:bg-slate-800 transition-colors"
                    >
                      {item.score != null ? `${Math.round(item.score)}%` : "Start Mock"}
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-500">
                <p>No active interview prep sessions.</p>
                <Link
                  href="/interview"
                  className="mt-2 inline-flex items-center gap-1 text-slate-900 font-semibold hover:underline"
                >
                  <span>Generate prep kit for a job</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <Link
              href="/interview"
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center justify-between"
            >
              <span>Launch Mock Interview Simulator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Card>
      </section>

      {/* 6. Skill Gaps & Recommended Bridge Projects */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
              Market Skill Gaps & Project Evidence
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified through job market analysis and GitHub repository intelligence.
            </p>
          </div>
          <Link
            href="/insights"
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 transition-colors"
          >
            <span>Full Insights & GitHub Analyzer</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Skill Gaps */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Top In-Demand Gaps</h3>
            {data?.skill_gaps && data.skill_gaps.length > 0 ? (
              <div className="space-y-2">
                {data.skill_gaps.slice(0, 4).map((gap, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50/50 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{gap.skill}</span>
                      <p className="text-slate-500">{gap.category}</p>
                    </div>
                    <Badge variant={gap.priority === "HIGH" ? "error" : "warning"} size="sm">
                      {gap.priority} Priority
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No critical skill gaps identified.</p>
            )}
          </Card>

          {/* Recommended Projects */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Targeted Portfolio Projects</h3>
            {data?.recommended_projects && data.recommended_projects.length > 0 ? (
              <div className="space-y-2">
                {data.recommended_projects.slice(0, 3).map((proj, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50/50 text-xs space-y-1"
                  >
                    <span className="font-semibold text-slate-900 block">{proj.title}</span>
                    <p className="text-slate-500 line-clamp-1">{proj.description}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(proj.focus_skills || []).slice(0, 3).map((sk, sidx) => (
                        <span
                          key={sidx}
                          className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] text-slate-600 font-medium"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No project recommendations generated yet.</p>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
