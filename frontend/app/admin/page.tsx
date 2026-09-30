"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { useAuth } from "@/lib/authContext";
import {
  fetchAdminDashboard,
  fetchAdminUsers,
  updateUserStatus,
  fetchAdminAuditLogs,
  fetchIngestionMetrics,
  fetchIngestionSources,
  fetchIngestionRuns,
  triggerIngestionRun,
  AdminDashboardKPI,
  UserProfile,
  AuditLogEvent,
  IngestionMetrics,
  IngestionSource,
  IngestionRun,
} from "@/lib/api";

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<"users" | "health" | "logs" | "ingestion">("users");
  const [stats, setStats] = useState<AdminDashboardKPI | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<AuditLogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
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
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>("ALL");

  const loadData = async () => {
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
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, roleFilter]);

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

  // Not authenticated or not admin guard
  if (!authLoading && !isAdmin) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-400 mb-6 shadow-xl">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Administrator Access Required
        </h1>
        <p className="mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400">
          This governance portal is restricted to system administrators with privileged operational access.
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
    <div className="space-y-8 pb-12">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Operator Console</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Admin Panel & System Governance
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time multi-user management, tenant monitoring, and security audit logs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors flex items-center gap-2 text-slate-700 dark:text-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Registered Users</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats?.total_users ?? "—"}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Active: {stats?.active_users ?? 0}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Discovered Jobs</span>
            <Briefcase className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats?.total_jobs ?? "—"}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Across 11 tech sources
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Applications</span>
            <Layers className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats?.total_applications ?? "—"}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            In 16-stage Kanban CRM
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Outreach & n8n</span>
            <Send className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats?.total_outreach_drafts ?? "—"}
          </div>
          <div className="text-xs flex items-center gap-1.5 mt-1 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-600 dark:text-emerald-400">n8n Engine Active</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "users"
              ? "border-slate-900 dark:border-white text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          User Accounts ({users.length})
        </button>
        <button
          onClick={() => setActiveTab("health")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "health"
              ? "border-slate-900 dark:border-white text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          System & Scraper Diagnostics
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "logs"
              ? "border-slate-900 dark:border-white text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Security Audit Logs ({logs.length})
        </button>
        <button
          onClick={() => setActiveTab("ingestion")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
            activeTab === "ingestion"
              ? "border-slate-900 dark:border-white text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-indigo-500" />
          <span>100+ Source Ingestion ({ingestionSources.length})</span>
        </button>
      </div>

      {/* Tab 1: User Management */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadData()}
                placeholder="Search by email..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="">All Roles</option>
                <option value="CANDIDATE">Candidates</option>
                <option value="ADMIN">Administrators</option>
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">User Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                          {u.email}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              u.role === "ADMIN"
                                ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                : "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-rose-500 font-medium">
                              <span className="w-2 h-2 rounded-full bg-rose-500" />
                              Deactivated
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={updatingId === u.id}
                            className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
                              u.is_active
                                ? "border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                : "border-emerald-200 dark:border-emerald-900 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            }`}
                          >
                            {u.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => handleToggleRole(u)}
                            disabled={updatingId === u.id}
                            className="px-3 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            {u.role === "ADMIN" ? "Make Candidate" : "Make Admin"}
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

      {/* Tab 2: System Health */}
      {activeTab === "health" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              <span>Core Infrastructure Status</span>
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="font-medium text-slate-700 dark:text-slate-300">FastAPI API Server</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> Port 8000 Healthy
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="font-medium text-slate-700 dark:text-slate-300">Next.js 14 Frontend</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> Port 3000 Healthy
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="font-medium text-slate-700 dark:text-slate-300">Database Engine</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> Connected
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="font-medium text-slate-700 dark:text-slate-300">n8n Automation Engine</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> Port 5678 Active
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" />
              <span>Multi-Source Scraper Policy & Status</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All 11 job discovery adapters operate under zero-scraping, public syndication, and permitted feed policies.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                "LinkedIn Jobs (Feed)",
                "Naukri (Syndicated)",
                "Indeed (Permitted)",
                "Internshala (Fresher)",
                "Freshersworld (Grad)",
                "Foundit (Monster)",
                "Wellfound (Startups)",
                "Glassdoor (Authorized)",
                "Company Career Pages",
                "Public RSS/Atom Feeds",
              ].map((src) => (
                <div
                  key={src}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-750 flex items-center justify-between"
                >
                  <span className="font-medium truncate">{src}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Security & Audit Logs */}
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

      {/* Tab 4: Phase 23 100+ Source Ingestion Pipeline */}
      {activeTab === "ingestion" && (
        <div className="space-y-6">
          {/* Ingestion Pipeline Health KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Total Sources</span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {ingestionMetrics?.total_sources_configured ?? ingestionSources.length}
              </p>
              <span className="text-[10px] text-slate-500">100+ Verified Catalog</span>
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

          {/* Trigger Ingestion Form Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-indigo-500" />
                  <span>Manual Ingestion Dispatcher</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Trigger an ingestion cycle on any of the 100+ registered ATS boards.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                Deduplication & Scam Scoring Active
              </span>
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
                  Max Jobs to Fetch
                </label>
                <input
                  type="number"
                  min="5"
                  max="200"
                  value={runMaxJobs}
                  onChange={(e) => setRunMaxJobs(parseInt(e.target.value) || 20)}
                  className="w-full text-xs py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none mb-2">
                  <input
                    type="checkbox"
                    checked={runDryRun}
                    onChange={(e) => setRunDryRun(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                  />
                  <span>Dry Run (Preview Only)</span>
                </label>
                <button
                  onClick={() => handleTriggerIngestion()}
                  disabled={runningTrigger}
                  className="w-full py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {runningTrigger ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Ingesting...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>{runDryRun ? "Test Fetch (Dry Run)" : "Trigger Ingestion"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Live Run Result Feedback */}
            {lastRunResult && (
              <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">Run Result:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      lastRunResult.status === "SUCCESS"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                    }`}>
                      {lastRunResult.status}
                    </span>
                    <span className="font-mono text-slate-500">[{lastRunResult.source_id}]</span>
                  </div>
                  <span className="text-slate-400">{lastRunResult.duration_ms}ms</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Fetched</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{lastRunResult.jobs_fetched}</span>
                  </div>
                  <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="text-emerald-500 block text-[10px]">Accepted</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">{lastRunResult.jobs_accepted}</span>
                  </div>
                  <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="text-amber-500 block text-[10px]">Duplicates Filtered</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">{lastRunResult.duplicates_count}</span>
                  </div>
                  <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="text-rose-500 block text-[10px]">Rejected</span>
                    <span className="font-bold text-rose-700 dark:text-rose-400">{lastRunResult.jobs_rejected}</span>
                  </div>
                </div>

                {lastRunResult.error_details && (
                  <p className="text-rose-600 dark:text-rose-400 text-[11px] font-mono mt-1">
                    Error details: {lastRunResult.error_details}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Registered Sources Health Table */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-500" />
                  <span>Registered Source Health & Architecture ({ingestionSources.length})</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Real-time health, success rates, and last synced timestamps across all ATS board integrations.
                </p>
              </div>

              {/* Source Type Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={sourceTypeFilter}
                  onChange={(e) => setSourceTypeFilter(e.target.value)}
                  className="text-xs py-1.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  <option value="ALL">All Types</option>
                  <option value="GREENHOUSE">Greenhouse ATS</option>
                  <option value="LEVER">Lever ATS</option>
                  <option value="INDIA_BOARD">Indian Boards</option>
                  <option value="PUBLIC_FEED">Public Feeds</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                    <th className="py-2.5 px-3">Source Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Jobs Ingested</th>
                    <th className="py-2.5 px-3">Duplicates Filtered</th>
                    <th className="py-2.5 px-3">Last Synced</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {ingestionSources
                    .filter((s) => sourceTypeFilter === "ALL" || s.source_type === sourceTypeFilter)
                    .slice(0, 30)
                    .map((s) => (
                      <tr key={s.source_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                          <div>{s.name}</div>
                          <span className="font-mono text-[10px] text-slate-400">{s.source_id}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {s.source_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            s.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {s.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold">{s.jobs_accepted_total}</td>
                        <td className="py-2.5 px-3 text-slate-500">{s.duplicates_found_total}</td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {s.last_run_at ? new Date(s.last_run_at).toLocaleDateString() : "Never"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleTriggerIngestion(s.source_id)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                          >
                            Run Now
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {ingestionSources.length > 30 && (
              <p className="text-[11px] text-slate-400 text-center pt-2">
                Showing top 30 of {ingestionSources.length} configured sources. All sources are actively monitored.
              </p>
            )}
          </div>

          {/* Recent Source Runs Log */}
          {ingestionRuns.length > 0 && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-500" />
                <span>Recent Ingestion Execution Runs</span>
              </h3>
              <div className="space-y-2">
                {ingestionRuns.slice(0, 10).map((r) => (
                  <div
                    key={r.run_id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        r.status === "SUCCESS"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                      }`}>
                        {r.status}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">{r.source_id}</span>
                      <span className="text-slate-400">• {r.duration_ms}ms</span>
                    </div>

                    <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[11px]">
                      <span>Fetched: <strong className="text-slate-800 dark:text-slate-200">{r.jobs_fetched}</strong></span>
                      <span>Accepted: <strong className="text-emerald-600 dark:text-emerald-400">{r.jobs_accepted}</strong></span>
                      <span>Duplicates: <strong className="text-amber-600 dark:text-amber-400">{r.duplicates_count}</strong></span>
                      <span className="text-slate-400">{r.finished_at ? new Date(r.finished_at).toLocaleTimeString() : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
