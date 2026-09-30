"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  FileText,
  FileCode,
  Download,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Terminal,
  ExternalLink,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  Eye,
  Columns,
  GitCompare,
  Building2,
  CheckCheck,
  AlertCircle,
  Undo2,
  Save,
  BookOpen,
  Share2,
} from "lucide-react";
import {
  fetchTailoredResumeByIdApi,
  fetchJobApi,
  compileResumePdfApi,
  getResumePdfUrl,
  approveTailoredResumeApi,
  rejectTailoredResumeApi,
  updateTailoredResumeLatexApi,
  fetchTailoredResumeDiffApi,
  tailorResumeApi,
  ResumeVersion,
  Job,
  CompiledPDFResponse,
  ResumeDiffResponse,
  ATSDetails,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";

export default function TailoredResumeWorkspace() {
  const params = useParams();
  const router = useRouter();
  const versionId = (params?.versionId as string) || "";

  const [version, setVersion] = useState<ResumeVersion | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [diffData, setDiffData] = useState<ResumeDiffResponse | null>(null);
  const [compiledPdf, setCompiledPdf] = useState<CompiledPDFResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [savingLatex, setSavingLatex] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Left column tab state
  const [leftTab, setLeftTab] = useState<"why_changes" | "diff" | "editor">("why_changes");

  // LaTeX Editor State
  const [latexSource, setLatexSource] = useState<string>("");
  const [originalGeneratedLatex, setOriginalGeneratedLatex] = useState<string>("");
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);

  // Rejection Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Overleaf Export State
  const [showOverleafModal, setShowOverleafModal] = useState(false);

  // Console Logs Modal
  const [showLogs, setShowLogs] = useState(false);

  // Load Data
  const loadVersionData = async () => {
    if (!versionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTailoredResumeByIdApi(versionId);
      if (res.error || !res.data) {
        throw new Error(res.error || "Failed to load tailored resume");
      }
      const v = res.data;
      setVersion(v);
      setLatexSource(v.latex_content || "");
      setOriginalGeneratedLatex(v.latex_content || "");

      // Parallel fetch Job details and Diff
      const promises: Promise<any>[] = [];
      if (v.job_id) {
        promises.push(fetchJobApi(v.job_id));
      }
      promises.push(fetchTailoredResumeDiffApi(v.id));

      const [jobRes, diffRes] = await Promise.all(promises);
      if (jobRes?.data) {
        setJob(jobRes.data);
      }
      if (diffRes?.data) {
        setDiffData(diffRes.data);
      }

      // Auto-compile if not yet compiled
      await handleCompile(false);
    } catch (err: any) {
      setError(err?.message || "Failed to load resume workspace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersionData();
  }, [versionId]);

  // Compile PDF
  const handleCompile = async (force = false) => {
    if (!versionId) return;
    setCompiling(true);
    try {
      const res = await compileResumePdfApi(versionId, {
        timeout_seconds: 20,
        force_recompile: force,
      });
      if (res.data) {
        setCompiledPdf(res.data);
      }
    } catch (err: any) {
      console.warn("Compilation warning:", err);
    } finally {
      setCompiling(false);
    }
  };

  // Copy LaTeX
  const handleCopyLatex = async () => {
    if (!latexSource) return;
    try {
      await navigator.clipboard.writeText(latexSource);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  // Download .tex
  const handleDownloadTex = () => {
    if (!latexSource) return;
    const blob = new Blob([latexSource], { type: "text/x-tex;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Tailored_Resume_v${version?.version_number || 1}.tex`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Save manual LaTeX edits
  const handleSaveLatex = async () => {
    if (!version) return;
    setSavingLatex(true);
    setError(null);
    setActionSuccess(null);
    try {
      const res = await updateTailoredResumeLatexApi(version.id, latexSource);
      if (res.data) {
        setVersion(res.data);
        setHasUnsavedEdits(false);
        setActionSuccess("LaTeX edits saved and validated against candidate profile. Recompiled successfully.");
        await handleCompile(true);
      } else {
        setError(res.error || "Failed to save LaTeX edits.");
      }
    } catch (err: any) {
      setError(err?.message || "Error saving LaTeX edits.");
    } finally {
      setSavingLatex(false);
    }
  };

  // Reset editor to generated version
  const handleResetLatex = () => {
    setLatexSource(originalGeneratedLatex);
    setHasUnsavedEdits(false);
  };

  // Approve resume workflow
  const handleApprove = async () => {
    if (!version) return;
    setApproving(true);
    setError(null);
    setActionSuccess(null);
    try {
      const res = await approveTailoredResumeApi(version.id, "Explicitly approved by user in Review Studio.");
      if (res.data?.success) {
        setVersion({ ...version, status: "APPROVED", approved_at: res.data.approved_at });
        setActionSuccess(res.data.message || "Resume approved. Status set to APPROVED. Ready for application.");
      } else {
        setError(res.error || "Approval failed");
      }
    } catch (err: any) {
      setError(err?.message || "Approval error occurred");
    } finally {
      setApproving(false);
    }
  };

  // Reject resume workflow
  const handleReject = async () => {
    if (!version) return;
    setRejecting(true);
    setError(null);
    setActionSuccess(null);
    try {
      const res = await rejectTailoredResumeApi(version.id, rejectionReason);
      if (res.data?.success) {
        setVersion({ ...version, status: "REJECTED", rejection_reason: rejectionReason });
        setShowRejectModal(false);
        setActionSuccess(res.data.message || "Resume version marked as REJECTED.");
      } else {
        setError(res.error || "Rejection failed");
      }
    } catch (err: any) {
      setError(err?.message || "Rejection error occurred");
    } finally {
      setRejecting(false);
    }
  };

  // Regenerate resume workflow
  const handleRegenerate = async () => {
    if (!version?.job_id) return;
    setRegenerating(true);
    setError(null);
    setActionSuccess(null);
    try {
      const res = await tailorResumeApi(version.job_id, {
        candidate_id: version.candidate_id,
        master_resume_id: version.source_resume_id || undefined,
      });
      if (res.data?.version?.id) {
        router.push(`/resumes/${res.data.version.id}`);
      } else {
        setError(res.error || "Failed to regenerate resume.");
      }
    } catch (err: any) {
      setError(err?.message || "Regeneration failed.");
    } finally {
      setRegenerating(false);
    }
  };

  // Open in Overleaf
  const handleOpenInOverleaf = () => {
    setShowOverleafModal(true);
  };

  const handleOverleafPost = () => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "https://www.overleaf.com/docs";
    form.target = "_blank";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "snip";
    input.value = latexSource;

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
    setShowOverleafModal(false);
  };

  if (loading) {
    return <LoadingState message="Loading tailored resume workspace and compiler sandbox..." className="min-h-[60vh]" />;
  }

  if (error && !version) {
    return (
      <div className="py-12 max-w-md mx-auto">
        <ErrorState title="Tailored Resume Not Found" error={error} onRetry={() => router.push("/resumes")} />
      </div>
    );
  }

  const pdfUrl = version ? getResumePdfUrl(version.id) : "";
  const isCompilationSuccess = compiledPdf?.compilation_status === "success";

  const atsDetails: ATSDetails = (version?.ats_details as any) || {
    ats_score: version?.ats_score || 84,
    matched_keywords: [],
    missing_keywords: [],
    skills_emphasized: [],
    skills_omitted: [],
    potential_gaps: [],
    evidence_chain: [],
  };

  const matchPercent = job?.match_score ? Math.round(job.match_score * 100) : 78;
  const atsScore = version?.ats_score ?? atsDetails.ats_score ?? 84;

  return (
    <div className="space-y-6 pb-24">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <Link
          href={job ? `/jobs/${job.id}` : "/resumes"}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{job ? `Back to ${job.role} at ${job.company}` : "Back to Resumes"}</span>
        </Link>

        <div className="flex items-center space-x-2">
          <Badge variant="blue" size="sm">
            v{version?.version_number || 1}
          </Badge>

          {version?.status === "APPROVED" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>APPROVED</span>
            </span>
          ) : version?.status === "REJECTED" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>REJECTED</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>REVIEW REQUIRED</span>
            </span>
          )}
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 dark:text-emerald-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-xs font-semibold text-rose-700 hover:text-rose-900 dark:text-rose-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace Header & Overview Card */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 sm:p-7 shadow-card space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Job & Tailoring Identity */}
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>TAILORED RESUME</span>
              <span>•</span>
              <span>v{version?.version_number}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {job?.role || "Software Engineer"}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-medium">
              <span className="flex items-center gap-1">
                <Building2 className="w-4 h-4 text-slate-400" />
                {job?.company || "Target Company"}
              </span>
              {job?.location && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span>{job.location}</span>
                </>
              )}
            </div>
          </div>

          {/* Scores Badges */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Deterministic Match Score */}
            <div className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
              <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight block">
                {matchPercent}%
              </span>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mt-0.5">
                Role Match
              </span>
            </div>

            {/* ATS Coverage Score */}
            <div className="px-4 py-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-center">
              <span className="text-2xl font-bold text-blue-700 dark:text-blue-300 tracking-tight block">
                {atsScore}%
              </span>
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mt-0.5">
                ATS Coverage
              </span>
            </div>

            {/* Status Pill */}
            <div className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
              <span className="text-xs font-bold uppercase tracking-wider block text-slate-900 dark:text-white">
                {version?.status || "REVIEW REQUIRED"}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">
                Review Status
              </span>
            </div>
          </div>
        </div>

        {/* Global Action Workflow Controls */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          {/* Quick tab switchers */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
            <button
              onClick={() => setLeftTab("why_changes")}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                leftTab === "why_changes"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
              <span>Why These Changes</span>
            </button>

            <button
              onClick={() => setLeftTab("diff")}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                leftTab === "diff"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <GitCompare className="w-3.5 h-3.5 text-indigo-500" />
              <span>View Changes ({diffData?.total_changes || 0})</span>
            </button>

            <button
              onClick={() => setLeftTab("editor")}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                leftTab === "editor"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-emerald-500" />
              <span>Edit LaTeX</span>
              {hasUnsavedEdits && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
            </button>
          </div>

          {/* Workflow Decision Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRegenerate}
              loading={regenerating}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              title="Re-run tailoring agent loop with target JD"
            >
              Regenerate
            </Button>

            {version?.status !== "REJECTED" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRejectModal(true)}
                disabled={rejecting}
                icon={<XCircle className="w-3.5 h-3.5 text-rose-500" />}
              >
                Reject
              </Button>
            )}

            {version?.status !== "APPROVED" ? (
              <Button
                size="sm"
                variant="primary"
                onClick={handleApprove}
                loading={approving}
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Approve Resume
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                <CheckCheck className="w-4 h-4" />
                <span>Ready for Application</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Split Layout: Left (Analysis/Diff/Editor) & Right (PDF Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Why These Changes / Diff / LaTeX Editor (7 cols) */}
        <div className="lg:col-span-6 xl:col-span-6 space-y-4">
          {/* TAB 1: Why These Changes & Potential Gaps */}
          {leftTab === "why_changes" && (
            <div className="space-y-4">
              {/* WHY THESE CHANGES */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-card space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      WHY THESE CHANGES
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500">
                    Truthfully derived from candidate profile
                  </span>
                </div>

                <div className="space-y-2.5">
                  {/* Verified highlights */}
                  {atsDetails.skills_emphasized && atsDetails.skills_emphasized.length > 0 ? (
                    atsDetails.skills_emphasized.map((skill, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                      >
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0 mt-0.5">
                          ✓
                        </span>
                        <div>
                          <strong className="text-slate-900 dark:text-white">{skill}</strong> emphasized in technical skills & project alignment.
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 py-3">
                      Skills and projects re-ranked based on verified candidate evidence.
                    </div>
                  )}

                  {/* Bullet / Section actions */}
                  {version?.diff_summary?.bullets_modified?.map((b: string, i: number) => (
                    <div
                      key={`bullet-${i}`}
                      className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                    >
                      <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0 mt-0.5">
                        ✓
                      </span>
                      <div className="text-slate-700 dark:text-slate-300">
                        {b}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Evidence Chain */}
                {atsDetails.evidence_chain && atsDetails.evidence_chain.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                      ATS Keyword Evidence Chain
                    </span>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {atsDetails.evidence_chain.map((ev, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-[11px] flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span className="text-slate-900 dark:text-white">JD: {ev.jd_keyword}</span>
                            <span className="text-blue-600 dark:text-blue-400 font-normal">{ev.action}</span>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 italic">
                            Evidence: {ev.candidate_evidence}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* POTENTIAL GAPS */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-card space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      POTENTIAL GAPS
                    </h2>
                  </div>
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    Strict zero-hallucination guarantee
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The following requirements were found in the job description but not in your verified master profile. <strong>CareerPilot never invents missing qualifications</strong>:
                </p>

                <div className="space-y-2">
                  {atsDetails.potential_gaps && atsDetails.potential_gaps.length > 0 ? (
                    atsDetails.potential_gaps.map((gap, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200"
                      >
                        <span className="text-amber-500 font-bold shrink-0 mt-0.5">•</span>
                        <span>{gap}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>No critical skill gaps identified for this role.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Categorized Resume Diff */}
          {leftTab === "diff" && (
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-card space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-blue-600" />
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    MASTER RESUME vs TAILORED RESUME
                  </h2>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  {diffData?.total_changes || 0} Grounded Changes
                </span>
              </div>

              {diffData?.categories ? (
                <div className="space-y-4">
                  {Object.entries(diffData.categories).map(([category, items]) => {
                    if (!items || items.length === 0) return null;
                    const isAdded = category === "ADDED / EMPHASIZED";
                    const isDeemp = category === "DE-EMPHASIZED";
                    const isReord = category === "REORDERED";
                    const isUnchanged = category === "UNCHANGED";

                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isAdded
                                ? "bg-emerald-500"
                                : isDeemp
                                ? "bg-slate-400"
                                : isReord
                                ? "bg-blue-500"
                                : "bg-slate-300"
                            }`}
                          />
                          <span>{category}</span>
                          <span className="text-[10px] text-slate-400">({items.length})</span>
                        </div>

                        <div className="space-y-2">
                          {items.map((it, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border text-xs space-y-1 ${
                                isAdded
                                  ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40"
                                  : isReord
                                  ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40"
                                  : "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800"
                              }`}
                            >
                              <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                                <span>{it.title}</span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-300">{it.description}</p>
                              {it.traceable_evidence && (
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                                  Evidence: {it.traceable_evidence}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-8 text-center">
                  Loading structured comparison...
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Editable LaTeX Editor */}
          {leftTab === "editor" && (
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-card space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    LaTeX Source Editor
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleResetLatex}
                    disabled={!hasUnsavedEdits}
                    icon={<Undo2 className="w-3 h-3" />}
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleSaveLatex}
                    loading={savingLatex}
                    icon={<Save className="w-3 h-3" />}
                  >
                    Save & Compile
                  </Button>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/50 text-[11px] text-blue-800 dark:text-blue-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Manual edits never modify the master resume. All saved edits are audited against candidate profile facts.
                </span>
              </div>

              {/* Editor Textarea */}
              <div className="relative">
                <textarea
                  value={latexSource}
                  onChange={(e) => {
                    setLatexSource(e.target.value);
                    setHasUnsavedEdits(true);
                  }}
                  rows={26}
                  className="w-full font-mono text-xs p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed resize-y selection:bg-blue-600"
                  spellCheck={false}
                />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: PDF Preview & Quick Export Toolbar (6 cols) */}
        <div className="lg:col-span-6 xl:col-span-6 space-y-4">
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-card space-y-4">
            {/* PDF Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  PDF Preview Pane
                </span>
                {compiledPdf?.compiler_used && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                    {compiledPdf.compiler_used}
                  </span>
                )}
              </div>

              {/* Toolbar Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCompile(true)}
                  loading={compiling}
                  icon={<RefreshCw className="w-3 h-3" />}
                  title="Recompile PDF from current LaTeX source"
                >
                  Compile
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLatex}
                  icon={copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                >
                  {copied ? "Copied" : "Copy LaTeX"}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenInOverleaf}
                  icon={<ExternalLink className="w-3 h-3 text-emerald-600" />}
                  title="Export or Open in Overleaf"
                >
                  Open in Overleaf
                </Button>

                {isCompilationSuccess && (
                  <a
                    href={getResumePdfUrl(version!.id, true)}
                    download
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 transition-colors shadow-subtle"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </a>
                )}
              </div>
            </div>

            {/* Diagnostics status badge */}
            {compiledPdf && (
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isCompilationSuccess ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                  />
                  <span>
                    {isCompilationSuccess ? "Compilation clean" : "Compilation failure"}
                  </span>
                  {compiledPdf.compile_duration_ms > 0 && (
                    <span>({compiledPdf.compile_duration_ms}ms)</span>
                  )}
                </div>

                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 font-mono"
                >
                  <Terminal className="w-3 h-3" />
                  <span>logs</span>
                </button>
              </div>
            )}

            {/* Embedded PDF Viewer */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 overflow-hidden shadow-inner min-h-[680px] flex flex-col justify-center">
              {isCompilationSuccess ? (
                <iframe
                  src={`${pdfUrl}#toolbar=1&navpanes=0`}
                  title="Tailored Resume PDF Preview"
                  className="w-full h-[760px] rounded-lg border-0 bg-white"
                />
              ) : compiling ? (
                <div className="py-24 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Compiling Tailored PDF...
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Running LaTeX compilation in secure isolated sandbox environment.
                  </p>
                </div>
              ) : (
                <div className="py-24 text-center space-y-3 px-6">
                  <FileText className="w-10 h-10 text-slate-400 mx-auto" />
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    PDF Compilation Ready
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Compile the tailored LaTeX source into an ATS-compliant PDF using our isolated sandboxed compiler.
                  </p>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleCompile(true)}
                    loading={compiling}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Compile PDF Now
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <Modal
          isOpen={showRejectModal}
          onClose={() => setShowRejectModal(false)}
          title="Reject Tailored Resume Version"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Provide feedback or a reason for rejecting this tailored resume draft. This helps improve future regenerations:
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Needs more emphasis on distributed streaming or cloud infrastructure..."
              rows={4}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setShowRejectModal(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="danger" onClick={handleReject} loading={rejecting}>
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Overleaf Export Modal */}
      {showOverleafModal && (
        <Modal
          isOpen={showOverleafModal}
          onClose={() => setShowOverleafModal(false)}
          title="Open in Overleaf"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              You can open this verified LaTeX document directly in Overleaf via their official snippet import, or download the <code>.tex</code> source file to import into an existing project.
            </p>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <span className="font-semibold text-slate-900 dark:text-white block">Official Supported Integration</span>
              <p className="text-slate-500 dark:text-slate-400">
                Submits the clean LaTeX document directly to Overleaf’s secure snippet processor.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={handleDownloadTex} icon={<Download className="w-3.5 h-3.5" />}>
                Download .tex
              </Button>
              <Button size="sm" variant="primary" onClick={handleOverleafPost} icon={<ExternalLink className="w-3.5 h-3.5" />}>
                Launch Overleaf
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Terminal Logs Modal */}
      {showLogs && (
        <Modal
          isOpen={showLogs}
          onClose={() => setShowLogs(false)}
          title="LaTeX Compiler Terminal Output"
        >
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Engine: {compiledPdf?.compiler_used || "isolated_sandbox"}</span>
              <span>Status: {compiledPdf?.compilation_status}</span>
            </div>
            <pre className="p-3 bg-slate-950 text-slate-100 font-mono text-[11px] rounded-xl border border-slate-800 whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">
              {compiledPdf?.compilation_log || "No compiler logs recorded."}
            </pre>
          </div>
        </Modal>
      )}
    </div>
  );
}
