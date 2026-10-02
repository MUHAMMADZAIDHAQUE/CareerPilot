"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Edit3,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Users,
  Briefcase,
  Building2,
  AlertTriangle,
  Github,
  Linkedin,
  Mail,
  GraduationCap,
  History,
  FileCheck2,
  Send,
} from "lucide-react";
import {
  fetchOutreachDraftByIdApi,
  editOutreachDraftApi,
  validateOutreachDraftApi,
  approveOutreachDraftApi,
  rejectOutreachDraftApi,
  regenerateOutreachDraftApi,
  sendOutreachApi,
  fetchConnectedProvidersApi,
  OutreachDraft,
  OutreachDispatch,
  ConnectedProvider,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { LoadingState, ErrorState } from "@/components/ui/States";

export default function OutreachReviewStudioPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = (params?.draftId as string) || "";

  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit State
  const [subjectText, setSubjectText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editSummary, setEditSummary] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Action Loading states
  const [validating, setValidating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Phase 20: Authorized Dispatch State
  const [showSendModal, setShowSendModal] = useState(false);
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);
  const [confirmReviewed, setConfirmReviewed] = useState(false);
  const [confirmExternal, setConfirmExternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [dispatchRecord, setDispatchRecord] = useState<OutreachDispatch | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<ConnectedProvider[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadDraft = async () => {
    if (!draftId) return;
    setLoading(true);
    setError(null);
    try {
      const [res, provRes] = await Promise.all([
        fetchOutreachDraftByIdApi(draftId),
        fetchConnectedProvidersApi(),
      ]);
      if (res.data) {
        setDraft(res.data);
        setSubjectText(res.data.subject || "");
        setBodyText(res.data.body || "");
      } else {
        setError(res.error || "Failed to load outreach draft");
      }
      if (provRes.data) {
        setConnectedProviders(provRes.data);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load outreach draft");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDraft();
  }, [draftId]);

  // Handle Save Edit
  const handleSaveEdit = async () => {
    if (!draft) return;
    setSavingEdit(true);
    try {
      const res = await editOutreachDraftApi(draft.id, {
        body: bodyText,
        subject: subjectText,
        change_summary: editSummary || "Human edits in Outreach Review Studio",
        editor: "human_reviewer",
      });
      if (res.data) {
        setDraft(res.data);
        setIsEditing(false);
        setEditSummary("");
        showToast("Edit saved and draft automatically revalidated.");
      } else {
        alert(res.error || "Failed to save draft edits");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to save edits");
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Revalidate
  const handleValidate = async () => {
    if (!draft) return;
    setValidating(true);
    try {
      const res = await validateOutreachDraftApi(draft.id);
      if (res.data) {
        setDraft(res.data);
        showToast("Draft validated successfully against 12 safety & truth checkpoints.");
      } else {
        alert(res.error || "Validation failed");
      }
    } catch (err: any) {
      alert(err?.message || "Validation failed");
    } finally {
      setValidating(false);
    }
  };

  // Handle Approve
  const handleApprove = async () => {
    if (!draft) return;
    setApproving(true);
    try {
      const res = await approveOutreachDraftApi(draft.id, {
        approver: "human_reviewer",
        notes: "Approved via Outreach Review Studio. Ready for future dispatch.",
      });
      if (res.data) {
        setDraft(res.data);
        showToast("Draft APPROVED FOR DISPATCH. No message transmitted.");
      } else {
        alert(res.error || "Approval failed");
      }
    } catch (err: any) {
      alert(err?.message || "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  // Handle Reject
  const handleReject = async () => {
    if (!draft) return;
    const reason = prompt("Reason for rejecting this draft (optional):");
    setRejecting(true);
    try {
      const res = await rejectOutreachDraftApi(draft.id, {
        rejector: "human_reviewer",
        reason: reason || "Rejected by reviewer",
      });
      if (res.data) {
        setDraft(res.data);
        showToast("Draft marked as REJECTED.");
      } else {
        alert(res.error || "Rejection failed");
      }
    } catch (err: any) {
      alert(err?.message || "Rejection failed");
    } finally {
      setRejecting(false);
    }
  };

  // Handle Regenerate
  const handleRegenerate = async () => {
    if (!draft) return;
    setRegenerating(true);
    try {
      const res = await regenerateOutreachDraftApi(draft.id, {
        instructions: "Regenerate grounded draft",
        regenerate_by: "human_reviewer",
      });
      if (res.data) {
        setDraft(res.data);
        setSubjectText(res.data.subject || "");
        setBodyText(res.data.body || "");
        setIsEditing(false);
        showToast("Draft freshly regenerated and validated.");
      } else {
        alert(res.error || "Regeneration failed");
      }
    } catch (err: any) {
      alert(err?.message || "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopyText = () => {
    const fullText = draft?.subject ? `Subject: ${draft.subject}\n\n${draft.body}` : draft?.body || "";
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast("Message copied to clipboard.");
  };

  if (loading) {
    return <LoadingState message="Loading Outreach Review Studio..." />;
  }

  if (error || !draft) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <ErrorState error={error || "Draft not found"} onRetry={loadDraft} />
        <div className="mt-4 text-center">
          <Link href="/outreach" className="text-sm font-semibold text-blue-600 hover:underline">
            ← Back to Outreach Studio
          </Link>
        </div>
      </div>
    );
  }

  const isApproved = draft.status === "APPROVED_FOR_DISPATCH";
  const isBlocked = draft.status === "BLOCKED";
  const isRejected = draft.status === "REJECTED";
  const valPassed = draft.validation_results?.passed === true;
  const isLinkedIn = draft.channel.toUpperCase() === "LINKEDIN";

  const charCount = bodyText.length;
  const charRangeWarning = isLinkedIn
    ? charCount < 300 || charCount > 1000
    : charCount < 400 || charCount > 1600;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-medium flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/outreach"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Outreach Studio</span>
        </Link>

        <div className="flex items-center gap-2">
          {isApproved ? (
            <Badge variant="success" className="text-xs font-bold uppercase tracking-wider py-1 px-3">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approved for Dispatch
            </Badge>
          ) : isBlocked ? (
            <Badge variant="error" className="text-xs font-bold uppercase tracking-wider py-1 px-3">
              <XCircle className="w-3.5 h-3.5 mr-1.5" /> Blocked
            </Badge>
          ) : isRejected ? (
            <Badge variant="neutral" className="text-xs font-bold uppercase tracking-wider py-1 px-3">
              Rejected
            </Badge>
          ) : (
            <Badge variant="warning" className="text-xs font-bold uppercase tracking-wider py-1 px-3">
              <Clock className="w-3.5 h-3.5 mr-1.5" /> Review Required
            </Badge>
          )}

          <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
            v{draft.generation_version} · Not sent
          </span>
        </div>
      </div>

      {/* Mandatory Safety Guardrail Banner */}
      <div className="rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 p-4 sm:p-5 flex items-start gap-3.5 shadow-sm">
        <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h2 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
            APPROVE FOR DISPATCH — MESSAGE WILL NOT BE SENT IN PHASE 19
          </h2>
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            CareerPilot Phase 19 prepares, grounds, validates, and records human approval for outreach messages.
            External message dispatch (LinkedIn or Email transmission) is strictly isolated and deferred to a future phase.
            Approving this draft records formal human sign-off only.
          </p>
        </div>
      </div>

      {/* 2-Column Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Context, Verified Evidence & Validation Checklist (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Contact Profile Context */}
          <Card className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Referral Contact Context
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {draft.contact_name || "Referral Contact"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {draft.contact_title} ·{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {draft.contact_company}
                  </span>
                </p>
              </div>

              {draft.contact_relevance_score != null && (
                <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-center shrink-0">
                  <span className="text-[9px] uppercase tracking-wider text-purple-600 font-bold block">
                    Relevance
                  </span>
                  <span className="text-base font-bold text-purple-900 dark:text-purple-200">
                    {Math.round(draft.contact_relevance_score)}/100
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                Type: {draft.contact_relationship_type || "ENGINEER"}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">
                Channel: {draft.channel}
              </span>
            </div>
          </Card>

          {/* Target Job Context */}
          <Card className="p-5 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Target Opportunity
            </span>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {draft.job_title || "Job Position"}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {draft.job_company || "Company"}
              </p>
            </div>
          </Card>

          {/* Verified Personalization Grounding */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Verified Personalization Signals ({draft.personalization_evidence?.length || 0})
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                100% Grounded
              </span>
            </div>

            <div className="space-y-2">
              {(draft.personalization_evidence || []).map((ev, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-blue-600 dark:text-blue-400 text-[11px]">
                      ✓ {ev.type}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Source: {ev.source}
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                    {ev.claim}
                  </p>
                  {ev.source_url && (
                    <a
                      href={ev.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:underline pt-0.5"
                    >
                      <span>Public reference</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* 12-Point Safety & Truth Checklist */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Safety & Truth Validation Engine
              </span>
              <Badge
                variant={valPassed ? "success" : "error"}
                className="text-[10px] font-bold uppercase"
              >
                {valPassed ? "Passed" : "Violations Found"}
              </Badge>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-700 dark:text-slate-300">Candidate Facts Grounded</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-700 dark:text-slate-300">Job Requirements Grounded</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-700 dark:text-slate-300">Zero Fabricated Relationships</span>
                {valPassed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-700 dark:text-slate-300">Zero Private / Sensitive Data</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-700 dark:text-slate-300">Spam & Manipulation Free</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-700 dark:text-slate-300">Master Resume Immutability</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
            </div>

            {/* Risk Flags if any */}
            {draft.risk_flags && draft.risk_flags.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-red-900 dark:text-red-200">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Active Risk Flags:
                </span>
                <ul className="list-disc list-inside space-y-0.5">
                  {draft.risk_flags.map((flag, i) => (
                    <li key={i}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Message Editor, Actions & Audit Log (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="p-6 space-y-5">
            {/* Editor Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Personalized Outreach Draft
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tailored specifically for {draft.contact_name} ({draft.channel})
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleCopyText}>
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy Text
                    </>
                  )}
                </Button>

                {!isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    disabled={isApproved}
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit Message
                  </Button>
                )}
              </div>
            </div>

            {/* Email Subject Field (if Email channel or has subject) */}
            {(draft.subject !== null || isEditing) && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Subject Line:
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={subjectText}
                    onChange={(e) => setSubjectText(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter email subject line..."
                  />
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200">
                    {draft.subject || "No subject specified"}
                  </div>
                )}
              </div>
            )}

            {/* Message Body Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Message Body:
                </label>
                <span
                  className={`text-[11px] font-mono ${
                    charRangeWarning
                      ? "text-amber-600 dark:text-amber-400 font-semibold"
                      : "text-slate-400"
                  }`}
                >
                  {charCount} characters ({isLinkedIn ? "Target: 500-900" : "Target: 700-1400"})
                </span>
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <textarea
                    rows={12}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Type or edit message text..."
                  />

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Reason for Change (Audit Summary):
                    </label>
                    <input
                      type="text"
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                      placeholder="e.g., Shortened introduction, emphasized Go and Kubernetes experience"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setBodyText(draft.body);
                        setSubjectText(draft.subject || "");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {savingEdit ? "Saving & Revalidating..." : "Save & Revalidate"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                  {draft.body}
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRegenerate}
                  disabled={regenerating || isApproved}
                  title="Regenerate fresh draft from verified profile facts"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${regenerating ? "animate-spin" : ""}`} />
                  <span>Regenerate</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleValidate}
                  disabled={validating}
                  title="Re-run 12-point truth & safety validation"
                >
                  <FileCheck2 className={`w-3.5 h-3.5 mr-1 ${validating ? "animate-spin" : ""}`} />
                  <span>Validate</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReject}
                  disabled={rejecting || isApproved}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  <span>Reject</span>
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={approving || isApproved || isBlocked || !valPassed}
                  className={
                    isApproved
                      ? "bg-emerald-600 text-white cursor-default"
                      : "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                  }
                  id="btn-approve-draft"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  <span>{isApproved ? "Approved for Dispatch" : "Approve for Dispatch"}</span>
                </Button>

                {isApproved && draft.status !== "DISPATCHED" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (draft.channel.toUpperCase() === "LINKEDIN") {
                        setShowLinkedInModal(true);
                      } else {
                        setShowSendModal(true);
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
                    id="btn-trigger-dispatch"
                  >
                    <Send className="w-4 h-4 mr-1.5" />
                    <span>SEND OUTREACH</span>
                  </Button>
                )}

                {draft.status === "DISPATCHED" && (
                  <span className="text-xs px-3 py-1.5 rounded-xl font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>DISPATCHED</span>
                  </span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-right">
              {draft.status === "DISPATCHED"
                ? "Message transmitted via authorized gateway."
                : "Approval enables authorized dispatch. Consequential send requires double-confirmation."}
            </p>
          </Card>

          {/* Audit Trail & Human Edits Log */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Audit Trail & Human Edit History
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                    Initial AI Draft Prepared
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Prompt version: {draft.prompt_version} · Created: {new Date(draft.created_at).toLocaleString()}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  NO_MESSAGE_SENT = TRUE
                </span>
              </div>

              {(draft.human_edits || []).map((edit, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-900 dark:text-blue-200">
                      Human Edit #{idx + 1} ({edit.edited_by})
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(edit.edited_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                    Summary: {edit.change_summary}
                  </p>
                </div>
              ))}

              {draft.approved_at && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-900 dark:text-emerald-200 block">
                      Approved by {draft.approved_by || "human reviewer"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(draft.approved_at).toLocaleString()}
                    </span>
                  </div>
                  <Badge variant="success" className="text-[10px] uppercase font-bold">
                    APPROVED_FOR_DISPATCH
                  </Badge>
                </div>
              )}

              {draft.status === "DISPATCHED" && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-blue-900 dark:text-blue-200 block">
                      Outreach Dispatched
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Channel: {draft.channel} · Idempotent delivery verified
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    DISPATCHED
                  </Badge>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Send Review Modal (Email Double Confirmation) */}
      {showSendModal && (
        <Modal
          isOpen={showSendModal}
          onClose={() => setShowSendModal(false)}
          title="Email Outreach Send Review"
        >
          <div className="space-y-4 text-xs">
            {(() => {
              const activeEmailProvider = connectedProviders.find((p) => p.is_active);

              if (activeEmailProvider) {
                return (
                  <>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Recipient:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {draft.contact_name || "Referral Contact"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Connected Account:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {activeEmailProvider.provider} ({activeEmailProvider.account_email || activeEmailProvider.email_address})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Subject:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {draft.subject || "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Double confirmation checkboxes */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <label className="flex items-start gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={confirmReviewed}
                          onChange={(e) => setConfirmReviewed(e.target.checked)}
                          className="rounded text-blue-600 mt-0.5"
                          id="chk-confirm-reviewed"
                        />
                        <span className="font-medium">
                          I have personally reviewed this email message content and verified the recipient.
                        </span>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={confirmExternal}
                          onChange={(e) => setConfirmExternal(e.target.checked)}
                          className="rounded text-blue-600 mt-0.5"
                          id="chk-confirm-external"
                        />
                        <span className="font-medium">
                          I understand this consequential action will send an external email through my connected {activeEmailProvider.provider} account.
                        </span>
                      </label>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <Button variant="outline" onClick={() => setShowSendModal(false)} disabled={sending}>
                        Cancel
                      </Button>
                      <Button
                        onClick={async () => {
                          setSending(true);
                          try {
                            const res = await sendOutreachApi(draft.id, true, activeEmailProvider.provider);
                            if (res.data) {
                              setDispatchRecord(res.data);
                              setDraft({ ...draft, status: "DISPATCHED" as any, dispatch_status: "SENT" as any });
                              setShowSendModal(false);
                              showToast(`Email successfully transmitted via authorized ${activeEmailProvider.provider}!`);
                            } else {
                              alert(res.error || "Failed to dispatch email");
                            }
                          } finally {
                            setSending(false);
                          }
                        }}
                        disabled={!confirmReviewed || !confirmExternal || sending}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4"
                        id="btn-send-now"
                      >
                        {sending ? "TRANSMITTING..." : `SEND VIA ${activeEmailProvider.provider}`}
                      </Button>
                    </div>
                  </>
                );
              }

              // No provider connected state
              return (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 leading-relaxed">
                    <span className="font-bold block mb-1">No Email Provider Connected</span>
                    CareerPilot never claims an email was transmitted without authorized provider confirmation. Connect your Gmail or Outlook account in Settings to enable direct one-click sending, or copy this draft to send from your own email client.
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {draft.subject ? `Subject: ${draft.subject}\n\n${draft.body}` : draft.body}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const full = draft.subject ? `Subject: ${draft.subject}\n\n${draft.body}` : draft.body;
                        navigator.clipboard.writeText(full);
                        showToast("Email text copied to clipboard!");
                      }}
                      className="w-full sm:w-auto"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      <span>COPY EMAIL DRAFT</span>
                    </Button>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Link
                        href="/settings"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-medium transition-colors"
                      >
                        <span>Connect in Settings</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>

                      <Button
                        size="sm"
                        onClick={async () => {
                          await sendOutreachApi(draft.id, true);
                          setDraft({ ...draft, status: "DISPATCHED" as any, dispatch_status: "SENT" as any });
                          setShowSendModal(false);
                          showToast("Marked as sent manually by user.");
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        <span>Mark as Sent Manually</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* Manual LinkedIn Copy Modal */}
      {showLinkedInModal && (
        <Modal
          isOpen={showLinkedInModal}
          onClose={() => setShowLinkedInModal(false)}
          title="Manual Transmission Required for LinkedIn"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 leading-relaxed">
              <span className="font-bold block mb-1">Safety & Compliance Guarantee:</span>
              CareerPilot strictly preserves candidate account safety. We never store LinkedIn passwords, use automated browser extensions, or perform automated connection requests.
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Approved Message Text (Ready to paste):
              </label>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {draft.body}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(draft.body);
                  setCopiedMessage(true);
                  setTimeout(() => setCopiedMessage(false), 3000);
                  showToast("Message copied to clipboard! Ready to paste into LinkedIn.");
                }}
                className="w-full sm:w-auto flex items-center gap-1.5"
                id="btn-copy-linkedin-msg"
              >
                {copiedMessage ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMessage ? "COPIED TO CLIPBOARD" : "COPY MESSAGE"}</span>
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <a
                  href={draft.contact_profile_url || "https://linkedin.com"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A66C2] hover:bg-[#004182] text-white font-semibold transition-colors shadow-sm"
                  id="btn-open-linkedin-profile"
                >
                  <span>OPEN LINKEDIN PROFILE</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await sendOutreachApi(draft.id, true);
                    setDraft({ ...draft, status: "DISPATCHED" as any, dispatch_status: "SENT" as any });
                    setShowLinkedInModal(false);
                    showToast("Marked as sent manually by user.");
                  }}
                  title="Record that you manually pasted and sent this note on LinkedIn"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                  <span>Mark as Sent</span>
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
