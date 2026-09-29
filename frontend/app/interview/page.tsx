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
  }, []);

  // Fetch prep kit when job changes
  useEffect(() => {
    if (!selectedJobId) return;
    const found = jobs.find((j) => j.id === selectedJobId);
    if (found) setSelectedJob(found);

    async function loadPrepKit() {
      setPrepLoading(true);
      setPrepError(null);
      try {
        const res = await fetchInterviewPrepApi(selectedJobId);
        if (res.data) {
          setPrepKit(res.data);
        } else {
          setPrepError(res.error || "Failed to load prep kit");
        }
      } catch (err: any) {
        setPrepError(err?.message || "Error generating prep kit");
      } finally {
        setPrepLoading(false);
      }
    }
    loadPrepKit();
  }, [selectedJobId]);

  // Start a new mock interview session
  const handleStartMockInterview = async () => {
    if (!selectedJob) return;
    setSessionLoading(true);
    setActiveTab("simulator");
    try {
      const res = await startInterviewSessionApi({
        job_id: selectedJob.id,
      });
      if (res.data) {
        setActiveSession(res.data);
        setElapsedSeconds(0);
        setTimerActive(true);
      }
    } catch (err) {
      console.error("Failed to start session:", err);
    } finally {
      setSessionLoading(false);
    }
  };

  // Submit answer
  const handleSubmitAnswer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeSession || !candidateAnswer.trim() || submittingAnswer) return;

    setSubmittingAnswer(true);
    try {
      const res = await submitInterviewAnswerApi(activeSession.id, candidateAnswer.trim());
      if (res.data) {
        setActiveSession(res.data);
        setCandidateAnswer("");
      }
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  // Finish session
  const handleFinishSession = async () => {
    if (!activeSession) return;
    setTimerActive(false);
    setSessionLoading(true);
    try {
      const res = await finishInterviewSessionApi(activeSession.id);
      if (res.data) {
        setActiveSession(res.data);
      }
    } catch (err) {
      console.error("Finish error:", err);
    } finally {
      setSessionLoading(false);
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-slate-500" />
            <span>AI Mock Interview Simulator • Real Rubric Scoring</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Interview Preparation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Grounded in your job description, resume projects, and verified technical competencies.
          </p>
        </div>

        {/* Job Selector Dropdown */}
        <div className="w-full sm:w-72">
          <Select
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
      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("prep_kit")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "prep_kit"
              ? "border-slate-900 text-slate-900 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Curated Question Bank</span>
        </button>

        <button
          onClick={() => setActiveTab("simulator")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "simulator"
              ? "border-slate-900 text-slate-900 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Play className="w-4 h-4" />
          <span>Live AI Mock Interviewer</span>
          {activeSession && activeSession.status === "IN_PROGRESS" && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
          )}
        </button>
      </div>

      {/* VIEW 1: PREPARATION QUESTION KIT */}
      {activeTab === "prep_kit" && (
        <div className="space-y-6">
          {/* Action Hero Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
                Target Interview Kit: {selectedJob?.role || "Software Engineer"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedJob?.company} • Technical rubrics, behavioral STAR prompts, and architecture topics.
              </p>
            </div>

            <Button
              size="md"
              variant="primary"
              onClick={handleStartMockInterview}
              icon={<Play className="w-4 h-4" />}
            >
              Start Mock Interview
            </Button>
          </div>

          {/* Section Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
            <button
              onClick={() => setQuestionCategory("technical")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                questionCategory === "technical"
                  ? "bg-white text-slate-900 shadow-subtle font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Technical Questions ({prepKit?.technical_questions?.length || 0})
            </button>
            <button
              onClick={() => setQuestionCategory("behavioral")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                questionCategory === "behavioral"
                  ? "bg-white text-slate-900 shadow-subtle font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Behavioral ({prepKit?.behavioral_questions?.length || 0})
            </button>
            <button
              onClick={() => setQuestionCategory("project")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                questionCategory === "project"
                  ? "bg-white text-slate-900 shadow-subtle font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Project Questions ({prepKit?.project_questions?.length || 0})
            </button>
            <button
              onClick={() => setQuestionCategory("company")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                questionCategory === "company"
                  ? "bg-white text-slate-900 shadow-subtle font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Company Questions ({prepKit?.jd_specific_questions?.length || 0})
            </button>
            <button
              onClick={() => setQuestionCategory("weak_areas")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                questionCategory === "weak_areas"
                  ? "bg-white text-slate-900 shadow-subtle font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Weak Areas & Gaps
            </button>
          </div>

          {/* Questions List */}
          {prepLoading ? (
            <LoadingState message="Synthesizing role-specific interview question kit..." />
          ) : prepError ? (
            <ErrorState title="Failed to load interview questions" error={prepError} />
          ) : (
            <div className="space-y-3">
              {questionCategory === "technical" &&
                prepKit?.technical_questions?.map((q, idx) => (
                  <Card key={idx} className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="blue" size="sm">
                            {q.topic}
                          </Badge>
                          <Badge variant="neutral" size="sm">
                            {q.difficulty}
                          </Badge>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900">{q.question}</h3>
                      </div>
                      <button
                        onClick={() =>
                          setExpandedQuestionId(expandedQuestionId === `tech-${idx}` ? null : `tech-${idx}`)
                        }
                        className="p-1 rounded text-slate-400 hover:text-slate-700"
                      >
                        {expandedQuestionId === `tech-${idx}` ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {expandedQuestionId === `tech-${idx}` && (
                      <div className="mt-3 pt-3 border-t border-slate-100 text-xs space-y-2 text-slate-600">
                        {q.sample_good_points && q.sample_good_points.length > 0 && (
                          <div>
                            <strong className="text-slate-900 block mb-1">Key Talking Points:</strong>
                            <ul className="list-disc pl-4 space-y-0.5">
                              {q.sample_good_points.map((pt, pidx) => (
                                <li key={pidx}>{pt}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {q.context_source && (
                          <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 font-mono text-[11px]">
                            <strong className="text-slate-800">Context Source:</strong>{" "}
                            {q.context_source}
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                ))}

              {questionCategory === "behavioral" &&
                prepKit?.behavioral_questions?.map((q, idx) => (
                  <Card key={idx} className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Badge variant="neutral" size="sm" className="mb-1">
                          {q.competency}
                        </Badge>
                        <h3 className="text-sm font-semibold text-slate-900">{q.question}</h3>
                      </div>
                    </div>
                    {q.star_framework_tip && (
                      <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1">
                        <strong className="text-slate-900 block">STAR Strategy:</strong>
                        {q.star_framework_tip.Situation && <p><span className="font-semibold text-slate-700">Situation:</span> {q.star_framework_tip.Situation}</p>}
                        {q.star_framework_tip.Task && <p><span className="font-semibold text-slate-700">Task:</span> {q.star_framework_tip.Task}</p>}
                        {q.star_framework_tip.Action && <p><span className="font-semibold text-slate-700">Action:</span> {q.star_framework_tip.Action}</p>}
                        {q.star_framework_tip.Result && <p><span className="font-semibold text-slate-700">Result:</span> {q.star_framework_tip.Result}</p>}
                      </div>
                    )}
                  </Card>
                ))}

              {questionCategory === "project" &&
                prepKit?.project_questions?.map((q, idx) => (
                  <Card key={idx} className="space-y-2">
                    <Badge variant="neutral" size="sm" className="mb-1">
                      {q.project_name}
                    </Badge>
                    <h3 className="text-sm font-semibold text-slate-900">{q.question}</h3>
                    {q.rationale && (
                      <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                        <strong>Rationale:</strong> {q.rationale}
                      </p>
                    )}
                  </Card>
                ))}

              {questionCategory === "company" &&
                prepKit?.jd_specific_questions?.map((q, idx) => (
                  <Card key={idx} className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-900">{q.question}</h3>
                    {q.why_asked && (
                      <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                        <strong>Why Asked:</strong> {q.why_asked}
                      </p>
                    )}
                  </Card>
                ))}

              {questionCategory === "weak_areas" && (
                <Card className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900">Identified Weak Areas & Risk Questions</h3>
                  <p className="text-xs text-slate-600">
                    Questions addressing technologies or requirements where your profile has lower coverage.
                  </p>
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
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
              <GraduationCap className="w-12 h-12 text-slate-400 mx-auto" />
              <h3 className="text-base font-semibold text-slate-900">
                Ready to Start Your Mock Interview?
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                The AI interviewer will ask questions based on {selectedJob?.role} specifications, listen to your answers, and grade technical precision turn-by-turn.
              </p>
              <Button
                size="md"
                variant="primary"
                onClick={handleStartMockInterview}
                loading={sessionLoading}
                icon={<Play className="w-4 h-4" />}
              >
                Begin Simulation
              </Button>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Simulator Header Strip */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center space-x-3">
                  <span className="font-semibold text-slate-900">
                    {activeSession.role || selectedJob?.role} at {activeSession.company_name || selectedJob?.company}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1 font-mono text-slate-600">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatTimer(elapsedSeconds)}</span>
                  </span>
                  <span className="text-slate-300">•</span>
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
                      Finish Interview Early
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

              {/* Turns History */}
              <div className="space-y-4">
                {activeSession.turns?.map((turn: InterviewTurn, idx: number) => (
                  <div key={turn.id || idx} className="space-y-3">
                    {/* Interviwer Question */}
                    <div className="flex items-start space-x-3 max-w-3xl">
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        AI
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 leading-relaxed shadow-subtle">
                        <span className="font-semibold block text-[11px] text-slate-500 uppercase tracking-wider mb-1">
                          Interviewer (Turn {turn.turn_index + 1})
                        </span>
                        {turn.question}
                      </div>
                    </div>

                    {/* Candidate Answer */}
                    {turn.candidate_answer && (
                      <div className="flex items-start justify-end space-x-3 pl-12">
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs text-slate-800 leading-relaxed shadow-card max-w-3xl">
                          <span className="font-semibold block text-[11px] text-slate-500 uppercase tracking-wider mb-1">
                            Your Response
                          </span>
                          {turn.candidate_answer}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                          You
                        </div>
                      </div>
                    )}

                    {/* Turn Feedback & Rubric */}
                    {turn.evaluation && (
                      <div className="ml-11 max-w-3xl p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                          <span>Evaluation: {Math.round(turn.evaluation.overall_score > 1 ? turn.evaluation.overall_score : turn.evaluation.overall_score * 100)}%</span>
                          <span>Clarity: {turn.evaluation.clarity}/10</span>
                          <span>Accuracy: {turn.evaluation.technical_accuracy}/10</span>
                        </div>
                        <p className="text-slate-600 text-[11px]">{turn.evaluation.feedback}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Answer Input Box if in progress */}
              {activeSession.status === "IN_PROGRESS" && (
                <form onSubmit={handleSubmitAnswer} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card space-y-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Your Response
                  </label>
                  <textarea
                    rows={4}
                    value={candidateAnswer}
                    onChange={(e) => setCandidateAnswer(e.target.value)}
                    placeholder="Structure your answer using the STAR method or clear architecture trade-offs. Press Cmd+Enter to send..."
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        handleSubmitAnswer();
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 leading-relaxed"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      Shortcut: <kbd className="px-1.5 py-0.5 rounded bg-slate-100 font-mono">Cmd+Enter</kbd>
                    </span>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      loading={submittingAnswer}
                      disabled={!candidateAnswer.trim()}
                      icon={<Send className="w-3.5 h-3.5" />}
                    >
                      Submit Response
                    </Button>
                  </div>
                </form>
              )}

              {/* Final Summary Card when completed */}
              {activeSession.status === "COMPLETED" && (
                <Card className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        Interview Simulation Complete
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Completed in {formatTimer(elapsedSeconds)} • Overall Score: {Math.round((activeSession.final_feedback?.overall_score ? (activeSession.final_feedback.overall_score > 1 ? activeSession.final_feedback.overall_score / 100 : activeSession.final_feedback.overall_score) : 0.8) * 100)}%
                      </p>
                    </div>
                    <Badge variant="success" size="md">
                      Graded
                    </Badge>
                  </div>

                  {activeSession.final_feedback && (
                    <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-200">
                      {typeof activeSession.final_feedback === "string"
                        ? activeSession.final_feedback
                        : JSON.stringify(activeSession.final_feedback, null, 2)}
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
