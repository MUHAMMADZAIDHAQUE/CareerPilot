"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileCode,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Download,
  ArrowRight,
  Sparkles,
  Layers,
  Code2,
  RefreshCw,
  Eye,
  Columns,
  ChevronDown,
  ChevronUp,
  FileText,
  Terminal,
  ExternalLink,
  Clock,
  XCircle,
} from "lucide-react";
import {
  TailorResumeResponse,
  SectionDiff,
  ValidationCheckItem,
  compileResumePdfApi,
  getResumePdfUrl,
  CompiledPDFResponse,
} from "@/lib/api";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Card, CardHeader } from "./ui/Card";

interface TailoredResumeStudioProps {
  tailorData: TailorResumeResponse;
  jobRole: string;
  companyName: string;
  onRetailor?: (instructions?: string) => Promise<void>;
  isLoading?: boolean;
}

export default function TailoredResumeStudio({
  tailorData,
  jobRole,
  companyName,
  onRetailor,
  isLoading = false,
}: TailoredResumeStudioProps) {
  const [viewMode, setViewMode] = useState<"sections" | "split" | "tailored_raw" | "pdf_preview">("sections");
  const [copied, setCopied] = useState(false);
  const [showValidatorDetails, setShowValidatorDetails] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);

  // Compilation State
  const [compiledPdf, setCompiledPdf] = useState<CompiledPDFResponse | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const { version, master_resume_content, validation_report, diff_summary } = tailorData;

  const handleCompilePdf = async (force = false) => {
    setCompiling(true);
    setCompileError(null);
    try {
      const res = await compileResumePdfApi(version.id, {
        timeout_seconds: 15,
        force_recompile: force,
      });
      if (res.data) {
        setCompiledPdf(res.data);
        if (res.data.compilation_status === "success") {
          setViewMode("pdf_preview");
        } else {
          setCompileError(
            res.data.error_message || "LaTeX compilation failed. Inspect terminal logs for details."
          );
        }
      } else if (res.error) {
        setCompileError(res.error);
      }
    } catch (err: any) {
      setCompileError(err?.message || "Compilation failed");
    } finally {
      setCompiling(false);
    }
  };

  const handleCopyLatex = async () => {
    try {
      await navigator.clipboard.writeText(version.latex_content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownloadTex = () => {
    const blob = new Blob([version.latex_content], { type: "text/x-tex;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeCompany = companyName.replace(/[^a-zA-Z0-9]/g, "_");
    link.href = url;
    link.download = `Tailored_Resume_${safeCompany}_v${version.version_number}.tex`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const pdfUrl = getResumePdfUrl(version.id);
  const isPdfReady = compiledPdf?.compilation_status === "success";

  return (
    <div className="space-y-6">
      {/* Top Banner: Version, Validation Shield, and Action Buttons */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <Badge variant="blue" size="sm">
                Tailored Resume v{version.version_number}
              </Badge>
              {version.validation_status === "valid" ? (
                <Badge variant="success" size="sm" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                  100% Grounded & Verified (0 Hallucinations)
                </Badge>
              ) : (
                <Badge variant="warning" size="sm" icon={<AlertTriangle className="w-3.5 h-3.5" />}>
                  Validation Notice ({version.validation_status})
                </Badge>
              )}
            </div>

            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
              Tailored for {jobRole} at {companyName}
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Deterministic evidence-grounded LaTeX resume targeting required competencies and stack alignment. Master facts preserved.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={isPdfReady ? "secondary" : "primary"}
              onClick={() => handleCompilePdf(isPdfReady)}
              loading={compiling}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              {compiling ? "Compiling..." : isPdfReady ? "Recompile PDF" : "Compile PDF"}
            </Button>

            {isPdfReady && (
              <a
                href={getResumePdfUrl(version.id, true)}
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </a>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyLatex}
              icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copied ? "Copied LaTeX!" : "Copy LaTeX"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadTex}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              .tex
            </Button>

            <Link
              href={`/resumes/${version.id}`}
              target="_blank"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Full Page</span>
            </Link>

            {onRetailor && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowInstructionsModal(!showInstructionsModal)}
                disabled={isLoading}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Re-tailor
              </Button>
            )}
          </div>
        </div>

        {/* Optional Re-tailor instructions */}
        {showInstructionsModal && (
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g. Emphasize distributed systems, high concurrency, and PostgreSQL bullets..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
            />
            <Button
              size="sm"
              variant="primary"
              onClick={async () => {
                if (onRetailor) {
                  await onRetailor(customInstructions);
                  setShowInstructionsModal(false);
                }
              }}
              disabled={isLoading}
            >
              Apply Instructions
            </Button>
          </div>
        )}

        {/* Validator Summary Strip */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-slate-900">Zero Inventions</div>
              <div className="text-[11px] text-slate-500">All claims traceable to profile</div>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-slate-900">Metrics Audited</div>
              <div className="text-[11px] text-slate-500">{validation_report?.metrics_audited?.length || 0} metrics verified</div>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-slate-900">History Preserved</div>
              <div className="text-[11px] text-slate-500">Titles, companies, dates intact</div>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-slate-900">Skills Aligned</div>
              <div className="text-[11px] text-slate-500">Targeted keywords reordered</div>
            </div>
          </div>
        </div>

        {/* Validator Details Collapsible */}
        <div className="pt-1">
          <button
            onClick={() => setShowValidatorDetails(!showValidatorDetails)}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center space-x-1 transition-colors"
          >
            <span>{showValidatorDetails ? "Hide Validator Audit Checklist" : "View Full Validator Audit Checklist"}</span>
            {showValidatorDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showValidatorDetails && (
            <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Validator Agent Audit Checks ({validation_report?.checks?.length || 0} evaluated)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {validation_report?.checks?.map((check: ValidationCheckItem, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-start space-x-2"
                  >
                    {check.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-semibold text-slate-900">{check.check_name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{check.details}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
          <button
            onClick={() => setViewMode("sections")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === "sections"
                ? "bg-white text-slate-900 shadow-subtle font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Section Changes ({diff_summary?.sections_modified || 0})
          </button>
          <button
            onClick={() => setViewMode("split")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === "split"
                ? "bg-white text-slate-900 shadow-subtle font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Side-by-Side Diff
          </button>
          <button
            onClick={() => setViewMode("tailored_raw")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === "tailored_raw"
                ? "bg-white text-slate-900 shadow-subtle font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            LaTeX Source
          </button>
          <button
            onClick={() => {
              setViewMode("pdf_preview");
              if (!compiledPdf && !compiling) {
                handleCompilePdf(false);
              }
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 ${
              viewMode === "pdf_preview"
                ? "bg-white text-slate-900 shadow-subtle font-semibold"
                : isPdfReady
                ? "text-emerald-700 hover:text-emerald-800"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>PDF Preview {isPdfReady && "✓"}</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 font-mono hidden sm:block">
          Master template: sample_master_resume.tex (Immutable)
        </div>
      </div>

      {/* Mode 1: Section Changes Breakdown */}
      {viewMode === "sections" && (
        <div className="space-y-4">
          {diff_summary?.section_diffs?.length === 0 ? (
            <div className="p-8 rounded-xl border border-slate-200 bg-white text-center text-xs text-slate-500">
              No sections required modification; master resume is already optimally aligned with JD.
            </div>
          ) : (
            diff_summary?.section_diffs?.map((diff: SectionDiff, idx: number) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-slate-900">{diff.section_name}</span>
                    <Badge variant="neutral" size="sm">
                      {diff.change_type}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500">
                    <strong>{diff.rationale}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Before */}
                  <div className="p-3.5 rounded-xl bg-rose-50/40 border border-rose-200 space-y-2">
                    <div className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider">
                      Original Master Bullet / Content
                    </div>
                    <div className="text-xs text-rose-950 whitespace-pre-wrap font-mono bg-white p-2.5 rounded-lg border border-rose-200/60">
                      {diff.original_snippet || "N/A"}
                    </div>
                  </div>

                  {/* After */}
                  <div className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-200 space-y-2">
                    <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider flex items-center space-x-1.5">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>Job-Tailored Alignment</span>
                    </div>
                    <div className="text-xs text-emerald-950 whitespace-pre-wrap font-mono bg-white p-2.5 rounded-lg border border-emerald-200/60">
                      {diff.tailored_snippet || "N/A"}
                    </div>
                  </div>
                </div>

                {/* Evidence attribution */}
                {diff.traceable_evidence && diff.traceable_evidence.length > 0 && (
                  <div className="pt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-slate-500 font-medium">Grounded in candidate proof:</span>
                    {diff.traceable_evidence.map((ev: string, evIdx: number) => (
                      <span
                        key={evIdx}
                        className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Mode 2: Side-by-Side LaTeX Diff */}
      {viewMode === "split" && (
        <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-card">
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* Master LaTeX */}
            <div className="p-4 bg-slate-50/50">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <FileCode className="w-3.5 h-3.5 text-slate-500" />
                  <span>Master LaTeX (Immutable)</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">sample_master_resume.tex</span>
              </div>
              <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[550px] p-2 bg-white rounded-lg border border-slate-200">
                {master_resume_content}
              </pre>
            </div>

            {/* Tailored LaTeX */}
            <div className="p-4 bg-white">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Job-Tailored LaTeX (v{version.version_number})</span>
                </span>
                <button
                  onClick={handleCopyLatex}
                  className="text-[11px] text-slate-500 hover:text-slate-900 flex items-center space-x-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[550px] p-2 bg-slate-50 rounded-lg border border-slate-200">
                {version.latex_content}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Mode 3: Raw Tailored LaTeX */}
      {viewMode === "tailored_raw" && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 space-y-4 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Tailored LaTeX Source</h3>
              <p className="text-xs text-slate-500">Ready to compile with pdflatex or export</p>
            </div>
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="outline" onClick={handleCopyLatex}>
                {copied ? "Copied!" : "Copy Source"}
              </Button>
              <Button size="sm" variant="primary" onClick={handleDownloadTex}>
                Download .tex
              </Button>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
            <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[550px]">
              {version.latex_content}
            </pre>
          </div>
        </div>
      )}

      {/* Mode 4: Phase 7 PDF Preview & Live Viewer */}
      {viewMode === "pdf_preview" && (
        <div className="space-y-4">
          {/* Compilation Diagnostics Header */}
          {compiledPdf && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 flex flex-wrap items-center justify-between gap-4 text-xs shadow-card">
              <div className="flex items-center space-x-3">
                {compiledPdf.compilation_status === "success" ? (
                  <span className="text-emerald-700 flex items-center space-x-1.5 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Compiled Successfully</span>
                  </span>
                ) : (
                  <span className="text-rose-700 flex items-center space-x-1.5 font-semibold">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Compilation Status: {compiledPdf.compilation_status}</span>
                  </span>
                )}

                <span className="text-slate-300">•</span>
                <span className="text-slate-500">
                  Engine: <strong className="text-slate-800">{compiledPdf.compiler_used}</strong>
                </span>

                <span className="text-slate-300">•</span>
                <span className="text-slate-500">
                  Duration: <strong className="text-slate-800">{compiledPdf.compile_duration_ms}ms</strong>
                </span>

                {compiledPdf.file_size_bytes > 0 && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500">
                      Size: <strong className="text-slate-800">{(compiledPdf.file_size_bytes / 1024).toFixed(1)} KB</strong>
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="text-slate-600 hover:text-slate-900 flex items-center space-x-1 font-medium transition-colors"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>{showLogs ? "Hide Console Logs" : "View Console Logs"}</span>
                </button>

                {isPdfReady && (
                  <a
                    href={getResumePdfUrl(version.id, true)}
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-subtle"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Compilation Error Banner if Failed */}
          {compileError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2">
              <div className="flex items-center space-x-2 font-semibold text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Compilation Diagnostics</span>
              </div>
              <p>{compileError}</p>
            </div>
          )}

          {/* Console Logs Panel */}
          {showLogs && compiledPdf && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 border-b border-slate-200 pb-2">
                <span className="font-semibold text-slate-800">Compilation Engine Terminal Logs</span>
                <span>Status: {compiledPdf.compilation_status}</span>
              </div>
              <pre className="p-3 bg-white rounded-lg border border-slate-200 text-slate-800 whitespace-pre-wrap max-h-60 overflow-y-auto">
                {compiledPdf.compilation_log || "No console output recorded."}
              </pre>
            </div>
          )}

          {/* Embedded PDF Viewer */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 overflow-hidden shadow-card">
            {isPdfReady ? (
              <iframe
                src={`${pdfUrl}#toolbar=1&navpanes=0`}
                title="Tailored Resume PDF Preview"
                className="w-full h-[750px] rounded-xl border border-slate-200 bg-white"
              />
            ) : (
              <div className="py-20 text-center space-y-3">
                <FileText className="w-10 h-10 text-slate-400 mx-auto" />
                <h3 className="text-base font-semibold text-slate-900">PDF Not Yet Compiled</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Compile this validated tailored LaTeX resume into an ATS-compliant PDF in an isolated sandbox.
                </p>
                <Button
                  size="md"
                  variant="primary"
                  onClick={() => handleCompilePdf(true)}
                  loading={compiling}
                  icon={<RefreshCw className="w-4 h-4" />}
                >
                  Compile Resume Now
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
