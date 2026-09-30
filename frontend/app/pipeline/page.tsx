"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Layers,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  FileText,
  Users2,
  Sparkles,
  ArrowRight,
  Send,
  Building2,
  MapPin,
  ChevronRight,
  Flame,
  Info,
} from "lucide-react";
import {
  fetchCandidateProfile,
  fetchApplicationQueue,
  fetchQueueSummaryStats,
  confirmApplyQueueItem,
  updateQueueItem,
  deleteQueueItem,
  ApplicationQueueItem,
  ApplicationQueueSummaryStats,
  Candidate,
  getCurrentCandidateId,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/States";

export default function PipelineQueuePage() {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [queueItems, setQueueItems] = useState<ApplicationQueueItem[]>([]);
  const [stats, setStats] = useState<ApplicationQueueSummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Confirmation Modal
  const [confirmModalItem, setConfirmModalItem] = useState<ApplicationQueueItem | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [userAcknowledged, setUserAcknowledged] = useState(false);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      let cand = candidate;
      if (!cand) {
        const candRes = await fetchCandidateProfile();
        if (candRes.data) {
          cand = candRes.data;
          setCandidate(cand);
        }
      }

      const candId = cand?.id || getCurrentCandidateId();
      if (!candId) {
        setError("Please sign in to view your application pipeline queue.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [queueRes, statsRes] = await Promise.all([
        fetchApplicationQueue(candId),
        fetchQueueSummaryStats(candId),
      ]);

      if (queueRes.data) {
        setQueueItems(queueRes.data);
      } else if (queueRes.error) {
        setError(queueRes.error);
      }

      if (statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load application queue");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConfirmApply = async () => {
    if (!confirmModalItem || !userAcknowledged) return;
    setSubmittingAction(true);
    try {
      const res = await confirmApplyQueueItem(confirmModalItem.id, true);
      if (res.data) {
        setQueueItems((prev) =>
          prev.map((item) => (item.id === confirmModalItem.id ? res.data! : item))
        );
        setConfirmModalItem(null);
        setUserAcknowledged(false);
        // Refresh summary stats
        if (candidate?.id) {
          fetchQueueSummaryStats(candidate.id).then((s) => s.data && setStats(s.data));
        }
      } else {
        alert(res.error || "Failed to confirm application");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to confirm application");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to remove this job from your preparation queue?")) return;
    try {
      const res = await deleteQueueItem(itemId);
      if (res.data) {
        setQueueItems((prev) => prev.filter((item) => item.id !== itemId));
        if (candidate?.id) {
          fetchQueueSummaryStats(candidate.id).then((s) => s.data && setStats(s.data));
        }
      } else {
        alert(res.error || "Failed to remove item");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to remove item");
    }
  };

  // Filtered queue items
  const filteredItems = useMemo(() => {
    return queueItems.filter((item) => {
      if (priorityFilter !== "ALL" && item.priority !== priorityFilter) return false;
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const role = (item.job_role || "").toLowerCase();
        const comp = (item.job_company || "").toLowerCase();
        const loc = (item.job_location || "").toLowerCase();
        if (!role.includes(q) && !comp.includes(q) && !loc.includes(q)) return false;
      }
      return true;
    });
  }, [queueItems, priorityFilter, statusFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Top Banner / Hero */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs tracking-wider uppercase mb-1">
                <Layers className="w-4 h-4" />
                <span>Phase 23 India Intelligence & Ingestion Engine</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Application Execution Queue
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
                High-throughput pipeline for staged jobs across 100+ verified Indian ATS boards.
                Always enforces human confirmation before consequential submission.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData(true)}
                disabled={loading || refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Link href="/jobs">
                <Button variant="primary" size="sm">
                  <Search className="w-4 h-4 mr-2" />
                  Explore Jobs
                </Button>
              </Link>
              <Link href="/applications">
                <Button variant="outline" size="sm">
                  Kanban Board
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Quick Metrics / Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-6">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total in Queue</span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {stats?.total ?? queueItems.length}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Needs Review</span>
              <p className="text-xl font-bold text-amber-800 dark:text-amber-300 mt-1">
                {stats?.pending_review ?? queueItems.filter((i) => i.status === "READY" || i.status === "NEEDS_REVIEW").length}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Needs Resume</span>
              <p className="text-xl font-bold text-blue-800 dark:text-blue-300 mt-1">
                {stats?.needs_resume ?? queueItems.filter((i) => i.status === "NEEDS_RESUME").length}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40">
              <span className="text-xs font-medium text-purple-700 dark:text-purple-400">Needs Referral</span>
              <p className="text-xl font-bold text-purple-800 dark:text-purple-300 mt-1">
                {stats?.needs_referral ?? queueItems.filter((i) => i.status === "NEEDS_REFERRAL").length}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Confirmed / Ready</span>
              <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-1">
                {stats?.confirmed ?? queueItems.filter((i) => i.user_confirmation).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by role, company, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Priority filter */}
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-medium">
              <span className="px-2 text-slate-400">Priority:</span>
              {["ALL", "HIGH", "MEDIUM", "LOW"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    priorityFilter === p
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-medium py-1.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border-none text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="READY">Ready for Review</option>
              <option value="NEEDS_RESUME">Needs Resume</option>
              <option value="NEEDS_REFERRAL">Needs Referral</option>
              <option value="MANUAL_SUBMIT">Manual Submit</option>
              <option value="APPLIED">Applied</option>
            </select>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <LoadingState message="Loading your application queue..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadData()} />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={<Layers className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
            title={
              queueItems.length === 0
                ? "Your Application Queue is Empty"
                : "No matching queue items"
            }
            description={
              queueItems.length === 0
                ? "Browse fresh Indian jobs and add high-priority roles to your execution queue for structured preparation and human-gated submission."
                : "Try adjusting your priority or status filter to see items in your pipeline."
            }
            actionText="Discover Indian Jobs"
            onAction={() => (window.location.href = "/jobs")}
          />
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="group relative p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400/50 dark:hover:border-indigo-500/50 shadow-xs hover:shadow-md transition-all duration-200"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Job & Status Information */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {/* Priority Badge */}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          item.priority === "HIGH"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                            : item.priority === "MEDIUM"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
                            : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {item.priority === "HIGH" && <Flame className="w-3 h-3 mr-1 text-rose-500 fill-rose-500" />}
                        {item.priority} Priority
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          item.status === "MANUAL_SUBMIT" || item.status === "APPLIED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : item.status === "READY"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {item.status.replace(/_/g, " ")}
                      </span>

                      {/* Human-in-the-loop confirmation badge */}
                      {item.user_confirmation ? (
                        <span className="inline-flex items-center text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Human Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Confirmation Required
                        </span>
                      )}

                      {/* India Relevance Badge */}
                      {item.job_india_relevance && item.job_india_relevance !== "GLOBAL" && (
                        <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                          🇮🇳 {item.job_india_relevance.replace("INDIA_", "")}
                        </span>
                      )}

                      {/* Fresher Badge */}
                      {item.job_is_fresher_eligible && (
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
                          🎓 Fresher Eligible
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                      {item.job_role || "Job Position"}
                    </h2>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                      <div className="flex items-center">
                        <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {item.job_company || "Company"}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        <span>{item.job_location || "India"}</span>
                      </div>
                      <div className="flex items-center text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                        <Sparkles className="w-3 h-3 mr-1" />
                        <span>Next: {item.next_action || "Prepare application"}</span>
                      </div>
                    </div>

                    {item.notes && (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                        &quot;{item.notes}&quot;
                      </p>
                    )}
                  </div>

                  {/* Right: Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 lg:self-center">
                    {/* Tailor Resume link */}
                    <Link href={`/resumes?job_id=${item.job_id}`}>
                      <Button variant="outline" size="sm" className="text-xs h-8">
                        <FileText className="w-3.5 h-3.5 mr-1 text-slate-500" />
                        Tailor Resume
                      </Button>
                    </Link>

                    {/* Find Referrals link */}
                    <Link href={`/referrals?job_id=${item.job_id}`}>
                      <Button variant="outline" size="sm" className="text-xs h-8">
                        <Users2 className="w-3.5 h-3.5 mr-1 text-slate-500" />
                        Referrals
                      </Button>
                    </Link>

                    {/* Consequential action: Confirm & Apply */}
                    {!item.user_confirmation ? (
                      <Button
                        variant="primary"
                        size="sm"
                        className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={() => {
                          setConfirmModalItem(item);
                          setUserAcknowledged(false);
                        }}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                        Confirm & Apply
                      </Button>
                    ) : item.application_url ? (
                      <a
                        href={item.application_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex"
                      >
                        <Button
                          variant="primary"
                          size="sm"
                          className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          Open Application
                        </Button>
                      </a>
                    ) : null}

                    {/* Delete Item */}
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Human Confirmation Modal */}
      {confirmModalItem && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!submittingAction) setConfirmModalItem(null);
          }}
          title="Explicit Human Approval Required"
          description="CareerPilot strictly enforces human-in-the-loop control for all job applications."
        >
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                {confirmModalItem.job_role}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {confirmModalItem.job_company} • {confirmModalItem.job_location || "India"}
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <div className="flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Human Gate Guarantee:</strong> Your application will never be auto-submitted without your active confirmation.
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <FileText className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p>
                  Confirming marks this queue item as <strong>MANUAL_SUBMIT</strong> so you can review tailored materials before submission.
                </p>
              </div>
            </div>

            {/* Checkbox requirement */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="flex items-start space-x-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={userAcknowledged}
                  onChange={(e) => setUserAcknowledged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  I confirm that I have reviewed the job details and wish to approve manual application staging for this role.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmModalItem(null)}
                disabled={submittingAction}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmApply}
                disabled={!userAcknowledged || submittingAction}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {submittingAction ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                    Approve & Proceed
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
