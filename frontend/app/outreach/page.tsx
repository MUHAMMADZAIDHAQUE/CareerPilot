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
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/States";

export default function OutreachPage() {
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterChannel, setFilterChannel] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId || !selectedContactId) {
      setError("Please select both a Job and a Contact.");
      return;
    }

    setGenerating(true);
    setError(null);
    setSuccessMsg(null);

    const channelParam =
      selectedChannel === "email" ? "email" : selectedChannel === "linkedin" ? "linkedin" : undefined;

    const res = await generateOutreachApi({
      job_id: selectedJobId,
      contact_id: selectedContactId,
      channel: channelParam,
      custom_instructions: customInstructions.trim() || undefined,
    });

    setGenerating(false);

    if (res.data) {
      setIsGenerateModalOpen(false);
      setCustomInstructions("");
      setSuccessMsg("Outreach drafts generated! Please review and approve before sending.");
      loadMessages();
    } else {
      setError(res.error || "Failed to generate outreach drafts");
    }
  };

  const handleApprove = async (id: string) => {
    setActingId(id);
    const res = await approveOutreachApi(id);
    setActingId(null);
    if (res.data) {
      setSuccessMsg("Message approved for sending!");
      loadMessages();
    } else {
      setError(res.error || "Failed to approve message");
    }
  };

  const handleReject = async (id: string) => {
    setActingId(id);
    const res = await rejectOutreachApi(id);
    setActingId(null);
    if (res.data) {
      setSuccessMsg("Message marked as rejected.");
      loadMessages();
    } else {
      setError(res.error || "Failed to reject message");
    }
  };

  const handleMarkSent = async (id: string) => {
    setActingId(id);
    const res = await markOutreachSentApi(id);
    setActingId(null);
    if (res.data) {
      setSuccessMsg("Message recorded as sent!");
      loadMessages();
    } else {
      setError(res.error || "Failed to mark as sent");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this outreach draft?")) return;
    setActingId(id);
    const res = await deleteOutreachApi(id);
    setActingId(null);
    if (res.data) {
      setSuccessMsg("Draft deleted.");
      loadMessages();
    } else {
      setError(res.error || "Failed to delete message");
    }
  };

  const openEditModal = (message: OutreachMessage) => {
    setEditingMessage(message);
    setEditSubject(message.subject || "");
    setEditBody(message.body);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMessage) return;

    setSavingEdit(true);
    const res = await editOutreachApi(editingMessage.id, {
      subject: editSubject.trim() || undefined,
      body: editBody.trim(),
    });
    setSavingEdit(false);

    if (res.data) {
      setIsEditModalOpen(false);
      setSuccessMsg("Message draft updated.");
      loadMessages();
    } else {
      setError(res.error || "Failed to update message");
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  };

  // Filtered List
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      const matchStatus = filterStatus === "ALL" || m.status === filterStatus;
      const matchChannel = filterChannel === "ALL" || m.channel.toLowerCase() === filterChannel.toLowerCase();
      return matchStatus && matchChannel;
    });
  }, [messages, filterStatus, filterChannel]);

  return (
    <div className="space-y-8 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Human-in-the-Loop • Zero Automated Spamming</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Referral Outreach Studio
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review, edit, and approve personalized referral messages and email drafts before sending.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMessages}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={openGenerateModal}
            icon={<Plus className="w-4 h-4" />}
          >
            Generate Outreach
          </Button>
        </div>
      </div>

      {/* Safety Protocol Banner */}
      <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/70 flex items-start space-x-3 text-xs text-slate-600">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-slate-900">
            Mandatory Human Review Policy
          </p>
          <p className="text-slate-500 leading-relaxed">
            CareerPilot generates grounded drafts based on candidate proof and mutual history. Bulk automated sending is strictly prevented: each message must be explicitly approved and sent through your own accounts.
          </p>
        </div>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3.5 rounded-xl border border-slate-200/90 bg-white shadow-card">
        {/* Status Filters */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
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
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filterStatus === tab.id
                  ? "bg-slate-900 text-white font-semibold shadow-subtle"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Channel Filters */}
        <div className="flex items-center space-x-1.5 text-xs text-slate-500">
          <span className="font-medium">Channel:</span>
          {["ALL", "email", "linkedin"].map((ch) => (
            <button
              key={ch}
              onClick={() => setFilterChannel(ch)}
              className={`px-2 py-0.5 rounded-md font-medium uppercase text-[11px] ${
                filterChannel === ch
                  ? "bg-slate-200 text-slate-900 font-semibold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Grid */}
      {loading ? (
        <LoadingState message="Loading outreach review queue..." />
      ) : filteredMessages.length > 0 ? (
        <div className="space-y-4">
          {filteredMessages.map((message) => {
            const isEmail = message.channel.toUpperCase() === "EMAIL";
            const isPending = message.status === "NEEDS_REVIEW";
            const isApproved = message.status === "APPROVED";
            const isSent = message.status === "SENT";

            return (
              <div
                key={message.id}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card hover:border-slate-300 transition-all space-y-4"
              >
                {/* Header: Channel, Contact, Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
                      {isEmail ? <Mail className="w-4 h-4" /> : <Linkedin className="w-4 h-4 text-blue-600" />}
                    </span>
                    <div>
                      <span className="text-sm font-semibold text-slate-900">
                        {message.contact ? message.contact.name : "Contact"}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">
                        {message.contact?.company || "Company"} • {message.contact?.role || "Role"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={
                        isSent
                          ? "success"
                          : isApproved
                          ? "blue"
                          : isPending
                          ? "warning"
                          : "neutral"
                      }
                      size="sm"
                    >
                      {message.status}
                    </Badge>
                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(message.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Subject & Body */}
                <div className="space-y-2">
                  {message.subject && (
                    <div className="text-xs font-semibold text-slate-900">
                      <span className="text-slate-400 font-normal">Subject: </span>
                      {message.subject}
                    </div>
                  )}

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-800 font-sans leading-relaxed whitespace-pre-wrap">
                    {message.body}
                  </div>
                </div>

                {/* Grounding & Evidence Tags */}
                {message.tailoring_points && message.tailoring_points.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">Grounded Talking Points:</span>
                    {message.tailoring_points.map((pt, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-medium"
                      >
                        {pt}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions Strip */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(message.id, message.body)}
                      icon={copiedId === message.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    >
                      {copiedId === message.id ? "Copied!" : "Copy Text"}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(message)}
                      icon={<Edit3 className="w-3.5 h-3.5" />}
                    >
                      Edit
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(message.id)}
                      icon={<Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-600" />}
                    >
                      Delete
                    </Button>
                  </div>

                  {/* State transition buttons */}
                  <div className="flex items-center space-x-2">
                    {isPending && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(message.id)}
                          disabled={actingId === message.id}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleApprove(message.id)}
                          loading={actingId === message.id}
                          icon={<Check className="w-3.5 h-3.5" />}
                        >
                          Approve Draft
                        </Button>
                      </>
                    )}

                    {isApproved && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleMarkSent(message.id)}
                        loading={actingId === message.id}
                        icon={<Send className="w-3.5 h-3.5" />}
                      >
                        Mark as Sent
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No Outreach Drafts Found"
          description="Generate tailored outreach messages for contacts in your Referral Workspace."
          actionText="Generate Outreach Draft"
          onAction={openGenerateModal}
        />
      )}

      {/* Edit Message Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Outreach Message"
        description="Refine wording before approving or copying."
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {editingMessage?.subject !== undefined && (
            <Input
              label="Subject Line"
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
            />
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Message Body *
            </label>
            <textarea
              rows={6}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 leading-relaxed font-sans"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={savingEdit}
            >
              Save Draft
            </Button>
          </div>
        </form>
      </Modal>

      {/* Generate Outreach Modal */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Generate Grounded Outreach Draft"
        description="Select a job opportunity and contact to produce personalized referral messages."
      >
        <form onSubmit={handleGenerate} className="space-y-4">
          <Select
            label="Target Job Opportunity *"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            required
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.role} at {j.company}
              </option>
            ))}
          </Select>

          <Select
            label="Target Contact *"
            value={selectedContactId}
            onChange={(e) => setSelectedContactId(e.target.value)}
            required
          >
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.role} at {c.company}) • {c.relationship || "Contact"}
              </option>
            ))}
          </Select>

          <Select
            label="Outreach Channel"
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value as any)}
          >
            <option value="all">Generate Both (LinkedIn & Email)</option>
            <option value="linkedin">LinkedIn Message Only</option>
            <option value="email">Professional Email Only</option>
          </Select>

          <Input
            label="Custom Angle or Focus (Optional)"
            placeholder="e.g. Focus on our mutual interest in distributed systems..."
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsGenerateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={generating}
              disabled={!selectedJobId || !selectedContactId}
              icon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Generate Drafts
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
