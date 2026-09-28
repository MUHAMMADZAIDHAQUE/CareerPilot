"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Briefcase,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Building2,
  MapPin,
  Clock,
  DollarSign,
  GraduationCap,
  Layers,
  Code2,
  ExternalLink,
  ChevronRight,
  Sliders,
  ShieldCheck,
  FolderGit2,
  FileText,
} from "lucide-react";
import {
  fetchJobApi,
  matchCandidateToJobApi,
  fetchLatestMatchApi,
  Job,
  MatchResponse,
} from "@/lib/api";

export default function JobMatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = (params?.jobId as string) || "";

  const [job, setJob] = useState<Job | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom weights modal / state
  const [showWeightAdjuster, setShowWeightAdjuster] = useState(false);
  const [weights, setWeights] = useState({
    required_skill_coverage: 0.35,
    semantic_skill_similarity: 0.25,
    experience_compatibility: 0.15,
    project_relevance: 0.15,
    education_compatibility: 0.10,
  });

  const loadData = async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);

    // 1. Fetch Job
    const jobRes = await fetchJobApi(jobId);
    if (jobRes.error || !jobRes.data) {
      setError(jobRes.error || "Job not found");
      setLoading(false);
      return;
    }
    setJob(jobRes.data);

    // 2. Fetch or calculate Match
    const matchRes = await fetchLatestMatchApi(jobId);
    if (matchRes.data) {
      setMatchResult(matchRes.data);
    } else {
      // Run match automatically
      const newMatch = await matchCandidateToJobApi(jobId);
      if (newMatch.data) {
        setMatchResult(newMatch.data);
      } else if (newMatch.error) {
        setError(newMatch.error);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [jobId]);

  const handleRecalculateMatch = async () => {
    if (!jobId) return;
    setMatchingLoading(true);
    setError(null);

    const res = await matchCandidateToJobApi(jobId, { weights });
    setMatchingLoading(false);

    if (res.data) {
      setMatchResult(res.data);
    } else {
      setError(res.error || "Failed to recalculate match");
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (score >= 60) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    return "text-rose-400 border-rose-500/30 bg-rose-500/10";
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return "from-emerald-500 to-teal-400";
    if (score >= 60) return "from-amber-500 to-yellow-400";
    return "from-rose-500 to-orange-400";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-400 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-400">Loading Job & Matching Evaluation...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center max-w-lg mx-auto space-y-4">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
          <XCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Evaluation Unavailable</h2>
        <p className="text-sm text-slate-400">{error || "Could not locate job record."}</p>
        <Link
          href="/jobs/analyze"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 text-sm font-semibold text-slate-200 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to JD Analyzer</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Link href="/jobs/analyze" className="hover:text-slate-200 flex items-center space-x-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>JD Analyzer</span>
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-semibold">{job.company}</span>
          <span>/</span>
          <span className="text-brand-400 truncate max-w-xs">{job.role}</span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setShowWeightAdjuster(!showWeightAdjuster)}
            className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-semibold text-slate-300 hover:text-white flex items-center space-x-1.5 transition-all shadow-sm"
          >
            <Sliders className="w-3.5 h-3.5 text-brand-400" />
            <span>Adjust Weights</span>
          </button>

          <button
            type="button"
            onClick={handleRecalculateMatch}
            disabled={matchingLoading}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-accent-cyan hover:from-brand-500 hover:to-accent-cyan text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all flex items-center space-x-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${matchingLoading ? "animate-spin" : ""}`} />
            <span>{matchingLoading ? "Matching..." : "Re-Score"}</span>
          </button>
        </div>
      </div>

      {/* Configurable Weights Drawer */}
      {showWeightAdjuster && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-brand-500/30 backdrop-blur-xl animate-fadeIn space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-brand-400" />
              <h3 className="font-bold text-sm text-white">Deterministic Scoring Weight Configuration</h3>
            </div>
            <span className="text-xs text-slate-400">Total: 100%</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 pt-2">
            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">
                Required Skills: {Math.round(weights.required_skill_coverage * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.required_skill_coverage}
                onChange={(e) => setWeights({ ...weights, required_skill_coverage: parseFloat(e.target.value) })}
                className="w-full accent-brand-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">
                Semantic Vectors: {Math.round(weights.semantic_skill_similarity * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.semantic_skill_similarity}
                onChange={(e) => setWeights({ ...weights, semantic_skill_similarity: parseFloat(e.target.value) })}
                className="w-full accent-brand-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">
                Experience Tenure: {Math.round(weights.experience_compatibility * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.experience_compatibility}
                onChange={(e) => setWeights({ ...weights, experience_compatibility: parseFloat(e.target.value) })}
                className="w-full accent-brand-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">
                Project Relevance: {Math.round(weights.project_relevance * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.project_relevance}
                onChange={(e) => setWeights({ ...weights, project_relevance: parseFloat(e.target.value) })}
                className="w-full accent-brand-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">
                Education Match: {Math.round(weights.education_compatibility * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.education_compatibility}
                onChange={(e) => setWeights({ ...weights, education_compatibility: parseFloat(e.target.value) })}
                className="w-full accent-brand-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Hero Score Card */}
      {matchResult && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -z-10" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            {/* Left: Overall Match Score Meter */}
            <div className="flex items-center space-x-6">
              <div
                className={`w-28 h-28 sm:w-32 sm:h-32 rounded-3xl border-2 flex flex-col items-center justify-center shadow-xl ${getScoreColor(
                  matchResult.overall_match_score
                )}`}
              >
                <span className="text-3xl sm:text-4xl font-black tracking-tight">
                  {matchResult.overall_match_score}%
                </span>
                <span className="text-[10px] sm:text-xs uppercase font-extrabold tracking-wider mt-1 opacity-90">
                  Match Score
                </span>
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
                  <span>Deterministic Evaluation Engine</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {job.role}
                </h1>
                <div className="flex items-center space-x-2 text-slate-300 text-sm font-medium">
                  <Building2 className="w-4 h-4 text-brand-400" />
                  <span>{job.company}</span>
                  <span>•</span>
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{job.location || "Remote"}</span>
                </div>
              </div>
            </div>

            {/* Right: Sub-score Breakdown Progress Bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 w-full lg:max-w-md bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
              {/* Required Skills */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">Required Skills</span>
                  <span className="text-emerald-400">{matchResult.required_skill_coverage}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                    style={{ width: `${matchResult.required_skill_coverage}%` }}
                  />
                </div>
              </div>

              {/* Semantic Vectors */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">Semantic Vectors</span>
                  <span className="text-cyan-400">{matchResult.semantic_score}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-700"
                    style={{ width: `${matchResult.semantic_score}%` }}
                  />
                </div>
              </div>

              {/* Experience */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">Experience Tenure</span>
                  <span className="text-amber-400">{matchResult.experience_compatibility}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-700"
                    style={{ width: `${matchResult.experience_compatibility}%` }}
                  />
                </div>
              </div>

              {/* Project Relevance */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">Projects Match</span>
                  <span className="text-purple-400">{matchResult.project_relevance}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-purple-400 rounded-full transition-all duration-700"
                    style={{ width: `${matchResult.project_relevance}%` }}
                  />
                </div>
              </div>

              {/* Education Match */}
              <div className="space-y-1 sm:col-span-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">Education Compatibility</span>
                  <span className="text-blue-400">{matchResult.education_compatibility}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all duration-700"
                    style={{ width: `${matchResult.education_compatibility}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Explanation Card */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span>Grounded Alignment Assessment</span>
            </h3>
            <p className="text-sm text-slate-200 leading-relaxed font-sans">
              {matchResult.explanation}
            </p>
          </div>
        </div>
      )}

      {/* Skills Tri-Matrix: Matched vs Missing Required vs Missing Preferred */}
      {matchResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Matched Skills */}
          <div className="bg-slate-900/60 border border-emerald-500/30 rounded-2xl p-6 backdrop-blur-xl shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Matched Skills</h3>
                  <p className="text-xs text-emerald-400/80">Covered in Profile</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {matchResult.matched_skills.length}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {matchResult.matched_skills.length > 0 ? (
                matchResult.matched_skills.map((s, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>{s}</span>
                  </span>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No skills matched.</p>
              )}
            </div>
          </div>

          {/* Missing Required Skills */}
          <div className="bg-slate-900/60 border border-rose-500/30 rounded-2xl p-6 backdrop-blur-xl shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Missing Required</h3>
                  <p className="text-xs text-rose-400/80">Critical Gaps</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                {matchResult.missing_required_skills.length}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {matchResult.missing_required_skills.length > 0 ? (
                matchResult.missing_required_skills.map((s, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 flex items-center space-x-1"
                  >
                    <XCircle className="w-3 h-3 text-rose-400" />
                    <span>{s}</span>
                  </span>
                ))
              ) : (
                <p className="text-xs text-emerald-400 font-medium">None! All mandatory skills are covered.</p>
              )}
            </div>
          </div>

          {/* Missing Preferred Skills */}
          <div className="bg-slate-900/60 border border-cyan-500/30 rounded-2xl p-6 backdrop-blur-xl shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Missing Preferred</h3>
                  <p className="text-xs text-cyan-400/80">Optional Pluses</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {matchResult.missing_preferred_skills.length}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {matchResult.missing_preferred_skills.length > 0 ? (
                matchResult.missing_preferred_skills.map((s, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30"
                  >
                    {s}
                  </span>
                ))
              ) : (
                <p className="text-xs text-cyan-400 font-medium">All preferred skills covered or none listed.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Relevant Projects Section */}
      {matchResult && matchResult.relevant_projects.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-white flex items-center space-x-2">
              <FolderGit2 className="w-4 h-4 text-brand-400" />
              <span>Ranked Relevant Portfolio Projects</span>
            </h3>
            <span className="text-xs text-slate-400">
              Evaluated against JD technologies & domain
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {matchResult.relevant_projects.map((proj, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-brand-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold text-sm text-white">{proj.title}</h4>
                    <span className="px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-300 border border-brand-500/20 text-xs font-bold">
                      {proj.relevance_score}% relevance
                    </span>
                  </div>
                  {proj.key_bullet && (
                    <p className="text-xs text-slate-300 leading-relaxed mb-3 line-clamp-2">
                      {proj.key_bullet}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/60">
                  {proj.matching_skills.map((tech, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] font-mono"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grounded Evidence System (No Hallucination) */}
      {matchResult && matchResult.evidence.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-white flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Verifiable Evidence System (Grounded Citations)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Every listed match is explicitly cited with supporting proof from your candidate profile.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {matchResult.evidence.length} citations verified
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matchResult.evidence.map((ev, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-200">{ev.requirement}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        ev.requirement_type === "required"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                      }`}
                    >
                      {ev.requirement_type}
                    </span>
                  </div>

                  {/* Verbatim quote */}
                  <blockquote className="text-xs text-slate-300 font-mono italic bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60 mb-2">
                    "{ev.evidence_quote}"
                  </blockquote>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/40">
                  <span className="font-medium text-slate-300 truncate max-w-[200px]">
                    {ev.source_title}
                  </span>
                  <span className="text-emerald-400 font-semibold font-mono">
                    {Math.round(ev.confidence * 100)}% verified
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Original Job Description Accordion */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 backdrop-blur-xl">
        <h3 className="font-bold text-sm text-slate-300 uppercase tracking-wider mb-3 flex items-center space-x-2">
          <FileText className="w-4 h-4 text-slate-400" />
          <span>Original Job Description</span>
        </h3>
        <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 leading-relaxed">
          {job.raw_description}
        </pre>
      </div>
    </div>
  );
}
