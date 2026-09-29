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
} from "lucide-react";
import {
  fetchJobsApi,
  fetchRecommendedJobsApi,
  importJobUrlApi,
  Job,
  RecommendedJobItem,
  Candidate,
  fetchCandidateProfile,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { JobCard } from "@/components/ui/JobCard";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/States";

export default function JobDiscoveryPage() {
  const [activeTab, setActiveTab] = useState<"recommended" | "all">("recommended");
  const [candidate, setCandidate] = useState<Candidate | null>(null);

  // Job lists
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<RecommendedJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [selectedSource, setSelectedSource] = useState("all");
  const [minScoreFilter, setMinScoreFilter] = useState(0);

  // Import Modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importCompany, setImportCompany] = useState("");
  const [importRole, setImportRole] = useState("");
  const [importingUrl, setImportingUrl] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Profile
      const candRes = await fetchCandidateProfile();
      if (candRes.data) {
        setCandidate(candRes.data);
      }

      // 2. Fetch all jobs
      const jobsRes = await fetchJobsApi({ limit: 80 });
      if (jobsRes.data) {
        setAllJobs(jobsRes.data);
      }

      // 3. Fetch recommended jobs
      const recRes = await fetchRecommendedJobsApi(candRes.data?.id, 0.0, 60);
      if (recRes.data) {
        setRecommendedJobs(recRes.data.recommendations);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load jobs");
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

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;

    setImportingUrl(true);
    setImportStatus(null);

    const res = await importJobUrlApi({
      url: importUrl.trim(),
      company: importCompany.trim() || undefined,
      role: importRole.trim() || undefined,
    });

    setImportingUrl(false);

    if (res.error) {
      setImportStatus({ type: "error", text: res.error });
    } else if (res.data) {
      setImportStatus({
        type: "success",
        text: `Successfully ingested "${res.data.job.role}" at ${res.data.job.company}!`,
      });
      setImportUrl("");
      setImportCompany("");
      setImportRole("");
      // Reload jobs
      loadData();
    }
  };

  // Filtered jobs calculations
  const filteredAllJobs = useMemo(() => {
    return allJobs.filter((j) => {
      const matchSearch =
        !searchTerm.trim() ||
        j.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        j.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (j.required_skills || []).some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchLoc =
        !searchLocation.trim() ||
        (j.location && j.location.toLowerCase().includes(searchLocation.toLowerCase()));

      const matchSrc =
        selectedSource === "all" ||
        ((j.source_name || j.source_type) &&
          (j.source_name || j.source_type)!.toLowerCase() === selectedSource.toLowerCase());

      return matchSearch && matchLoc && matchSrc;
    });
  }, [allJobs, searchTerm, searchLocation, selectedSource]);

  const filteredRecommendedJobs = useMemo(() => {
    return recommendedJobs.filter((r) => {
      const j = r.job;
      const matchSearch =
        !searchTerm.trim() ||
        j.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        j.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (j.required_skills || []).some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchLoc =
        !searchLocation.trim() ||
        (j.location && j.location.toLowerCase().includes(searchLocation.toLowerCase()));

      const matchScore = (r.overall_match_score ?? 0) >= minScoreFilter;

      return matchSearch && matchLoc && matchScore;
    });
  }, [recommendedJobs, searchTerm, searchLocation, minScoreFilter]);

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Job Discovery & Matching
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Sourced opportunities ranked deterministically against your verified experience.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            loading={refreshing}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowImportModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Ingest Job URL
          </Button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-card space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            placeholder="Search by role, company, or technology..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
          <Input
            placeholder="Filter location (e.g. Remote, San Francisco)..."
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
            icon={<MapPin className="w-4 h-4" />}
          />
          <Select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
          >
            <option value="all">All Job Sources</option>
            <option value="linkedin">LinkedIn</option>
            <option value="greenhouse">Greenhouse</option>
            <option value="lever">Lever</option>
            <option value="workday">Workday</option>
            <option value="direct">Direct Career Site</option>
          </Select>
        </div>

        {activeTab === "recommended" && (
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <span className="font-medium">Minimum Match Score:</span>
              <div className="flex items-center gap-1.5">
                {[0, 50, 70, 80, 90].map((score) => (
                  <button
                    key={score}
                    onClick={() => setMinScoreFilter(score)}
                    className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors ${
                      minScoreFilter === score
                        ? "bg-slate-900 text-white font-semibold"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {score === 0 ? "Any" : `≥${score}%`}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-slate-400 font-mono">
              Showing {filteredRecommendedJobs.length} matches
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("recommended")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "recommended"
              ? "border-slate-900 text-slate-900 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Recommended For You</span>
          <span className="ml-1 text-xs px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono">
            {recommendedJobs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("all")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "all"
              ? "border-slate-900 text-slate-900 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>All Discovered Jobs</span>
          <span className="ml-1 text-xs px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono">
            {allJobs.length}
          </span>
        </button>
      </div>

      {/* Jobs Grid */}
      {loading ? (
        <LoadingState message="Calculating deterministic matches and parsing job requirements..." />
      ) : activeTab === "recommended" ? (
        filteredRecommendedJobs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecommendedJobs.map((rec) => (
              <JobCard
                key={rec.job.id}
                id={rec.job.id}
                role={rec.job.role}
                company={rec.job.company}
                location={rec.job.location}
                experience={rec.job.experience_requirement}
                matchScore={rec.overall_match_score}
                requiredSkills={rec.matched_skills}
                missingSkills={rec.missing_required_skills}
                source={rec.job.source_name || rec.job.source_type}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Recommended Jobs Match Filters"
            description="Try loosening your search terms or lowering the minimum match score."
            actionText="Clear Filters"
            onAction={() => {
              setSearchTerm("");
              setSearchLocation("");
              setMinScoreFilter(0);
            }}
          />
        )
      ) : (
        filteredAllJobs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAllJobs.map((job) => (
              <JobCard
                key={job.id}
                id={job.id}
                role={job.role}
                company={job.company}
                location={job.location}
                experience={job.experience_requirement}
                matchScore={job.match_score}
                requiredSkills={job.required_skills}
                missingSkills={job.missing_required_skills}
                source={job.source_name || job.source_type}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Jobs Found"
            description="No jobs match your search parameters. Try ingesting a new job posting URL."
            actionText="Ingest Job URL"
            onAction={() => setShowImportModal(true)}
          />
        )
      )}

      {/* Ingest Job URL Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportStatus(null);
        }}
        title="Ingest Job Description URL"
        description="CareerPilot normalizes URLs, extracts structured requirements, and runs deterministic matching."
      >
        <form onSubmit={handleImportSubmit} className="space-y-4">
          <Input
            label="Job Posting URL *"
            placeholder="https://boards.greenhouse.io/... or https://jobs.lever.co/..."
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Company (Optional)"
              placeholder="e.g. Anthropic"
              value={importCompany}
              onChange={(e) => setImportCompany(e.target.value)}
            />
            <Input
              label="Role (Optional)"
              placeholder="e.g. Staff Software Engineer"
              value={importRole}
              onChange={(e) => setImportRole(e.target.value)}
            />
          </div>

          {importStatus && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center space-x-2 ${
                importStatus.type === "success"
                  ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                  : "bg-rose-50 text-rose-900 border border-rose-200"
              }`}
            >
              {importStatus.type === "success" ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <X className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{importStatus.text}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowImportModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={importingUrl}
              disabled={!importUrl.trim()}
            >
              Parse & Match Job
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
