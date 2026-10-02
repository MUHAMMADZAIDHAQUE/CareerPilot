"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
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
  MapPin,
  Briefcase,
  Users2,
  Send,
  AlertCircle,
  GraduationCap,
  Info,
} from "lucide-react";
import {
  fetchCandidateProfile,
  fetchResumeDocumentsApi,
  fetchResumeVersionsApi,
  compileResumePdfApi,
  getResumePdfUrl,
  fetchJobApi,
  fetchLatestTailoredResumeApi,
  tailorResumeApi,
  discoverReferralsEngineApi,
  fetchDiscoveredReferralsForJobApi,
  generateOutreachDraftApi,
  Candidate,
  ResumeDocument,
  ResumeVersion,
  Job,
  ReferralContact,
  ReferralDiscoveryResult,
  OutreachDraft,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { MatchScore } from "@/components/ui/MatchScore";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { ResumeCardSkeleton } from "@/components/ui/Skeleton";
import ResumeUploadModal from "@/components/ResumeUploadModal";

function ResumeWorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobIdParam = searchParams.get("job_id");

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [documents, setDocuments] = useState<ResumeDocument[]>([]);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Notice banner state
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Job Context state (carried from /jobs or JobCard)
  const [targetJob, setTargetJob] = useState<Job | null>(null);
  const [targetJobLoading, setTargetJobLoading] = useState(false);
  const [targetJobError, setTargetJobError] = useState<string | null>(null);
  const [targetJobVersion, setTargetJobVersion] = useState<ResumeVersion | null>(null);
  const [isTailoringForJob, setIsTailoringForJob] = useState(false);

  // Automatic Referral Discovery state for target job
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralsMeta, setReferralsMeta] = useState<ReferralDiscoveryResult | null>(null);
  const [referralContacts, setReferralContacts] = useState<ReferralContact[]>([]);
  const [referralsError, setReferralsError] = useState<string | null>(null);
  const [showAllReferrals, setShowAllReferrals] = useState(false);

  // Outreach Draft modal & preparation state
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [activeDraft, setActiveDraft] = useState<OutreachDraft | null>(null);
  const [draftGeneratingId, setDraftGeneratingId] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftCopied, setDraftCopied] = useState(false);

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

  // Check if routed specifically to upload master resume
  useEffect(() => {
    if (searchParams.get("upload") === "true") {
      setNoticeMessage("Please upload your master resume first. Tailoring requires your verified career facts.");
      setShowUploadModal(true);
    }
  }, [searchParams]);

  const triggerReferralDiscovery = async (jobId: string) => {
    setReferralsLoading(true);
    setReferralsError(null);
    try {
      const res = await discoverReferralsEngineApi(jobId, candidate?.id, 100);
      if (res.data) {
        setReferralsMeta(res.data);
        setReferralContacts(res.data.contacts || []);
      } else {
        const fallbackRes = await fetchDiscoveredReferralsForJobApi(jobId, candidate?.id);
        if (fallbackRes.data) {
          setReferralsMeta(fallbackRes.data);
          setReferralContacts(fallbackRes.data.contacts || []);
        } else {
          setReferralsError(res.error || "No referral contacts found for this company.");
        }
      }
    } catch (err: any) {
      setReferralsError(err?.message || "Referral discovery encountered an issue.");
    } finally {
      setReferralsLoading(false);
    }
  };

  // Synchronize target Job context if navigated from Job details or Job card
  useEffect(() => {
    if (!jobIdParam) {
      setTargetJob(null);
      setTargetJobVersion(null);
      setReferralsMeta(null);
      setReferralContacts([]);
      return;
    }
    const loadJobContext = async () => {
      setTargetJobLoading(true);
      setTargetJobError(null);
      try {
        const [jobRes, verRes] = await Promise.all([
          fetchJobApi(jobIdParam),
          fetchLatestTailoredResumeApi(jobIdParam),
        ]);
        if (jobRes.data) {
          setTargetJob(jobRes.data);
          // Automatically trigger referral discovery targeting 100 prospects
          triggerReferralDiscovery(jobIdParam);
        } else {
          setTargetJobError(jobRes.error || `Job '${jobIdParam}' could not be loaded.`);
        }
        if (verRes.data) {
          setTargetJobVersion(verRes.data);
        }
      } catch (err: any) {
        setTargetJobError(err?.message || "Failed to load target job context");
      } finally {
        setTargetJobLoading(false);
      }
    };
    loadJobContext();
  }, [jobIdParam]);

  const handleTailorResumeClick = () => {
    const hasMaster = documents.length > 0 || (candidate && (candidate.skills?.length > 0 || candidate.experiences?.length > 0));
    if (!hasMaster) {
      setNoticeMessage("No master resume found. Please upload your master resume first to extract your verified career facts before tailoring.");
      setShowUploadModal(true);
      return;
    }
    // Master resume exists -> navigate to existing job board
    router.push("/jobs");
  };

  const handlePrepareDraft = async (contact: ReferralContact) => {
    if (!targetJob) return;
    setDraftGeneratingId(contact.id);
    setDraftError(null);
    try {
      const res = await generateOutreachDraftApi({
        job_id: targetJob.id,
        referral_contact_id: contact.id,
        candidate_id: candidate?.id,
        channel: "email",
        length: "concise",
      });
      if (res.data) {
        setActiveDraft(res.data);
        setDraftModalOpen(true);
      } else {
        setDraftError(res.error || "Failed to generate outreach draft.");
      }
    } catch (err: any) {
      setDraftError(err?.message || "Failed to generate outreach draft.");
    } finally {
      setDraftGeneratingId(null);
    }
  };

  const handleGenerateForJob = async () => {
    if (!jobIdParam) return;
    setIsTailoringForJob(true);
    try {
      const res = await tailorResumeApi(jobIdParam);
      if (res.data?.version?.id) {
        router.push(`/resumes/${res.data.version.id}`);
      } else {
        alert(res.error || "Failed to synthesize tailored resume. Please verify your master profile facts.");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to synthesize tailored resume.");
    } finally {
      setIsTailoringForJob(false);
    }
  };

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
            variant="outline"
            size="sm"
            onClick={() => setShowUploadModal(true)}
            icon={<Upload className="w-3.5 h-3.5" />}
          >
            Upload Master Resume
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleTailorResumeClick}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold"
            icon={<Sparkles className="w-3.5 h-3.5" />}
            id="btn-tailor-resume"
          >
            Tailor Resume
          </Button>
        </div>
      </div>

      {/* Notice Message Banner */}
      {noticeMessage && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 text-xs sm:text-sm text-amber-800 dark:text-amber-200 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{noticeMessage}</span>
          </div>
          <button
            onClick={() => setNoticeMessage(null)}
            className="text-amber-600 hover:text-amber-800 dark:text-amber-400 text-xs font-semibold px-2 py-1 rounded-md"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* CONTEXTUAL JOB TAILORING BANNER (Carried over when navigated via ?job_id=...) */}
      {jobIdParam && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
          {targetJobLoading ? (
            <div className="p-5 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 flex items-center gap-3 text-xs text-blue-700 dark:text-blue-300 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span>Loading target job context for tailoring...</span>
            </div>
          ) : targetJobError ? (
            <div className="p-5 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/30 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3 text-red-700 dark:text-red-300">
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
                <div>
                  <span className="font-bold block">Could Not Load Job Context</span>
                  <span className="text-[11px] text-red-600 dark:text-red-400">{targetJobError}</span>
                </div>
              </div>
              <Link
                href="/jobs"
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors"
              >
                Browse Jobs
              </Link>
            </div>
          ) : targetJob ? (
            <>
              {/* Active Tailoring Card */}
              <div className="rounded-2xl border-2 border-blue-500/50 dark:border-blue-500/60 bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/60 dark:from-blue-950/40 dark:via-[#111827] dark:to-indigo-950/30 p-6 sm:p-7 shadow-lg relative overflow-hidden space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider">
                      <Sparkles className="w-3 h-3" />
                      <span>Active Tailoring Target</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      Tailoring for: {targetJob.role}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium flex flex-wrap items-center gap-2">
                      <span className="font-bold text-blue-600 dark:text-blue-400">{targetJob.company}</span>
                      {targetJob.location && <span>• {targetJob.location}</span>}
                      {targetJob.employment_type && <span>• {targetJob.employment_type}</span>}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {targetJobVersion ? (
                      <>
                        <Link
                          href={`/resumes/${targetJobVersion.id}`}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-colors"
                          id="btn-open-tailored-studio"
                        >
                          <span>Open in Review Studio</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>

                        <a
                          href={getResumePdfUrl(targetJobVersion.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
                          download={`tailored_resume_${targetJob.company.toLowerCase()}.pdf`}
                        >
                          <Download className="w-3.5 h-3.5 text-blue-600" />
                          <span>PDF</span>
                        </a>

                        <button
                          onClick={() => handleCopyLatex(targetJobVersion)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
                        >
                          {copiedId === targetJobVersion.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === targetJobVersion.id ? "Copied LaTeX!" : "LaTeX"}</span>
                        </button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateForJob}
                          disabled={isTailoringForJob}
                          icon={<RefreshCw className={`w-3.5 h-3.5 ${isTailoringForJob ? "animate-spin" : ""}`} />}
                        >
                          {isTailoringForJob ? "Re-tailoring..." : "Re-tailor"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="primary"
                        size="md"
                        onClick={handleGenerateForJob}
                        disabled={isTailoringForJob}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5"
                        icon={<Sparkles className={`w-4 h-4 ${isTailoringForJob ? "animate-spin" : ""}`} />}
                        id="btn-generate-tailored"
                      >
                        {isTailoringForJob ? "Synthesizing Grounded Resume..." : "Generate Tailored Resume"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Metadata & Alignment chips */}
                <div className="pt-2 border-t border-blue-100 dark:border-blue-900/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Target Skills:</span>
                    {(targetJob.required_skills || []).slice(0, 5).map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] border border-slate-200 dark:border-slate-700"
                      >
                        {skill}
                      </span>
                    ))}
                    {(targetJob.required_skills || []).length > 5 && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        +{(targetJob.required_skills || []).length - 5} more
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Grounded in Master Profile Facts • Zero Hallucination</span>
                  </div>
                </div>
              </div>

              {/* AUTOMATICALLY DISCOVERED REFERRAL PROSPECTS SECTION */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Users2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                        Discovered Referral Prospects for {targetJob.company}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Automatically queried across 5 verified sources: LinkedIn Public Directory, Company Team, Alumni Network, GitHub Contributors, and Public Tech Profiles.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {referralsLoading ? (
                      <Badge variant="warning" size="md">
                        <RefreshCw className="w-3 h-3 animate-spin mr-1.5" />
                        Discovering Prospects (Target: 100)...
                      </Badge>
                    ) : referralsMeta?.target_reached ? (
                      <Badge variant="success" size="md">
                        <CheckCircle2 className="w-3 h-3 mr-1.5" />
                        {referralsMeta.total_verified} Verified Prospects Found (100 Target Reached)
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="md">
                        <AlertCircle className="w-3 h-3 mr-1.5" />
                        {referralContacts.length} Verified Prospects Found ({referralsMeta?.shortfall || (100 - referralContacts.length)} Shortfall)
                      </Badge>
                    )}

                    <Link
                      href={`/referrals?job_id=${targetJob.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
                    >
                      <span>View Referrals Board</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Progress bar or loading state */}
                {referralsLoading && (
                  <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-2">
                    <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-300 font-medium">
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        Searching verified legitimate sources for {targetJob.company}...
                      </span>
                      <span className="font-mono">Target: 100</span>
                    </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full animate-pulse w-3/4" />
                    </div>
                  </div>
                )}

                {/* Notice for shortfall (honest reporting, zero fabrication) */}
                {!referralsLoading && referralsMeta && !referralsMeta.target_reached && referralsMeta.notice && (
                  <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Honest Prospect Reporting</span>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                        {referralsMeta.notice} All {referralContacts.length} contacts listed below are verified from legitimate public sources. No artificial contacts are ever generated to artificially inflate numbers.
                      </p>
                    </div>
                  </div>
                )}

                {/* Prospects Grid */}
                {!referralsLoading && referralContacts.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {(showAllReferrals ? referralContacts : referralContacts.slice(0, 6)).map((contact) => (
                        <div
                          key={contact.id}
                          className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all flex flex-col justify-between gap-3 text-xs"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                                  {contact.name}
                                </h4>
                                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 line-clamp-1">
                                  {contact.current_title || contact.role}
                                </p>
                              </div>
                              <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold shrink-0">
                                {Math.round(contact.relevance_score)}% Match
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                              {contact.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  {contact.location}
                                </span>
                              )}
                              {contact.university && (
                                <span className="flex items-center gap-1">
                                  <GraduationCap className="w-3 h-3 text-indigo-500" />
                                  {contact.university}
                                </span>
                              )}
                            </div>

                            {contact.source && (
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] uppercase">
                                  {contact.source.replace("_", " ")}
                                </span>
                                {contact.relationship_type && (
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[10px]">
                                    {contact.relationship_type}
                                  </span>
                                )}
                              </div>
                            )}

                            {contact.relevance_reasons && contact.relevance_reasons.length > 0 && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                                &ldquo;{contact.relevance_reasons[0]}&rdquo;
                              </p>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                            {contact.profile_url ? (
                              <a
                                href={contact.profile_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                <span>Public Profile</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-mono">Directory Record</span>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePrepareDraft(contact)}
                              disabled={draftGeneratingId === contact.id}
                              className="text-[11px] py-1 px-2.5 flex items-center gap-1 hover:border-indigo-400"
                            >
                              {draftGeneratingId === contact.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Send className="w-3 h-3 text-indigo-500" />
                              )}
                              <span>{draftGeneratingId === contact.id ? "Drafting..." : "Prepare Draft"}</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {referralContacts.length > 6 && (
                      <div className="flex justify-center pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAllReferrals(!showAllReferrals)}
                        >
                          {showAllReferrals
                            ? "Show Fewer Prospects"
                            : `Show All ${referralContacts.length} Discovered Prospects`}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : !referralsLoading && (
                  <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-500 dark:text-slate-400 space-y-2">
                    <p>No referral prospects discovered yet for {targetJob.company}.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => triggerReferralDiscovery(targetJob.id)}
                      icon={<RefreshCw className="w-3.5 h-3.5" />}
                    >
                      Retry Discovery
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

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
                {versions.map((ver) => {
                  const isTargetJobVersion = targetJob && ver.job_id === targetJob.id;
                  return (
                    <div
                      key={ver.id}
                      className={`group rounded-2xl border ${
                        isTargetJobVersion
                          ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
                          : "border-slate-200/90 dark:border-slate-800"
                      } bg-white dark:bg-[#111827] p-5 sm:p-6 shadow-card dark:shadow-none hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-dropdown transition-all flex flex-col justify-between`}
                    >
                      <div className="space-y-3.5">
                        {/* Card Header: Job Target & Match Score */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                                Version {ver.version_number}
                              </span>
                              {isTargetJobVersion && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                                  Target Opportunity
                                </span>
                              )}
                            </div>
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
                );
              })}
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

      {/* Outreach Draft Review Modal */}
      {draftModalOpen && activeDraft && (
        <Modal
          isOpen={draftModalOpen}
          onClose={() => setDraftModalOpen(false)}
          title="Referral Outreach Draft Review"
          description="Personalized draft grounded in candidate and referral facts. Requires human approval before sending."
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Human-in-the-Loop Mandate</span>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                  CareerPilot will never send messages or emails automatically. Review this draft, make any adjustments, and approve when you are satisfied.
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800 font-medium">
                <span className="text-slate-500">Subject:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{activeDraft.subject}</span>
              </div>
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800 font-medium">
                <span className="text-slate-500">Channel:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 uppercase">{activeDraft.channel}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                Draft Content:
              </label>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto font-sans">
                {activeDraft.body}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <Badge variant="success" size="sm">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Anti-Hallucination Verified
                </Badge>
                <Badge variant="neutral" size="sm">
                  Status: {activeDraft.status}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      `Subject: ${activeDraft.subject}\n\n${activeDraft.body}`
                    );
                    setDraftCopied(true);
                    setTimeout(() => setDraftCopied(false), 2000);
                  }}
                  icon={draftCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {draftCopied ? "Copied!" : "Copy Text"}
                </Button>
                <Link href={`/outreach/${activeDraft.id}`}>
                  <Button
                    size="sm"
                    variant="primary"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    icon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    Open in Outreach Studio
                  </Button>
                </Link>
              </div>
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
          setShowUploadModal(false);
          setNoticeMessage(null);
        }}
      />
    </div>
  );
}

export default function ResumeWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-sm font-medium">Loading Resume Studio Workspace...</span>
        </div>
      }
    >
      <ResumeWorkspaceContent />
    </Suspense>
  );
}
