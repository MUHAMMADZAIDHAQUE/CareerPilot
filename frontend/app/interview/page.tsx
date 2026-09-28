"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Sliders,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Building2,
  GraduationCap,
  Play,
  RotateCcw,
  Send,
  Award,
  Layers,
  HelpCircle,
  Target,
  FileText,
  ExternalLink,
  Flame,
  Check,
  Copy,
  Info,
  StopCircle,
} from "lucide-react";
import {
  fetchJobsApi,
  Job,
  fetchInterviewPrepApi,
  startInterviewSessionApi,
  getInterviewSessionApi,
  listInterviewSessionsApi,
  submitInterviewAnswerApi,
  finishInterviewSessionApi,
  InterviewPreparation,
  InterviewSession,
  InterviewTurn,
  EvaluationDetail,
  FinalFeedbackDetail,
  TechnicalQuestionItem,
  ProjectQuestionItem,
  BehavioralQuestionItem,
  JDSpecificQuestionItem,
  ResumeSpecificQuestionItem,
  PreparationTopicItem,
} from "@/lib/api";

export default function InterviewPrepPage() {
  const [activeTab, setActiveTab] = useState<"prep_kit" | "simulator">("prep_kit");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Prep Kit State
  const [prepKit, setPrepKit] = useState<InterviewPreparation | null>(null);
  const [prepLoading, setPrepLoading] = useState<boolean>(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [questionCategoryFilter, setQuestionCategoryFilter] = useState<string>("all");
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  // Simulator State
  const [activeSession, setActiveSession] = useState<InterviewSession | null>(null);
  const [pastSessions, setPastSessions] = useState<InterviewSession[]>([]);
  const [sessionLoading, setSessionLoading] = useState<boolean>(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [candidateAnswer, setCandidateAnswer] = useState<string>("");
  const [submittingAnswer, setSubmittingAnswer] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(false);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerActive) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive]);

  // Load jobs on initial render
  useEffect(() => {
    async function loadJobs() {
      const res = await fetchJobsApi();
      if (res.data && res.data.length > 0) {
        setJobs(res.data);
        setSelectedJobId(res.data[0].id);
        setSelectedJob(res.data[0]);
      }
    }
    loadJobs();
  }, []);

  // When selectedJobId changes, load prep kit & past sessions
  useEffect(() => {
    if (!selectedJobId) return;
    const current = jobs.find((j) => j.id === selectedJobId) || null;
    setSelectedJob(current);
    loadPrepKit(selectedJobId);
    loadSessions(selectedJobId);
  }, [selectedJobId, jobs]);

  const loadPrepKit = async (jobId: string, force = false) => {
    setPrepLoading(true);
    setPrepError(null);
    const res = await fetchInterviewPrepApi(jobId, undefined, force);
    setPrepLoading(false);
    if (res.data) {
      setPrepKit(res.data);
    } else {
      setPrepError(res.error || "Failed to load prep kit");
    }
  };

  const loadSessions = async (jobId: string) => {
    const res = await listInterviewSessionsApi(jobId);
    if (res.data) {
      setPastSessions(res.data);
      // If there is an active session in progress, select it
      const inProg = res.data.find((s) => s.status === "IN_PROGRESS");
      if (inProg) {
        setActiveSession(inProg);
        setTimerActive(true);
      }
    }
  };

  // Start new mock interview
  const handleStartSession = async (questionCount = 5) => {
    if (!selectedJobId) return;
    setSessionLoading(true);
    setSessionError(null);
    setElapsedSeconds(0);
    setCandidateAnswer("");

    const res = await startInterviewSessionApi({
      job_id: selectedJobId,
      total_questions: questionCount,
    });
    setSessionLoading(false);
    if (res.data) {
      setActiveSession(res.data);
      setActiveTab("simulator");
      setTimerActive(true);
      loadSessions(selectedJobId);
    } else {
      setSessionError(res.error || "Failed to start interview session");
    }
  };

  // Submit Answer
  const handleSubmitAnswer = async () => {
    if (!activeSession || !candidateAnswer.trim()) return;
    setSubmittingAnswer(true);
    setSessionError(null);

    const res = await submitInterviewAnswerApi(activeSession.id, candidateAnswer);
    setSubmittingAnswer(false);
    if (res.data) {
      setActiveSession(res.data);
      setCandidateAnswer("");
      setElapsedSeconds(0);
      if (res.data.status === "COMPLETED") {
        setTimerActive(false);
      }
      loadSessions(selectedJobId);
    } else {
      setSessionError(res.error || "Failed to evaluate answer");
    }
  };

  // End Interview Early
  const handleFinishEarly = async () => {
    if (!activeSession) return;
    setSessionLoading(true);
    const res = await finishInterviewSessionApi(activeSession.id);
    setSessionLoading(false);
    if (res.data) {
      setActiveSession(res.data);
      setTimerActive(false);
      loadSessions(selectedJobId);
    }
  };

  // Score color helper
  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (score >= 70) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    return "text-rose-400 bg-rose-500/10 border-rose-500/30";
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 85) return "bg-emerald-400";
    if (score >= 70) return "bg-amber-400";
    return "bg-rose-400";
  };

  // Helper format seconds
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Filter questions in Prep Kit
  const getFilteredQuestions = () => {
    if (!prepKit) return [];
    const list: Array<{
      category: string;
      title: string;
      question: string;
      contextSource?: string;
      samplePoints?: string[];
      starTip?: any;
      difficulty?: string;
    }> = [];

    if (questionCategoryFilter === "all" || questionCategoryFilter === "technical") {
      prepKit.technical_questions.forEach((q) => {
        list.push({
          category: "Technical",
          title: q.topic,
          question: q.question,
          contextSource: q.context_source,
          samplePoints: q.sample_good_points,
          difficulty: q.difficulty,
        });
      });
    }

    if (questionCategoryFilter === "all" || questionCategoryFilter === "project") {
      prepKit.project_questions.forEach((q) => {
        list.push({
          category: "Project-Based",
          title: q.project_name,
          question: q.question,
          contextSource: q.context_source,
          difficulty: "System Depth",
        });
      });
    }

    if (questionCategoryFilter === "all" || questionCategoryFilter === "behavioral") {
      prepKit.behavioral_questions.forEach((q) => {
        list.push({
          category: "Behavioral",
          title: q.competency,
          question: q.question,
          contextSource: q.context_source,
          starTip: q.star_framework_tip,
        });
      });
    }

    if (questionCategoryFilter === "all" || questionCategoryFilter === "jd_specific") {
      prepKit.jd_specific_questions.forEach((q) => {
        list.push({
          category: "JD-Specific",
          title: q.jd_requirement,
          question: q.question,
          contextSource: q.context_source,
        });
      });
    }

    if (questionCategoryFilter === "all" || questionCategoryFilter === "resume_specific") {
      prepKit.resume_specific_questions.forEach((q) => {
        list.push({
          category: "Resume-Specific",
          title: q.resume_claim,
          question: q.question,
          contextSource: q.context_source,
        });
      });
    }

    if (questionCategoryFilter === "all" || questionCategoryFilter === "follow_up") {
      prepKit.follow_up_questions.forEach((q) => {
        list.push({
          category: "Follow-Up Probes",
          title: q.original_category || "In-Depth Probe",
          question: q.question,
          contextSource: q.probe_direction,
        });
      });
    }

    return list;
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner / Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-xs text-brand-400 font-semibold tracking-wider uppercase mb-1">
            <GraduationCap className="w-4 h-4" />
            <span>Phase 12: Interview Preparation & Simulation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            AI Interview Agent & Mock Simulator
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Evidence-grounded technical questions, real-time STAR evaluation, follow-up probes, and weak area analysis.
          </p>
        </div>

        {/* Job Selection Dropdown */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative min-w-[260px]">
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-brand-500 shadow-md"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.role} • {j.company}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => loadPrepKit(selectedJobId, true)}
            disabled={prepLoading}
            className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all shadow-sm"
            title="Regenerate prep questions"
          >
            <RefreshCw className={`w-4 h-4 ${prepLoading ? "animate-spin text-brand-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Compliance & Anti-Hallucination Disclaimer Banner */}
      <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            <strong>Simulated Preparation Guard:</strong> All technical, project, and behavioral questions are generated strictly from the job requirements and candidate profile. Not actual or proprietary leaked company questions.
          </span>
        </div>
        <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-indigo-500/20 text-[10px] font-bold uppercase tracking-wider text-indigo-200">
          Deterministic & Grounded
        </span>
      </div>

      {/* Primary Tab Switcher */}
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("prep_kit")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "prep_kit"
              ? "bg-brand-600 text-white shadow-md shadow-brand-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Question Bank & Study Kit</span>
        </button>

        <button
          onClick={() => setActiveTab("simulator")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "simulator"
              ? "bg-brand-600 text-white shadow-md shadow-brand-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Play className="w-4 h-4" />
          <span>Interactive Mock Simulator</span>
          {activeSession?.status === "IN_PROGRESS" && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: QUESTION BANK & STUDY KIT */}
      {/* ========================================================================= */}
      {activeTab === "prep_kit" && (
        <div className="space-y-8">
          {prepLoading && (
            <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3">
              <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-400 rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Synthesizing role-grounded questions & STAR tips...</p>
            </div>
          )}

          {prepError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
              {prepError}
            </div>
          )}

          {prepKit && !prepLoading && (
            <>
              {/* Preparation Topics Study Roadmap */}
              <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Target className="w-5 h-5 text-brand-400" />
                    <h2 className="text-sm sm:text-base font-bold text-white">
                      Suggested Preparation Roadmap ({prepKit.suggested_preparation_topics.length} Key Topics)
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400">Targeted for {prepKit.company_name}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {prepKit.suggested_preparation_topics.map((t, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate">{t.topic}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            t.priority === "HIGH"
                              ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                              : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{t.recommended_prep}</p>
                      <ul className="text-[10px] text-slate-400 space-y-1 list-disc list-inside">
                        {t.key_concepts.map((kc, kidx) => (
                          <li key={kidx} className="truncate">{kc}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Bar & Category Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: "all", label: "All Questions" },
                    { id: "technical", label: "Technical" },
                    { id: "project", label: "Project-Based" },
                    { id: "behavioral", label: "Behavioral (STAR)" },
                    { id: "jd_specific", label: "JD-Specific" },
                    { id: "resume_specific", label: "Resume-Specific" },
                    { id: "follow_up", label: "Follow-Up Probes" },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setQuestionCategoryFilter(filter.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        questionCategoryFilter === filter.id
                          ? "bg-brand-500 text-white shadow-sm"
                          : "bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handleStartSession(5)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center space-x-2 shrink-0"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start 5-Question Simulation</span>
                </button>
              </div>

              {/* Questions Feed */}
              <div className="space-y-4">
                {getFilteredQuestions().map((q, idx) => {
                  const isExpanded = expandedQuestionId === `q_${idx}`;
                  return (
                    <div
                      key={idx}
                      className="glass-card p-5 rounded-2xl border border-slate-800 hover:border-slate-700/80 transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-[10px] font-bold uppercase tracking-wider">
                            {q.category}
                          </span>
                          <span className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-md">
                            {q.title}
                          </span>
                        </div>
                        {q.difficulty && (
                          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            {q.difficulty}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-semibold text-slate-100 leading-snug">
                        {q.question}
                      </h3>

                      {q.contextSource && (
                        <div className="text-[11px] text-slate-400 flex items-center space-x-1">
                          <span className="font-semibold text-slate-500">Source:</span>
                          <span className="text-slate-300 truncate">{q.contextSource}</span>
                        </div>
                      )}

                      {/* STAR Tips / Sample Good Points Collapsible */}
                      {(q.samplePoints || q.starTip) && (
                        <div className="pt-2 border-t border-slate-800/80">
                          <button
                            onClick={() => setExpandedQuestionId(isExpanded ? null : `q_${idx}`)}
                            className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center space-x-1"
                          >
                            <span>{isExpanded ? "Hide Guidance" : "Show Answering Guidance & Good Points"}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          {isExpanded && (
                            <div className="mt-3 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2">
                              {q.samplePoints && (
                                <div className="space-y-1">
                                  <span className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">
                                    Sample Key Points:
                                  </span>
                                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                                    {q.samplePoints.map((pt, pidx) => (
                                      <li key={pidx}>{pt}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {q.starTip && (
                                <div className="space-y-1.5">
                                  <span className="font-bold text-emerald-400 text-[11px] uppercase tracking-wider">
                                    STAR Framework Guide:
                                  </span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                    <div className="p-2 rounded bg-slate-800/80">
                                      <strong>Situation:</strong> {q.starTip.Situation}
                                    </div>
                                    <div className="p-2 rounded bg-slate-800/80">
                                      <strong>Task:</strong> {q.starTip.Task}
                                    </div>
                                    <div className="p-2 rounded bg-slate-800/80">
                                      <strong>Action:</strong> {q.starTip.Action}
                                    </div>
                                    <div className="p-2 rounded bg-slate-800/80">
                                      <strong>Result:</strong> {q.starTip.Result}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INTERACTIVE MOCK SIMULATOR */}
      {/* ========================================================================= */}
      {activeTab === "simulator" && (
        <div className="space-y-8">
          {!activeSession ? (
            /* No Active Session - Start Prompt */
            <div className="p-10 rounded-2xl glass-card border border-slate-800 text-center max-w-xl mx-auto space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-500 flex items-center justify-center mx-auto shadow-lg shadow-brand-500/20">
                <Play className="w-7 h-7 text-white fill-white ml-0.5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Start Interactive Mock Interview</h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  The AI interviewer will ask one question at a time, evaluate your answer across 6 categories, ask contextual follow-ups, and produce a final readiness report.
                </p>
              </div>

              <div className="flex justify-center gap-3">
                <button
                  onClick={() => handleStartSession(3)}
                  disabled={sessionLoading}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700"
                >
                  Quick 3 Questions
                </button>
                <button
                  onClick={() => handleStartSession(5)}
                  disabled={sessionLoading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-xs font-bold text-white shadow-md shadow-brand-500/20 flex items-center space-x-2"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Standard 5 Questions</span>
                </button>
              </div>
            </div>
          ) : activeSession.status === "COMPLETED" ? (
            /* ========================================================================= */
            /* FINAL COMPREHENSIVE FEEDBACK SCREEN */
            /* ========================================================================= */
            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Interview Simulation Completed</span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-white mt-1">
                    Performance Evaluation Report
                  </h2>
                  <p className="text-xs text-slate-400">
                    {activeSession.role} at {activeSession.company_name}
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleStartSession(5)}
                    className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-500/20 flex items-center space-x-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retake Interview</span>
                  </button>
                </div>
              </div>

              {/* Overall Score & Radar Overview */}
              {activeSession.final_feedback && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Score Radial Card */}
                  <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Overall Readiness Score
                    </div>
                    <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-emerald-400">
                      {activeSession.final_feedback.overall_score}%
                    </div>
                    <p className="text-xs text-slate-300 max-w-xs">
                      {activeSession.final_feedback.summary}
                    </p>
                  </div>

                  {/* 6 Category Breakdown Bars */}
                  <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                    <div className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                      Evaluation Categories Breakdown
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label: "Technical Accuracy", key: "technical_accuracy" },
                        { label: "Relevance", key: "relevance" },
                        { label: "Clarity", key: "clarity" },
                        { label: "Structure", key: "structure" },
                        { label: "Evidence", key: "evidence" },
                        { label: "Communication", key: "communication" },
                      ].map((item) => {
                        const score = (activeSession.final_feedback?.category_scores as any)?.[item.key] || 0;
                        return (
                          <div key={item.key} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-300 font-medium">{item.label}</span>
                              <span className="font-bold text-white">{score}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${getScoreBarColor(score)} rounded-full transition-all duration-500`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Strengths & Weak Areas */}
              {activeSession.final_feedback && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Strengths */}
                  <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                    <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Key Demonstrated Strengths</span>
                    </div>
                    <ul className="space-y-2 text-xs text-slate-300">
                      {activeSession.final_feedback.strengths.map((str, idx) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Weak Areas & Identified Gaps */}
                  <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                    <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                      <AlertCircle className="w-4 h-4" />
                      <span>Identified Weak Areas & Gaps</span>
                    </div>
                    <ul className="space-y-2 text-xs text-slate-300">
                      {activeSession.final_feedback.weak_areas.map((w, idx) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Actionable Recommendations */}
              {activeSession.final_feedback && (
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Targeted Pre-Interview Recommendations
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeSession.final_feedback.recommendations.map((rec, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-800/60 text-xs text-slate-300 flex items-start space-x-2">
                        <ArrowRight className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ========================================================================= */
            /* LIVE INTERVIEW QUESTION & ANSWER FLOW */
            /* ========================================================================= */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Question, Answer Studio, Past Turns */}
              <div className="lg:col-span-2 space-y-6">
                {/* Current Active Question Card */}
                {activeSession.current_turn && (
                  <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 text-[10px] font-bold uppercase tracking-wider">
                          Question {activeSession.current_turn.turn_index + 1} of {activeSession.total_target_questions}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">
                          {activeSession.current_turn.category}
                        </span>
                        {activeSession.current_turn.is_follow_up && (
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                            Follow-Up Probe
                          </span>
                        )}
                      </div>

                      {/* Timer */}
                      <div className="flex items-center space-x-1.5 text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                        <Clock className="w-3.5 h-3.5 text-brand-400" />
                        <span>{formatTime(elapsedSeconds)}</span>
                      </div>
                    </div>

                    <h2 className="text-base sm:text-lg font-bold text-white leading-relaxed">
                      {activeSession.current_turn.question}
                    </h2>

                    {activeSession.current_turn.context_source && (
                      <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
                        <span className="text-slate-500 font-semibold">Grounded in:</span>
                        <span className="text-slate-300 truncate">{activeSession.current_turn.context_source}</span>
                      </div>
                    )}

                    {/* Answer Studio */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <label className="font-semibold text-slate-300">Your Answer:</label>
                        <span>{candidateAnswer.split(/\s+/).filter(Boolean).length} words</span>
                      </div>

                      <textarea
                        rows={6}
                        value={candidateAnswer}
                        onChange={(e) => setCandidateAnswer(e.target.value)}
                        placeholder="Type your structured answer here (e.g. STAR method for behavioral: Situation, Task, Action, Result; or problem-solution-tradeoffs for technical questions)..."
                        className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 leading-relaxed transition-all"
                      />

                      {sessionError && (
                        <div className="text-xs text-red-400">{sessionError}</div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                        <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                          <Info className="w-3.5 h-3.5 text-brand-400" />
                          <span>Tip: Include quantitative metrics and concrete project trade-offs.</span>
                        </div>

                        <div className="flex items-center space-x-3">
                          <button
                            onClick={handleFinishEarly}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white"
                          >
                            Finish Early
                          </button>

                          <button
                            onClick={handleSubmitAnswer}
                            disabled={submittingAnswer || !candidateAnswer.trim()}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-brand-500/20 flex items-center space-x-2 transition-all"
                          >
                            {submittingAnswer ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                                <span>Evaluating Answer...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                <span>Submit for AI Evaluation</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* History of Answered Turns in Current Session */}
                {activeSession.turns.filter((t) => t.candidate_answer).length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Completed Turns & Real-time Evaluations ({activeSession.turns.filter((t) => t.candidate_answer).length})
                    </h3>

                    {activeSession.turns
                      .filter((t) => t.candidate_answer)
                      .reverse()
                      .map((turn) => (
                        <div
                          key={turn.id}
                          className="p-5 rounded-2xl glass-card border border-slate-800 space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-300">
                              Question {turn.turn_index + 1}: {turn.category}
                            </span>
                            {turn.evaluation && (
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getScoreColor(
                                  turn.evaluation.overall_score
                                )}`}
                              >
                                {turn.evaluation.overall_score}% Score
                              </span>
                            )}
                          </div>

                          <p className="text-xs sm:text-sm font-semibold text-slate-200">
                            {turn.question}
                          </p>

                          {/* Candidate Answer excerpt */}
                          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                            <span className="font-bold text-slate-400 block mb-1 text-[11px] uppercase tracking-wider">
                              Your Answer:
                            </span>
                            {turn.candidate_answer}
                          </div>

                          {/* 6 Category Score Pills */}
                          {turn.evaluation && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                              {[
                                { label: "Technical", score: turn.evaluation.technical_accuracy },
                                { label: "Relevance", score: turn.evaluation.relevance },
                                { label: "Clarity", score: turn.evaluation.clarity },
                                { label: "Structure", score: turn.evaluation.structure },
                                { label: "Evidence", score: turn.evaluation.evidence },
                                { label: "Communication", score: turn.evaluation.communication },
                              ].map((item, cidx) => (
                                <div
                                  key={cidx}
                                  className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 flex justify-between items-center"
                                >
                                  <span className="text-slate-400">{item.label}</span>
                                  <span className="font-bold text-white">{item.score}%</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Feedback Summary */}
                          {turn.evaluation && (
                            <div className="text-xs text-slate-300 bg-brand-500/5 border border-brand-500/20 p-3 rounded-xl space-y-1">
                              <span className="font-bold text-brand-300 block text-[11px] uppercase tracking-wider">
                                Constructive Feedback:
                              </span>
                              <p>{turn.evaluation.feedback}</p>
                            </div>
                          )}

                          {/* Generated Follow-up Question */}
                          {turn.follow_up_question && (
                            <div className="text-xs text-purple-300 bg-purple-500/5 border border-purple-500/20 p-3 rounded-xl flex items-start space-x-2">
                              <HelpCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold text-purple-300 block text-[11px] uppercase tracking-wider">
                                  Generated Follow-Up Probe:
                                </span>
                                <p>{turn.follow_up_question}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Right Col: Live Weak Areas, Session Context */}
              <div className="space-y-6">
                {/* Live Weak Area Tracker */}
                <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4" />
                    <span>Live Weak Area Tracker</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Weak areas detected across your answers during this session:
                  </p>

                  {activeSession.weak_areas.length === 0 ? (
                    <div className="p-3 rounded-xl bg-slate-900 text-xs text-slate-500 text-center">
                      No weak areas detected yet. Keep answering with evidence!
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {activeSession.weak_areas.map((w, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Session Target Summary */}
                <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3 text-xs">
                  <span className="font-bold text-white uppercase tracking-wider block text-[11px]">
                    Session Details
                  </span>
                  <div className="space-y-2 text-slate-400">
                    <div className="flex justify-between">
                      <span>Target Role:</span>
                      <span className="text-white font-semibold">{selectedJob?.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Target Company:</span>
                      <span className="text-white font-semibold">{selectedJob?.company}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Questions Planned:</span>
                      <span className="text-white font-semibold">{activeSession.total_target_questions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Questions Answered:</span>
                      <span className="text-emerald-400 font-bold">
                        {activeSession.turns.filter((t) => t.candidate_answer).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
