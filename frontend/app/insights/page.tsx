"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Target,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  Briefcase,
  Layers,
  GraduationCap,
  FolderGit2,
  Calendar,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Check,
  Award,
  Github,
  Star,
  GitFork,
  ExternalLink,
  Code2,
} from "lucide-react";
import {
  fetchCareerSkillGapsApi,
  fetchCandidateProfile,
  fetchLatestGitHubAnalysisApi,
  SkillGapAnalysisResponse,
  Candidate,
  GitHubAnalysisResponse,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Progress } from "@/components/ui/Progress";
import { Timeline, TimelineItem } from "@/components/ui/Timeline";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/States";

export default function CareerInsightsPage() {
  const [analysis, setAnalysis] = useState<SkillGapAnalysisResponse | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [githubData, setGithubData] = useState<GitHubAnalysisResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"market_gaps" | "roadmap" | "github_proof">("market_gaps");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [gapsRes, candRes, ghRes] = await Promise.all([
        fetchCareerSkillGapsApi(),
        fetchCandidateProfile(),
        fetchLatestGitHubAnalysisApi(),
      ]);

      if (gapsRes.data) setAnalysis(gapsRes.data);
      if (candRes.data) setCandidate(candRes.data);
      if (ghRes.data) setGithubData(ghRes.data);
    } catch (err: any) {
      setError(err?.message || "Failed to load career insights");
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

  // Filtered skills list
  const filteredSkills = useMemo(() => {
    return (analysis?.skills || []).filter((item) => {
      const matchSearch =
        !searchQuery.trim() ||
        item.skill.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category ? item.category.toLowerCase().includes(searchQuery.toLowerCase()) : false);

      const matchPrio =
        priorityFilter === "all" ||
        item.priority.toLowerCase() === priorityFilter.toLowerCase();

      return matchSearch && matchPrio;
    });
  }, [analysis, searchQuery, priorityFilter]);

  // Construct Roadmap Timeline Items
  const roadmapTimelineItems: TimelineItem[] = useMemo(() => {
    if (!analysis?.roadmap) return [];
    return analysis.roadmap.map((phase, idx) => ({
      id: `phase-${idx}`,
      title: phase.phase_name,
      subtitle: `${phase.timeline} • ${phase.focus_skills?.join(", ") || ""}`,
      status: idx === 0 ? ("current" as const) : ("upcoming" as const),
      content: (
        <div className="space-y-2 mt-1">
          <div className="flex flex-wrap gap-1.5">
            {(phase.focus_skills || []).map((sk, sidx) => (
              <span
                key={sidx}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200"
              >
                {sk}
              </span>
            ))}
          </div>
          {phase.recommended_project && (
            <div className="pt-1 text-xs text-slate-600">
              <strong className="text-slate-900">Recommended Project:</strong>{" "}
              {phase.recommended_project}
            </div>
          )}
          {phase.milestones && phase.milestones.length > 0 && (
            <ul className="list-disc list-inside text-[11px] text-slate-500 pt-1 space-y-0.5">
              {phase.milestones.map((m, midx) => (
                <li key={midx}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      ),
    }));
  }, [analysis]);

  return (
    <div className="space-y-8 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium mb-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
            <span>Market Intelligence & Code Evidence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Career Insights & Skill Gaps
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Compare verified candidate skills against recurring job requirements and GitHub repository proof.
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
            Refresh Insights
          </Button>

          <Link href="/github">
            <Button variant="primary" size="sm" icon={<Github className="w-4 h-4" />}>
              GitHub Analyzer
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("market_gaps")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "market_gaps"
              ? "border-slate-900 text-slate-900 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Market Skill Gaps</span>
          <span className="ml-1 text-xs px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono">
            {analysis?.skills?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("roadmap")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "roadmap"
              ? "border-slate-900 text-slate-900 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>3-Phase Learning Roadmap</span>
        </button>

        <button
          onClick={() => setActiveTab("github_proof")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "github_proof"
              ? "border-slate-900 text-slate-900 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FolderGit2 className="w-4 h-4" />
          <span>GitHub Code Proof</span>
        </button>
      </div>

      {loading ? (
        <LoadingState message="Analyzing candidate skill vectors and market demand..." />
      ) : error ? (
        <ErrorState title="Failed to load insights" error={error} onRetry={loadData} />
      ) : activeTab === "market_gaps" ? (
        /* TAB 1: MARKET SKILL GAPS */
        <div className="space-y-6">
          {/* Top High-level Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <span className="text-xs font-medium text-slate-500 block">Verified Profile Skills</span>
              <span className="text-2xl font-semibold text-slate-900 mt-1 block">
                {candidate?.skills?.length || 0}
              </span>
              <p className="text-xs text-slate-400 mt-1">Confirmed in master profile</p>
            </Card>

            <Card>
              <span className="text-xs font-medium text-slate-500 block">Market Readiness Score</span>
              <span className="text-2xl font-semibold text-slate-900 mt-1 block">
                {Math.round(analysis?.market_readiness_score ? (analysis.market_readiness_score > 1 ? analysis.market_readiness_score : analysis.market_readiness_score * 100) : 78)}%
              </span>
              <p className="text-xs text-slate-400 mt-1">Weighted across discovered jobs</p>
            </Card>

            <Card>
              <span className="text-xs font-medium text-slate-500 block">High Priority Gaps</span>
              <span className="text-2xl font-semibold text-rose-700 mt-1 block">
                {(analysis?.skills || []).filter((s) => s.priority === "HIGH").length}
              </span>
              <p className="text-xs text-slate-400 mt-1">Demanded across ≥40% of target jobs</p>
            </Card>
          </div>

          {/* Filter Toolbar */}
          <div className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-card flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full">
              <Input
                placeholder="Search skills (e.g. Kubernetes, Python, Redis)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </Select>
            </div>
          </div>

          {/* Skills Breakdown Grid */}
          <div className="space-y-3">
            {filteredSkills.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-card hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-slate-900">{item.skill}</span>
                    <Badge variant={item.priority === "HIGH" ? "error" : "warning"} size="sm">
                      {item.priority} Priority
                    </Badge>
                    <span className="text-[11px] font-mono text-slate-400">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{item.candidate_evidence || "Identified as target job requirement"}</p>
                </div>

                <div className="shrink-0 flex items-center gap-4 text-xs">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Market Demand</span>
                    <span className="font-semibold text-slate-900 block">
                      {item.frequency_percentage}% of target jobs
                    </span>
                  </div>

                  <div className="w-24">
                    <Progress value={item.frequency_percentage} size="sm" variant={item.priority === "HIGH" ? "rose" : "primary"} />
                  </div>
                </div>
              </div>
            ))}

            {filteredSkills.length === 0 && (
              <EmptyState
                title="No Skills Match Filter"
                description="Try loosening your search terms."
              />
            )}
          </div>
        </div>
      ) : activeTab === "roadmap" ? (
        /* TAB 2: LEARNING ROADMAP */
        <Card className="p-6 space-y-6">
          <CardHeader
            title="Strategic 3-Phase Growth Roadmap"
            subtitle="Sequenced milestones to close critical high-demand competencies without fabricating experience."
          />

          <Timeline items={roadmapTimelineItems} />
        </Card>
      ) : (
        /* TAB 3: GITHUB REPOSITORY PROOF */
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
                Verified Repository Intelligence
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Authentic open-source proof extracted from public commits, dependencies, and architectures.
              </p>
            </div>

            <Link href="/github">
              <Button size="sm" variant="primary" icon={<Github className="w-4 h-4" />}>
                Run Full Analysis
              </Button>
            </Link>
          </div>

          {githubData?.relevant_projects && githubData.relevant_projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {githubData.relevant_projects.map((proj, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-card space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-1.5">
                        <FolderGit2 className="w-4 h-4 text-slate-400" />
                        <span>{proj.name}</span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {proj.description || "Public repository"}
                      </p>
                    </div>

                    <a
                      href={proj.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded text-slate-400 hover:text-slate-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                    {proj.primary_language && (
                      <span className="font-mono text-slate-700 font-medium">
                        {proj.primary_language}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-500" />
                      <span>{proj.stars}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <GitFork className="w-3.5 h-3.5 text-slate-400" />
                      <span>{proj.forks}</span>
                    </span>
                  </div>

                  {proj.topics && proj.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {proj.topics.slice(0, 4).map((t, tidx) => (
                        <span
                          key={tidx}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No GitHub Proof Cached"
              description="Connect your GitHub handle to extract truthful code proof for your resume."
              actionText="Analyze GitHub"
              onAction={() => window.location.assign("/github")}
            />
          )}
        </div>
      )}
    </div>
  );
}
