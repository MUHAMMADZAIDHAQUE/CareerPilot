"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  MapPin,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  GraduationCap,
  Briefcase,
  Users2,
  FileText,
  Save,
  CheckSquare,
  XCircle,
  Clock,
  Sparkles,
  Layers,
  Send,
  Code2,
} from "lucide-react";
import {
  fetchReferralContactByIdApi,
  selectReferralContactApi,
  dismissReferralContactApi,
  updateReferralContactNotesApi,
  ReferralContact,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LoadingState, ErrorState } from "@/components/ui/States";

export default function ReferralContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = (params?.contactId as string) || "";

  const [contact, setContact] = useState<ReferralContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Notes state
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Action feedback
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function loadContact() {
      if (!contactId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchReferralContactByIdApi(contactId);
        if (res.data) {
          setContact(res.data);
          setNotes(res.data.notes || "");
        } else {
          setError(res.error || "Contact not found");
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load contact details");
      } finally {
        setLoading(false);
      }
    }
    loadContact();
  }, [contactId]);

  const handleSelect = async () => {
    if (!contact) return;
    setActionLoading(true);
    try {
      const res = await selectReferralContactApi(contact.id);
      if (res.data) {
        setContact(res.data);
        setActionSuccess("Contact selected for Human-Approved Outreach Preparation.");
        setTimeout(() => setActionSuccess(null), 3500);
      }
    } catch (err: any) {
      alert("Failed to select contact: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = async () => {
    if (!contact) return;
    setActionLoading(true);
    try {
      const res = await dismissReferralContactApi(contact.id);
      if (res.data) {
        setContact(res.data);
        setActionSuccess("Contact dismissed from referral recommendations.");
        setTimeout(() => setActionSuccess(null), 3500);
      }
    } catch (err: any) {
      alert("Failed to dismiss contact: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!contact) return;
    setSavingNotes(true);
    try {
      const res = await updateReferralContactNotesApi(contact.id, notes);
      if (res.data) {
        setContact(res.data);
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2500);
      }
    } catch (err: any) {
      alert("Failed to save notes: " + err.message);
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading contact profile and referral provenance..." />;
  }

  if (error || !contact) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ErrorState error={error || "Contact not found"} onRetry={() => router.push("/referrals")} />
      </div>
    );
  }

  const isSelected = contact.outreach_status === "SELECTED";
  const isDismissed = contact.outreach_status === "DO_NOT_CONTACT";

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <Link
          href="/referrals"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Referrals Dashboard</span>
        </Link>

        {contact.profile_url && (
          <a
            href={contact.profile_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
          >
            <span>OPEN SOURCE PROFILE</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Action Success Toast */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Profile Hero Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 sm:p-8 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              {contact.relationship_type.replace(/_/g, " ")}
            </span>

            {contact.verification_status === "VERIFIED" && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Verified Public Contact</span>
              </span>
            )}

            {isSelected && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Selected for Outreach
              </span>
            )}

            {isDismissed && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                Dismissed
              </span>
            )}
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {contact.name}
            </h1>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">
              {contact.current_title}
            </p>
            {contact.headline && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {contact.headline}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{contact.company}</span>
            </span>

            {contact.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{contact.location}</span>
              </span>
            )}

            {contact.university && (
              <span className="flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                <span>{contact.university} {contact.graduation_year ? `(' ${contact.graduation_year})` : ""}</span>
              </span>
            )}
          </div>
        </div>

        {/* Relevance Score Display */}
        <div className="shrink-0 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
            Referral Relevance
          </span>
          <span className="text-4xl font-extrabold text-slate-900 dark:text-white block font-mono">
            {Math.round(contact.relevance_score)}%
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block max-w-[130px]">
            Based on company, role, skills & alumni overlap
          </span>
        </div>
      </div>

      {/* Main Grid: Evidence Breakdown & Provenance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Why Relevant & Technical Skills */}
        <div className="lg:col-span-2 space-y-6">
          {/* Why Relevant Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Transparent Relevance Reasons</span>
            </h3>

            <div className="space-y-2.5">
              {contact.relevance_reasons.map((reason, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{reason.replace(/^✓\s*/, "")}</span>
                </div>
              ))}
            </div>

            {/* Score Factor Breakdown */}
            {contact.score_breakdown && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Relevance Score Components
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-[10px] text-slate-500 block">Company Match (30%)</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {contact.score_breakdown.company_association || 0} pts
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-[10px] text-slate-500 block">Role / Team (20%)</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {contact.score_breakdown.role_team_relevance || 0} pts
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-[10px] text-slate-500 block">Tech Overlap (15%)</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {contact.score_breakdown.technical_overlap || 0} pts
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-[10px] text-slate-500 block">Alumni Connection (15%)</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {contact.score_breakdown.alumni_relationship || 0} pts
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-[10px] text-slate-500 block">Seniority Context (10%)</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {contact.score_breakdown.seniority_context || 0} pts
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-[10px] text-slate-500 block">Public Evidence (10%)</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {contact.score_breakdown.public_evidence || 0} pts
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Technical Skills & Domains */}
          {contact.skills && contact.skills.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Verified Technical Skills & Domains</span>
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {contact.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* User Notes Section */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Personal Notes & Outreach Context</span>
            </h3>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your notes about mutual connections, shared projects, or specific referral angles..."
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <div className="flex justify-between items-center pt-1">
              <span className="text-[11px] text-slate-400">
                {notesSaved ? "✓ Notes saved!" : "Notes are stored privately for your profile"}
              </span>
              <Button size="sm" variant="outline" onClick={handleSaveNotes} loading={savingNotes}>
                <Save className="w-3.5 h-3.5 mr-1" />
                Save Notes
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Source Provenance & Actions */}
        <div className="space-y-6">
          {/* Action Box */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Outreach Preparation</h3>

            <div className="space-y-2">
              <Button
                variant={isSelected ? "outline" : "primary"}
                className="w-full justify-center"
                onClick={handleSelect}
                loading={actionLoading}
              >
                {isSelected ? "Deselect for Outreach" : "Select for Outreach"}
              </Button>

              <Button
                variant="outline"
                className="w-full justify-center text-slate-600 hover:text-red-600"
                onClick={handleDismiss}
                loading={actionLoading}
              >
                Dismiss Contact
              </Button>
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
              <strong>Human-in-the-Loop Guardrail:</strong> Selecting a contact only prepares them for outreach drafting.
              CareerPilot will never send messages or emails automatically.
            </p>
          </div>

          {/* Source Provenance Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Multi-Source Provenance</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Primary Source:</span>
                <span className="font-semibold text-slate-900 dark:text-white capitalize">{contact.source}</span>
              </div>

              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Public Contact Method:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {contact.public_contact_method || "Public Profile"}
                </span>
              </div>

              {contact.last_verified_at && (
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>Last Verified:</span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {new Date(contact.last_verified_at).toLocaleDateString()}
                  </span>
                </div>
              )}

              {/* Source References List */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Aggregated Source Records
                </span>
                <div className="space-y-1.5">
                  {(contact.source_references || []).map((ref, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[11px] flex justify-between items-center"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{ref.source}</span>
                      {ref.url && (
                        <a
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1"
                        >
                          <span>Link</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
