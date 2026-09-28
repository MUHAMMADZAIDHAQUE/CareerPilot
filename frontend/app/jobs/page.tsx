"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Briefcase,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  MapPin,
  Building2,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowRight,
  Globe,
  SlidersHorizontal,
  Layers,
  Wand2,
  FileCode,
  Tag,
  Check,
  X,
  Share2,
  Users,
  Kanban,
} from "lucide-react";
import {
  fetchJobsApi,
  fetchRecommendedJobsApi,
  importJobUrlApi,
  importBulkJobsApi,
  Job,
  RecommendedJobItem,
  JobFilterParams,
  Candidate,
  fetchCandidateProfile,
} from "@/lib/api";

export default function JobDiscoveryDashboard() {
  const [activeTab, setActiveTab] = useState<"recommended" | "all">("recommended");
  const [candidate, setCandidate] = useState<Candidate | null>(null);

  // Job lists
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<RecommendedJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchRole, setSearchRole] = useState("");
  const [searchCompany, setSearchCompany] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [selectedSource, setSelectedSource] = useState("all");
  const [minScoreFilter, setMinScoreFilter] = useState(0);
  const [activeOnly, setActiveOnly] = useState(true);

  // Modals state
  const [showUrlImportModal, setShowUrlImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importCompany, setImportCompany] = useState("");
  const [importRole, setImportRole] = useState("");
  const [importingUrl, setImportingUrl] = useState(false);
  const [importUrlMessage, setImportUrlMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const [syncingFeeds, setSyncingFeeds] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Load profile and jobs
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Candidate profile
      const candRes = await fetchCandidateProfile();
      const candData = candRes.data;
      if (candData) {
        setCandidate(candData);
      }

      // 2. Fetch all jobs
      const jobsRes = await fetchJobsApi({ limit: 60 });
      if (jobsRes.data) {
        setAllJobs(jobsRes.data);
      }

      // 3. Fetch recommended jobs
      const recRes = await fetchRecommendedJobsApi(candData?.id, 0.0, 40);
      if (recRes.data) {
        setRecommendedJobs(recRes.data.recommendations);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load job discovery data");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // URL Import Handler
  const handleImportUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;

    setImportingUrl(true);
    setImportUrlMessage(null);

    const res = await importJobUrlApi({
      url: importUrl.trim(),
      company: importCompany.trim() || undefined,
      role: importRole.trim() || undefined,
    });

    setImportingUrl(false);

    if (res.data) {
      if (res.data.is_duplicate) {
        setImportUrlMessage({
          type: "info",
          text: `Duplicate detected: "${res.data.job.role} at ${res.data.job.company}" is already in your board.`,
        });
      } else {
        setImportUrlMessage({
          type: "success",
          text: `Imported "${res.data.job.role} at ${res.data.job.company}" successfully!`,
        });
        setImportUrl("");
        setImportCompany("");
        setImportRole("");
        await loadDashboardData();
        setTimeout(() => setShowUrlImportModal(false), 2000);
      }
    } else {
      setImportUrlMessage({
        type: "error",
        text: res.error || "Failed to import job from URL.",
      });
    }
  };

  // Public Feeds Sync Handler
  const handleSyncPublicFeeds = async () => {
    setSyncingFeeds(true);
    setSyncMessage(null);
    try {
      const res = await importBulkJobsApi({
        source_type: "public_feed",
        source_name: "Public Authorized Tech Feed",
      });
      if (res.data) {
        setSyncMessage(`Imported ${res.data.imported_count} new postings (${res.data.duplicate_count} skipped as duplicates).`);
        await loadDashboardData();
        setTimeout(() => setSyncMessage(null), 4000);
      } else {
        setSyncMessage(res.error || "Failed to sync feeds.");
      }
    } catch {
      setSyncMessage("Feed sync error.");
    } finally {
      setSyncingFeeds(false);
    }
  };

  // Filtered Jobs in "All Jobs" view
  const filteredAllJobs = useMemo(() => {
    return allJobs.filter((job) => {
      if (activeOnly && job.is_expired) return false;
      if (searchRole && !job.role.toLowerCase().includes(searchRole.toLowerCase())) return false;
      if (searchCompany && !job.company.toLowerCase().includes(searchCompany.toLowerCase())) return false;
      if (searchLocation && !(job.location || "").toLowerCase().includes(searchLocation.toLowerCase())) return false;
      if (selectedSource !== "all" && (job.source_type || "").toLowerCase() !== selectedSource.toLowerCase()) return false;
      if (minScoreFilter > 0 && (job.match_score || 0) < minScoreFilter) return false;
      return true;
    });
  }, [allJobs, activeOnly, searchRole, searchCompany, searchLocation, selectedSource, minScoreFilter]);

  // Filtered Recommended Jobs view
  const filteredRecommendedJobs = useMemo(() => {
    return recommendedJobs.filter((rec) => {
      if (activeOnly && rec.job.is_expired) return false;
      if (searchRole && !rec.job.role.toLowerCase().includes(searchRole.toLowerCase())) return false;
      if (searchCompany && !rec.job.company.toLowerCase().includes(searchCompany.toLowerCase())) return false;
      if (searchLocation && !(rec.job.location || "").toLowerCase().includes(searchLocation.toLowerCase())) return false;
      if (minScoreFilter > 0 && rec.overall_match_score < minScoreFilter) return false;
      return true;
    });
  }, [recommendedJobs, activeOnly, searchRole, searchCompany, searchLocation, minScoreFilter]);

  const activeJobCount = allJobs.filter((j) => !j.is_expired).length;
  const strongMatchCount = recommendedJobs.filter((r) => r.overall_match_score >= 80).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Top Hero Banner */}
      <div className="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -mt-20" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-brand-400 uppercase tracking-wider mb-2">
                <Globe className="w-3.5 h-3.5" />
                <span>Phase 8 • Modular Job Discovery & Intake</span>
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                Discovered Opportunities & Match Engine
              </h1>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Authorized job intake from public APIs, company career endpoints, and user URLs. Automatic duplicate detection, URL normalization, and deterministic skill gap scoring.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowUrlImportModal(true)}
                className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white flex items-center space-x-2 transition-all shadow-lg shadow-brand-500/25"
              >
                <Plus className="w-4 h-4" />
                <span>Import Job URL</span>
              </button>

              <button
                onClick={handleSyncPublicFeeds}
                disabled={syncingFeeds}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center space-x-2 transition-all shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingFeeds ? "animate-spin text-brand-400" : ""}`} />
                <span>{syncingFeeds ? "Syncing..." : "Sync Public Feeds"}</span>
              </button>

              <Link
                href="/applications"
                className="px-3.5 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-semibold text-amber-200 hover:text-white flex items-center space-x-1.5 transition-all shadow-sm"
              >
                <Kanban className="w-3.5 h-3.5 text-amber-400" />
                <span>CRM Board</span>
              </Link>

              <Link
                href="/jobs/analyze"
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center space-x-1.5 transition-all"
              >
                <span>Paste JD</span>
              </Link>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-400 hover:text-white transition-all"
                title="Refresh dashboard"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Sync notification */}
          {syncMessage && (
            <div className="mt-4 p-3 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-200 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
              <span>{syncMessage}</span>
            </div>
          )}

          {/* Metric Summary Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
            <div className="glass-card p-4 border border-slate-800 rounded-xl">
              <div className="text-xs text-slate-400 font-medium">Discovered Jobs</div>
              <div className="text-2xl font-bold text-white mt-1">{allJobs.length}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{activeJobCount} active postings</div>
            </div>

            <div className="glass-card p-4 border border-slate-800 rounded-xl">
              <div className="text-xs text-brand-300 font-medium flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                <span>Strong Matches</span>
              </div>
              <div className="text-2xl font-bold text-brand-400 mt-1">{strongMatchCount}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">&gt; 80% compatibility</div>
            </div>

            <div className="glass-card p-4 border border-slate-800 rounded-xl">
              <div className="text-xs text-slate-400 font-medium">Candidate Profile</div>
              <div className="text-sm font-bold text-white mt-1 truncate">
                {candidate?.full_name || "Profile Loaded"}
              </div>
              <div className="text-[11px] text-emerald-400 mt-0.5 flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Deterministic Scoring</span>
              </div>
            </div>

            <div className="glass-card p-4 border border-slate-800 rounded-xl">
              <div className="text-xs text-slate-400 font-medium">Compliance Guard</div>
              <div className="text-sm font-bold text-emerald-400 mt-1">100% Authorized</div>
              <div className="text-[11px] text-slate-500 mt-0.5">No unauthorized scraping</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        {/* Search & Multi-Filter Control Bar */}
        <div className="glass-card p-4 border border-slate-800 rounded-2xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Role Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchRole}
                onChange={(e) => setSearchRole(e.target.value)}
                placeholder="Filter by role title..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Company Search */}
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchCompany}
                onChange={(e) => setSearchCompany(e.target.value)}
                placeholder="Filter by company..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Location Search */}
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                placeholder="Filter by location (e.g. Remote)..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Source Dropdown */}
            <div className="relative">
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="all">All Sources</option>
                <option value="public_feed">Public Authorized Feeds</option>
                <option value="career_page">Company Career Portals</option>
                <option value="url_import">URL Direct Imports</option>
                <option value="user_configured">User Configured</option>
                <option value="direct">Direct Paste</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/60 text-xs">
            {/* Match Score Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 font-medium">Min Match Score:</span>
              <div className="flex items-center space-x-1.5">
                {[0, 60, 75, 85].map((score) => (
                  <button
                    key={score}
                    onClick={() => setMinScoreFilter(score)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      minScoreFilter === score
                        ? "bg-brand-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {score === 0 ? "All" : `${score}%+`}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Only Toggle */}
            <label className="flex items-center space-x-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="rounded border-slate-700 text-brand-600 focus:ring-brand-500 bg-slate-900"
              />
              <span>Hide expired / closed listings</span>
            </label>
          </div>
        </div>

        {/* View Mode Tab Switcher */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab("recommended")}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
                activeTab === "recommended"
                  ? "bg-brand-600 text-white shadow-md shadow-brand-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Recommended for You ({filteredRecommendedJobs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
                activeTab === "all"
                  ? "bg-brand-600 text-white shadow-md shadow-brand-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Discovered Jobs ({filteredAllJobs.length})</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 hidden sm:block">
            Automated application submission disabled (Strict human agency)
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="glass-card p-16 text-center text-slate-400 border border-slate-800 rounded-2xl flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
            <p className="text-sm">Discovering and scoring opportunities against candidate profile...</p>
          </div>
        )}

        {/* TAB 1: Recommended Jobs (Ranked by Match Score & Highlighting Missing Skills) */}
        {!loading && activeTab === "recommended" && (
          <div className="space-y-4">
            {filteredRecommendedJobs.length === 0 ? (
              <div className="glass-card p-12 text-center text-slate-400 border border-slate-800 rounded-2xl space-y-3">
                <Briefcase className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-white">No Recommended Jobs Match Your Filter</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Try lowering your minimum match score filter or importing new opportunities from job URLs or public feeds.
                </p>
                <button
                  onClick={() => setMinScoreFilter(0)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
                >
                  Reset Match Score Filter
                </button>
              </div>
            ) : (
              filteredRecommendedJobs.map((rec, idx) => {
                const job = rec.job;
                const score = rec.overall_match_score;
                return (
                  <div
                    key={job.id || idx}
                    className="glass-card p-6 border border-slate-800 hover:border-slate-700 rounded-2xl transition-all space-y-4 relative overflow-hidden group"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Role & Company */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Score Pill */}
                          <div
                            className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center space-x-1.5 ${
                              score >= 80
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : score >= 60
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                          >
                            <span>{score.toFixed(0)}% Match</span>
                          </div>

                          {/* Source badge */}
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            {job.source_name || "Direct"}
                          </span>

                          {job.is_expired && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Expired / Closed
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-bold text-white group-hover:text-brand-300 transition-colors">
                          <Link href={`/jobs/${job.id}`}>{job.role}</Link>
                        </h3>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                          <span className="font-semibold text-slate-200 flex items-center space-x-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-500" />
                            <span>{job.company}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            <span>{job.location || "Remote"}</span>
                          </span>
                          {job.salary && (
                            <span className="flex items-center space-x-1 text-emerald-400">
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>{job.salary}</span>
                            </span>
                          )}
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>{job.employment_type || "Full-time"}</span>
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Link
                          href={`/jobs/${job.id}?tab=tailor`}
                          className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition-all shadow-md shadow-brand-500/20"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>Tailor Resume</span>
                        </Link>

                        <Link
                          href={`/jobs/${job.id}`}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-all"
                        >
                          <span>Breakdown</span>
                        </Link>

                        <Link
                          href={`/jobs/${job.id}/referrals`}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center space-x-1"
                          title="Discover referrals for this job"
                        >
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Referrals</span>
                        </Link>

                        {job.application_url && (
                          <a
                            href={job.application_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-700"
                            title="Open original job posting"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Grounded Recommendation Reason */}
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/90 text-xs text-slate-300">
                      <span className="font-semibold text-brand-300">Match Rationale:</span>{" "}
                      {rec.recommendation_reason}
                    </div>

                    {/* Matched vs Missing Skills Highlight */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {/* Matched Skills */}
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Matched Skills ({rec.matched_skills.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {rec.matched_skills.slice(0, 6).map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/25"
                            >
                              {skill}
                            </span>
                          ))}
                          {rec.matched_skills.length === 0 && (
                            <span className="text-[11px] text-slate-500">None detected</span>
                          )}
                        </div>
                      </div>

                      {/* Missing Skills */}
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Missing Skills Gap ({rec.missing_required_skills.length + rec.missing_preferred_skills.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {rec.missing_required_skills.slice(0, 5).map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30"
                              title="Required skill missing from profile"
                            >
                              {skill} *
                            </span>
                          ))}
                          {rec.missing_preferred_skills.slice(0, 3).map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/25"
                              title="Preferred skill missing from profile"
                            >
                              {skill}
                            </span>
                          ))}
                          {rec.missing_required_skills.length === 0 && rec.missing_preferred_skills.length === 0 && (
                            <span className="text-[11px] text-emerald-400">100% skill coverage!</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: All Discovered Jobs */}
        {!loading && activeTab === "all" && (
          <div className="space-y-4">
            {filteredAllJobs.length === 0 ? (
              <div className="glass-card p-12 text-center text-slate-400 border border-slate-800 rounded-2xl">
                No jobs match the current filters.
              </div>
            ) : (
              filteredAllJobs.map((job) => (
                <div
                  key={job.id}
                  className="glass-card p-5 border border-slate-800 hover:border-slate-700 rounded-2xl transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                          {job.source_name || "Direct"}
                        </span>
                        {job.match_score !== null && job.match_score !== undefined && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              job.match_score >= 80
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {job.match_score.toFixed(0)}% Match
                          </span>
                        )}
                        {job.is_expired && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Expired
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-white hover:text-brand-300 transition-colors">
                        <Link href={`/jobs/${job.id}`}>{job.role}</Link>
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="text-slate-200 font-semibold">{job.company}</span>
                        <span>•</span>
                        <span>{job.location || "Remote"}</span>
                        <span>•</span>
                        <span>{job.employment_type || "Full-time"}</span>
                        {job.salary && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-400">{job.salary}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700"
                      >
                        Details
                      </Link>
                      <Link
                        href={`/jobs/${job.id}/referrals`}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-indigo-300 border border-slate-700 hover:border-indigo-500/40 flex items-center space-x-1"
                        title="Find referrals"
                      >
                        <Users className="w-3 h-3 text-indigo-400" />
                        <span>Referrals</span>
                      </Link>
                      <Link
                        href={`/jobs/${job.id}?tab=tailor`}
                        className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white"
                      >
                        Tailor
                      </Link>
                    </div>
                  </div>

                  {/* Skills tags */}
                  {job.required_skills && job.required_skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {job.required_skills.slice(0, 8).map((sk, skIdx) => (
                        <span
                          key={skIdx}
                          className="px-2 py-0.5 rounded text-[10px] bg-slate-800/80 text-slate-300 border border-slate-700/60"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* MODAL: Import Job from URL */}
      {showUrlImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-card max-w-lg w-full p-6 border border-slate-800 rounded-2xl space-y-4 bg-slate-900/95 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4 text-brand-400" />
                <h3 className="text-sm font-bold text-white">Import Job from URL</h3>
              </div>
              <button
                onClick={() => setShowUrlImportModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Paste any job posting URL (Greenhouse, Lever, LinkedIn, Ashby, Company Careers). CareerPilot will normalize the URL, strip tracking params, detect duplicates, and extract structured requirements.
            </p>

            <form onSubmit={handleImportUrl} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Job Posting URL *
                </label>
                <input
                  type="url"
                  required
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://jobs.lever.co/company/job-id or company career page..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Company (Optional)
                  </label>
                  <input
                    type="text"
                    value={importCompany}
                    onChange={(e) => setImportCompany(e.target.value)}
                    placeholder="e.g. Stripe"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Role (Optional)
                  </label>
                  <input
                    type="text"
                    value={importRole}
                    onChange={(e) => setImportRole(e.target.value)}
                    placeholder="e.g. Senior Backend Engineer"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {importUrlMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                    importUrlMessage.type === "success"
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                      : importUrlMessage.type === "info"
                      ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-300"
                      : "bg-rose-500/10 border border-rose-500/30 text-rose-300"
                  }`}
                >
                  {importUrlMessage.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{importUrlMessage.text}</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUrlImportModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importingUrl}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition-all shadow-md shadow-brand-500/25"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${importingUrl ? "animate-spin" : ""}`} />
                  <span>{importingUrl ? "Importing & Analyzing..." : "Import & Analyze"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
