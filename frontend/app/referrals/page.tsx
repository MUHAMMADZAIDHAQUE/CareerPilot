"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Users2,
  Search,
  Building2,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Briefcase,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  ArrowRight,
  Eye,
  CheckSquare,
  Square,
  XCircle,
  UserCheck,
  HelpCircle,
} from "lucide-react";
import {
  fetchReferralContactsApi,
  fetchDiscoveredReferralsForJobApi,
  discoverReferralsEngineApi,
  selectReferralContactApi,
  dismissReferralContactApi,
  bulkSelectReferralContactsApi,
  bulkGenerateOutreachDraftsApi,
  fetchJobsApi,
  ReferralContact,
  Job,
  ReferralDiscoveryResult,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";

function ReferralDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialJobId = searchParams.get("job_id") || "";

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId);
  const [contacts, setContacts] = useState<ReferralContact[]>([]);
  const [discoveryMeta, setDiscoveryMeta] = useState<ReferralDiscoveryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("relevance");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [preparingOutreach, setPreparingOutreach] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load initial jobs
  useEffect(() => {
    async function loadJobs() {
      try {
        const jobsRes = await fetchJobsApi({ limit: 50 });
        if (jobsRes.data && jobsRes.data.length > 0) {
          setJobs(jobsRes.data);
          if (!selectedJobId) {
            setSelectedJobId(jobsRes.data[0].id);
          }
        }
      } catch (err: any) {
        console.error("Failed to load jobs", err);
      }
    }
    loadJobs();
  }, []);

  // Load referral discovery contacts for the selected job
  const loadReferrals = async (jobIdToLoad: string) => {
    if (!jobIdToLoad) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDiscoveredReferralsForJobApi(jobIdToLoad);
      if (res.data) {
        setDiscoveryMeta(res.data);
        setContacts(res.data.contacts || []);
        // Initialize selected set from database outreach_status
        const initialSelected = new Set<string>();
        (res.data.contacts || []).forEach((c) => {
          if (c.outreach_status === "SELECTED") {
            initialSelected.add(c.id);
          }
        });
        setSelectedIds(initialSelected);
      } else {
        // Fallback to general contacts list if job discovery isn't ready
        const fallbackRes = await fetchReferralContactsApi({ jobId: jobIdToLoad, limit: 100 });
        if (fallbackRes.data) {
          setContacts(fallbackRes.data);
        } else {
          setError(res.error || "Failed to load referral contacts");
        }
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load referral contacts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedJobId) {
      loadReferrals(selectedJobId);
    }
  }, [selectedJobId]);

  const handleRefresh = async () => {
    if (!selectedJobId) return;
    setRefreshing(true);
    try {
      const res = await discoverReferralsEngineApi(selectedJobId);
      if (res.data) {
        setDiscoveryMeta(res.data);
        setContacts(res.data.contacts || []);
        setToastMessage(`Refreshed! Discovered ${res.data.total_discovered} potential contacts.`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to refresh referral discovery");
    } finally {
      setRefreshing(false);
    }
  };

  // Toggle single contact selection
  const handleToggleSelect = async (contact: ReferralContact) => {
    const isCurrentlySelected = selectedIds.has(contact.id);
    const newSet = new Set(selectedIds);

    if (isCurrentlySelected) {
      newSet.delete(contact.id);
      setSelectedIds(newSet);
      await dismissReferralContactApi(contact.id);
    } else {
      newSet.add(contact.id);
      setSelectedIds(newSet);
      await selectReferralContactApi(contact.id);
    }
  };

  // Dismiss a contact
  const handleDismiss = async (contactId: string) => {
    const newSet = new Set(selectedIds);
    newSet.delete(contactId);
    setSelectedIds(newSet);

    // Optimistically update list
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, outreach_status: "DO_NOT_CONTACT" } : c))
    );
    await dismissReferralContactApi(contactId);
    setToastMessage("Contact dismissed from active recommendations.");
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Bulk actions
  const handleSelectAllVerified = async () => {
    setBulkActionLoading(true);
    const verifiedIds = contacts.filter((c) => c.verification_status === "VERIFIED").map((c) => c.id);
    setSelectedIds(new Set(verifiedIds));
    await bulkSelectReferralContactsApi(verifiedIds, "select_all_verified");
    setBulkActionLoading(false);
    setToastMessage(`Selected all ${verifiedIds.length} verified contacts.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeselectAll = async () => {
    setBulkActionLoading(true);
    const allIds = contacts.map((c) => c.id);
    setSelectedIds(new Set());
    await bulkSelectReferralContactsApi(allIds, "deselect");
    setBulkActionLoading(false);
    setToastMessage("Cleared contact selection.");
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePrepareOutreach = async () => {
    if (selectedIds.size === 0 || !selectedJobId) return;
    setPreparingOutreach(true);
    try {
      const res = await bulkGenerateOutreachDraftsApi({
        job_id: selectedJobId,
        contact_ids: Array.from(selectedIds),
      });
      if (res.data) {
        setToastMessage(`Prepared ${res.data.total_generated} outreach drafts! Redirecting to Outreach Studio...`);
        setTimeout(() => {
          router.push(`/outreach?job_id=${selectedJobId}`);
        }, 1200);
      } else {
        alert(res.error || "Failed to prepare outreach drafts");
        setPreparingOutreach(false);
      }
    } catch (err: any) {
      alert(err?.message || "Failed to prepare outreach drafts");
      setPreparingOutreach(false);
    }
  };

  // Filter & Search logic
  const filteredContacts = useMemo(() => {
    return contacts
      .filter((contact) => {
        // Exclude dismissed contacts from default view unless specifically searched
        if (contact.outreach_status === "DO_NOT_CONTACT" && !searchQuery) {
          return false;
        }

        // Role filter
        if (roleFilter !== "ALL") {
          const rel = contact.relationship_type.toUpperCase();
          if (roleFilter === "ENGINEERS" && !["ENGINEER", "SENIOR_ENGINEER", "TEAM_MEMBER"].includes(rel)) return false;
          if (roleFilter === "MANAGERS" && !["ENGINEERING_MANAGER", "TECH_LEAD"].includes(rel)) return false;
          if (roleFilter === "RECRUITERS" && rel !== "RECRUITER") return false;
          if (roleFilter === "ALUMNI" && rel !== "ALUMNI") return false;
          if (roleFilter === "HIRING_TEAM" && !["HIRING_TEAM", "ENGINEERING_MANAGER"].includes(rel)) return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = contact.name.toLowerCase().includes(q);
          const matchTitle = contact.current_title.toLowerCase().includes(q);
          const matchCompany = contact.company.toLowerCase().includes(q);
          const matchUni = (contact.university || "").toLowerCase().includes(q);
          const matchSkills = (contact.skills || []).some((s) => s.toLowerCase().includes(q));
          if (!matchName && !matchTitle && !matchCompany && !matchUni && !matchSkills) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "relevance") {
          return b.relevance_score - a.relevance_score;
        }
        if (sortBy === "company") {
          return a.company.localeCompare(b.company);
        }
        if (sortBy === "role") {
          return a.current_title.localeCompare(b.current_title);
        }
        if (sortBy === "alumni") {
          const aAlumni = a.relationship_type === "ALUMNI" ? 1 : 0;
          const bAlumni = b.relationship_type === "ALUMNI" ? 1 : 0;
          return bAlumni - aAlumni;
        }
        if (sortBy === "verification") {
          const aVer = a.verification_status === "VERIFIED" ? 1 : 0;
          const bVer = b.verification_status === "VERIFIED" ? 1 : 0;
          return bVer - aVer;
        }
        return 0;
      });
  }, [contacts, roleFilter, searchQuery, sortBy]);

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-medium flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner & Target Dashboard */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 sm:p-8 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Users2 className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Phase 18 Referral Engine
            </span>
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Referral Discovery Studio
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Discover verified internal advocates, alumni, engineering managers, and team peers at your target companies.
              Strictly grounded in public/authorized sources.
            </p>
          </div>

          {/* Target Job Selector */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Target Opportunity:</label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
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
              <span>Re-run Discovery</span>
            </button>
          </div>
        </div>

        {/* Discovery Target Metric Cards */}
        {discoveryMeta && (
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="text-center px-4 py-1">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                Discovery Target
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white block font-mono">
                {discoveryMeta.target_count}
              </span>
            </div>

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

            <div className="text-center px-4 py-1">
              <span className="text-[10px] text-purple-600 dark:text-purple-400 uppercase font-semibold block">
                Found
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400 block font-mono">
                {discoveryMeta.total_discovered}
              </span>
            </div>

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

            <div className="text-center px-4 py-1">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold block">
                Verified
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 block font-mono">
                {discoveryMeta.total_verified}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Target Shortfall or Success Notice */}
      {discoveryMeta && !discoveryMeta.target_reached && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <span className="font-bold">Honest Discovery Target Shortfall:</span>{" "}
            {discoveryMeta.notice ||
              `Target not reached because fewer verified/relevant contacts were discoverable from the configured sources (${discoveryMeta.total_verified}/50). Zero contacts were fabricated.`}
          </div>
        </div>
      )}

      {/* Control Bar: Filters, Search, Sort & Bulk Selection */}
      <div className="space-y-4">
        {/* Role Category Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
            {[
              { id: "ALL", label: "All Contacts" },
              { id: "ENGINEERS", label: "Engineers" },
              { id: "MANAGERS", label: "Managers" },
              { id: "RECRUITERS", label: "Recruiters" },
              { id: "ALUMNI", label: "Alumni" },
              { id: "HIRING_TEAM", label: "Hiring Team" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setRoleFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  roleFilter === f.id
                    ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="relevance">Highest Relevance</option>
              <option value="company">Company</option>
              <option value="role">Role Title</option>
              <option value="alumni">Alumni First</option>
              <option value="verification">Verification Status</option>
            </select>
          </div>
        </div>

        {/* Search & Bulk Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, role, university, or technology..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Bulk Selection Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800">
              Selected: {selectedIds.size} / 50+
            </span>

            <Button
              size="sm"
              variant="outline"
              onClick={handleSelectAllVerified}
              loading={bulkActionLoading}
            >
              Select All Verified
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleDeselectAll}
              disabled={selectedIds.size === 0 || bulkActionLoading}
            >
              Deselect All
            </Button>

            <Button
              size="sm"
              onClick={handlePrepareOutreach}
              disabled={selectedIds.size === 0 || bulkActionLoading || preparingOutreach}
              className={
                selectedIds.size > 0
                  ? "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600"
              }
              title="Prepares selected contacts for Human-in-the-Loop outreach drafting. Never sends messages automatically."
            >
              {preparingOutreach ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  <span>Preparing Outreach...</span>
                </>
              ) : (
                <>
                  <span>Prepare Outreach ({selectedIds.size})</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Referral Contacts List */}
      {loading ? (
        <LoadingState message="Discovering and ranking potential referral contacts across configured sources..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => loadReferrals(selectedJobId)} />
      ) : filteredContacts.length === 0 ? (
        <EmptyState
          title="No Referral Contacts Found"
          description="Try broadening your search query or re-running discovery across configured sources."
          actionText="Run Referral Discovery"
          onAction={handleRefresh}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => {
            const isSelected = selectedIds.has(contact.id);
            const isVerified = contact.verification_status === "VERIFIED";

            return (
              <div
                key={contact.id}
                className={`rounded-2xl border transition-all p-5 flex flex-col justify-between space-y-4 ${
                  isSelected
                    ? "border-purple-500 bg-purple-50/20 dark:bg-purple-950/20 shadow-md ring-1 ring-purple-500"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                }`}
              >
                {/* Header: Checkbox + Name + Relevance Score */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <button
                        onClick={() => handleToggleSelect(contact)}
                        className="mt-1 text-slate-400 hover:text-purple-600 transition-colors"
                        title={isSelected ? "Deselect contact" : "Select contact"}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <div>
                        <Link
                          href={`/referrals/${contact.id}`}
                          className="font-bold text-sm text-slate-900 dark:text-white hover:text-purple-600 transition-colors block"
                        >
                          {contact.name}
                        </Link>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium line-clamp-1">
                          {contact.current_title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{contact.company}</span>
                          {contact.location && <span>• {contact.location}</span>}
                        </p>
                      </div>
                    </div>

                    {/* Relevance Score Pill */}
                    <div
                      className={`shrink-0 px-2 py-1 rounded-xl text-xs font-mono font-bold border ${
                        contact.relevance_score >= 80
                          ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          : contact.relevance_score >= 60
                          ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                      title={`Relevance Score: ${contact.relevance_score}/100 based on company match, team overlap, skills, and alumni connection.`}
                    >
                      {Math.round(contact.relevance_score)}%
                    </div>
                  </div>

                  {/* Relationship & Verification Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      {contact.relationship_type.replace(/_/g, " ")}
                    </span>

                    {isVerified && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        <span>Verified</span>
                      </span>
                    )}

                    {contact.university && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center gap-1">
                        <GraduationCap className="w-3 h-3" />
                        <span className="truncate max-w-[120px]">{contact.university}</span>
                      </span>
                    )}
                  </div>

                  {/* Why Relevant Breakdown (Grounded bullets) */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 space-y-1.5 border border-slate-100 dark:border-slate-800/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                      Why Relevant:
                    </span>
                    <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                      {contact.relevance_reasons.slice(0, 3).map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 leading-snug">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500 mt-0.5" />
                          <span className="line-clamp-2">{reason.replace(/^✓\s*/, "")}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Source Provenance References */}
                  {contact.source_references && contact.source_references.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      <span className="text-[10px] text-slate-400 font-medium">Sources:</span>
                      {contact.source_references.map((ref, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        >
                          {ref.source}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <Link
                    href={`/referrals/${contact.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 transition-colors"
                  >
                    <span>View Profile</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleSelect(contact)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isSelected
                          ? "bg-purple-600 text-white hover:bg-purple-700"
                          : "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </button>

                    <button
                      onClick={() => handleDismiss(contact.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      title="Dismiss contact from list"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReferralDashboardPage() {
  return (
    <React.Suspense fallback={<LoadingState message="Loading referral discovery studio..." />}>
      <ReferralDashboardContent />
    </React.Suspense>
  );
}

