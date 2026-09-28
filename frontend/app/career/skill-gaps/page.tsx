"use client";

import React, { useState, useEffect } from "react";
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
  Info,
  Flame,
  Award,
} from "lucide-react";
import {
  fetchCareerSkillGapsApi,
  SkillGapAnalysisResponse,
  SkillGapItem,
  RoadmapPhase,
} from "@/lib/api";

export default function CareerSkillGapsPage() {
  const [analysis, setAnalysis] = useState<SkillGapAnalysisResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [strengthFilter, setStrengthFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [expandedSkillName, setExpandedSkillName] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const res = await fetchCareerSkillGapsApi();
    setLoading(false);
    if (res.data) {
      setAnalysis(res.data);
    } else {
      setError(res.error || "Failed to load career skill gap analysis");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtering
  const filteredSkills = (analysis?.skills || []).filter((item) => {
    // Search
    if (searchQuery.trim() && !item.skill.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Strength Filter
    if (strengthFilter === "gaps" && (item.current_strength === "Strong" || item.current_strength === "Medium")) {
      return false;
    }
    if (strengthFilter === "medium" && item.current_strength !== "Medium") {
      return false;
    }
    if (strengthFilter === "strong" && item.current_strength !== "Strong") {
      return false;
    }
    // Priority Filter
    if (priorityFilter !== "all" && item.priority.toLowerCase() !== priorityFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  // Strength badge styling
  const getStrengthBadge = (strength: string) => {
    switch (strength) {
      case "Strong":
        return {
          bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          icon: CheckCircle2,
          label: "Strong (Verified)",
        };
      case "Medium":
        return {
          bg: "bg-blue-500/10 text-blue-400 border-blue-500/30",
          icon: Sparkles,
          label: "Medium (Deepen)",
        };
      case "Weak":
      case "Missing":
      default:
        return {
          bg: "bg-rose-500/10 text-rose-400 border-rose-500/30",
          icon: AlertTriangle,
          label: "Weak (Gap)",
        };
    }
  };

  // Priority badge styling
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      case "HIGH":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "MEDIUM":
        return "bg-blue-500/20 text-blue-300 border-blue-500/40";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-xs text-brand-400 font-semibold tracking-wider uppercase mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>Phase 13: Career Skill Gap Agent</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Target Job Skill Gap Analysis & Roadmap
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Cross-analyzing saved jobs, applied jobs, and profile evidence to identify recurring skill gaps and tailor your learning trajectory.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white flex items-center space-x-1.5 transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-brand-400" : ""}`} />
            <span>Refresh Analysis</span>
          </button>
        </div>
      </div>

      {/* Strict Anti-Hallucination Guardrail Pill */}
      <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            <strong>Grounded Skill Integrity:</strong> Verified skills, projects, and experiences in your candidate profile are permanently recognized as active assets and never misclassified as missing.
          </span>
        </div>
        <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-indigo-500/20 text-[10px] font-bold uppercase tracking-wider text-indigo-200">
          Profile Verified
        </span>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3">
          <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-400 rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Analyzing recurring skill demands across your target jobs...</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
          {error}
        </div>
      )}

      {analysis && !loading && (
        <>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Market Readiness */}
            <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Market Readiness</span>
                <Award className="w-4 h-4 text-brand-400" />
              </div>
              <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-emerald-400">
                {analysis.market_readiness_score}%
              </div>
              <div className="text-[11px] text-slate-500">
                Coverage across target job skills
              </div>
            </div>

            {/* Target Jobs Analyzed */}
            <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Target Jobs Analyzed</span>
                <Briefcase className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">
                {analysis.target_jobs_analyzed}
              </div>
              <div className="text-[11px] text-slate-500">
                {analysis.saved_jobs_count} saved • {analysis.applied_jobs_count} applied
              </div>
            </div>

            {/* Identified Skill Gaps */}
            <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-300">Identified Gaps</span>
                <Flame className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-3xl font-extrabold text-rose-400">
                {analysis.identified_gaps_count}
              </div>
              <div className="text-[11px] text-slate-500">
                Missing from target applications
              </div>
            </div>

            {/* Total Demanded Skills */}
            <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Demanded Skills</span>
                <Layers className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">
                {analysis.total_skills_demanded}
              </div>
              <div className="text-[11px] text-slate-500">
                Unique skills demanded
              </div>
            </div>
          </div>

          {/* AI Executive Assessment Summary */}
          <div className="glass-card p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-brand-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>AI Market Competitiveness Assessment</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {analysis.summary}
            </p>
          </div>

          {/* 3-Phase Structured Learning Roadmap */}
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center space-x-2 text-brand-400 text-xs font-bold uppercase tracking-wider">
                  <Target className="w-4 h-4" />
                  <span>Personalized Remediation Roadmap</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
                  Step-by-Step Skill Acquisition Trajectory
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Designed to bridge top application blockers
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {analysis.roadmap.map((phase, pidx) => (
                <div
                  key={pidx}
                  className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 flex flex-col justify-between hover:border-slate-700 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-[10px] font-bold uppercase tracking-wider">
                        {phase.timeline}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        Phase {pidx + 1}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white leading-snug">
                      {phase.phase_name}
                    </h3>

                    {/* Focus Skills */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Focus Skills:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {phase.focus_skills.map((fs, fsidx) => (
                          <span
                            key={fsidx}
                            className="px-2 py-0.5 rounded-md bg-slate-800 text-[11px] font-semibold text-slate-200 border border-slate-700"
                          >
                            {fs}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Milestones Checklist */}
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Milestones:
                      </span>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {phase.milestones.map((ms, msidx) => (
                          <li key={msidx} className="flex items-start space-x-2 text-[11px] leading-relaxed">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{ms}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Recommended Project Target */}
                  {phase.recommended_project && (
                    <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs space-y-1 mt-3">
                      <div className="flex items-center space-x-1.5 text-purple-300 font-bold text-[11px]">
                        <FolderGit2 className="w-3.5 h-3.5 text-purple-400" />
                        <span>Recommended Portfolio Project:</span>
                      </div>
                      <p className="text-[11px] text-slate-300 line-clamp-2">
                        {phase.recommended_project}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Skill Gap Explorer & Filter Control Bar */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Skill Frequency & Evidence Matrix</h2>
                <p className="text-xs text-slate-400">
                  Showing {filteredSkills.length} of {analysis.skills.length} target skills
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative min-w-[180px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search skill..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* Strength Filter */}
                <select
                  value={strengthFilter}
                  onChange={(e) => setStrengthFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="all">All Strengths</option>
                  <option value="gaps">Gaps Only (Weak / Missing)</option>
                  <option value="medium">Medium (Deepen)</option>
                  <option value="strong">Strong (Verified Assets)</option>
                </select>

                {/* Priority Filter */}
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Skill Cards Grid */}
            <div className="space-y-3">
              {filteredSkills.map((item, idx) => {
                const badge = getStrengthBadge(item.current_strength);
                const BadgeIcon = badge.icon;
                const isExpanded = expandedSkillName === item.skill;

                return (
                  <div
                    key={idx}
                    className="glass-card p-5 rounded-2xl border border-slate-800 hover:border-slate-700/80 transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Skill Name & Demand */}
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-white shrink-0">
                          {item.skill.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-white">{item.skill}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} flex items-center space-x-1`}
                            >
                              <BadgeIcon className="w-3 h-3" />
                              <span>{badge.label}</span>
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${getPriorityBadge(
                                item.priority
                              )}`}
                            >
                              {item.priority}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400 mt-1 flex items-center space-x-2">
                            <span>
                              Demanded in <strong>{item.frequency_count}</strong> of {analysis.target_jobs_analyzed} target jobs ({item.frequency_percentage}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Toggle Details Button */}
                      <button
                        onClick={() => setExpandedSkillName(isExpanded ? null : item.skill)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center space-x-1 transition-all shrink-0"
                      >
                        <span>{isExpanded ? "Hide Action Plan" : "View Learning Path & Project"}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Candidate Evidence Pill */}
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 flex items-center space-x-2">
                      <span className="font-bold text-slate-400 text-[11px] uppercase tracking-wider shrink-0">
                        Profile Evidence:
                      </span>
                      <span className="truncate">{item.candidate_evidence}</span>
                    </div>

                    {/* Expandable Action Plan: Learning Path & Recommended Project */}
                    {isExpanded && (
                      <div className="pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Recommended Learning Path */}
                        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                          <div className="flex items-center space-x-2 text-brand-400 text-xs font-bold uppercase tracking-wider">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Recommended Learning Path</span>
                          </div>
                          <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside">
                            {item.recommended_learning_path.map((step, sidx) => (
                              <li key={sidx} className="leading-relaxed">
                                {step}
                              </li>
                            ))}
                          </ol>
                        </div>

                        {/* Recommended Portfolio Project */}
                        {item.recommended_project && (
                          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                            <div className="flex items-center space-x-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                              <FolderGit2 className="w-3.5 h-3.5" />
                              <span>Recommended Portfolio Project</span>
                            </div>
                            <h4 className="text-xs font-bold text-white">
                              {item.recommended_project.title}
                            </h4>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              {item.recommended_project.description}
                            </p>
                            <div className="space-y-1 pt-1">
                              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                Key Features:
                              </span>
                              <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                                {item.recommended_project.key_features.map((kf, kfidx) => (
                                  <li key={kfidx}>{kf}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
