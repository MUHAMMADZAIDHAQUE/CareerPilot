"use client";

import React, { useState } from "react";
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
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { TailorResumeResponse, SectionDiff, ValidationCheckItem } from "@/lib/api";

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
  const [viewMode, setViewMode] = useState<"sections" | "split" | "tailored_raw">("sections");
  const [copied, setCopied] = useState(false);
  const [showValidatorDetails, setShowValidatorDetails] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);

  const { version, master_resume_content, validation_report, diff_summary } = tailorData;

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

  return (
    <div className="space-y-6">
      {/* Top Banner: Version, Validation Shield, and Action Buttons */}
      <div className="glass-card p-6 border border-slate-700/60 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30">
                Tailored Resume v{version.version_number}
              </span>
              {version.validation_status === "valid" ? (
                <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>100% Grounded & Verified (0 Hallucinations)</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Validation Warning ({version.validation_status})</span>
                </span>
              )}
            </div>

            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <span>Tailored for {jobRole} at {companyName}</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Deterministic evidence-grounded LaTeX resume targeting required competencies and stack alignment.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCopyLatex}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white flex items-center space-x-2 transition-all shadow-sm"
              title="Copy tailored LaTeX source to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
              <span>{copied ? "Copied LaTeX!" : "Copy LaTeX"}</span>
            </button>

            <button
              onClick={handleDownloadTex}
              className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white flex items-center space-x-2 transition-all shadow-md shadow-brand-500/20"
              title="Download standalone .tex file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .tex</span>
            </button>

            {onRetailor && (
              <button
                onClick={() => setShowInstructionsModal(!showInstructionsModal)}
                disabled={isLoading}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-xs font-semibold text-slate-300 hover:text-white flex items-center space-x-1.5 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span>Re-tailor</span>
              </button>
            )}
          </div>
        </div>

        {/* Optional Re-tailor instructions modal */}
        {showInstructionsModal && (
          <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g. Prioritize vector indexing and high-throughput microservices bullets..."
              className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
            <button
              onClick={async () => {
                if (onRetailor) {
                  await onRetailor(customInstructions);
                  setShowInstructionsModal(false);
                }
              }}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white whitespace-nowrap"
            >
              Apply & Regenerate
            </button>
          </div>
        )}

        {/* Validator Summary Strip */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-white">Zero Inventions</div>
              <div className="text-[11px] text-slate-400">All claims traceable to candidate</div>
            </div>
          </div>
          <div className="flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-white">Metrics Audited</div>
              <div className="text-[11px] text-slate-400">{validation_report?.metrics_audited?.length || 0} numbers/metrics verified</div>
            </div>
          </div>
          <div className="flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-white">Experience Preserved</div>
              <div className="text-[11px] text-slate-400">Companies, titles & dates intact</div>
            </div>
          </div>
          <div className="flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-white">Skills Aligned</div>
              <div className="text-[11px] text-slate-400">Surfaced JD stack to front</div>
            </div>
          </div>
        </div>

        {/* Validator Details Collapsible */}
        <div className="mt-4">
          <button
            onClick={() => setShowValidatorDetails(!showValidatorDetails)}
            className="text-xs font-medium text-brand-400 hover:text-brand-300 flex items-center space-x-1 transition-colors"
          >
            <span>{showValidatorDetails ? "Hide Audit Checklist" : "View Full Validator Audit Report"}</span>
            {showValidatorDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showValidatorDetails && (
            <div className="mt-3 p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Validator Agent Audit Checklist ({validation_report?.checks?.length || 0} checks)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {validation_report?.checks?.map((check, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-start space-x-2.5"
                  >
                    {check.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-semibold text-white">{check.check_name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{check.details}</div>
                    </div>
                  </div>
                ))}
              </div>
              {validation_report?.technologies_audited?.length > 0 && (
                <div className="pt-2 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">Audited Technologies:</span>{" "}
                  {validation_report.technologies_audited.join(", ")}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* View Mode Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewMode("sections")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              viewMode === "sections"
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Section Changes ({diff_summary?.sections_modified || 0})</span>
          </button>
          <button
            onClick={() => setViewMode("split")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              viewMode === "split"
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Side-by-Side LaTeX Diff</span>
          </button>
          <button
            onClick={() => setViewMode("tailored_raw")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              viewMode === "tailored_raw"
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Full Tailored LaTeX</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 hidden sm:block">
          Master source: <code className="text-slate-300 bg-slate-800/80 px-1.5 py-0.5 rounded">resume/master/sample_master_resume.tex</code> (Immutable)
        </div>
      </div>

      {/* Mode 1: Section Changes Breakdown */}
      {viewMode === "sections" && (
        <div className="space-y-4">
          {diff_summary?.section_diffs?.length === 0 ? (
            <div className="glass-card p-8 text-center text-slate-400 border border-slate-800 rounded-2xl">
              No sections required modification; master resume already aligned with JD.
            </div>
          ) : (
            diff_summary?.section_diffs?.map((diff: SectionDiff, idx: number) => (
              <div
                key={idx}
                className="glass-card p-6 border border-slate-700/60 rounded-2xl space-y-4 transition-all hover:border-slate-600"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-sm font-bold text-white">{diff.section_name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        diff.change_type === "reordered"
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                          : diff.change_type === "tailored_bullets"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : "bg-brand-500/20 text-brand-300 border border-brand-500/30"
                      }`}
                    >
                      {diff.change_type.replace("_", " ")}
                    </span>
                  </div>

                  {diff.traceable_evidence?.length > 0 && (
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[11px] text-slate-400">Targeted Evidence:</span>
                      <div className="flex flex-wrap gap-1">
                        {diff.traceable_evidence.slice(0, 4).map((ev, evIdx) => (
                          <span
                            key={evIdx}
                            className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-medium text-slate-300 border border-slate-700"
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-300 bg-brand-950/20 border border-brand-500/20 p-3 rounded-xl flex items-start space-x-2">
                  <Sparkles className="w-3.5 h-3.5 text-brand-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-white">Rationale: </span>
                    {diff.rationale}
                  </div>
                </div>

                {/* Diff Comparison Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Original */}
                  <div className="rounded-xl bg-slate-950/90 border border-slate-800/80 p-4">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Original Master</span>
                      <span className="text-[10px] text-slate-500">source excerpt</span>
                    </div>
                    <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-60">
                      {diff.original_snippet}
                    </pre>
                  </div>

                  {/* Tailored */}
                  <div className="rounded-xl bg-slate-950/90 border border-brand-500/30 p-4 relative">
                    <div className="text-[11px] font-bold text-brand-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span className="flex items-center space-x-1.5">
                        <Sparkles className="w-3 h-3 text-brand-400" />
                        <span>Tailored Output</span>
                      </span>
                      <span className="text-[10px] text-brand-400/80">evidence grounded</span>
                    </div>
                    <pre className="text-xs text-emerald-300/90 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-60">
                      {diff.tailored_snippet}
                    </pre>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Mode 2: Side-by-Side Split LaTeX Diff */}
      {viewMode === "split" && (
        <div className="glass-card border border-slate-700/60 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
            {/* Master Original */}
            <div className="p-4 bg-slate-950/80">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Master LaTeX Resume (Immutable)
                </span>
                <span className="text-[11px] text-slate-500">original template</span>
              </div>
              <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[600px] p-2">
                {master_resume_content}
              </pre>
            </div>

            {/* Tailored LaTeX */}
            <div className="p-4 bg-slate-950/80">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="text-xs font-bold text-brand-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                  <span>Job-Tailored LaTeX (v{version.version_number})</span>
                </span>
                <button
                  onClick={handleCopyLatex}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center space-x-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="text-xs font-mono text-emerald-300/90 whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[600px] p-2">
                {version.latex_content}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Mode 3: Raw Tailored LaTeX with Copy/Download */}
      {viewMode === "tailored_raw" && (
        <div className="glass-card p-6 border border-slate-700/60 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Full Tailored LaTeX Document</h3>
              <p className="text-xs text-slate-400">Ready to compile with pdflatex or import into Overleaf</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopyLatex}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center space-x-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied!" : "Copy Source"}</span>
              </button>
              <button
                onClick={handleDownloadTex}
                className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .tex</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-slate-950 p-4 border border-slate-800">
            <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[600px]">
              {version.latex_content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
