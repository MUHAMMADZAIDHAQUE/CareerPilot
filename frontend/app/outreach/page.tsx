"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Send,
  Mail,
  Linkedin,
  CheckCircle2,
  XCircle,
  Clock,
  Edit3,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Users,
  Briefcase,
  Building2,
  Trash2,
  RefreshCw,
  Plus,
  Filter,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Info,
  ShieldAlert,
  ArrowRight,
  UserCheck,
} from "lucide-react";
import {
  fetchOutreachDraftsApi,
  fetchJobsApi,
  bulkSendOutreachApi,
  OutreachDraft,
  Job,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/States";

function OutreachStudioContent() {
  const searchParams = useSearchParams();
  const initialJobId = searchParams.get("job_id") || "ALL";

  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bulk Selection State
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);

  // Filters
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId);
  const [filterChannel, setFilterChannel] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterRisk, setFilterRisk] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [draftsRes, jobsRes] = await Promise.all([
        fetchOutreachDraftsApi(),
        fetchJobsApi({ limit: 50 }),
      ]);

      if (draftsRes.data) {
        setDrafts(draftsRes.data);
      } else {
        setError(draftsRes.error || "Failed to load outreach drafts");
      }

      if (jobsRes.data) {
        setJobs(jobsRes.data);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load outreach dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = drafts.length;
    const needsReview = drafts.filter(
      (d) => d.status === "REVIEW_REQUIRED" || d.status === "VALIDATING" || d.status === "EDITED"
    ).length;
    const validated = drafts.filter(
      (d) => d.validation_results?.passed === true && d.status !== "APPROVED_FOR_DISPATCH"
    ).length;
    const approved = drafts.filter((d) => d.status === "APPROVED_FOR_DISPATCH").length;
    const blocked = drafts.filter(
      (d) => d.status === "BLOCKED" || d.validation_results?.risk_level === "BLOCKED"
    ).length;
    const rejected = drafts.filter((d) => d.status === "REJECTED").length;

    return { total, needsReview, validated, approved, blocked, rejected };
  }, [drafts]);

  const approvedDrafts = useMemo(
    () => drafts.filter((d) => d.status === "APPROVED_FOR_DISPATCH"),
    [drafts]
  );

  // Filtered drafts
  const filteredDrafts = useMemo(() => {
    return drafts.filter((d) => {
      // Job filter
      if (selectedJobId !== "ALL" && d.job_id !== selectedJobId) {
        return false;
      }
      // Channel filter
      if (filterChannel !== "ALL" && d.channel.toUpperCase() !== filterChannel) {
        return false;
      }
      // Status filter
      if (filterStatus !== "ALL") {
        if (filterStatus === "NEEDS_REVIEW") {
          if (!["REVIEW_REQUIRED", "VALIDATING", "EDITED"].includes(d.status)) return false;
        } else if (d.status !== filterStatus) {
          return false;
        }
      }
      // Risk filter
      if (filterRisk !== "ALL") {
        const risk = d.validation_results?.risk_level || "LOW";
        if (risk !== filterRisk) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const contactMatch = d.contact_name?.toLowerCase().includes(q);
        const titleMatch = d.contact_title?.toLowerCase().includes(q);
        const companyMatch =
          d.contact_company?.toLowerCase().includes(q) || d.job_company?.toLowerCase().includes(q);
        const bodyMatch = d.body.toLowerCase().includes(q);
        if (!contactMatch && !titleMatch && !companyMatch && !bodyMatch) {
          return false;
        }
      }
      return true;
    });
  }, [drafts, selectedJobId, filterChannel, filterStatus, filterRisk, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      {/* Safety & Compliance Header Banner */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 sm:p-8 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Phase 19 Outreach Preparation Engine
            </span>
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Outreach Studio
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              AI-generated personalized drafts strictly grounded in verified facts. Validated against
              fabrications and private data leaks. Review, edit, and approve for future dispatch.
            </p>
          </div>

          {/* Target Job Selector & Refresh */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Filter by Opportunity:</label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Opportunities ({jobs.length})</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.company} — {j.role}
                </option>
              ))}
            </select>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Safety Boundary Notice Box */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-4 rounded-2xl max-w-md">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong className="block font-semibold mb-0.5">Approval Boundary Guardrail:</strong>
              Approving a draft marks it <span className="font-mono font-bold">APPROVED_FOR_DISPATCH</span>.
              Zero messages, emails, or LinkedIn connection requests are sent in Phase 19.
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111827]">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Total Drafts
          </span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
            {metrics.total}
          </span>
        </div>

        <div className="p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
            Needs Review
          </span>
          <span className="text-2xl font-bold text-amber-900 dark:text-amber-200 mt-1 block">
            {metrics.needsReview}
          </span>
        </div>

        <div className="p-4 rounded-xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
          <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">
            Validated
          </span>
          <span className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-1 block">
            {metrics.validated}
          </span>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20">
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
            Approved
          </span>
          <span className="text-2xl font-bold text-emerald-900 dark:text-emerald-200 mt-1 block">
            {metrics.approved}
          </span>
        </div>

        <div className="p-4 rounded-xl border border-red-200/80 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
          <span className="text-[11px] font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider block">
            Blocked
          </span>
          <span className="text-2xl font-bold text-red-900 dark:text-red-200 mt-1 block">
            {metrics.blocked}
          </span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Rejected
          </span>
          <span className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-1 block">
            {metrics.rejected}
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <input
              type="text"
              placeholder="Search contact, title, company, or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 pl-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          </div>

          {/* Channel Filter */}
          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Channels</option>
            <option value="LINKEDIN">LinkedIn</option>
            <option value="EMAIL">Email</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
            <option value="REVIEW_REQUIRED">Review Required</option>
            <option value="APPROVED_FOR_DISPATCH">Approved for Dispatch</option>
            <option value="BLOCKED">Blocked</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Risk Level Filter */}
          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="LOW">Low Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {approvedDrafts.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedDraftIds.size === approvedDrafts.length) {
                    setSelectedDraftIds(new Set());
                  } else {
                    setSelectedDraftIds(new Set(approvedDrafts.map((d) => d.id)));
                  }
                }}
                className="text-xs font-semibold"
                id="btn-select-all-approved"
              >
                {selectedDraftIds.size === approvedDrafts.length
                  ? "Deselect All"
                  : `Select All Approved (${approvedDrafts.length})`}
              </Button>

              <Button
                size="sm"
                onClick={() => setShowBulkModal(true)}
                disabled={selectedDraftIds.size === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                id="btn-bulk-send"
              >
                <Send className="w-3.5 h-3.5" />
                <span>SEND SELECTED ({selectedDraftIds.size})</span>
              </Button>
            </>
          )}

          <Link
            href="/referrals"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>Referral Studio</span>
          </Link>
        </div>
      </div>

      {/* Main Drafts Cards List */}
      {loading ? (
        <LoadingState message="Loading outreach drafts and validation status..." />
      ) : error ? (
        <ErrorState error={error} onRetry={loadData} />
      ) : filteredDrafts.length === 0 ? (
        <EmptyState
          title="No outreach drafts found"
          description="Prepare outreach drafts from the Referral Discovery Studio by selecting verified contacts and clicking 'Prepare Outreach'."
          actionText="Open Referral Studio"
          onAction={() => window.location.href = "/referrals"}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDrafts.map((draft) => {
            const isApproved = draft.status === "APPROVED_FOR_DISPATCH";
            const isBlocked = draft.status === "BLOCKED";
            const isRejected = draft.status === "REJECTED";
            const valPassed = draft.validation_results?.passed === true;

            const evidenceSignals = draft.personalization_evidence || [];

            return (
              <Card
                key={draft.id}
                className={`p-5 flex flex-col justify-between transition-all hover:border-blue-400 dark:hover:border-blue-600 ${
                  isApproved
                    ? "border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10"
                    : isBlocked
                    ? "border-red-200/80 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10"
                    : ""
                }`}
              >
                <div className="space-y-3.5">
                  {/* Card Header: Contact & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      {isApproved && (
                        <input
                          type="checkbox"
                          checked={selectedDraftIds.has(draft.id)}
                          onChange={(e) => {
                            const next = new Set(selectedDraftIds);
                            if (e.target.checked) next.add(draft.id);
                            else next.delete(draft.id);
                            setSelectedDraftIds(next);
                          }}
                          className="mt-1 rounded text-blue-600 cursor-pointer"
                        />
                      )}
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {draft.contact_name || "Referral Contact"}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {draft.contact_title || "Team Member"} ·{" "}
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {draft.contact_company || draft.job_company || "Target Company"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      {isApproved ? (
                        <Badge variant="success" className="text-[10px] uppercase font-bold tracking-wider">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Approved for Dispatch
                        </Badge>
                      ) : isBlocked ? (
                        <Badge variant="error" className="text-[10px] uppercase font-bold tracking-wider">
                          <XCircle className="w-3 h-3 mr-1" /> Blocked
                        </Badge>
                      ) : isRejected ? (
                        <Badge variant="neutral" className="text-[10px] uppercase font-bold tracking-wider">
                          Rejected
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="text-[10px] uppercase font-bold tracking-wider">
                          <Clock className="w-3 h-3 mr-1" /> Review Required
                        </Badge>
                      )}

                      <span className="text-[10px] text-slate-400 font-mono">
                        Not sent
                      </span>
                    </div>
                  </div>

                  {/* Channel & Relevance Badge Bar */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {draft.channel.toUpperCase() === "LINKEDIN" ? (
                        <Linkedin className="w-3.5 h-3.5 text-[#0A66C2]" />
                      ) : (
                        <Mail className="w-3.5 h-3.5 text-blue-500" />
                      )}
                      <span>{draft.channel}</span>
                      <span className="text-[10px] text-slate-400 font-normal">· Prepared</span>
                    </span>

                    {draft.contact_relevance_score != null && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Relevance {Math.round(draft.contact_relevance_score)}/100</span>
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                        valPassed
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                      }`}
                    >
                      {valPassed ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Validation: PASSED</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Validation: BLOCKED</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Personalization Signals */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Personalization: {evidenceSignals.length} verified signals
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {evidenceSignals.slice(0, 4).map((sig, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        >
                          ✓ {sig.type}
                        </span>
                      ))}
                      {evidenceSignals.length > 4 && (
                        <span className="text-[10px] text-slate-400 self-center">
                          +{evidenceSignals.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Message Snippet */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 line-clamp-3 font-mono leading-relaxed">
                    {draft.subject && (
                      <div className="font-bold text-slate-900 dark:text-slate-200 mb-1">
                        Subj: {draft.subject}
                      </div>
                    )}
                    {draft.body}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 mt-4 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-400">
                    {draft.human_edits?.length > 0
                      ? `${draft.human_edits.length} human edit(s)`
                      : "AI-generated draft"}
                  </div>

                  <Link
                    href={`/outreach/${draft.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold shadow-subtle transition-colors"
                  >
                    <span>Review Draft</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bulk Send Double Confirmation Modal */}
      {showBulkModal && (
        <Modal
          isOpen={showBulkModal}
          onClose={() => setShowBulkModal(false)}
          title={`Authorized Bulk Send (${selectedDraftIds.size} Messages)`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300">
              <span className="font-bold block mb-1">Bulk Dispatch Review</span>
              You have selected {selectedDraftIds.size} human-approved drafts. CareerPilot will transmit each email message via verified provider gateways while preserving LinkedIn messages for manual review.
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {Array.from(selectedDraftIds).map((id) => {
                const d = drafts.find((x) => x.id === id);
                if (!d) return null;
                return (
                  <div key={id} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {d.contact_name || "Contact"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {d.job_company || "Target Company"} · {d.channel}
                      </span>
                    </div>
                    <Badge variant="success" className="text-[10px]">
                      APPROVED
                    </Badge>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-start gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={bulkConfirm}
                  onChange={(e) => setBulkConfirm(e.target.checked)}
                  className="rounded text-blue-600 mt-0.5"
                  id="chk-bulk-confirm"
                />
                <span className="font-medium">
                  I confirm double-verification of all {selectedDraftIds.size} recipients and approve dispatching these communications.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setShowBulkModal(false)} disabled={bulkSending}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  setBulkSending(true);
                  try {
                    const res = await bulkSendOutreachApi(Array.from(selectedDraftIds), true, "GMAIL");
                    if (res.data) {
                      setShowBulkModal(false);
                      setSelectedDraftIds(new Set());
                      loadData();
                      alert(`Successfully dispatched ${res.data.successful_count} messages!`);
                    } else {
                      alert(res.error || "Failed to execute bulk dispatch");
                    }
                  } finally {
                    setBulkSending(false);
                  }
                }}
                disabled={!bulkConfirm || bulkSending}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                id="btn-bulk-send-now"
              >
                {bulkSending ? "DISPATCHING..." : "SEND NOW"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function OutreachPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading Outreach Studio..." />}>
      <OutreachStudioContent />
    </Suspense>
  );
}
