"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Briefcase,
  Search,
  SlidersHorizontal,
  RefreshCw,
  Plus,
  ArrowRight,
  Globe,
  Sparkles,
  ExternalLink,
  MapPin,
  Building2,
  Check,
  X,
  Layers,
  FileCode,
  Users2,
  GraduationCap,
  Compass,
  BellRing,
  CheckCircle2,
  AlertTriangle,
  Bookmark,
  EyeOff,
  Filter,
} from "lucide-react";
import {
  Job,
  SourceCapability,
  JobSearchFilterRequest,
  searchJobsWithFiltersApi,
  fetchJobSourcesApi,
  saveJobApi,
  ignoreJobApi,
  importJobUrlApi,
  fetchCandidateProfile,
  Candidate,
  enqueueJobToQueue,
  getCurrentCandidateId,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { JobCardSkeleton } from "@/components/ui/Skeleton";

const DEFAULT_SOURCES = [
  "linkedin",
  "naukri",
  "internshala",
  "freshersworld",
  "indeed",
  "company_careers",
  "wellfound",
  "foundit",
  "glassdoor",
  "public_feed",
  "user_url",
];

const INDIA_CITIES = [
  "All Locations",
  "All India",
  "Remote India",
  "Bengaluru",
  "Hyderabad",
  "Pune",
  "Mumbai",
  "Delhi NCR",
  "Chennai",
  "Kolkata",
];

const EXP_OPTIONS = [
  "Fresher",
  "Entry Level",
  "0-1 years",
  "0-2 years",
  "1-3 years",
  "Internship",
  "Graduate Program",
];

const JOB_TYPE_OPTIONS = ["Full-time", "Internship", "Contract", "Part-time"];
const WORK_MODE_OPTIONS = ["Remote", "Hybrid", "On-site"];

export default function JobDiscoveryPortalPage() {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sourceCapabilities, setSourceCapabilities] = useState<SourceCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("All Locations");
  const [selectedSources, setSelectedSources] = useState<string[]>(DEFAULT_SOURCES);
  const [fresherMode, setFresherMode] = useState(true);
  const [selectedExp, setSelectedExp] = useState<string[]>(["Fresher", "Entry Level", "0-1 years", "0-2 years", "Internship"]);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>(["Full-time", "Internship"]);
  const [selectedWorkModes, setSelectedWorkModes] = useState<string[]>(["Remote", "Hybrid", "On-site"]);
  const [postedWithin, setPostedWithin] = useState<number | undefined>(undefined);
  const [minMatchScore, setMinMatchScore] = useState<number>(0);
  const [companyFilter, setCompanyFilter] = useState("");

  // Modals
  const [showSourcesModal, setShowSourcesModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importCompany, setImportCompany] = useState("");
  const [importRole, setImportRole] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Feedback notifications
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [ignoredJobIds, setIgnoredJobIds] = useState<Set<string>>(new Set());
  const [queuedJobIds, setQueuedJobIds] = useState<Set<string>>(new Set());

  // Load initial candidate & sources
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [candRes, sourcesRes] = await Promise.all([
          fetchCandidateProfile(),
          fetchJobSourcesApi(),
        ]);
        if (candRes.data) setCandidate(candRes.data);
        if (sourcesRes.data) setSourceCapabilities(sourcesRes.data);
      } catch (err: any) {
        console.error("Initial load error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Perform search
  const performSearch = async () => {
    setSearching(true);
    setError(null);
    try {
      let locCandidates: string[] | undefined = undefined;
      if (selectedLocation === "All India") {
        locCandidates = ["India"];
      } else if (selectedLocation !== "All Locations") {
        locCandidates = [selectedLocation];
      }
      const payload: JobSearchFilterRequest = {
        query: searchQuery.trim() || undefined,
        sources: selectedSources.length > 0 ? selectedSources : undefined,
        locations: locCandidates,
        experience_levels: selectedExp.length > 0 ? selectedExp : undefined,
        job_types: selectedJobTypes.length > 0 ? selectedJobTypes : undefined,
        work_modes: selectedWorkModes.length > 0 ? selectedWorkModes : undefined,
        posted_within_days: postedWithin,
        min_match_score: minMatchScore > 0 ? minMatchScore : undefined,
        fresher_mode: fresherMode,
        company: companyFilter.trim() || undefined,
        candidate_id: candidate?.id,
        limit: 80,
      };

      const res = await searchJobsWithFiltersApi(payload);
      if (res.data) {
        setJobs(res.data.jobs);
      } else {
        setError(res.error || "Failed to search jobs");
      }
    } catch (err: any) {
      setError(err?.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  // Run search on filter changes or initial load
  useEffect(() => {
    performSearch();
  }, [
    selectedLocation,
    selectedSources,
    fresherMode,
    selectedExp,
    selectedJobTypes,
    selectedWorkModes,
    postedWithin,
    minMatchScore,
  ]);

  // Actions
  const handleSaveJob = async (job: Job) => {
    const res = await saveJobApi(job.id, candidate?.id);
    if (!res.error) {
      setSavedJobIds((prev) => new Set([...prev, job.id]));
    } else {
      alert(res.error);
    }
  };

  const handleIgnoreJob = async (job: Job) => {
    const res = await ignoreJobApi(job.id, candidate?.id);
    if (!res.error) {
      setIgnoredJobIds((prev) => new Set([...prev, job.id]));
    } else {
      alert(res.error);
    }
  };

  const handleEnqueueJob = async (job: Job) => {
    const candId = candidate?.id || getCurrentCandidateId() || "demo-candidate";
    const res = await enqueueJobToQueue(candId, job.id, "HIGH", `Staged from job search`);
    if (!res.error) {
      setQueuedJobIds((prev) => new Set([...prev, job.id]));
    } else {
      alert(res.error || "Failed to add job to queue");
    }
  };

  const handleImportUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await importJobUrlApi({
        url: importUrl.trim(),
        company: importCompany.trim() || undefined,
        role: importRole.trim() || undefined,
      });
      if (res.data) {
        setImportMsg({
          type: "success",
          text: `Successfully imported "${res.data.job.role}" at ${res.data.job.company}!`,
        });
        setImportUrl("");
        setImportCompany("");
        setImportRole("");
        performSearch();
      } else {
        setImportMsg({ type: "error", text: res.error || "Failed to import job from URL" });
      }
    } catch (err: any) {
      setImportMsg({ type: "error", text: err?.message || "Import failed" });
    } finally {
      setImporting(false);
    }
  };

  const displayedJobs = useMemo(() => {
    return jobs.filter((j) => !ignoredJobIds.has(j.id));
  }, [jobs, ignoredJobIds]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs uppercase font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200">
              India Fresher & Tech Portal
            </Badge>
            <span className="text-xs text-slate-400 font-mono">• 11 Verified Sources</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Compass className="w-7 h-7 text-blue-600" />
            Job Discovery Portal
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Explore and filter opportunities across Naukri, Internshala, Freshersworld, LinkedIn, Indeed, and Company Career Portals with zero fabricated data.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link href="/pipeline">
            <Button variant="outline" size="sm" className="flex items-center gap-2 text-xs">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>Queue</span>
            </Button>
          </Link>

          <Link href="/alerts">
            <Button variant="outline" size="sm" className="flex items-center gap-2 text-xs">
              <BellRing className="w-3.5 h-3.5 text-blue-600" />
              <span>Job Alerts</span>
            </Button>
          </Link>

          <Button
            onClick={() => setShowImportModal(true)}
            size="sm"
            variant="outline"
            className="flex items-center gap-2 text-xs"
            id="btn-import-url"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span>Import Job URL</span>
          </Button>

          <Button
            onClick={() => setShowSourcesModal(true)}
            size="sm"
            className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 flex items-center gap-2 text-xs shadow-sm"
            id="btn-sources-modal"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>SOURCES ({selectedSources.length})</span>
          </Button>
        </div>
      </div>

      {/* Global Search Bar & Location Pills */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && performSearch()}
              placeholder="Search roles, skills, keywords (e.g. SDE, Python, Data Analyst, React)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              id="input-job-search"
            />
          </div>

          <Button
            onClick={performSearch}
            disabled={searching}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shrink-0"
            id="btn-search-submit"
          >
            {searching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "SEARCH JOBS"}
          </Button>
        </div>

        {/* Quick Indian Cities */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-slate-400 font-medium shrink-0 flex items-center gap-1 mr-1">
            <MapPin className="w-3.5 h-3.5" /> India Hubs:
          </span>
          {INDIA_CITIES.map((city) => (
            <button
              key={city}
              onClick={() => setSelectedLocation(city)}
              className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 ${
                selectedLocation === city
                  ? "bg-blue-600 text-white font-semibold shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {city}
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout: Left Sidebar Filters + Right Job Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Sidebar Filters */}
        <div className="lg:col-span-1 space-y-5 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
          {/* Fresher Mode Toggle */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4" />
                Fresher Mode
              </span>
              <input
                type="checkbox"
                id="fresher-mode-toggle"
                checked={fresherMode}
                onChange={(e) => setFresherMode(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-400 leading-snug">
              Prioritizes 0-exp roles, internships, and trainee positions; down-ranks senior roles.
            </p>
          </div>

          {/* Experience Filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
              <span>Experience Level</span>
              <div className="flex items-center gap-2 text-[10px] text-blue-600">
                <button onClick={() => setSelectedExp([...EXP_OPTIONS])} className="hover:underline">
                  All
                </button>
                <span>|</span>
                <button onClick={() => setSelectedExp([])} className="hover:underline">
                  Clear
                </button>
              </div>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {EXP_OPTIONS.map((exp) => (
                <label key={exp} className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={selectedExp.includes(exp)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedExp([...selectedExp, exp]);
                      else setSelectedExp(selectedExp.filter((x) => x !== exp));
                    }}
                    className="rounded text-blue-600"
                  />
                  <span>{exp}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Job Type Filter */}
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
              <span>Job Type</span>
              <div className="flex items-center gap-2 text-[10px] text-blue-600">
                <button onClick={() => setSelectedJobTypes([...JOB_TYPE_OPTIONS])} className="hover:underline">
                  All
                </button>
                <span>|</span>
                <button onClick={() => setSelectedJobTypes([])} className="hover:underline">
                  Clear
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              {JOB_TYPE_OPTIONS.map((jt) => (
                <label key={jt} className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={selectedJobTypes.includes(jt)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedJobTypes([...selectedJobTypes, jt]);
                      else setSelectedJobTypes(selectedJobTypes.filter((x) => x !== jt));
                    }}
                    className="rounded text-blue-600"
                  />
                  <span>{jt}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Work Mode Filter */}
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
              <span>Work Mode</span>
              <div className="flex items-center gap-2 text-[10px] text-blue-600">
                <button onClick={() => setSelectedWorkModes([...WORK_MODE_OPTIONS])} className="hover:underline">
                  All
                </button>
                <span>|</span>
                <button onClick={() => setSelectedWorkModes([])} className="hover:underline">
                  Clear
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              {WORK_MODE_OPTIONS.map((wm) => (
                <label key={wm} className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={selectedWorkModes.includes(wm)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedWorkModes([...selectedWorkModes, wm]);
                      else setSelectedWorkModes(selectedWorkModes.filter((x) => x !== wm));
                    }}
                    className="rounded text-blue-600"
                  />
                  <span>{wm}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Match Score Threshold */}
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
              <span>Candidate Match Threshold</span>
              <span className="font-mono text-blue-600">{minMatchScore}%+</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="10"
              value={minMatchScore}
              onChange={(e) => setMinMatchScore(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Any</span>
              <span>50%</span>
              <span>70%</span>
              <span>90%</span>
            </div>
          </div>

          {/* Company Filter */}
          <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <label className="font-semibold text-slate-700 dark:text-slate-300 block">
              Filter by Company
            </label>
            <input
              type="text"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              onBlur={performSearch}
              placeholder="e.g. Swiggy, Razorpay..."
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>
        </div>

        {/* Right Job Cards List */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing <strong className="text-slate-900 dark:text-white">{displayedJobs.length}</strong> opportunities
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono">
                {selectedSources.length} sources active
              </span>
            </div>
          </div>

          {searching ? (
            <div className="space-y-3">
              <JobCardSkeleton />
              <JobCardSkeleton />
              <JobCardSkeleton />
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={performSearch} />
          ) : displayedJobs.length === 0 ? (
            <EmptyState
              title="No Jobs Found Matching Criteria"
              description="Try broadening your location, clearing experience filters, or opening more sources in the SOURCES modal."
              actionText="Reset Filters"
              onAction={() => {
                setSelectedSources(DEFAULT_SOURCES);
                setSelectedLocation("All India");
                setSelectedExp([...EXP_OPTIONS]);
                setFresherMode(true);
                setMinMatchScore(0);
                setSearchQuery("");
              }}
            />
          ) : (
            <div className="space-y-3">
              {displayedJobs.map((job) => {
                const isSaved = savedJobIds.has(job.id);
                const hasSafetyWarning = job.has_safety_warnings || job.scam_risk_level === "HIGH" || job.scam_risk_level === "MEDIUM";

                return (
                  <Card
                    key={job.id}
                    className="p-5 space-y-3 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition-all shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/jobs/${job.id}`}>
                            <h3 className="font-bold text-base text-slate-900 dark:text-white hover:text-blue-600 transition-colors">
                              {job.role}
                            </h3>
                          </Link>
                          {job.is_fresher_eligible && (
                            <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300">
                              Fresher Eligible
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {job.company}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {job.location || "India"}
                          </span>
                          <span>•</span>
                          <span>{job.experience_level || "Fresher"}</span>
                          <span>•</span>
                          <span>{job.remote_status || "On-site"}</span>
                          {job.salary && (
                            <>
                              <span>•</span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {job.salary}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right Meta: Source Badge & Match Score */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {job.source_name || job.source_type || "Direct"}
                        </Badge>
                        {job.match_score !== undefined && job.match_score !== null && (
                          <div className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold text-xs">
                            {Math.round(job.match_score)}%
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Scam / Quality Signal Warning Alert */}
                    {hasSafetyWarning && (
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold block">Quality & Safety Advisory</span>
                          <span className="text-[11px] text-amber-700 dark:text-amber-400">
                            Potential risk flags detected in job text (e.g. upfront payment language, unverified email, or unusual Fresher guarantees). Proceed with diligence.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Description snippet */}
                    {job.raw_description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {job.raw_description}
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <Link href={`/jobs/${job.id}`}>
                          <Button size="sm" variant="outline" className="text-xs">
                            VIEW DETAILS
                          </Button>
                        </Link>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSaveJob(job)}
                          className={`text-xs flex items-center gap-1.5 ${
                            isSaved ? "bg-emerald-50 text-emerald-700 border-emerald-300" : ""
                          }`}
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                          <span>{isSaved ? "SAVED" : "SAVE"}</span>
                        </Button>

                        <button
                          onClick={() => handleIgnoreJob(job)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Ignore job"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link href={`/resumes?job_id=${job.id}`}>
                          <Button size="sm" variant="outline" className="text-xs flex items-center gap-1.5">
                            <FileCode className="w-3.5 h-3.5" />
                            <span>TAILOR RESUME</span>
                          </Button>
                        </Link>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEnqueueJob(job)}
                          className={`text-xs flex items-center gap-1.5 transition-all ${
                            queuedJobIds.has(job.id)
                              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800"
                              : "hover:border-indigo-400"
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{queuedJobIds.has(job.id) ? "QUEUED" : "QUEUE"}</span>
                        </Button>

                        {(job.official_company_url || job.application_url || job.canonical_url) && (
                          <a
                            href={(job.official_company_url || job.application_url || job.canonical_url)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                          >
                            <span>OPEN ORIGINAL</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sources Selection Modal */}
      {showSourcesModal && (
        <Modal
          isOpen={showSourcesModal}
          onClose={() => setShowSourcesModal(false)}
          title="Monitored Job Sources (11 Registry Sources)"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Toggle active job providers:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedSources([...DEFAULT_SOURCES])}
                  className="font-semibold text-blue-600 hover:underline"
                  id="btn-sources-select-all"
                >
                  Select All
                </button>
                <span>|</span>
                <button
                  onClick={() => setSelectedSources([])}
                  className="font-semibold text-blue-600 hover:underline"
                  id="btn-sources-clear-all"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {DEFAULT_SOURCES.map((sourceId) => {
                const cap = sourceCapabilities.find((c) => c.source_id === sourceId);
                const isSelected = selectedSources.includes(sourceId);

                return (
                  <label
                    key={sourceId}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedSources([...selectedSources, sourceId]);
                          else setSelectedSources(selectedSources.filter((x) => x !== sourceId));
                        }}
                        className="rounded text-blue-600"
                      />
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block capitalize">
                          {cap?.display_name || sourceId.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {cap?.notes || (cap?.access_mode ? `Mode: ${cap.access_mode}` : "Verified Connector")}
                        </span>
                      </div>
                    </div>

                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      {cap?.access_mode || "ENABLED"}
                    </Badge>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                onClick={() => setShowSourcesModal(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                id="btn-apply-sources"
              >
                Apply Sources
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import Job URL Modal */}
      {showImportModal && (
        <Modal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          title="Import Job Posting from URL"
        >
          <form onSubmit={handleImportUrl} className="space-y-4 text-xs">
            <p className="text-slate-500 leading-relaxed">
              Paste any job posting URL (company careers portal, LinkedIn, Greenhouse, Lever, etc.). CareerPilot will extract, canonicalize, and analyze requirements truthfully.
            </p>

            {importMsg && (
              <div
                className={`p-3 rounded-xl border ${
                  importMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
                }`}
              >
                {importMsg.text}
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Job Posting URL *
              </label>
              <input
                type="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://company.com/careers/swe-fresher"
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Company (Optional)
                </label>
                <input
                  type="text"
                  value={importCompany}
                  onChange={(e) => setImportCompany(e.target.value)}
                  placeholder="e.g. Swiggy"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Role Title (Optional)
                </label>
                <input
                  type="text"
                  value={importRole}
                  onChange={(e) => setImportRole(e.target.value)}
                  placeholder="e.g. Associate SWE"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setShowImportModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={importing} className="bg-blue-600 hover:bg-blue-700 text-white">
                {importing ? "Importing & Analyzing..." : "Import & Analyze"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
