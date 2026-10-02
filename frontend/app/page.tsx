"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Search,
  Command,
  Send,
  Bell,
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
import { EmptyState, ErrorState } from "@/components/ui/States";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import CareerPipeline from "@/components/CareerPipeline";
import TodayActions from "@/components/TodayActions";
import { parseNaturalLanguageQuery } from "@/components/AiCommandBar";

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [commandQuery, setCommandQuery] = useState("");

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

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandQuery.trim()) return;
    const targetUrl = parseNaturalLanguageQuery(commandQuery);
    router.push(targetUrl);
  };

  const handleExecuteQuery = (text: string) => {
    const targetUrl = parseNaturalLanguageQuery(text);
    router.push(targetUrl);
  };

  const pCounts = data?.pipeline_counts;

  if (loading && !data) {
    return <DashboardSkeleton />;
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
    <div className="space-y-12 sm:space-y-14 pb-16">
      {/* 1. Hero Experience (AI Career Command Center) */}
      <section className="pt-4 sm:pt-8 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold tracking-wide max-w-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="sm:hidden">AI Copilot Active</span>
            <span className="hidden sm:inline">AI Copilot Active • Zero-Hallucination Mode • 11 Discovery Portals</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15] break-words">
            Your AI copilot for the job search.
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 font-normal leading-relaxed max-w-3xl">
            Find verified fresher opportunities, compile fact-grounded resumes, discover referrals, dispatch authorized outreach, and track applications.
          </p>

          {/* Ask CareerPilot Natural Language Command Bar */}
          <div className="pt-3 max-w-2xl">
            <form onSubmit={handleCommandSubmit} className="relative flex items-center">
              <Sparkles className="absolute left-4 w-5 h-5 text-blue-500 animate-pulse pointer-events-none" />
              <input
                type="text"
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Ask CareerPilot anything... (e.g. 'Show me remote React fresher jobs')"
                className="w-full pl-12 pr-24 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 shadow-card focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <div className="absolute right-2 flex items-center gap-1.5">
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  className="text-xs px-3.5 py-1.5"
                >
                  Ask
                </Button>
              </div>
            </form>

            {/* Quick Suggestion Chips */}
            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
              <span className="text-slate-400 dark:text-slate-500 text-[11px] font-medium">Try:</span>
              <button
                onClick={() => handleExecuteQuery("Show me remote React fresher jobs")}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition-colors"
              >
                Remote React fresher jobs
              </button>
              <button
                onClick={() => handleExecuteQuery("Check my upcoming deadlines and OAs")}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition-colors"
              >
                Upcoming deadlines & OAs
              </button>
              <button
                onClick={() => handleExecuteQuery("Outreach drafts awaiting review")}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition-colors"
              >
                Outreach drafts
              </button>
              <button
                onClick={() => handleExecuteQuery("Job alerts")}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition-colors"
              >
                Job alerts
              </button>
            </div>
          </div>
        </div>

        {/* 2. Interactive Progression Pipeline */}
        <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800/80">
          <CareerPipeline
            counts={{
              jobs: pCounts?.jobs_count || 0,
              analyzed: data?.jobs_discovered?.active_jobs || 0,
              matched: pCounts?.matched_count || 0,
              tailored: pCounts?.tailored_resumes_count || 0,
              referrals: pCounts?.referrals_count || 0,
              applied: pCounts?.applied_count || 0,
              interviews: pCounts?.interviews_count || 0,
              gaps: data?.skill_gaps?.length || 0,
            }}
          />
        </div>
      </section>

      {/* 3. "Today" Section: Proactive Next Actions */}
      <TodayActions data={data} />

      {/* 4. Core Career Command Metrics */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Active Career Metrics
          </h2>
          <button
            onClick={loadDashboard}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <Metric
            label="Active Opportunities"
            value={data?.jobs_discovered?.total_jobs || 0}
            subtext={`${data?.jobs_discovered?.active_jobs || 0} open positions`}
            icon={<Briefcase className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
          />
          <Metric
            label="Strong Matches"
            value={data?.pipeline_counts?.matched_count || 0}
            subtext="Ready to apply & tailor"
            icon={<Sparkles className="w-4 h-4 text-blue-500" />}
          />
          <Metric
            label="Tailored Resumes"
            value={data?.pipeline_counts?.tailored_resumes_count || 0}
            subtext={`${data?.pipeline_counts?.compiled_pdfs_count || 0} PDFs compiled`}
            icon={<FileCode className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
          />
          <Metric
            label="Referrals"
            value={data?.pipeline_counts?.referrals_count || 0}
            subtext={`${data?.pipeline_counts?.pending_approvals_count || 0} review needed`}
            icon={<Users2 className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
          />
          <Metric
            label="Interviews"
            value={data?.pipeline_counts?.interviews_count || 0}
            subtext="Mock prep sessions"
            icon={<GraduationCap className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
          />
        </div>
      </section>

      {/* 5. Human-in-the-Loop Action Required Banner */}
      {data?.outreach_requiring_approval && data.outreach_requiring_approval.length > 0 && (
        <section className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200 tracking-tight">
                  Human Approval Required ({data.outreach_requiring_approval.length} Outreach Drafts)
                </h3>
                <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                  CareerPilot never auto-sends messages. Review the AI-generated outreach drafts before copying or sending.
                </p>
              </div>
            </div>
            <Link
              href="/outreach"
              className="text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-200 hover:underline shrink-0"
            >
              View All Drafts →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {data.outreach_requiring_approval.slice(0, 2).map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-[#111827] rounded-xl border border-amber-200/80 dark:border-amber-900/50 p-4 shadow-subtle dark:shadow-none flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900 dark:text-white">{item.contact_name}</span>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                      {item.channel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {item.job_company} • {item.job_role || "Referral Outreach"}
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-2.5 line-clamp-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg font-mono leading-relaxed">
                    &quot;{item.body_snippet}&quot;
                  </p>
                </div>

                <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
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
                    disabled={approvingId === item.id}
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

      {/* 6. High-Priority Matches Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              High Match Discovered Roles
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Ranked with deterministic fact-grounding against your master resume.
            </p>
          </div>
          <Link
            href="/jobs"
            className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
          >
            <span>Explore all 11 Sources</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </Link>
        </div>

        {data?.strong_matches && data.strong_matches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.strong_matches.slice(0, 3).map((job) => (
              <JobCard
                key={job.job_id}
                id={job.job_id}
                role={job.role}
                company={job.company}
                location={job.location || "Remote"}
                employmentType={job.employment_type || "Full-time"}
                matchScore={job.match_score}
                matchCategory={job.match_category}
                actionLabel="Tailor Resume"
                actionHref={`/resumes?job_id=${job.job_id}`}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No high matches found yet"
            description="Run a new job discovery scrape or tailor your skills in your candidate profile."
            action={{
              label: "Explore Discovered Jobs",
              onClick: () => router.push("/jobs"),
            }}
          />
        )}
      </section>

      {/* 7. Fast Access: Tailored Resumes & Mock Interviews */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tailored Resumes Studio Quick Link */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader
              title="Tailored Resumes"
              subtitle="LaTeX resumes compiled with factual evidence."
              action={
                <Link
                  href="/resumes"
                  className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
                >
                  <span>Open Studio</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              }
            />

            {data?.tailored_resumes && data.tailored_resumes.length > 0 ? (
              <div className="mt-4 space-y-3">
                {data.tailored_resumes.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850 flex items-center justify-between text-xs sm:text-sm"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">{item.job_role}</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.job_company} • v{item.version_number}</p>
                    </div>
                    <Badge variant={item.pdf_compiled ? "success" : "neutral"} size="sm">
                      {item.pdf_compiled ? "PDF Ready" : "Draft"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm text-slate-500 dark:text-slate-400 space-y-2">
                <p>No tailored resumes created yet.</p>
                <Link
                  href={data?.strong_matches?.[0]?.job_id ? `/resumes?job_id=${data.strong_matches[0].job_id}` : "/jobs"}
                  className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  <span>Tailor resume for top match</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/resumes"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-between"
            >
              <span>Manage all tailored resumes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Card>

        {/* Mock Interview Prep Quick Link */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader
              title="Interview Co-Pilot"
              subtitle="Role-tailored technical & behavioral mock prep."
              action={
                <Link
                  href="/interview"
                  className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
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
                    className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850 flex items-center justify-between text-xs sm:text-sm"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">{item.role}</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.company} • {item.stage_or_status}</p>
                    </div>
                    <Link
                      href={`/interview?job_id=${item.id}`}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
                    >
                      {item.score != null ? `${Math.round(item.score)}%` : "Start Mock"}
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm text-slate-500 dark:text-slate-400 space-y-2">
                <p>No active interview prep sessions.</p>
                <Link
                  href="/interview"
                  className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  <span>Generate prep kit for a job</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/interview"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-between"
            >
              <span>Launch Mock Interview Simulator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Card>
      </section>

      {/* 8. Skill Gaps & Recommended Bridge Projects */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Market Skill Gaps & Project Evidence
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Verified through job market analysis and GitHub repository intelligence.
            </p>
          </div>
          <Link
            href="/insights"
            className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
          >
            <span>Full Insights & GitHub Analyzer</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Skill Gaps */}
          <Card>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Top In-Demand Gaps</h3>
            {data?.skill_gaps && data.skill_gaps.length > 0 ? (
              <div className="space-y-2">
                {data.skill_gaps.slice(0, 4).map((gap, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs sm:text-sm"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">{gap.skill}</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{gap.category}</p>
                    </div>
                    <Badge variant={gap.priority === "HIGH" ? "error" : "warning"} size="sm">
                      {gap.priority} Priority
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500">No critical skill gaps identified.</p>
            )}
          </Card>

          {/* Recommended Projects */}
          <Card>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Targeted Portfolio Projects</h3>
            {data?.recommended_projects && data.recommended_projects.length > 0 ? (
              <div className="space-y-2">
                {data.recommended_projects.slice(0, 3).map((proj, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs space-y-1.5"
                  >
                    <span className="font-semibold text-slate-900 dark:text-white block sm:text-sm">{proj.title}</span>
                    <p className="text-slate-500 dark:text-slate-400 line-clamp-1 leading-relaxed">{proj.description}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(proj.focus_skills || []).slice(0, 3).map((sk, sidx) => (
                        <span
                          key={sidx}
                          className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300 font-medium"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500">No project recommendations generated yet.</p>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
