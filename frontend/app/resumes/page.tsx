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
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/States";
import ResumeUploadModal from "@/components/ResumeUploadModal";

export default function ResumeWorkspacePage() {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [documents, setDocuments] = useState<ResumeDocument[]>([]);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Version Comparison / Diff state
  const [selectedVersionForDiff, setSelectedVersionForDiff] = useState<ResumeVersion | null>(null);
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
      // fallback
    }
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Master Resume Immutable • Zero Hallucination Mode</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Resume Workspace
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your verified master profile and compile job-specific tailored LaTeX resumes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadWorkspaceData}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowUploadModal(true)}
            icon={<Upload className="w-3.5 h-3.5" />}
          >
            Upload Resume
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading your master documents and tailored versions..." />
      ) : error ? (
        <ErrorState title="Failed to load workspace" error={error} onRetry={loadWorkspaceData} />
      ) : (
        <>
          {/* 1. Master Resume Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Master Candidate Resume</span>
                  <Badge variant="success" size="sm">
                    Protected Truth
                  </Badge>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  The ground truth representing your real experience. Never modified automatically by AI agents.
                </p>
              </div>

              <Link
                href="/profile"
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1"
              >
                <span>Edit Profile Facts</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            </div>

            <Card className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {candidate?.full_name || "Candidate Profile"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {candidate?.headline || "Software Engineer"} • {candidate?.email}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-mono">
                    {candidate?.skills?.length || 0} Skills
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-mono">
                    {candidate?.experiences?.length || 0} Roles
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-mono">
                    {candidate?.projects?.length || 0} Projects
                  </span>
                </div>
              </div>

              {/* Uploaded Master Documents list */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Uploaded Master Files ({documents.length})
                </h4>

                {documents.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <span className="font-semibold text-slate-900 block truncate max-w-[200px]">
                            {doc.filename}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 uppercase">
                            {doc.file_type} • Version {doc.version}
                          </span>
                        </div>
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Active
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No master documents uploaded yet.</p>
                )}
              </div>
            </Card>
          </section>

          {/* 2. Tailored Resume Versions Section */}
          <section className="space-y-4 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
                  Tailored Resume Versions ({versions.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Job-specific LaTeX resumes synthesized from verified facts with AST fact-checking.
                </p>
              </div>

              <Link
                href="/jobs"
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1"
              >
                <span>Find Jobs to Tailor</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            </div>

            {versions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card hover:border-slate-300 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Badge variant="blue" size="sm">
                            Version {ver.version_number}
                          </Badge>
                          <h3 className="text-sm font-semibold text-slate-900 mt-1 line-clamp-1">
                            Tailored Resume
                          </h3>
                        </div>

                        {ver.validation_status === "valid" ? (
                          <Badge variant="success" size="sm" icon={<ShieldCheck className="w-3 h-3" />}>
                            Grounded
                          </Badge>
                        ) : (
                          <Badge variant="warning" size="sm">
                            Notice
                          </Badge>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="text-xs text-slate-500 space-y-1">
                        <p className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(ver.created_at).toLocaleDateString()}</span>
                        </p>
                        <p className="font-mono text-[11px] text-slate-400 truncate">
                          ID: {ver.id.substring(0, 8)}...
                        </p>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedVersionForDiff(ver)}
                          className="px-2.5 py-1 rounded-md text-slate-700 bg-slate-100 hover:bg-slate-200 font-medium transition-colors"
                          title="View Side-by-Side Diff"
                        >
                          Visual Diff
                        </button>
                        <button
                          onClick={() => handleCopyLatex(ver)}
                          className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Copy LaTeX"
                        >
                          {copiedId === ver.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCompile(ver.id)}
                          loading={compilingVersionId === ver.id}
                        >
                          Compile
                        </Button>
                        <Link
                          href={`/resumes/${ver.id}`}
                          className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Open Full Preview"
                        >
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
                description="Browse jobs and generate your first fact-grounded tailored LaTeX resume."
                actionText="Explore Jobs"
                onAction={() => window.location.assign("/jobs")}
              />
            )}
          </section>
        </>
      )}

      {/* Visual Diff Drawer */}
      <Drawer
        isOpen={Boolean(selectedVersionForDiff)}
        onClose={() => setSelectedVersionForDiff(null)}
        title={`Resume v${selectedVersionForDiff?.version_number} LaTeX Diff`}
        description="Side-by-side view comparing immutable master template facts against job-tailored bullets."
        width="2xl"
      >
        {selectedVersionForDiff && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs text-slate-500">
              <span className="font-medium text-slate-900">
                Validation Status: {selectedVersionForDiff.validation_status}
              </span>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleCompile(selectedVersionForDiff.id)}
                loading={compilingVersionId === selectedVersionForDiff.id}
              >
                Compile PDF
              </Button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Tailored LaTeX Source
              </h4>
              <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[600px] p-3 bg-white rounded-lg border border-slate-200">
                {selectedVersionForDiff.latex_content}
              </pre>
            </div>
          </div>
        )}
      </Drawer>

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
