"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  GraduationCap,
  Sparkles,
  Play,
  RotateCcw,
  Send,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  RefreshCw,
  StopCircle,
  Check,
  ArrowRight,
  Flame,
  Target,
  Sliders,
} from "lucide-react";
import {
  fetchJobsApi,
  Job,
  fetchInterviewPrepApi,
  startInterviewSessionApi,
  submitInterviewAnswerApi,
  finishInterviewSessionApi,
  listInterviewSessionsApi,
  InterviewPreparation,
  InterviewSession,
  InterviewTurn,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/States";

function InterviewPrepContent() {
  const searchParams = useSearchParams();
  const initialJobId = searchParams.get("job_id") || "";

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Setup options
  const [interviewType, setInterviewType] = useState<string>("Technical & Architecture");
  const [difficultyLevel, setDifficultyLevel] = useState<string>("Senior Engineer");

  // Active view: question kit or live mock interview
  const [activeTab, setActiveTab] = useState<"prep_kit" | "simulator">("prep_kit");
  const [questionCategory, setQuestionCategory] = useState<
    "technical" | "behavioral" | "project" | "company" | "weak_areas"
  >("technical");

  // Prep Kit State
  const [prepKit, setPrepKit] = useState<InterviewPreparation | null>(null);
  const [prepLoading, setPrepLoading] = useState<boolean>(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  // Simulator State
  const [activeSession, setActiveSession] = useState<InterviewSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState<boolean>(false);
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
        if (!selectedJobId) {
          setSelectedJobId(res.data[0].id);
          setSelectedJob(res.data[0]);
        } else {
          const found = res.data.find((j) => j.id === selectedJobId);
          if (found) setSelectedJob(found);
        }
      }
    }
    loadJobs();
  }, [selectedJobId]);

  // Load Prep Kit when job changes
  useEffect(() => {
    if (!selectedJobId) return;
    const found = jobs.find((j) => j.id === selectedJobId);
    if (found) setSelectedJob(found);

    async function loadKit() {
      setPrepLoading(true);
      setPrepError(null);
      const res = await fetchInterviewPrepApi(selectedJobId);
      setPrepLoading(false);
      if (res.data) {
        setPrepKit(res.data);
      } else {
        setPrepError(res.error || "Failed to load interview prep kit");
      }
    }
    loadKit();
  }, [selectedJobId, jobs]);

  // Start Live Mock Session
  const handleStartMockInterview = async () => {
    if (!selectedJobId) return;
    setSessionLoading(true);
    setElapsedSeconds(0);
    setTimerActive(true);

    const res = await startInterviewSessionApi({
      job_id: selectedJobId,
    });
    setSessionLoading(false);

    if (res.data) {
      setActiveSession(res.data);
      setActiveTab("simulator");
      setCandidateAnswer("");
    } else {
      alert(res.error || "Failed to start mock interview session");
      setTimerActive(false);
    }
  };

  // Submit Turn Answer
  const handleSubmitAnswer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeSession || !candidateAnswer.trim() || submittingAnswer) return;

    setSubmittingAnswer(true);
    const res = await submitInterviewAnswerApi(activeSession.id, candidateAnswer.trim());
    setSubmittingAnswer(false);

    if (res.data) {
      setActiveSession(res.data);
      setCandidateAnswer("");
      if (res.data.status === "COMPLETED") {
        setTimerActive(false);
      }
    } else {
      alert(res.error || "Failed to submit answer");
    }
  };

  // Finish early
  const handleFinishSession = async () => {
    if (!activeSession) return;
    setSessionLoading(true);
    const res = await finishInterviewSessionApi(activeSession.id);
    setSessionLoading(false);
    if (res.data) {
      setActiveSession(res.data);
      setTimerActive(false);
    }
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-10 sm:space-y-12 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold mb-2">
            <GraduationCap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>AI Mock Interview Simulator • Real Rubric Scoring</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Interview Preparation
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Practice role-specific technical, behavioral, and architecture questions with turn-by-turn AI feedback.
          </p>
        </div>

        {/* Job Selector Dropdown */}
        <div className="w-full sm:w-80">
          <Select
            label="Target Position"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.role} at {j.company}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Main Tabs: Question Kit vs Live Simulator */}
      <div className="flex items-center space-x-3 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("prep_kit")}
          className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "prep_kit"
              ? "border-slate-900 dark:border-white text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Curated Question Bank</span>
        </button>

        <button
          onClick={() => setActiveTab("simulator")}
          className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "simulator"
              ? "border-slate-900 dark:border-white text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Play className="w-4 h-4 text-blue-500" />
          <span>Live Mock Interview Room</span>
          {activeSession && activeSession.status === "IN_PROGRESS" && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
          )}
        </button>
      </div>

      {/* VIEW 1: PREPARATION QUESTION KIT */}
      {activeTab === "prep_kit" && (
        <div className="space-y-6">
          {/* Action Hero Setup Card */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 sm:p-7 shadow-card dark:shadow-none space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {selectedJob?.role || "Software Engineer"}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {selectedJob?.company} • Technical rubrics, behavioral STAR prompts, and architecture topics.
                </p>
              </div>

              <Button
                size="md"
                variant="primary"
                onClick={handleStartMockInterview}
                icon={<Play className="w-4 h-4" />}
              >
                START MOCK INTERVIEW
              </Button>
            </div>

            {/* Simulation Configuration Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <Select
                label="Interview Focus Track"
                value={interviewType}
                onChange={(e) => setInterviewType(e.target.value)}
              >
                <option value="Technical & Architecture">Technical Architecture & Coding Patterns</option>
                <option value="Behavioral (STAR)">Behavioral & Leadership (STAR Method)</option>
                <option value="System Design">Distributed System Design & Scalability</option>
                <option value="Company Fit">Company Culture & Mission Alignment</option>
              </Select>

              <Select
                label="Target Seniority Level"
                value={difficultyLevel}
                onChange={(e) => setDifficultyLevel(e.target.value)}
              >
                <option value="Mid-Level Engineer">Mid-Level Software Engineer (2–4 YOE)</option>
                <option value="Senior Engineer">Senior Software Engineer (5–8 YOE)</option>
                <option value="Staff / Principal">Staff / Principal Architect (8+ YOE)</option>
                <option value="Junior / New Grad">Junior / Associate Engineer</option>
              </Select>
            </div>
          </div>

          {/* Question Category Navigation */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setQuestionCategory("technical")}
              className={`px-3.5 py-2 rounded-xl font-medium transition-all ${
                questionCategory === "technical"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-subtle font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Technical Questions ({prepKit?.technical_questions?.length || 0})
            </button>
            <button
              onClick={() => setQuestionCategory("behavioral")}
              className={`px-3.5 py-2 rounded-xl font-medium transition-all ${
                questionCategory === "behavioral"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-subtle font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Behavioral ({prepKit?.behavioral_questions?.length || 0})
            </button>
            <button
              onClick={() => setQuestionCategory("project")}
              className={`px-3.5 py-2 rounded-xl font-medium transition-all ${
                questionCategory === "project"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-subtle font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Project Proof ({prepKit?.project_questions?.length || 0})
            </button>
            <button
              onClick={() => setQuestionCategory("company")}
              className={`px-3.5 py-2 rounded-xl font-medium transition-all ${
                questionCategory === "company"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-subtle font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Company Fit ({prepKit?.jd_specific_questions?.length || 0})
            </button>
            <button
              onClick={() => setQuestionCategory("weak_areas")}
              className={`px-3.5 py-2 rounded-xl font-medium transition-all ${
                questionCategory === "weak_areas"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-subtle font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Risk & Weak Areas
            </button>
          </div>

          {/* Questions List */}
          {prepLoading ? (
            <LoadingState message="Synthesizing role-specific interview question kit..." />
          ) : prepError ? (
            <ErrorState title="Failed to load interview questions" error={prepError} />
          ) : (
            <div className="space-y-3.5">
              {questionCategory === "technical" &&
                prepKit?.technical_questions?.map((q, idx) => (
                  <Card key={idx} className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant="blue" size="sm">
                            {q.topic}
                          </Badge>
                          <Badge variant="neutral" size="sm">
                            {q.difficulty}
                          </Badge>
                        </div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-snug">
                          {q.question}
                        </h3>
                      </div>
                      <button
                        onClick={() =>
                          setExpandedQuestionId(expandedQuestionId === `tech-${idx}` ? null : `tech-${idx}`)
                        }
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        {expandedQuestionId === `tech-${idx}` ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {expandedQuestionId === `tech-${idx}` && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs space-y-2 text-slate-600 dark:text-slate-300">
                        {q.sample_good_points && q.sample_good_points.length > 0 && (
                          <div>
                            <strong className="text-slate-900 dark:text-white block mb-1">
                              Key Talking Points:
                            </strong>
                            <ul className="list-disc pl-4 space-y-0.5">
                              {q.sample_good_points.map((pt, pidx) => (
                                <li key={pidx}>{pt}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {q.context_source && (
                          <p className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700 font-mono text-[11px]">
                            <strong className="text-slate-800 dark:text-slate-200">Context Source:</strong>{" "}
                            {q.context_source}
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                ))}

              {questionCategory === "behavioral" &&
                prepKit?.behavioral_questions?.map((q, idx) => (
                  <Card key={idx} className="space-y-3">
                    <Badge variant="neutral" size="sm" className="mb-1">
                      {q.competency}
                    </Badge>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-snug">
                      {q.question}
                    </h3>
                    {q.star_framework_tip && (
                      <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1.5 leading-relaxed">
                        <strong className="text-slate-900 dark:text-white block">STAR Strategy:</strong>
                        {q.star_framework_tip.Situation && (
                          <p><span className="font-semibold text-slate-700 dark:text-slate-300">Situation:</span> {q.star_framework_tip.Situation}</p>
                        )}
                        {q.star_framework_tip.Task && (
                          <p><span className="font-semibold text-slate-700 dark:text-slate-300">Task:</span> {q.star_framework_tip.Task}</p>
                        )}
                        {q.star_framework_tip.Action && (
                          <p><span className="font-semibold text-slate-700 dark:text-slate-300">Action:</span> {q.star_framework_tip.Action}</p>
                        )}
                        {q.star_framework_tip.Result && (
                          <p><span className="font-semibold text-slate-700 dark:text-slate-300">Result:</span> {q.star_framework_tip.Result}</p>
                        )}
                      </div>
                    )}
                  </Card>
                ))}

              {questionCategory === "project" &&
                prepKit?.project_questions?.map((q, idx) => (
                  <Card key={idx} className="space-y-2">
                    <Badge variant="blue" size="sm" className="mb-1">
                      {q.project_name}
                    </Badge>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-snug">
                      {q.question}
                    </h3>
                    {q.rationale && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
                        <strong>Rationale:</strong> {q.rationale}
                      </p>
                    )}
                  </Card>
                ))}

              {questionCategory === "company" &&
                prepKit?.jd_specific_questions?.map((q, idx) => (
                  <Card key={idx} className="space-y-2">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-snug">
                      {q.question}
                    </h3>
                    {q.why_asked && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
                        <strong>Why Asked:</strong> {q.why_asked}
                      </p>
                    )}
                  </Card>
                ))}

              {questionCategory === "weak_areas" && (
                <Card className="space-y-3">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Identified Risk Areas & Skill Gaps
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Questions addressing technologies or requirements where your profile has lower coverage.
                  </p>
                  <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs sm:text-sm leading-relaxed">
                    Interviewers frequently probe requirements where candidate proof is emerging. Practice bridging to analogous architectures you have built.
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: INTERACTIVE LIVE MOCK SIMULATOR */}
      {activeTab === "simulator" && (
        <div className="space-y-6">
          {!activeSession ? (
            <Card className="text-center py-16 space-y-4">
              <GraduationCap className="w-14 h-14 text-slate-400 dark:text-slate-500 mx-auto" />
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Ready to Start Your Mock Interview?
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  The AI interviewer will ask questions based on {selectedJob?.role} specifications, listen to your answers, and grade technical precision turn-by-turn.
                </p>
              </div>
              <Button
                size="md"
                variant="primary"
                onClick={handleStartMockInterview}
                loading={sessionLoading}
                icon={<Play className="w-4 h-4" />}
              >
                START MOCK INTERVIEW
              </Button>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Simulator Header Strip */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-card dark:shadow-none flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm">
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {activeSession.role || selectedJob?.role} at {activeSession.company_name || selectedJob?.company}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="flex items-center gap-1.5 font-mono text-slate-600 dark:text-slate-300">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>{formatTimer(elapsedSeconds)}</span>
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <Badge variant={activeSession.status === "COMPLETED" ? "success" : "blue"} size="sm">
                    {activeSession.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  {activeSession.status === "IN_PROGRESS" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleFinishSession}
                      disabled={sessionLoading}
                      icon={<StopCircle className="w-3.5 h-3.5" />}
                    >
                      Finish Interview
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleStartMockInterview}
                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                  >
                    Restart
                  </Button>
                </div>
              </div>

              {/* Conversational Turns History */}
              <div className="space-y-5">
                {activeSession.turns?.map((turn: InterviewTurn, idx: number) => (
                  <div key={turn.id || idx} className="space-y-3">
                    {/* Interviewer Question */}
                    <div className="flex items-start space-x-3.5 max-w-3xl">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center text-xs font-bold shrink-0">
                        AI
                      </div>
                      <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white leading-relaxed shadow-subtle">
                        <span className="font-semibold block text-[11px] text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                          Interviewer (Turn {turn.turn_index + 1})
                        </span>
                        {turn.question}
                      </div>
                    </div>

                    {/* Candidate Answer */}
                    {turn.candidate_answer && (
                      <div className="flex items-start justify-end space-x-3.5 pl-12">
                        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 leading-relaxed shadow-card dark:shadow-none max-w-3xl">
                          <span className="font-semibold block text-[11px] text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            Your Response
                          </span>
                          {turn.candidate_answer}
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold shrink-0">
                          You
                        </div>
                      </div>
                    )}

                    {/* Turn Feedback & Rubric */}
                    {turn.evaluation && (
                      <div className="ml-12 max-w-3xl p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-500 dark:text-slate-400 block">Overall Fit</span>
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              {Math.round(turn.evaluation.overall_score > 1 ? turn.evaluation.overall_score : turn.evaluation.overall_score * 100)}%
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-500 dark:text-slate-400 block">Clarity</span>
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              {turn.evaluation.clarity}/10
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-500 dark:text-slate-400 block">Accuracy</span>
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              {turn.evaluation.technical_accuracy}/10
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="font-semibold text-slate-900 dark:text-white text-xs block">
                            AI Feedback & Recommendations:
                          </span>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {turn.evaluation.feedback}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Answer Input Box */}
              {activeSession.status === "IN_PROGRESS" && (
                <form
                  onSubmit={handleSubmitAnswer}
                  className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-card dark:shadow-none space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                      Your Answer
                    </label>
                    <span className="text-xs text-slate-400 font-mono">
                      Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Cmd+Enter</kbd> to submit
                    </span>
                  </div>

                  <textarea
                    rows={5}
                    value={candidateAnswer}
                    onChange={(e) => setCandidateAnswer(e.target.value)}
                    placeholder="Structure your response clearly. Cite specific system design decisions, algorithmic trade-offs, or STAR situation/action/result metrics..."
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        handleSubmitAnswer();
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed"
                  />

                  <div className="flex items-center justify-end pt-1">
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      loading={submittingAnswer}
                      disabled={!candidateAnswer.trim()}
                      icon={<Send className="w-4 h-4" />}
                    >
                      Submit Response
                    </Button>
                  </div>
                </form>
              )}

              {/* Final Summary Card when completed */}
              {activeSession.status === "COMPLETED" && (
                <Card className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Interview Simulation Complete
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Duration: {formatTimer(elapsedSeconds)} • All rubric criteria scored
                      </p>
                    </div>
                    <Badge variant="success" size="md">
                      Graded
                    </Badge>
                  </div>

                  {activeSession.final_feedback && (
                    <div className="space-y-4">
                      {typeof activeSession.final_feedback === "object" ? (
                        <>
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                            {activeSession.final_feedback.overall_score != null && (
                              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overall Performance Score</span>
                                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                  {Math.round(activeSession.final_feedback.overall_score)}/100
                                </span>
                              </div>
                            )}
                            {activeSession.final_feedback.summary && (
                              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                {activeSession.final_feedback.summary}
                              </p>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {Array.isArray(activeSession.final_feedback.strengths) && activeSession.final_feedback.strengths.length > 0 && (
                              <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 space-y-2">
                                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                  <span>Demonstrated Strengths</span>
                                </h4>
                                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                                  {activeSession.final_feedback.strengths.map((s: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-1.5">
                                      <span className="text-emerald-600 font-bold">•</span>
                                      <span>{s}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {Array.isArray(activeSession.final_feedback.weak_areas) && activeSession.final_feedback.weak_areas.length > 0 && (
                              <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2">
                                <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                  <span>Areas for Improvement</span>
                                </h4>
                                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                                  {activeSession.final_feedback.weak_areas.map((w: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-1.5">
                                      <span className="text-amber-600 font-bold">•</span>
                                      <span>{w}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {Array.isArray(activeSession.final_feedback.recommendations) && activeSession.final_feedback.recommendations.length > 0 && (
                            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-2">
                              <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                <span>Actionable Recommendations</span>
                              </h4>
                              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                                {activeSession.final_feedback.recommendations.map((r: string, idx: number) => (
                                  <li key={idx} className="flex items-start gap-1.5">
                                    <span className="text-blue-600 font-bold">•</span>
                                    <span>{r}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                          {activeSession.final_feedback}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-end">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={handleStartMockInterview}
                      icon={<RotateCcw className="w-3.5 h-3.5" />}
                    >
                      Practice Another Round
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function InterviewPrepPage() {
  return (
    <React.Suspense fallback={<LoadingState message="Loading interview preparation workspace..." className="min-h-[50vh]" />}>
      <InterviewPrepContent />
    </React.Suspense>
  );
}
