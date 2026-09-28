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
  Sliders,
} from "lucide-react";
import {
  compileResumePdfApi,
  getResumePdfUrl,
  CompiledPDFResponse,
  ResumeVersion,
} from "@/lib/api";

const BASE_HOST = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function ResumePreviewPage() {
  const params = useParams();
  const router = useRouter();
  const versionId = (params?.versionId as string) || "";

  const [version, setVersion] = useState<ResumeVersion | null>(null);
  const [compiledPdf, setCompiledPdf] = useState<CompiledPDFResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "latex" | "logs">("preview");
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  // Fetch resume version metadata
  useEffect(() => {
    async function loadVersion() {
      if (!versionId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${BASE_HOST}/api/resumes/versions/${encodeURIComponent(versionId)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`Failed to load resume version (${res.status})`);
        }
        const data: ResumeVersion = await res.json();
        setVersion(data);

        // Attempt compilation or fetch cached PDF automatically
        await handleCompile(false);
      } catch (err: any) {
        setError(err.message || "Failed to load resume version");
      } finally {
        setLoading(false);
      }
    }
    loadVersion();
  }, [versionId]);

  const handleCompile = async (force = false) => {
    if (!versionId) return;
    setCompiling(true);
    setError(null);
    try {
      const res = await compileResumePdfApi(versionId, {
        timeout_seconds: 15,
        force_recompile: force,
      });
      if (res.data) {
        setCompiledPdf(res.data);
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err?.message || "Compilation failed");
    } finally {
      setCompiling(false);
    }
  };

  const handleCopyLatex = async () => {
    if (!version?.latex_content) return;
    try {
      await navigator.clipboard.writeText(version.latex_content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownloadTex = () => {
    if (!version?.latex_content) return;
    const blob = new Blob([version.latex_content], { type: "text/x-tex;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Tailored_Resume_v${version.version_number}.tex`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
        <p className="text-sm text-slate-400">Loading resume version and initializing compilation sandbox...</p>
      </div>
    );
  }

  if (error && !version) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col items-center justify-center">
        <div className="max-w-md w-full glass-card p-6 border border-rose-500/30 rounded-2xl text-center space-y-4">
          <XCircle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Resume Version Not Found</h2>
          <p className="text-sm text-slate-400">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition-all inline-flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    );
  }

  const pdfUrl = version ? getResumePdfUrl(version.id) : "";
  const isCompilationSuccess = compiledPdf?.compilation_status === "success";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Top Navbar */}
      <div className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Job & Tailoring Studio</span>
          </button>

          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30">
              Resume v{version?.version_number || 1}
            </span>

            {version?.validation_status === "valid" ? (
              <span className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>100% Grounded</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Action Header Card */}
        <div className="glass-card p-6 border border-slate-800 rounded-2xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center space-x-2 text-xs font-medium text-brand-400 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>CareerPilot LaTeX Compilation Service</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Tailored Resume PDF Preview & Download
              </h1>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Compiled in an isolated sandbox environment with strict execution guards. High-fidelity ATS-compliant typography.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleCompile(true)}
                disabled={compiling}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white flex items-center space-x-2 transition-all shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${compiling ? "animate-spin text-brand-400" : "text-slate-300"}`} />
                <span>{compiling ? "Compiling..." : "Recompile PDF"}</span>
              </button>

              <button
                onClick={handleCopyLatex}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white flex items-center space-x-2 transition-all shadow-sm"
                title="Copy LaTeX source"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
                <span>{copied ? "Copied!" : "Copy LaTeX"}</span>
              </button>

              <button
                onClick={handleDownloadTex}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white flex items-center space-x-2 transition-all shadow-sm"
              >
                <FileCode className="w-3.5 h-3.5 text-slate-300" />
                <span>.tex File</span>
              </button>

              {isCompilationSuccess && version && (
                <a
                  href={getResumePdfUrl(version.id, true)}
                  download
                  className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white flex items-center space-x-2 transition-all shadow-lg shadow-brand-500/25"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </a>
              )}
            </div>
          </div>

          {/* Compilation Diagnostics Bar */}
          {compiledPdf && (
            <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center space-x-4">
                <span className="flex items-center space-x-1.5 font-medium">
                  {compiledPdf.compilation_status === "success" ? (
                    <span className="text-emerald-400 flex items-center space-x-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Compiled Successfully</span>
                    </span>
                  ) : compiledPdf.compilation_status === "security_violation" ? (
                    <span className="text-rose-400 flex items-center space-x-1">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Security Violation Blocked</span>
                    </span>
                  ) : compiledPdf.compilation_status === "timeout" ? (
                    <span className="text-amber-400 flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>Compilation Timed Out</span>
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center space-x-1">
                      <XCircle className="w-4 h-4" />
                      <span>Compilation Failed</span>
                    </span>
                  )}
                </span>

                <span className="text-slate-500">•</span>
                <span className="text-slate-400">
                  Engine: <strong className="text-slate-200">{compiledPdf.compiler_used}</strong>
                </span>

                <span className="text-slate-500">•</span>
                <span className="text-slate-400">
                  Duration: <strong className="text-slate-200">{compiledPdf.compile_duration_ms}ms</strong>
                </span>

                {compiledPdf.file_size_bytes > 0 && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">
                      Size: <strong className="text-slate-200">{(compiledPdf.file_size_bytes / 1024).toFixed(1)} KB</strong>
                    </span>
                  </>
                )}
              </div>

              <button
                onClick={() => setShowLogs(!showLogs)}
                className="text-brand-400 hover:text-brand-300 flex items-center space-x-1 font-semibold transition-colors"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>{showLogs ? "Hide Compilation Logs" : "View Compilation Logs"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Detailed Compilation Error Banner if Failed */}
        {compiledPdf && compiledPdf.compilation_status !== "success" && (
          <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 space-y-3">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-white">
                  Compilation Diagnostic: {compiledPdf.error_details?.error_type || "Compilation Failure"}
                </h3>
                <p className="text-xs text-rose-300 mt-1">
                  {compiledPdf.error_details?.message || compiledPdf.error_message || "The LaTeX document could not be compiled."}
                </p>

                {compiledPdf.error_details?.line_number && (
                  <div className="mt-2 text-xs font-mono bg-slate-900/90 p-2.5 rounded-lg border border-rose-500/20 text-rose-300">
                    <span className="text-slate-400">Line {compiledPdf.error_details.line_number}:</span>{" "}
                    <code>{compiledPdf.error_details.snippet}</code>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Compilation Terminal Logs Drawer */}
        {showLogs && compiledPdf && (
          <div className="glass-card p-4 border border-slate-800 rounded-2xl space-y-2 bg-slate-950/95 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
              <span className="flex items-center space-x-1.5 font-semibold text-slate-200">
                <Terminal className="w-4 h-4 text-brand-400" />
                <span>LaTeX Compiler Console Logs</span>
              </span>
              <span>Status: {compiledPdf.compilation_status}</span>
            </div>
            <pre className="p-3 bg-black/60 rounded-xl text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-72 leading-relaxed">
              {compiledPdf.compilation_log || "No log captured."}
            </pre>
          </div>
        )}

        {/* View Mode Tab Switcher */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab("preview")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                activeTab === "preview" ? "bg-brand-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Interactive PDF Preview</span>
            </button>
            <button
              onClick={() => setActiveTab("latex")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                activeTab === "latex" ? "bg-brand-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>LaTeX Source Code</span>
            </button>
          </div>

          <div className="text-xs text-slate-400">
            Master Resume: <code className="text-slate-300 bg-slate-800/80 px-1.5 py-0.5 rounded">resume/master/sample_master_resume.tex</code> (Immutable)
          </div>
        </div>

        {/* Tab 1: PDF Preview Viewer */}
        {activeTab === "preview" && (
          <div className="glass-card p-4 border border-slate-800 rounded-2xl bg-slate-900/60 overflow-hidden shadow-2xl">
            {isCompilationSuccess ? (
              <div className="w-full">
                <iframe
                  src={`${pdfUrl}#toolbar=1&navpanes=0`}
                  title="Tailored Resume PDF Preview"
                  className="w-full h-[850px] rounded-xl border border-slate-800 bg-white"
                />
              </div>
            ) : (
              <div className="py-24 text-center space-y-4">
                <FileText className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-white">No PDF Available to Preview</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {compiling
                    ? "Compilation in progress..."
                    : "The resume has not been compiled yet or the last attempt failed. Click below to trigger compilation."}
                </p>
                <button
                  onClick={() => handleCompile(true)}
                  disabled={compiling}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white inline-flex items-center space-x-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${compiling ? "animate-spin" : ""}`} />
                  <span>{compiling ? "Compiling..." : "Compile Resume Now"}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Raw LaTeX Source Code */}
        {activeTab === "latex" && (
          <div className="glass-card p-6 border border-slate-800 rounded-2xl space-y-4 bg-slate-900/80">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Full Validated LaTeX (.tex) Source
              </span>
              <button
                onClick={handleCopyLatex}
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center space-x-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy Source"}</span>
              </button>
            </div>
            <pre className="p-4 bg-black/70 rounded-xl text-xs font-mono text-emerald-300/90 overflow-x-auto whitespace-pre leading-relaxed border border-slate-800">
              {version?.latex_content}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
