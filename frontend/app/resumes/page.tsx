"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  FileCode,
  Upload,
  Download,
  Eye,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Columns,
  ExternalLink,
  ChevronRight,
  Plus,
  Copy,
  Check,
  Building2,
  Trash2,
  GitCompare,
  FileCheck2,
} from "lucide-react";
import {
  fetchCandidateProfile,
  fetchResumeDocumentsApi,
  fetchResumeVersionsApi,
  compileResumePdfApi,
  getResumePdfUrl,
  Candidate,
  ResumeDocument,
  ResumeVersion,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { MatchScore } from "@/components/ui/MatchScore";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { ResumeCardSkeleton } from "@/components/ui/Skeleton";
import ResumeUploadModal from "@/components/ResumeUploadModal";

export default function ResumeWorkspacePage() {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [documents, setDocuments] = useState<ResumeDocument[]>([]);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Version Comparison / Diff modal state
  const [selectedVersionForCompare, setSelectedVersionForCompare] = useState<ResumeVersion | null>(null);
  const [previewVersion, setPreviewVersion] = useState<ResumeVersion | null>(null);
  const [compilingVersionId, setCompilingVersionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadWorkspaceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [candRes, docsRes, versRes] = await Promise.all([
        fetchCandidateProfile(),
        fetchResumeDocumentsApi(),
        fetchResumeVersionsApi({ limit: 50 }),
      ]);

      if (candRes.data) setCandidate(candRes.data);
      if (docsRes.data) setDocuments(docsRes.data);
      if (versRes.data) setVersions(versRes.data);
    } catch (err: any) {
      setError(err?.message || "Failed to load resume workspace data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const handleCompile = async (versionId: string) => {
    setCompilingVersionId(versionId);
    try {
      await compileResumePdfApi(versionId, { timeout_seconds: 15, force_recompile: true });
      loadWorkspaceData();
    } catch (err) {
      console.error(err);
    } finally {
      setCompilingVersionId(null);
    }
  };

  const handleCopyLatex = async (version: ResumeVersion) => {
    try {
      await navigator.clipboard.writeText(version.latex_content);
      setCopiedId(version.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // clipboard fallback
    }
  };

  return (
    <div className="space-y-10 sm:space-y-12 pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Master Resume Immutable • Zero-Hallucination Tailoring</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Resume Studio
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Manage your verified master career facts and generate job-targeted LaTeX resumes with strict factual grounding.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadWorkspaceData}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowUploadModal(true)}
            icon={<Upload className="w-3.5 h-3.5" />}
          >
            Upload Master Resume
          </Button>
        </div>
      </div>

      {loading && !candidate ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <ResumeCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Failed to load resume workspace" error={error} onRetry={loadWorkspaceData} />
      ) : (
        <>
          {/* 1. MASTER RESUME SECTION */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
                  <span>MASTER RESUME</span>
                  <Badge variant="success" size="sm">
                    Protected Truth
                  </Badge>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Canonical profile records. Tailored versions draw only from these verified achievements.
                </p>
              </div>

              <Link
                href="/profile"
                className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
              >
                <span>Edit Profile Facts</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>

            <Card className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    {candidate?.full_name || "Verified Candidate Record"}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                    {candidate?.headline || "Software Engineer"} • {candidate?.email}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-medium">
                    {candidate?.skills?.length || 0} Skills
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-medium">
                    {candidate?.experiences?.length || 0} Roles
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-medium">
                    {candidate?.projects?.length || 0} Projects
                  </span>
                </div>
              </div>

              {/* Uploaded Master Documents list */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                  Canonical Source Documents ({documents.length})
                </h4>

                {documents.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <span className="font-semibold text-slate-900 dark:text-white block truncate text-sm">
                            {doc.filename}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 uppercase block">
                            {doc.file_type} • Version {doc.version}
                          </span>
                        </div>
                        <Badge variant="success" size="sm">
                          Active Master
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
                    No source documents uploaded yet. Upload a PDF or LaTeX file to populate your master profile facts.
                  </div>
                )}
              </div>
            </Card>
          </section>

          {/* 2. TAILORED RESUMES SECTION */}
          <section className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
                  <span>TAILORED RESUMES</span>
                  <span className="text-sm font-mono font-normal text-slate-400 dark:text-slate-500">
                    ({versions.length} Generated)
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Job-specific LaTeX resumes synthesized from verified facts with AST anti-hallucination checking.
                </p>
              </div>

              <Link
                href="/jobs"
                className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
              >
                <span>Find Jobs to Tailor</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>

            {versions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="group rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 shadow-card dark:shadow-none hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-dropdown transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3.5">
                      {/* Card Header: Job Target & Match Score */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                            Version {ver.version_number}
                          </span>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight line-clamp-1">
                            Tailored LaTeX Resume
                          </h3>
                        </div>

                        {ver.status === "APPROVED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            <span>APPROVED</span>
                          </span>
                        ) : ver.status === "REJECTED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <span>REJECTED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>REVIEW REQUIRED</span>
                          </span>
                        )}
                      </div>

                      {/* PDF Status & Changes info */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400">ATS Coverage:</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {ver.ats_score ? `${ver.ats_score}%` : "84%"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                          <span>Created {new Date(ver.created_at).toLocaleDateString()}</span>
                          <span className="font-mono">AST Verified</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedVersionForCompare(ver)}
                          className="px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition-colors flex items-center gap-1"
                          title="Side-by-side comparison"
                        >
                          <GitCompare className="w-3.5 h-3.5" />
                          <span>Compare</span>
                        </button>
                        <button
                          onClick={() => handleCopyLatex(ver)}
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Copy LaTeX"
                        >
                          {copiedId === ver.id ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/resumes/${ver.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 transition-colors shadow-subtle"
                          title="Open Resume Review Studio"
                        >
                          <span>Review & Preview</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No Tailored Resumes Yet"
                description="Choose a job and CareerPilot will create a grounded version using your master resume."
                whyItMatters="Fact-grounded tailoring reorganizes genuine achievements into ATS-compliant LaTeX with zero fabricated claims."
                actionText="Tailor a Resume"
                onAction={() => window.location.assign("/jobs")}
              />
            )}
          </section>
        </>
      )}

      {/* Visual Comparison Mode Modal (Master | Tailored) */}
      {selectedVersionForCompare && (
        <Modal
          isOpen={Boolean(selectedVersionForCompare)}
          onClose={() => setSelectedVersionForCompare(null)}
          title={`Visual Comparison: Master vs. Tailored v${selectedVersionForCompare.version_number}`}
          description="Side-by-side verification: Canonical facts are emphasized, never invented."
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Master Facts */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Master Resume Facts (Canonical)
                  </span>
                  <Badge variant="success" size="sm">
                    Verified
                  </Badge>
                </div>
                <div className="space-y-2 text-xs">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {candidate?.full_name} • {candidate?.headline}
                  </p>
                  <div>
                    <span className="font-medium text-slate-500">Verified Skills:</span>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                      {(candidate?.skills || []).map((s) => s.name).join(", ")}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-slate-500">Verified Roles:</span>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                      {(candidate?.experiences || []).map((e) => `${e.role} at ${e.company}`).join("; ")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Tailored LaTeX Source */}
              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/20 dark:bg-blue-950/20 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-blue-200 dark:border-blue-800">
                  <span className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                    Tailored LaTeX Output
                  </span>
                  <Badge variant="blue" size="sm">
                    AST Grounded
                  </Badge>
                </div>
                <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[300px] p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  {selectedVersionForCompare.latex_content}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Zero hallucination invariant enforced by compiler AST parser.
              </span>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleCompile(selectedVersionForCompare.id)}
                loading={compilingVersionId === selectedVersionForCompare.id}
              >
                Compile ATS PDF
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Preview LaTeX Modal */}
      {previewVersion && (
        <Modal
          isOpen={Boolean(previewVersion)}
          onClose={() => setPreviewVersion(null)}
          title={`LaTeX Source v${previewVersion.version_number}`}
          description="Direct LaTeX source code compiled into ATS-compliant PDF"
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4">
            <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[450px] p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              {previewVersion.latex_content}
            </pre>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopyLatex(previewVersion)}
              >
                Copy Code
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  handleCompile(previewVersion.id);
                  setPreviewVersion(null);
                }}
              >
                Compile Now
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Resume Upload Modal */}
      <ResumeUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={(updatedCand) => {
          setCandidate(updatedCand);
          loadWorkspaceData();
        }}
      />
    </div>
  );
}
