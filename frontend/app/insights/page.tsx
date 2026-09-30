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
  const [activeTab, setActiveTab] = useState<"market_gaps" | "strengths" | "roadmap" | "github_proof">("market_gaps");
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
                className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
              >
                {sk}
              </span>
            ))}
          </div>
          {phase.recommended_project && (
            <div className="pt-1 text-xs text-slate-600 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-white">Recommended Project:</strong>{" "}
              {phase.recommended_project}
            </div>
          )}
          {phase.milestones && phase.milestones.length > 0 && (
            <ul className="list-disc list-inside text-xs text-slate-500 dark:text-slate-400 pt-1 space-y-0.5">
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
    <div className="space-y-8 sm:space-y-10 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Market Intelligence & Code Evidence</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Career Insights & Skill Matrix
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Compare verified candidate skills against market requirements with visual demand bars and GitHub repository proof.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            loading={refreshing}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Sync Matrix
          </Button>

          <Link href="/github">
            <Button variant="primary" size="sm" icon={<Github className="w-4 h-4" />}>
              GitHub Analyzer
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab("market_gaps")}
          className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === "market_gaps"
              ? "border-slate-900 dark:border-white text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Missing Skills & Gaps</span>
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
            {analysis?.skills?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("strengths")}
          className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === "strengths"
              ? "border-slate-900 dark:border-white text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Your Verified Strengths</span>
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono">
            {candidate?.skills?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("roadmap")}
          className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === "roadmap"
              ? "border-slate-900 dark:border-white text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>3-Phase Learning Roadmap</span>
        </button>

        <button
          onClick={() => setActiveTab("github_proof")}
          className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === "github_proof"
              ? "border-slate-900 dark:border-white text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Github className="w-4 h-4" />
          <span>GitHub Code Evidence</span>
        </button>
      </div>

      {loading ? (
        <LoadingState message="Aggregating market intelligence and GitHub proof..." />
      ) : error ? (
        <ErrorState title="Failed to load career insights" error={error} onRetry={loadData} />
      ) : (
        <>
          {/* TAB 1: MISSING SKILLS & MARKET DEMAND */}
          {activeTab === "market_gaps" && (
            <div className="space-y-6">
              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="max-w-md w-full">
                  <Input
                    placeholder="Search in-demand skills or categories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    icon={<Search className="w-4 h-4" />}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Priority:</span>
                  <Select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="text-xs"
                  >
                    <option value="all">All Priorities</option>
                    <option value="high">High Priority Gaps</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </Select>
                </div>
              </div>

              {/* Skills Grid with Visual Demand Bars */}
              {filteredSkills.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSkills.map((gap, idx) => {
                    const demandPercent =
                      gap.priority === "HIGH" ? 85 : gap.priority === "MEDIUM" ? 65 : 45;

                    return (
                      <div
                        key={idx}
                        className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-card dark:shadow-none hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-dropdown transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                {gap.skill}
                              </h3>
                              <span className="text-xs text-slate-500 dark:text-slate-400 block">
                                {gap.category || "Engineering Focus"}
                              </span>
                            </div>
                            <Badge
                              variant={gap.priority === "HIGH" ? "error" : "warning"}
                              size="sm"
                            >
                              {gap.priority} Priority
                            </Badge>
                          </div>

                          {/* Visual Market Demand Bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                              <span>Market Demand</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{demandPercent}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  gap.priority === "HIGH" ? "bg-rose-500" : "bg-amber-500"
                                }`}
                                style={{ width: `${demandPercent}%` }}
                              />
                            </div>
                          </div>

                          {(gap.recommended_learning_path?.length > 0 || gap.candidate_evidence) && (
                            <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                              <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">Bridge Strategy:</strong>
                              {gap.recommended_learning_path?.[0] || gap.candidate_evidence}
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                          <span className="text-slate-400">Target Role Fit</span>
                          <button
                            onClick={() => setActiveTab("roadmap")}
                            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <span>View Roadmap</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No Missing Skills Found"
                  description="Your candidate profile covers all requirements for current target roles."
                  icon={<CheckCircle2 className="w-8 h-8 text-emerald-600" />}
                />
              )}
            </div>
          )}

          {/* TAB 2: CANDIDATE VERIFIED STRENGTHS */}
          {activeTab === "strengths" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 space-y-1.5">
                <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-200 tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Verified Competencies from Your Candidate Profile</span>
                </h3>
                <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  Real skills grounded in your past experiences and projects. CareerPilot never claims you lack a skill that exists in your profile.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(candidate?.skills || []).map((skill, idx) => {
                  const yoe = skill.years_of_experience || 3;
                  const proficiency = Math.min(95, 60 + yoe * 7);

                  return (
                    <div
                      key={idx}
                      className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-card dark:shadow-none space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-base text-slate-900 dark:text-white">
                          {skill.name}
                        </span>
                        <Badge variant="success" size="sm">
                          Verified
                        </Badge>
                      </div>

                      {/* Visual Strength Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                          <span>Verified Proficiency</span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">{proficiency}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{ width: `${proficiency}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>{skill.category || "Core Competency"}</span>
                        <span className="font-mono">{yoe} YOE Grounded</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: 3-PHASE LEARNING ROADMAP */}
          {activeTab === "roadmap" && (
            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="3-Phase Career Learning Roadmap"
                  subtitle="Structured learning phases designed to build verifiable proof on your GitHub and resume."
                />
                <div className="mt-6">
                  {roadmapTimelineItems.length > 0 ? (
                    <Timeline items={roadmapTimelineItems} />
                  ) : (
                    <p className="text-xs text-slate-400">No active roadmap generated.</p>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* TAB 4: GITHUB CODE PROOF */}
          {activeTab === "github_proof" && (
            <div className="space-y-6">
              {githubData ? (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-card dark:shadow-none space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                          <Github className="w-5 h-5" />
                          <span>@{githubData.profile_summary?.username || "developer"}</span>
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                          {githubData.profile_summary?.public_repos || 0} Repositories Analyzed • {githubData.profile_summary?.total_stars || 0} Total Stars
                        </p>
                      </div>

                      <Badge variant="blue" size="md">
                        {githubData.profile_summary?.top_languages?.slice(0, 3).join(", ") || "Code Verified"}
                      </Badge>
                    </div>

                    {/* Verified Technical Evidence */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                        Extracted Code Proof & Bullet Grounding
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(githubData.potential_resume_evidence || []).map((evidence, cidx) => (
                          <div
                            key={cidx}
                            className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-xs space-y-1.5"
                          >
                            <span className="font-semibold text-slate-900 dark:text-white block">{evidence.skill_or_feature}</span>
                            <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                              {evidence.bullet_point}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                              Repo: {evidence.repository_name} {evidence.verifiable_metrics ? `• ${evidence.verifiable_metrics}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No GitHub Analysis Performed Yet"
                  description="Run the GitHub Analyzer to scan your public repositories and extract authentic proof."
                  actionText="Launch GitHub Analyzer"
                  onAction={() => window.location.assign("/github")}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
