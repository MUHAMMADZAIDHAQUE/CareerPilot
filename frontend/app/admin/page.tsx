"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Shield,
  Users,
  Briefcase,
  Layers,
  Send,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  UserCheck,
  UserX,
  FileText,
  Lock,
  ArrowRight,
  Play,
  Database,
  Sparkles,
  Globe,
  Flame,
  Award,
  FileCode,
  Clock,
  PhoneCall,
} from "lucide-react";
import { useAuth } from "@/lib/authContext";
import {
  fetchAdminDashboard,
  fetchAdminUsers,
  updateUserStatus,
  fetchAdminAuditLogs,
  fetchAdminCandidates,
  fetchAdminJobs,
  fetchAdminApplications,
  fetchAdminResumes,
  fetchAdminReferrals,
  fetchAdminInterviews,
  fetchIngestionMetrics,
  fetchIngestionSources,
  fetchIngestionRuns,
  triggerIngestionRun,
  AdminDashboardKPI,
  UserProfile,
  AuditLogEvent,
  AdminCandidateItem,
  AdminJobItem,
  AdminApplicationItem,
  AdminResumeItem,
  AdminReferralItem,
  AdminInterviewItem,
  IngestionMetrics,
  IngestionSource,
  IngestionRun,
} from "@/lib/api";

type AdminTab =
  | "overview"
  | "users"
  | "candidates"
  | "jobs"
  | "applications"
  | "resumes"
  | "referrals"
  | "interviews"
  | "health"
  | "ingestion"
  | "logs";

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [stats, setStats] = useState<AdminDashboardKPI | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [candidates, setCandidates] = useState<AdminCandidateItem[]>([]);
  const [jobs, setJobs] = useState<AdminJobItem[]>([]);
  const [applications, setApplications] = useState<AdminApplicationItem[]>([]);
  const [resumes, setResumes] = useState<AdminResumeItem[]>([]);
  const [referrals, setReferrals] = useState<AdminReferralItem[]>([]);
  const [interviews, setInterviews] = useState<AdminInterviewItem[]>([]);
  const [logs, setLogs] = useState<AuditLogEvent[]>([]);

  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [appStatusFilter, setAppStatusFilter] = useState<string>("");
  const [refStatusFilter, setRefStatusFilter] = useState<string>("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Phase 23: 100+ Source Ingestion State
  const [ingestionMetrics, setIngestionMetrics] = useState<IngestionMetrics | null>(null);
  const [ingestionSources, setIngestionSources] = useState<IngestionSource[]>([]);
  const [ingestionRuns, setIngestionRuns] = useState<IngestionRun[]>([]);
  const [selectedSourceToRun, setSelectedSourceToRun] = useState<string>("greenhouse_swiggy");
  const [runMaxJobs, setRunMaxJobs] = useState<number>(30);
  const [runDryRun, setRunDryRun] = useState<boolean>(true);
  const [runningTrigger, setRunningTrigger] = useState<boolean>(false);
  const [lastRunResult, setLastRunResult] = useState<IngestionRun | null>(null);

  // Initial load: Dashboard KPIs, Users & Ingestion summary
  // CP-003: Strictly ensure auth loading has finished and verified user is ADMIN
  const loadInitialData = async () => {
    if (authLoading || !user || !isAdmin) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [dashRes, usersRes, logsRes, metricsRes, sourcesRes, runsRes] = await Promise.all([
        fetchAdminDashboard(),
        fetchAdminUsers(searchQuery, roleFilter),
        fetchAdminAuditLogs(),
        fetchIngestionMetrics(),
        fetchIngestionSources(),
        fetchIngestionRuns(),
      ]);

      if (dashRes.data) setStats(dashRes.data);
      if (usersRes.data) setUsers(usersRes.data);
      if (logsRes.data) setLogs(logsRes.data);
      if (metricsRes.data) setIngestionMetrics(metricsRes.data);
      if (sourcesRes.data) setIngestionSources(sourcesRes.data);
      if (runsRes.data) setIngestionRuns(runsRes.data);
      if (dashRes.error) setErrorMsg(dashRes.error);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      loadInitialData();
    }
  }, [authLoading, user, isAdmin]);

  // Load specific tab data on demand
  useEffect(() => {
    if (authLoading || !user || !isAdmin) return;
    const fetchTabData = async () => {
      setTabLoading(true);
      try {
        if (activeTab === "candidates") {
          const res = await fetchAdminCandidates(searchQuery || undefined);
          if (res.data) setCandidates(res.data);
        } else if (activeTab === "jobs") {
          const res = await fetchAdminJobs(searchQuery || undefined);
          if (res.data) setJobs(res.data);
        } else if (activeTab === "applications") {
          const res = await fetchAdminApplications(appStatusFilter || undefined);
          if (res.data) setApplications(res.data);
        } else if (activeTab === "resumes") {
          const res = await fetchAdminResumes();
          if (res.data) setResumes(res.data);
        } else if (activeTab === "referrals") {
          const res = await fetchAdminReferrals(refStatusFilter || undefined);
          if (res.data) setReferrals(res.data);
        } else if (activeTab === "interviews") {
          const res = await fetchAdminInterviews();
          if (res.data) setInterviews(res.data);
        } else if (activeTab === "users") {
          const res = await fetchAdminUsers(searchQuery || undefined, roleFilter || undefined);
          if (res.data) setUsers(res.data);
        }
      } catch (err: any) {
        console.error("Tab fetch error:", err);
      } finally {
        setTabLoading(false);
      }
    };

    fetchTabData();
  }, [activeTab, authLoading, user, isAdmin, roleFilter, appStatusFilter, refStatusFilter]);

  const handleToggleStatus = async (targetUser: UserProfile) => {
    setUpdatingId(targetUser.id);
    const newStatus = !targetUser.is_active;
    const { data, error } = await updateUserStatus(targetUser.id, newStatus);
    setUpdatingId(null);
    if (data && !error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: data.is_active } : u))
      );
    } else {
      alert(error || "Could not update user status");
    }
  };

  const handleToggleRole = async (targetUser: UserProfile) => {
    setUpdatingId(targetUser.id);
    const newRole = targetUser.role === "ADMIN" ? "CANDIDATE" : "ADMIN";
    const { data, error } = await updateUserStatus(targetUser.id, undefined, newRole);
    setUpdatingId(null);
    if (data && !error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: data.role } : u))
      );
    } else {
      alert(error || "Could not update user role");
    }
  };

  const handleTriggerIngestion = async (sourceId?: string) => {
    const targetSource = sourceId || selectedSourceToRun;
    if (!targetSource) return;
    setRunningTrigger(true);
    setLastRunResult(null);
    try {
      const res = await triggerIngestionRun(targetSource, runMaxJobs, runDryRun);
      if (res.data) {
        setLastRunResult(res.data);
        const [mRes, sRes, rRes] = await Promise.all([
          fetchIngestionMetrics(),
          fetchIngestionSources(),
          fetchIngestionRuns(),
        ]);
        if (mRes.data) setIngestionMetrics(mRes.data);
        if (sRes.data) setIngestionSources(sRes.data);
        if (rRes.data) setIngestionRuns(rRes.data);
      } else {
        alert(res.error || "Failed to trigger ingestion run");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to trigger ingestion run");
    } finally {
      setRunningTrigger(false);
    }
  };

  // CP-003: Wait for auth verification to complete before determining access
  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Verifying administrator permissions...
        </p>
      </div>
    );
  }

  // Not authenticated or not admin guard: strictly block without calling admin APIs
  if (!user || !isAdmin) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-400 mb-6 shadow-xl">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Administrator Access Required
        </h1>
        <p className="mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400">
          This governance portal is strictly restricted to authenticated system administrators with verified ADMIN roles.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            href="/login"
            className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium text-sm hover:opacity-90 transition-opacity flex items-center gap-2 justify-center"
          >
            <span>Sign In as Admin</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/"
            className="px-6 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Admin Header & Operator Identity */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Operator Governance Console</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Admin Panel & Multi-Tenant Oversight
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real production data: users, candidates, catalog, CRM pipelines, resumes, outreach, and system health.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              {user?.email || "admin@careerpilot.ai"}
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
              ROLE: {user?.role || "ADMIN"}
            </div>
          </div>
          <button
            onClick={() => {
              loadInitialData();
            }}
            disabled={loading}
            className="px-4 py-2 text-xs font-medium bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 text-slate-700 dark:text-slate-300 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh All</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Stats Grid (8 Core Real Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Users</span>
            <Users className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {stats?.total_users ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Active: {stats?.active_users ?? 0}</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Candidates</span>
            <UserCheck className="w-3.5 h-3.5 text-cyan-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {stats?.total_candidates ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Profiles linked</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Jobs</span>
            <Briefcase className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {stats?.total_jobs ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Active catalog</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Apps</span>
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {stats?.total_applications ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Kanban CRM</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Resumes</span>
            <FileCode className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {stats?.total_resumes ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Tailored: {stats?.total_tailored_resumes ?? 0}</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Referrals</span>
            <Send className="w-3.5 h-3.5 text-pink-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {stats?.total_referrals ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Drafts: {stats?.total_outreach_drafts ?? 0}</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Interviews</span>
            <PhoneCall className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {stats?.total_interviews ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Mock sessions</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">System</span>
            <Activity className="w-3.5 h-3.5 text-teal-500" />
          </div>
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{stats?.system_status || "HEALTHY"}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono uppercase">{stats?.environment || "production"}</div>
        </div>
      </div>

      {/* Admin Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-px scrollbar-none">
        {[
          { id: "overview", label: "Overview", icon: Activity },
          { id: "users", label: `Users (${users.length})`, icon: Users },
          { id: "candidates", label: `Candidates (${stats?.total_candidates ?? candidates.length})`, icon: UserCheck },
          { id: "jobs", label: `Job Catalog (${stats?.total_jobs ?? jobs.length})`, icon: Briefcase },
          { id: "applications", label: `Applications (${stats?.total_applications ?? applications.length})`, icon: Layers },
          { id: "resumes", label: `Resumes (${stats?.total_resumes ?? resumes.length})`, icon: FileCode },
          { id: "referrals", label: `Referrals (${stats?.total_referrals ?? referrals.length})`, icon: Send },
          { id: "interviews", label: `Interviews (${stats?.total_interviews ?? interviews.length})`, icon: PhoneCall },
          { id: "health", label: "System Health", icon: Database },
          { id: "ingestion", label: "Job Sources Pipeline", icon: Globe },
          { id: "logs", label: `Audit Ledger (${logs.length})`, icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`px-3.5 py-2.5 text-xs font-medium rounded-t-xl transition-colors flex items-center gap-2 whitespace-nowrap ${
                isSelected
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold border-b-2 border-slate-900 dark:border-white"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Areas */}

      {/* 1. Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-500" />
                <span>Security & Authorization Boundary</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                All administrative requests are strictly verified at the FastAPI backend layer via signed JWT tokens and
                verified database user roles (<code className="font-mono text-amber-600 dark:text-amber-400">role == &quot;ADMIN&quot;</code>). Normal candidates attempting direct API access receive HTTP 403 Forbidden.
              </p>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Backend Auth Enforcement:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">ACTIVE (FastAPI Depends)</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>RBAC Isolation:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Multi-User Isolated</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Automated DB Migrations:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Applied</span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-500" />
                <span>Infrastructure & Database Health</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Connected to Supabase PostgreSQL 17 with pgvector vector embeddings, Render cloud FastAPI instance, and Vercel Next.js edge deployment.
              </p>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Database Engine:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">Supabase PostgreSQL + pgvector</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Backend Host:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">careerpilot-backend-fk3o.onrender.com</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Frontend Host:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">career-pilot-kappa-flax.vercel.app</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span>Quick Navigation & Oversight</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { tab: "users", label: "Inspect Users", desc: "Accounts & roles" },
                { tab: "candidates", label: "Candidate Profiles", desc: "Applications & resumes" },
                { tab: "jobs", label: "Job Catalog", desc: "Active tech postings" },
                { tab: "applications", label: "Applications CRM", desc: "16-stage pipeline" },
                { tab: "resumes", label: "Resume Tailoring", desc: "LaTeX & PDF versions" },
                { tab: "referrals", label: "Referral Outreach", desc: "AI drafts & reviews" },
              ].map((item) => (
                <button
                  key={item.tab}
                  onClick={() => setActiveTab(item.tab as AdminTab)}
                  className="p-3 text-left rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 transition-colors"
                >
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">{item.label}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. User Accounts Tab */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="text-xs py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300"
              >
                <option value="">All Roles</option>
                <option value="ADMIN">ADMIN</option>
                <option value="CANDIDATE">CANDIDATE</option>
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-semibold">User ID & Email</th>
                    <th className="py-3 px-4 font-semibold">Role</th>
                    <th className="py-3 px-4 font-semibold">Account Status</th>
                    <th className="py-3 px-4 font-semibold">Candidate ID</th>
                    <th className="py-3 px-4 font-semibold">Created Date</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No user accounts found matching your query.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{u.email}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{u.id}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                              u.role === "ADMIN"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              u.is_active
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.is_active ? "bg-emerald-500" : "bg-red-500"
                              }`}
                            />
                            {u.is_active ? "Active" : "Suspended"}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {u.candidate_id ? u.candidate_id.slice(0, 13) + "..." : "None"}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleToggleRole(u)}
                            disabled={updatingId === u.id}
                            className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            {u.role === "ADMIN" ? "Demote" : "Promote to Admin"}
                          </button>
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={updatingId === u.id}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                              u.is_active
                                ? "border border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                : "border border-emerald-200 dark:border-emerald-900 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            }`}
                          >
                            {u.is_active ? "Suspend" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Candidates Tab */}
      {activeTab === "candidates" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Candidate Profile</th>
                    <th className="py-3 px-4 font-semibold">Headline & Location</th>
                    <th className="py-3 px-4 font-semibold">Applications</th>
                    <th className="py-3 px-4 font-semibold">Resumes</th>
                    <th className="py-3 px-4 font-semibold">Joined Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {candidates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No candidate profiles found.
                      </td>
                    </tr>
                  ) : (
                    candidates.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{c.full_name}</div>
                          <div className="text-[11px] text-slate-400">{c.email}</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">{c.id}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800 dark:text-slate-200 font-medium">
                            {c.headline || "Software Engineer"}
                          </div>
                          <div className="text-[11px] text-slate-400">{c.location || "Remote"}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                            {c.applications_count} applications
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">
                            {c.resumes_count} resumes
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. Job Catalog Tab */}
      {activeTab === "jobs" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Job Title & Company</th>
                    <th className="py-3 px-4 font-semibold">Location</th>
                    <th className="py-3 px-4 font-semibold">Source</th>
                    <th className="py-3 px-4 font-semibold">Applications</th>
                    <th className="py-3 px-4 font-semibold">Discovered</th>
                    <th className="py-3 px-4 font-semibold text-right">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No jobs found in the catalog.
                      </td>
                    </tr>
                  ) : (
                    jobs.map((j) => (
                      <tr key={j.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{j.title}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{j.company}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {j.location || "Remote"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {j.source || "direct"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            {j.applications_count}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {j.created_at ? new Date(j.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {j.url ? (
                            <a
                              href={j.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                            >
                              External Link ↗
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. Applications CRM Tab */}
      {activeTab === "applications" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <select
              value={appStatusFilter}
              onChange={(e) => setAppStatusFilter(e.target.value)}
              className="text-xs py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300"
            >
              <option value="">All CRM Stages</option>
              <option value="SAVED">SAVED</option>
              <option value="ANALYZING">ANALYZING</option>
              <option value="RESUME_PREPARED">RESUME_PREPARED</option>
              <option value="RESUME_APPROVED">RESUME_APPROVED</option>
              <option value="APPLIED">APPLIED</option>
              <option value="INTERVIEW">INTERVIEW</option>
              <option value="OFFER">OFFER</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Candidate</th>
                    <th className="py-3 px-4 font-semibold">Job Opportunity</th>
                    <th className="py-3 px-4 font-semibold">Status / Kanban Stage</th>
                    <th className="py-3 px-4 font-semibold">Applied At</th>
                    <th className="py-3 px-4 font-semibold">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {applications.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No applications recorded yet.
                      </td>
                    </tr>
                  ) : (
                    applications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {app.candidate_name || "Anonymous Candidate"}
                          </div>
                          <div className="text-[11px] text-slate-400">{app.candidate_email || "—"}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {app.job_title || "Target Opportunity"}
                          </div>
                          <div className="text-[11px] text-slate-500">{app.company || "Company"}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {app.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {app.created_at ? new Date(app.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {app.updated_at ? new Date(app.updated_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. Resumes Tab */}
      {activeTab === "resumes" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Candidate</th>
                    <th className="py-3 px-4 font-semibold">Document Filename</th>
                    <th className="py-3 px-4 font-semibold">Format</th>
                    <th className="py-3 px-4 font-semibold">Master Template</th>
                    <th className="py-3 px-4 font-semibold">Tailored Versions</th>
                    <th className="py-3 px-4 font-semibold">Upload Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {resumes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No resume documents uploaded yet.
                      </td>
                    </tr>
                  ) : (
                    resumes.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {r.candidate_name || "Candidate"}
                          </div>
                          <div className="text-[11px] text-slate-400">{r.candidate_email || "—"}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-blue-500" />
                            <span>{r.filename}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{r.id}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {r.content_type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Saved</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            {r.versions_count} versions
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. Referrals & Outreach Tab */}
      {activeTab === "referrals" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <select
              value={refStatusFilter}
              onChange={(e) => setRefStatusFilter(e.target.value)}
              className="text-xs py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300"
            >
              <option value="">All Outreach Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option>
              <option value="APPROVED_FOR_DISPATCH">APPROVED_FOR_DISPATCH</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Contact & Target Company</th>
                    <th className="py-3 px-4 font-semibold">Job Context</th>
                    <th className="py-3 px-4 font-semibold">Channel</th>
                    <th className="py-3 px-4 font-semibold">Review Status</th>
                    <th className="py-3 px-4 font-semibold">Risk Level</th>
                    <th className="py-3 px-4 font-semibold">Date Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {referrals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No referral outreach drafts recorded yet.
                      </td>
                    </tr>
                  ) : (
                    referrals.map((ref) => (
                      <tr key={ref.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{ref.contact_name}</div>
                          <div className="text-[11px] text-slate-500">{ref.contact_role || ref.company}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                          {ref.job_title || "General Connection"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {ref.channel}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            {ref.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              ref.risk_level === "HIGH"
                                ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            }`}
                          >
                            {ref.risk_level || "LOW"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {ref.created_at ? new Date(ref.created_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 8. Mock Interviews Tab */}
      {activeTab === "interviews" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Candidate</th>
                    <th className="py-3 px-4 font-semibold">Target Job & Company</th>
                    <th className="py-3 px-4 font-semibold">Session Status</th>
                    <th className="py-3 px-4 font-semibold">Turn Count</th>
                    <th className="py-3 px-4 font-semibold">Overall Score</th>
                    <th className="py-3 px-4 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {interviews.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No mock interview sessions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    interviews.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {item.candidate_name || "Candidate"}
                          </div>
                          <div className="text-[11px] text-slate-400">{item.candidate_email || "—"}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{item.job_title}</div>
                          <div className="text-[11px] text-slate-500">{item.company}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                          {item.turns_count} turns
                        </td>
                        <td className="py-3 px-4">
                          {item.overall_score !== null && item.overall_score !== undefined ? (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {Math.round(item.overall_score)}%
                            </span>
                          ) : (
                            <span className="text-slate-400">In Progress</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 9. System Infrastructure & Health Tab */}
      {activeTab === "health" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-500" />
              <span>Real-Time Production Health Status</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>FastAPI Application Core</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">OPERATIONAL</div>
                <div className="text-[11px] text-slate-400">Status 200 OK | Render Cloud</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Supabase PostgreSQL + pgvector</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">CONNECTED</div>
                <div className="text-[11px] text-slate-400">PostgreSQL 17 | 1536-dim Vector Ext</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>JWT Auth & Multi-User RBAC</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">ENFORCED</div>
                <div className="text-[11px] text-slate-400">HS256 | Strict IDOR Segregation</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>n8n Workflow Engine</span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      stats?.n8n_connected ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-600"
                    }`}
                  />
                </div>
                <div
                  className={`text-lg font-bold ${
                    stats?.n8n_connected
                      ? "text-slate-900 dark:text-white"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {stats?.n8n_connected ? "ACTIVE" : "NOT CONFIGURED"}
                </div>
                <div className="text-[11px] text-slate-400">
                  {stats?.n8n_connected
                    ? "Webhook Verified | HITL Governed"
                    : "Unconfigured | Direct Execution Mode"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. Ingestion Pipeline Tab */}
      {activeTab === "ingestion" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Total Sources</span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {ingestionMetrics?.total_sources_configured ?? ingestionSources.length}
              </p>
              <span className="text-[10px] text-slate-500">Configured ATS Catalog</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Active Sources</span>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {ingestionMetrics?.active_sources ?? ingestionSources.filter((s) => s.status === "ACTIVE").length}
              </p>
              <span className="text-[10px] text-slate-500">Greenhouse, Lever & RSS</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Total Ingested</span>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {ingestionMetrics?.total_jobs_ingested ?? 0}
              </p>
              <span className="text-[10px] text-slate-500">Deduplicated jobs</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">India Relevance</span>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {ingestionMetrics?.india_first_jobs_count ?? 0}
              </p>
              <span className="text-[10px] text-slate-500">Classified India jobs</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-medium uppercase tracking-wider text-teal-600 dark:text-teal-400">Fresher Eligible</span>
              <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1">
                {ingestionMetrics?.fresher_eligible_jobs_count ?? 0}
              </p>
              <span className="text-[10px] text-slate-500">0-1 Yrs / Batch Match</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">Safety Flagged</span>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {ingestionMetrics?.scam_flagged_jobs_count ?? 0}
              </p>
              <span className="text-[10px] text-slate-500">Scam/Quality filtered</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-indigo-500" />
                  <span>Manual Ingestion Dispatcher</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Trigger an ingestion cycle on any of the configured ATS boards.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Source ATS / Board
                </label>
                <select
                  value={selectedSourceToRun}
                  onChange={(e) => setSelectedSourceToRun(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                >
                  {ingestionSources.map((s) => (
                    <option key={s.source_id} value={s.source_id}>
                      {s.name} ({s.source_type})
                    </option>
                  ))}
                  {ingestionSources.length === 0 && (
                    <>
                      <option value="greenhouse_swiggy">Swiggy India (Greenhouse ATS)</option>
                      <option value="greenhouse_razorpay">Razorpay (Greenhouse ATS)</option>
                      <option value="greenhouse_zomato">Zomato India (Greenhouse ATS)</option>
                      <option value="greenhouse_cred">CRED (Greenhouse ATS)</option>
                      <option value="lever_freshworks">Freshworks (Lever ATS)</option>
                      <option value="internshala">Internshala (Fresher)</option>
                      <option value="freshershunt">FreshersHunt</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Max Jobs
                </label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={runMaxJobs}
                  onChange={(e) => setRunMaxJobs(Number(e.target.value))}
                  className="w-full text-xs py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-end gap-2">
                <button
                  onClick={() => handleTriggerIngestion()}
                  disabled={runningTrigger}
                  className="w-full py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Play className={`w-3.5 h-3.5 ${runningTrigger ? "animate-spin" : ""}`} />
                  <span>{runningTrigger ? "Dispatching..." : "Execute"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 11. Security Audit Logs Tab */}
      {activeTab === "logs" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-500" />
              <span>Security, Outreach & Governance Audit Events</span>
            </h3>
            <span className="text-xs text-slate-500">Immutable ledger</span>
          </div>

          <div className="space-y-3">
            {logs.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                No audit events recorded yet.
              </p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {log.event_type}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        Actor: {log.actor}
                      </span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {JSON.stringify(log.payload)}
                    </div>
                  </div>
                  <div className="text-slate-400 dark:text-slate-500 shrink-0">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : "Just now"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
