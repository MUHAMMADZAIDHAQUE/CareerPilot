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
  Award,
  Flame,
} from "lucide-react";
import {
  fetchCareerSkillGapsApi,
  SkillGapAnalysisResponse,
  SkillGapItem,
  RoadmapPhase,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Progress } from "@/components/ui/Progress";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/States";

export default function CareerSkillGapsPage() {
  const [analysis, setAnalysis] = useState<SkillGapAnalysisResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [expandedSkillName, setExpandedSkillName] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCareerSkillGapsApi();
      if (res.data) {
        setAnalysis(res.data);
      } else {
        setError(res.error || "Failed to load skill gap analysis");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to query skill gap API");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSkills = (analysis?.skills || []).filter((item) => {
    if (searchQuery.trim() && !item.skill.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (priorityFilter !== "all" && item.priority.toLowerCase() !== priorityFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-8 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium mb-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
            <span>Target Job Market Gap Analysis</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Skill Gap Trajectory
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cross-analyzing saved jobs, active applications, and profile evidence to identify recurring skill demands.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            loading={refreshing}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Analysis
          </Button>

          <Link href="/insights">
            <Button variant="primary" size="sm" icon={<Target className="w-4 h-4" />}>
              Full Insights Hub
            </Button>
          </Link>
        </div>
      </div>

      {/* Grounded Integrity Banner */}
      <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/70 flex items-start space-x-3 text-xs text-slate-600">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-900">Grounded Skill Integrity Guaranteed</span>
          <p className="text-slate-500 mt-0.5">
            Verified skills and projects in your profile are permanently honored as active assets and never flagged as missing.
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Analyzing recurring skill demands across your target jobs..." />
      ) : error ? (
        <ErrorState title="Failed to load analysis" error={error} onRetry={loadData} />
      ) : analysis ? (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <span className="text-xs font-medium text-slate-500 block">Market Readiness</span>
              <span className="text-2xl font-semibold text-slate-900 mt-1 block">
                {analysis.market_readiness_score}%
              </span>
              <span className="text-[11px] text-slate-400">Coverage across target jobs</span>
            </Card>

            <Card>
              <span className="text-xs font-medium text-slate-500 block">Target Jobs Analyzed</span>
              <span className="text-2xl font-semibold text-slate-900 mt-1 block">
                {analysis.target_jobs_analyzed}
              </span>
              <span className="text-[11px] text-slate-400">
                {analysis.saved_jobs_count} saved • {analysis.applied_jobs_count} applied
              </span>
            </Card>

            <Card>
              <span className="text-xs font-medium text-slate-500 block">Identified Gaps</span>
              <span className="text-2xl font-semibold text-rose-700 mt-1 block">
                {analysis.identified_gaps_count}
              </span>
              <span className="text-[11px] text-slate-400">Recurring requirements</span>
            </Card>

            <Card>
              <span className="text-xs font-medium text-slate-500 block">Verified Strong Skills</span>
              <span className="text-2xl font-semibold text-emerald-700 mt-1 block">
                {analysis.skills.filter((s) => s.current_strength === "Strong").length}
              </span>
              <span className="text-[11px] text-slate-400">Grounded in candidate proof</span>
            </Card>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-card flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full">
              <Input
                placeholder="Search skills (e.g. Kubernetes, React, Python)..."
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
                className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-card hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-slate-900">{item.skill}</span>
                    <Badge variant={item.priority === "HIGH" ? "error" : "warning"} size="sm">
                      {item.priority} Priority
                    </Badge>
                    <span className="text-[11px] font-mono text-slate-400">{item.category}</span>
                  </div>
                  <p className="text-slate-500">{item.candidate_evidence || "Identified as target job requirement"}</p>
                </div>

                <div className="shrink-0 flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Demanded In</span>
                    <span className="font-semibold text-slate-900 block">
                      {item.frequency_percentage}% of jobs
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
                title="No Skills Found"
                description="No skills match your search filters."
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
