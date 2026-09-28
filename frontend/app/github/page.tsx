"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Github,
  Search,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Star,
  GitFork,
  BookOpen,
  Code2,
  FolderGit2,
  Layers,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  Info,
  Briefcase,
  ChevronRight,
  Rocket,
  FileText,
  BadgeAlert,
  Terminal,
} from "lucide-react";
import {
  analyzeGitHubApi,
  fetchLatestGitHubAnalysisApi,
  fetchJobsApi,
  GitHubAnalysisResponse,
  Job,
} from "@/lib/api";

export default function GitHubAnalyzerPage() {
  const [username, setUsername] = useState<string>("zaidhaque");
  const [githubToken, setGithubToken] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [showTokenInput, setShowTokenInput] = useState<boolean>(false);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [analysis, setAnalysis] = useState<GitHubAnalysisResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedBulletId, setCopiedBulletId] = useState<string | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<
    "overview" | "skills" | "projects" | "resume_evidence" | "improvements"
  >("overview");

  // Load available target jobs and latest saved analysis on mount
  useEffect(() => {
    async function init() {
      setInitialLoading(true);
      try {
        const [jobsRes, latestRes] = await Promise.all([
          fetchJobsApi({ limit: 30 }),
          fetchLatestGitHubAnalysisApi(),
        ]);

        if (jobsRes.data) {
          setJobs(jobsRes.data);
          if (jobsRes.data.length > 0 && !selectedJobId) {
            setSelectedJobId(jobsRes.data[0].id);
          }
        }

        if (latestRes.data) {
          setAnalysis(latestRes.data);
          if (latestRes.data.profile_summary?.username) {
            setUsername(latestRes.data.profile_summary.username);
          }
        }
      } catch (err: any) {
        console.error("Initialization error:", err);
      } finally {
        setInitialLoading(false);
      }
    }
    init();
  }, []);

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim()) {
      setError("Please enter a valid GitHub username");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      username: username.trim(),
      github_token: githubToken.trim() || undefined,
      job_id: selectedJobId || undefined,
    };

    const res = await analyzeGitHubApi(payload);
    setLoading(false);

    if (res.data) {
      setAnalysis(res.data);
    } else {
      setError(res.error || "Failed to analyze GitHub profile");
    }
  };

  const handleCopyBullet = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBulletId(id);
    setTimeout(() => setCopiedBulletId(null), 2500);
  };

  // Color mappings for language badges
  const getLanguageColor = (lang: string) => {
    const l = lang.toLowerCase();
    if (l.includes("python")) return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    if (l.includes("type") || l.includes("ts")) return "bg-sky-500/10 text-sky-400 border-sky-500/30";
    if (l.includes("java") && !l.includes("script")) return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    if (l.includes("script") || l.includes("js")) return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
    if (l.includes("go")) return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
    if (l.includes("rust")) return "bg-orange-500/10 text-orange-400 border-orange-500/30";
    if (l.includes("c++") || l.includes("c#")) return "bg-purple-500/10 text-purple-400 border-purple-500/30";
    return "bg-slate-700/40 text-slate-300 border-slate-600/40";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Top Banner / Hero */}
      <div className="border-b border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-950 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-brand-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <Github className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                    GitHub Career Analyzer
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-medium">
                      Phase 14
                    </span>
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Extract truthful repository evidence, verify target job alignment, and generate ATS resume bullets.
                  </p>
                </div>
              </div>
            </div>

            {/* Compliance Guarantee Badge */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs self-start md:self-auto">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Zero-Fabrication Guarantee &middot; Authorized Access Only</span>
            </div>
          </div>

          {/* Search & Control Form */}
          <form
            onSubmit={handleAnalyze}
            className="mt-6 p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              {/* GitHub Username */}
              <div className="md:col-span-4">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  GitHub Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Github className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. torvalds or zaidhaque"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Target Job Selector */}
              <div className="md:col-span-5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Target Role Alignment</span>
                  <span className="text-[10px] text-slate-500 font-normal">Optional Comparison</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all truncate"
                  >
                    <option value="">General Market Profile (No Specific Role)</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.role} @ {j.company} ({j.location || "Remote"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="md:col-span-3 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800/50 text-white font-medium text-sm transition-colors shadow-lg shadow-violet-600/20"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Analyze Profile</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowTokenInput(!showTokenInput)}
                  title="Configure Personal Access Token"
                  className={`p-2 rounded-lg border text-sm transition-colors ${
                    showTokenInput || githubToken
                      ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  <Key className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Optional Personal Access Token Accordion */}
            {showTokenInput && (
              <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs">
                <div className="flex-1 w-full">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-300 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      Personal Access Token (Optional)
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Increases rate limits & permits authorized private repo inspection
                    </span>
                  </div>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (stored only in memory for this session)"
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>
            )}
          </form>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {initialLoading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-violet-400" />
            <p className="text-sm">Loading repository intelligence & previous analysis...</p>
          </div>
        ) : !analysis ? (
          <div className="p-12 rounded-2xl border border-slate-800 bg-slate-900/50 text-center space-y-4 max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mx-auto">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">No GitHub Analysis Available</h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter your GitHub handle above and click &quot;Analyze Profile&quot; to inspect your repositories,
                extract proven technical skills, and generate evidence-based resume bullets.
              </p>
            </div>
            <button
              onClick={() => handleAnalyze()}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              Analyze Default Profile (@{username})
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile Summary Hero Card */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative">
                {/* User Info */}
                <div className="flex items-start space-x-4">
                  {analysis.profile_summary.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={analysis.profile_summary.avatar_url}
                      alt={analysis.profile_summary.username}
                      className="w-16 h-16 rounded-2xl border-2 border-slate-700 shadow-md object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xl font-bold border border-slate-700">
                      {analysis.profile_summary.username.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-xl font-bold text-white">
                        {analysis.profile_summary.name || analysis.profile_summary.username}
                      </h2>
                      <a
                        href={analysis.profile_summary.profile_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    <p className="text-xs text-violet-400 font-mono">@{analysis.profile_summary.username}</p>
                    {analysis.profile_summary.bio && (
                      <p className="text-xs text-slate-300 mt-1.5 max-w-xl">{analysis.profile_summary.bio}</p>
                    )}
                  </div>
                </div>

                {/* Target Role Pill */}
                {analysis.target_role && (
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-right self-stretch md:self-auto flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                      Compared Against
                    </span>
                    <span className="text-sm font-semibold text-white flex items-center gap-1.5 md:justify-end mt-0.5">
                      <Briefcase className="w-3.5 h-3.5 text-violet-400" />
                      {analysis.target_role}
                    </span>
                    {analysis.target_company && (
                      <span className="text-xs text-slate-400">@ {analysis.target_company}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/70">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Public Repos</span>
                    <FolderGit2 className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="text-xl font-bold text-white mt-1">
                    {analysis.profile_summary.public_repos}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/70">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Total Stars</span>
                    <Star className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-xl font-bold text-white mt-1">
                    {analysis.profile_summary.total_stars}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/70">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Skills Demonstrated</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-xl font-bold text-white mt-1">
                    {analysis.skills_demonstrated.length}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/70">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Missing Skills</span>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-xl font-bold text-white mt-1">
                    {analysis.skills_missing_evidence.length}
                  </div>
                </div>
              </div>

              {/* Top Languages */}
              {analysis.profile_summary.top_languages.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium mr-1">Primary Languages:</span>
                  {analysis.profile_summary.top_languages.map((lang) => (
                    <span
                      key={lang}
                      className={`text-xs px-2.5 py-0.5 rounded-full border font-mono font-medium ${getLanguageColor(
                        lang
                      )}`}
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center space-x-1 border-b border-slate-800 pb-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                  activeTab === "overview"
                    ? "bg-violet-600/20 text-violet-300 border border-violet-500/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Overview & Match</span>
              </button>

              <button
                onClick={() => setActiveTab("skills")}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                  activeTab === "skills"
                    ? "bg-violet-600/20 text-violet-300 border border-violet-500/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Demonstrated vs Missing ({analysis.skills_demonstrated.length}/{analysis.skills_missing_evidence.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("projects")}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                  activeTab === "projects"
                    ? "bg-violet-600/20 text-violet-300 border border-violet-500/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Code2 className="w-4 h-4" />
                <span>Ranked Projects ({analysis.relevant_projects.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("resume_evidence")}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                  activeTab === "resume_evidence"
                    ? "bg-violet-600/20 text-violet-300 border border-violet-500/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Resume Bullets ({analysis.potential_resume_evidence.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("improvements")}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                  activeTab === "improvements"
                    ? "bg-violet-600/20 text-violet-300 border border-violet-500/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Action Plan ({analysis.recommended_improvements.length})</span>
              </button>
            </div>

            {/* TAB: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left 7 cols: Key Evidence Highlights */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Top Projects Quick Peek */}
                  <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        <FolderGit2 className="w-4 h-4 text-violet-400" />
                        Top Role-Relevant Projects
                      </h3>
                      <button
                        onClick={() => setActiveTab("projects")}
                        className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                      >
                        <span>View All ({analysis.relevant_projects.length})</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {analysis.relevant_projects.slice(0, 3).map((proj) => (
                        <div
                          key={proj.name}
                          className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center space-x-2">
                                <a
                                  href={proj.html_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm font-semibold text-white hover:text-violet-400 transition-colors flex items-center gap-1"
                                >
                                  {proj.name}
                                  <ExternalLink className="w-3 h-3 text-slate-500" />
                                </a>
                                {proj.has_deployment && (
                                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                                    Live
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                                {proj.description || "No repository description provided."}
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30">
                                {Math.round(proj.role_relevance_score)}% Match
                              </span>
                            </div>
                          </div>

                          {/* Architecture highlights preview */}
                          {proj.architecture_highlights.length > 0 && (
                            <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 flex flex-wrap gap-1.5">
                              {proj.architecture_highlights.slice(0, 2).map((h, idx) => (
                                <span
                                  key={idx}
                                  className="text-[11px] px-2 py-0.5 rounded bg-slate-800/60 text-slate-300 border border-slate-700/50"
                                >
                                  {h}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ready-to-use Resume Bullets Quick Peek */}
                  <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        Grounded Resume Bullets
                      </h3>
                      <button
                        onClick={() => setActiveTab("resume_evidence")}
                        className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                      >
                        <span>View All ({analysis.potential_resume_evidence.length})</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {analysis.potential_resume_evidence.slice(0, 2).map((item, idx) => {
                        const isCopied = copiedBulletId === `quick-${idx}`;
                        return (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 group hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                              <span className="font-mono text-violet-400 text-[11px]">
                                {item.repository_name}
                              </span>
                              <button
                                onClick={() => handleCopyBullet(item.bullet_point, `quick-${idx}`)}
                                className="flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy Bullet</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <p className="text-xs text-slate-200 leading-relaxed font-sans">
                              &bull; {item.bullet_point}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right 5 cols: Skills Summary & Action Recommendations */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Verified Skills Summary */}
                  <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Demonstrated Skills
                      </h3>
                      <button
                        onClick={() => setActiveTab("skills")}
                        className="text-xs text-violet-400 hover:text-violet-300"
                      >
                        All ({analysis.skills_demonstrated.length})
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {analysis.skills_demonstrated.slice(0, 10).map((s) => (
                        <span
                          key={s.skill}
                          className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium"
                        >
                          {s.skill}
                        </span>
                      ))}
                    </div>

                    {analysis.skills_missing_evidence.length > 0 && (
                      <div className="mt-5 pt-4 border-t border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                            Missing Role Evidence
                          </h4>
                          <span className="text-[10px] text-slate-500">
                            {analysis.skills_missing_evidence.length} unproven
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.skills_missing_evidence.slice(0, 6).map((m) => (
                            <span
                              key={m.skill}
                              className="text-xs px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 font-medium"
                            >
                              {m.skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Priority Recommended Improvement */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-950/40 to-slate-900/60 border border-violet-500/30">
                    <div className="flex items-center space-x-2 text-violet-400 text-xs font-semibold uppercase tracking-wider mb-2">
                      <Sparkles className="w-4 h-4" />
                      <span>Highest Impact Optimization</span>
                    </div>

                    {analysis.recommended_improvements[0] ? (
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {analysis.recommended_improvements[0].title}
                        </h4>
                        <p className="text-xs text-slate-300 mt-1">
                          {analysis.recommended_improvements[0].description}
                        </p>
                        <div className="mt-3 space-y-1">
                          {analysis.recommended_improvements[0].actionable_steps.slice(0, 3).map((st, i) => (
                            <div key={i} className="flex items-start space-x-1.5 text-xs text-slate-400">
                              <span className="text-violet-400 font-mono">&rsaquo;</span>
                              <span>{st}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Profile matches target role benchmarks well.</p>
                    )}

                    <button
                      onClick={() => setActiveTab("improvements")}
                      className="mt-4 w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors text-center"
                    >
                      View Full Action Plan
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: SKILLS DEMONSTRATED VS MISSING */}
            {activeTab === "skills" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Skills Demonstrated */}
                  <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                      <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          Skills Demonstrated
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Verified with public code, languages, and repo structures
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                        {analysis.skills_demonstrated.length} proven
                      </span>
                    </div>

                    <div className="space-y-3">
                      {analysis.skills_demonstrated.map((item) => (
                        <div
                          key={item.skill}
                          className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-white">{item.skill}</span>
                            <span
                              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                                item.confidence === "High"
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                  : item.confidence === "Medium"
                                  ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                  : "bg-slate-700/40 text-slate-300 border-slate-600/40"
                              }`}
                            >
                              {item.confidence} Confidence
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 mt-1.5">{item.evidence_summary}</p>

                          {item.repo_sources.length > 0 && (
                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] text-slate-500 font-mono">Found in:</span>
                              {item.repo_sources.map((src) => (
                                <span
                                  key={src}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300"
                                >
                                  {src}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Skills Missing Evidence */}
                  <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                      <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-rose-400" />
                          Skills Missing Evidence
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Target role requirements with 0 public repository evidence
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold">
                        {analysis.skills_missing_evidence.length} missing
                      </span>
                    </div>

                    {analysis.skills_missing_evidence.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                        <p className="text-sm font-medium text-white">Full Skill Coverage</p>
                        <p className="text-xs text-slate-400 mt-1">
                          All target job requirements have verifiable repository evidence!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {analysis.skills_missing_evidence.map((item) => (
                          <div
                            key={item.skill}
                            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-rose-500/30 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-rose-200">{item.skill}</span>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                Target Role Gap
                              </span>
                            </div>

                            <p className="text-xs text-slate-300 mt-1.5">{item.reason}</p>

                            <div className="mt-2.5 pt-2 border-t border-slate-800/70 flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Bridge with a quick demonstration repo:</span>
                              <Link
                                href="/career/skill-gaps"
                                className="text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1"
                              >
                                <span>Roadmap</span>
                                <ChevronRight className="w-3 h-3" />
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: RANKED PROJECTS */}
            {activeTab === "projects" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">Role-Relevance Portfolio Ranking</h3>
                    <p className="text-xs text-slate-400">
                      Ranked deterministically by keyword overlap, language match, documentation depth, and tech stack alignment.
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">
                    Showing {analysis.relevant_projects.length} analyzed repositories
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.relevant_projects.map((proj) => (
                    <div
                      key={proj.name}
                      className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center space-x-2">
                              <a
                                href={proj.html_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-base font-bold text-white hover:text-violet-400 transition-colors flex items-center gap-1.5"
                              >
                                {proj.name}
                                <ArrowUpRight className="w-4 h-4 text-slate-500" />
                              </a>
                            </div>

                            {/* Language & Badges */}
                            <div className="flex items-center gap-2 mt-1">
                              {proj.primary_language && (
                                <span
                                  className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${getLanguageColor(
                                    proj.primary_language
                                  )}`}
                                >
                                  {proj.primary_language}
                                </span>
                              )}
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Star className="w-3 h-3 text-amber-400" />
                                {proj.stars}
                              </span>
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <GitFork className="w-3 h-3 text-slate-400" />
                                {proj.forks}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30 text-xs font-bold">
                              {Math.round(proj.role_relevance_score)}% Role Match
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                          {proj.description || "No description provided for this repository."}
                        </p>

                        {/* Topics */}
                        {proj.topics.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {proj.topics.map((t) => (
                              <span
                                key={t}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Architecture Highlights */}
                        {proj.architecture_highlights.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-slate-800/80">
                            <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                              Architectural Highlights:
                            </span>
                            <div className="space-y-1">
                              {proj.architecture_highlights.map((h, i) => (
                                <div key={i} className="flex items-start space-x-1.5 text-xs text-slate-300">
                                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                  <span>{h}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer Info */}
                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center space-x-3">
                          <span
                            className={`flex items-center gap-1 ${
                              proj.has_readme ? "text-emerald-400" : "text-slate-500"
                            }`}
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            {proj.has_readme ? "README Found" : "No README"}
                          </span>

                          {proj.homepage && (
                            <a
                              href={proj.homepage}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                            >
                              <Rocket className="w-3.5 h-3.5" />
                              Live Demo
                            </a>
                          )}
                        </div>

                        <a
                          href={proj.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1"
                        >
                          <span>Inspect Code</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: POTENTIAL RESUME EVIDENCE */}
            {activeTab === "resume_evidence" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300 flex items-start space-x-2.5">
                  <ShieldCheck className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">Truthful Resume Grounding:</span> All bullet points
                    are generated strictly from inspected repository metadata, languages, and architecture patterns.
                    No unverified metrics or fabricated experience claims are added.
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5">
                  {analysis.potential_resume_evidence.map((item, idx) => {
                    const isCopied = copiedBulletId === `full-${idx}`;
                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/80">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                              {item.skill_or_feature}
                            </span>
                            <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                              <FolderGit2 className="w-3 h-3 text-slate-500" />
                              {item.repository_name}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            {item.verifiable_metrics && (
                              <span className="text-[11px] text-slate-400 font-mono">
                                {item.verifiable_metrics}
                              </span>
                            )}
                            <button
                              onClick={() => handleCopyBullet(item.bullet_point, `full-${idx}`)}
                              className="flex items-center space-x-1 text-xs px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400 font-medium">Copied to Clipboard</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy Bullet</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Bullet text */}
                        <div className="flex items-start space-x-2 mt-1">
                          <span className="text-violet-400 font-bold select-none">&bull;</span>
                          <p className="text-sm text-slate-200 leading-relaxed font-sans select-all">
                            {item.bullet_point}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB: RECOMMENDED IMPROVEMENTS */}
            {activeTab === "improvements" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">GitHub Profile & Portfolio Action Plan</h3>
                    <p className="text-xs text-slate-400">
                      High-impact recommendations to maximize recruiter conversion and automated screening success.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {analysis.recommended_improvements.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                                rec.priority === "HIGH"
                                  ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                  : rec.priority === "MEDIUM"
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                  : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                              }`}
                            >
                              {rec.priority} Priority
                            </span>
                            <span className="text-xs font-mono text-slate-400">{rec.category}</span>
                          </div>
                          <h4 className="text-base font-bold text-white mt-1.5">{rec.title}</h4>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 mt-2 leading-relaxed">{rec.description}</p>

                      {rec.actionable_steps.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                          <span className="text-[11px] font-semibold text-slate-400">
                            Recommended Action Steps:
                          </span>
                          {rec.actionable_steps.map((st, i) => (
                            <div key={i} className="flex items-start space-x-2 text-xs text-slate-300">
                              <span className="text-violet-400 font-bold select-none">&rsaquo;</span>
                              <span>{st}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
