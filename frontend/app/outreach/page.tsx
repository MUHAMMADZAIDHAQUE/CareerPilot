"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Send,
  Mail,
  Linkedin,
  CheckCircle2,
  XCircle,
  Clock,
  Edit3,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Users,
  Briefcase,
  Building2,
  Trash2,
  RefreshCw,
  Plus,
  Filter,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  fetchOutreachMessagesApi,
  generateOutreachApi,
  editOutreachApi,
  approveOutreachApi,
  rejectOutreachApi,
  markOutreachSentApi,
  deleteOutreachApi,
  fetchJobsApi,
  fetchContactsApi,
  OutreachMessage,
  Job,
  Contact,
} from "@/lib/api";

export default function OutreachPage() {
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterChannel, setFilterChannel] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Action loading states
  const [actingId, setActingId] = useState<string | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<OutreachMessage | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Generate Modal State
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<"all" | "email" | "linkedin">("all");
  const [customInstructions, setCustomInstructions] = useState("");
  const [generating, setGenerating] = useState(false);

  // Load Messages
  const loadMessages = async () => {
    setLoading(true);
    setError(null);
    const res = await fetchOutreachMessagesApi();
    setLoading(false);
    if (res.data) {
      setMessages(res.data);
    } else {
      setError(res.error || "Failed to load outreach messages");
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  // Load jobs and contacts for the Generate modal
  const openGenerateModal = async () => {
    setIsGenerateModalOpen(true);
    const [jobsRes, contactsRes] = await Promise.all([
      fetchJobsApi(),
      fetchContactsApi(),
    ]);
    if (jobsRes.data) {
      setJobs(jobsRes.data);
      if (jobsRes.data.length > 0 && !selectedJobId) {
        setSelectedJobId(jobsRes.data[0].id);
      }
    }
    if (contactsRes.data) {
      setContacts(contactsRes.data);
      if (contactsRes.data.length > 0 && !selectedContactId) {
        setSelectedContactId(contactsRes.data[0].id!);
      }
    }
  };

  // Submit Generation
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId || !selectedContactId) {
      setError("Please select both a Job and a Contact.");
      return;
    }

    setGenerating(true);
    setError(null);

    const res = await generateOutreachApi({
      job_id: selectedJobId,
      contact_id: selectedContactId,
      channel: selectedChannel,
      custom_instructions: customInstructions.trim() || undefined,
    });

    setGenerating(false);

    if (res.data) {
      setIsGenerateModalOpen(false);
      setSuccessMsg(`Generated ${res.data.messages.length} personalized outreach drafts!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      loadMessages();
    } else {
      setError(res.error || "Failed to generate outreach drafts");
    }
  };

  // Approve
  const handleApprove = async (id: string) => {
    setActingId(id);
    const res = await approveOutreachApi(id);
    setActingId(null);
    if (res.data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "APPROVED", approved_at: res.data?.approved_at } : m))
      );
      setSuccessMsg("Draft approved! You can now copy and manually send it.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setError(res.error || "Failed to approve draft");
    }
  };

  // Reject
  const handleReject = async (id: string) => {
    setActingId(id);
    const res = await rejectOutreachApi(id);
    setActingId(null);
    if (res.data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "REJECTED" } : m))
      );
    } else {
      setError(res.error || "Failed to reject draft");
    }
  };

  // Mark as Sent
  const handleMarkSent = async (id: string) => {
    setActingId(id);
    const res = await markOutreachSentApi(id);
    setActingId(null);
    if (res.data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "SENT", sent_at: res.data?.sent_at } : m))
      );
      setSuccessMsg("Outreach status updated to SENT.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setError(res.error || "Failed to mark as sent");
    }
  };

  // Copy to clipboard
  const handleCopy = (message: OutreachMessage) => {
    const textToCopy =
      message.channel === "email" && message.subject
        ? `Subject: ${message.subject}\n\n${message.body}`
        : message.body;

    navigator.clipboard.writeText(textToCopy);
    setCopiedId(message.id);
    setSuccessMsg(
      message.channel === "linkedin"
        ? "LinkedIn draft copied! Ready to paste into LinkedIn."
        : "Email draft & subject copied! Ready to paste into your email client."
    );
    setTimeout(() => {
      setCopiedId(null);
      setSuccessMsg(null);
    }, 3000);
  };

  // Open Edit Modal
  const openEdit = (message: OutreachMessage) => {
    setEditingMessage(message);
    setEditSubject(message.subject || "");
    setEditBody(message.body);
    setIsEditModalOpen(true);
  };

  // Submit Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMessage) return;

    setSavingEdit(true);
    const res = await editOutreachApi(editingMessage.id, {
      subject: editingMessage.channel === "email" ? editSubject : undefined,
      body: editBody,
    });
    setSavingEdit(false);

    if (res.data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === editingMessage.id ? res.data! : m))
      );
      setIsEditModalOpen(false);
      setSuccessMsg("Draft changes saved.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setError(res.error || "Failed to update draft");
    }
  };

  // Delete message
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this outreach draft?")) return;
    const res = await deleteOutreachApi(id);
    if (res.data?.success) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setSuccessMsg("Draft deleted.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setError(res.error || "Failed to delete draft");
    }
  };

  // Filtered Messages
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (filterStatus !== "ALL" && m.status !== filterStatus) return false;
      if (filterChannel !== "ALL" && m.channel !== filterChannel) return false;
      return true;
    });
  }, [messages, filterStatus, filterChannel]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "NEEDS_REVIEW":
        return {
          label: "Needs Review",
          color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          icon: <Clock className="w-3 h-3" />,
        };
      case "APPROVED":
        return {
          label: "Approved",
          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          icon: <CheckCircle2 className="w-3 h-3" />,
        };
      case "SENT":
        return {
          label: "Sent",
          color: "bg-blue-500/10 text-blue-400 border-blue-500/30",
          icon: <Send className="w-3 h-3" />,
        };
      case "REJECTED":
        return {
          label: "Rejected",
          color: "bg-rose-500/10 text-rose-400 border-rose-500/30",
          icon: <XCircle className="w-3 h-3" />,
        };
      default:
        return {
          label: "Draft",
          color: "bg-slate-800 text-slate-400 border-slate-700",
          icon: <Edit3 className="w-3 h-3" />,
        };
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">
              Phase 10
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-xs text-slate-400">Outreach Agent</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center space-x-3">
            <span>Referral Outreach Studio</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Generate, review, and approve personalized referral emails and LinkedIn message drafts.
            Strict human-in-the-loop control with zero automated sending.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={loadMessages}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all shadow-sm disabled:opacity-50"
            title="Refresh Drafts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={openGenerateModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-brand-500/25 flex items-center space-x-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Outreach Draft</span>
          </button>
        </div>
      </div>

      {/* Safety & Protocol Banner */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md flex items-start space-x-3 text-xs text-slate-300">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-white">
            Human-in-the-Loop Protocol & Ethical Messaging Guidelines
          </p>
          <p className="text-slate-400 leading-relaxed">
            CareerPilot prepares personalized drafts for your review. Automated messaging is strictly disabled:
            all messages must be reviewed, approved, and manually sent by you. No unsolicited bulk messages or
            unauthorized LinkedIn bots.
          </p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80">
        {/* Status Filters */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
          {[
            { id: "ALL", label: "All Drafts" },
            { id: "NEEDS_REVIEW", label: "Needs Review" },
            { id: "APPROVED", label: "Approved" },
            { id: "SENT", label: "Sent" },
            { id: "REJECTED", label: "Rejected" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filterStatus === tab.id
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-slate-800/60 text-slate-400 hover:text-white border border-slate-700/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Channel Filters */}
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-semibold text-slate-400">Channel:</span>
          {[
            { id: "ALL", label: "All" },
            { id: "email", label: "Email" },
            { id: "linkedin", label: "LinkedIn" },
          ].map((ch) => (
            <button
              key={ch.id}
              onClick={() => setFilterChannel(ch.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                filterChannel === ch.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>
      </div>

      {/* Message Cards List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-3">
          <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-400 rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Loading Outreach Drafts...</p>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 text-center max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center mx-auto">
            <Send className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Outreach Messages Found</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {messages.length === 0
              ? "You haven't generated any outreach drafts yet. Select a referral contact and job to craft personalized message drafts."
              : "No drafts match the selected filters."}
          </p>
          <button
            type="button"
            onClick={openGenerateModal}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold inline-flex items-center space-x-2 shadow-md shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Generate First Draft</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredMessages.map((message) => {
            const statusBadge = getStatusBadge(message.status);
            const isEmail = message.channel === "email";
            const contact = message.contact;
            const job = message.job;

            return (
              <div
                key={message.id}
                className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 transition-all space-y-5 shadow-xl shadow-black/20"
              >
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start space-x-3.5">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                        isEmail
                          ? "bg-sky-500/10 border-sky-500/20 text-sky-400"
                          : "bg-blue-600/10 border-blue-500/20 text-blue-400"
                      }`}
                    >
                      {isEmail ? <Mail className="w-5 h-5" /> : <Linkedin className="w-5 h-5" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                          {isEmail ? "Referral Email" : "LinkedIn Message Draft"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border flex items-center space-x-1 ${statusBadge.color}`}
                        >
                          {statusBadge.icon}
                          <span>{statusBadge.label}</span>
                        </span>
                        {message.relationship_context && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            {message.relationship_context}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        {contact && (
                          <>
                            <span className="font-semibold text-white">{contact.name}</span>
                            <span>({contact.role} at {contact.company})</span>
                          </>
                        )}
                        {job && (
                          <>
                            <span>→</span>
                            <span className="text-brand-300 font-medium">
                              {job.role} at {job.company}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Date badge */}
                  <div className="text-[11px] text-slate-500 shrink-0 self-end sm:self-auto font-mono">
                    {new Date(message.created_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Subject Line (if email) */}
                {isEmail && message.subject && (
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-center space-x-2">
                    <span className="font-bold text-slate-400 text-[11px] uppercase">Subject:</span>
                    <span className="font-medium text-white">{message.subject}</span>
                  </div>
                )}

                {/* Body Content */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/90 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                  {message.body}
                </div>

                {/* Grounding & Metadata highlights */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {message.project_highlight
                        ? `Grounded in project: "${message.project_highlight}"`
                        : "Grounded in verified candidate background"}
                    </span>
                  </div>

                  {!isEmail && (
                    <span className="font-mono text-slate-500">
                      {message.body.length} characters (ideal for LinkedIn)
                    </span>
                  )}
                </div>

                {/* Card Actions (Edit, Approve, Reject, Copy, Mark Sent, Delete) */}
                <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                  {/* Left: Copy & Edit */}
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(message)}
                      className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
                    >
                      {copiedId === message.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Draft</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEdit(message)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center space-x-1.5 transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Edit</span>
                    </button>
                  </div>

                  {/* Right: Approval & Workflow state controls */}
                  <div className="flex items-center space-x-2">
                    {message.status === "NEEDS_REVIEW" && (
                      <>
                        <button
                          type="button"
                          disabled={actingId === message.id}
                          onClick={() => handleApprove(message.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1 shadow-sm transition-all disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>

                        <button
                          type="button"
                          disabled={actingId === message.id}
                          onClick={() => handleReject(message.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-300 border border-slate-700 text-xs font-semibold flex items-center space-x-1 transition-all disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    )}

                    {message.status === "APPROVED" && (
                      <button
                        type="button"
                        disabled={actingId === message.id}
                        onClick={() => handleMarkSent(message.id)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center space-x-1 shadow-sm transition-all disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Mark as Sent</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(message.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 transition-colors"
                      title="Delete Draft"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Draft Modal */}
      {isEditModalOpen && editingMessage && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <Edit3 className="w-5 h-5 text-brand-400" />
                <h2 className="text-lg font-bold text-white">
                  Edit Outreach Draft ({editingMessage.channel.toUpperCase()})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {editingMessage.channel === "email" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    required
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Message Body
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {editBody.length} characters
                  </span>
                </div>
                <textarea
                  rows={10}
                  required
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 font-sans leading-relaxed focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white shadow-md shadow-brand-500/20 disabled:opacity-50"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate New Outreach Modal */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <Sparkles className="w-5 h-5 text-brand-400" />
                <h2 className="text-lg font-bold text-white">Generate Outreach Drafts</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              {/* Select Job */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Job *
                </label>
                {jobs.length === 0 ? (
                  <p className="text-xs text-amber-400">
                    No jobs analyzed yet. Please import or analyze a job first.
                  </p>
                ) : (
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.role} at {j.company}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Select Contact */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Referral Contact *
                </label>
                {contacts.length === 0 ? (
                  <p className="text-xs text-amber-400">
                    No contacts saved yet. Please add a connection from the Referral page.
                  </p>
                ) : (
                  <select
                    value={selectedContactId}
                    onChange={(e) => setSelectedContactId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.role} at {c.company})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Select Channel */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Communication Channel
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "all", label: "Both (Email + LinkedIn)" },
                    { id: "email", label: "Email Draft" },
                    { id: "linkedin", label: "LinkedIn Draft" },
                  ].map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setSelectedChannel(ch.id as any)}
                      className={`p-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                        selectedChannel === ch.id
                          ? "bg-brand-600 text-white border-brand-500"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Instructions */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Custom Notes / Talking Points (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Mention that I loved their talk on distributed databases at QCon..."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating || jobs.length === 0 || contacts.length === 0}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white shadow-md shadow-brand-500/20 disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{generating ? "Crafting Drafts..." : "Generate Drafts"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
