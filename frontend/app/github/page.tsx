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
  FileText,
  BadgeAlert,
} from "lucide-react";
import {
  analyzeGitHubApi,
  fetchLatestGitHubAnalysisApi,
  fetchJobsApi,
  GitHubAnalysisResponse,
  Job,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/States";

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
          fetchJobsApi({ limit: 40 }),
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
    setTimeout(() => setCopiedBulletId(null), 2000);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Fact-Grounded Code Evidence • Non-Fabricating</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            GitHub Career Analyzer
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Extract truthful open-source proof from repositories to verify required skills and formulate grounded resume bullets.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAnalyze()}
          loading={loading}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Re-Analyze Profile
        </Button>
      </div>

      {/* Analyzer Controls Form */}
      <Card>
        <form onSubmit={handleAnalyze} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5">
              <Input
                label="GitHub Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. torvalds or zaidhaque"
                icon={<Github className="w-4 h-4" />}
                required
              />
            </div>

            <div className="md:col-span-5">
              <Select
                label="Target Job Alignment (Optional)"
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
              >
                <option value="">General Market Fit (No Specific Role)</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.role} at {j.company}
                  </option>
                ))}
              </Select>
            </div>

            <div className="md:col-span-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={loading}
                className="w-full"
                icon={<Search className="w-4 h-4" />}
              >
                Analyze
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <button
              type="button"
              onClick={() => setShowTokenInput(!showTokenInput)}
              className="text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium transition-colors"
            >
              <Key className="w-3 h-3" />
              <span>{showTokenInput ? "Hide API Token" : "Provide GitHub Personal Access Token (for higher rate limits)"}</span>
            </button>
          </div>

          {showTokenInput && (
            <div className="pt-2">
              <Input
                label="Personal Access Token (Read-Only public repos)"
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_..."
                helperText="Tokens are never permanently stored; used only for unthrottled API querying."
              />
            </div>
          )}
        </form>
      </Card>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {initialLoading ? (
        <LoadingState message="Connecting to GitHub API and inspecting public repositories..." />
      ) : analysis ? (
        <div className="space-y-6">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl border border-slate-200 bg-white text-center shadow-card">
              <span className="text-xs text-slate-500 block">Public Repositories</span>
              <span className="text-2xl font-semibold text-slate-900 mt-1 block">
                {analysis.profile_summary.public_repos}
              </span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white text-center shadow-card">
              <span className="text-xs text-slate-500 block">Earned Stars</span>
              <span className="text-2xl font-semibold text-amber-700 mt-1 block">
                {analysis.profile_summary.total_stars}
              </span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white text-center shadow-card">
              <span className="text-xs text-slate-500 block">Verified Tech Skills</span>
              <span className="text-2xl font-semibold text-slate-900 mt-1 block">
                {analysis.skills_demonstrated.length}
              </span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white text-center shadow-card">
              <span className="text-xs text-slate-500 block">ATS Resume Bullets</span>
              <span className="text-2xl font-semibold text-emerald-700 mt-1 block">
                {analysis.potential_resume_evidence.length}
              </span>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex items-center space-x-2 border-b border-slate-200 overflow-x-auto pb-1 text-xs">
            {[
              { id: "overview", label: "Overview & Evidence" },
              { id: "skills", label: `Demonstrated Skills (${analysis.skills_demonstrated.length})` },
              { id: "projects", label: `Relevant Repositories (${analysis.relevant_projects.length})` },
              { id: "resume_evidence", label: `ATS Resume Bullets (${analysis.potential_resume_evidence.length})` },
              { id: "improvements", label: "Recommended Improvements" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white font-semibold shadow-subtle"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="space-y-4">
                <CardHeader
                  title="Profile Summary"
                  subtitle={`GitHub @${analysis.profile_summary.username}`}
                />
                <div className="text-xs space-y-2 text-slate-600">
                  <p>
                    <strong className="text-slate-900">Name:</strong> {analysis.profile_summary.name || analysis.profile_summary.username}
                  </p>
                  {analysis.profile_summary.bio && (
                    <p>
                      <strong className="text-slate-900">Bio:</strong> {analysis.profile_summary.bio}
                    </p>
                  )}
                  {analysis.profile_summary.top_languages && (
                    <div>
                      <strong className="text-slate-900 block mb-1">Top Languages:</strong>
                      <div className="flex flex-wrap gap-1">
                        {analysis.profile_summary.top_languages.map((l, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="space-y-4">
                <CardHeader
                  title="Target Role Alignment"
                  subtitle={analysis.target_role ? `${analysis.target_role} at ${analysis.target_company || "Target Company"}` : "General Engineering Standards"}
                />
                <div className="text-xs space-y-2 text-slate-600">
                  <p>
                    Repository evidence supports{" "}
                    <strong className="text-slate-900">{analysis.skills_demonstrated.length} core competencies</strong>.
                  </p>
                  {analysis.skills_missing_evidence && analysis.skills_missing_evidence.length > 0 && (
                    <p className="text-amber-700">
                      {analysis.skills_missing_evidence.length} role requirements lack code proof in public repositories.
                    </p>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* TAB 2: SKILLS */}
          {activeTab === "skills" && (
            <div className="space-y-3">
              {analysis.skills_demonstrated.map((sk, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-card flex items-start justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-slate-900">{sk.skill}</span>
                      <Badge variant="blue" size="sm">{sk.confidence} Confidence</Badge>
                      <span className="text-[11px] font-mono text-slate-400">{sk.category}</span>
                    </div>
                    <p className="text-slate-600">{sk.evidence_summary}</p>
                  </div>
                  <div className="text-right text-[11px] text-slate-400 font-mono shrink-0">
                    {sk.repo_sources?.join(", ")}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: PROJECTS */}
          {activeTab === "projects" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.relevant_projects.map((proj, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-card space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                        <FolderGit2 className="w-4 h-4 text-slate-400" />
                        <span>{proj.name}</span>
                      </h4>
                      <a
                        href={proj.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-slate-400 hover:text-slate-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {proj.description || "Public repository"}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono text-slate-700">{proj.primary_language || "Code"}</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-500" />
                        <span>{proj.stars}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="w-3.5 h-3.5 text-slate-400" />
                        <span>{proj.forks}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: ATS RESUME BULLETS */}
          {activeTab === "resume_evidence" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Truthful, impact-oriented resume bullets synthesized from actual repository architectures and verifiable metrics.
              </p>
              {analysis.potential_resume_evidence.map((bullet, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-card flex items-start justify-between gap-4 text-xs"
                >
                  <div className="space-y-1 max-w-3xl">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-900">{bullet.skill_or_feature}</span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Repo: {bullet.repository_name}
                      </span>
                    </div>
                    <p className="text-slate-700 font-sans leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                      {bullet.bullet_point}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyBullet(bullet.bullet_point, `bullet-${idx}`)}
                    icon={copiedBulletId === `bullet-${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copiedBulletId === `bullet-${idx}` ? "Copied!" : "Copy"}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: IMPROVEMENTS */}
          {activeTab === "improvements" && (
            <div className="space-y-3">
              {analysis.recommended_improvements.map((imp, idx) => (
                <Card key={idx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900">{imp.title}</h4>
                    <Badge variant={imp.priority === "HIGH" ? "error" : "warning"} size="sm">
                      {imp.priority} Priority
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600">{imp.description}</p>
                  {imp.actionable_steps && (
                    <ul className="list-disc pl-4 text-xs text-slate-500 space-y-0.5 pt-1">
                      {imp.actionable_steps.map((step, sidx) => (
                        <li key={sidx}>{step}</li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title="No GitHub Analysis Performed"
          description="Enter your GitHub username above to discover authentic code proof for your career search."
          actionText="Analyze GitHub"
          onAction={() => handleAnalyze()}
        />
      )}
    </div>
  );
}
