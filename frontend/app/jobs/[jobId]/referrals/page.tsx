"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Users,
  Building2,
  GraduationCap,
  Briefcase,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  Mail,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Send,
  Edit2,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import {
  fetchJobApi,
  fetchJobReferralsApi,
  discoverJobReferralsApi,
  updateReferralStatusApi,
  createContactApi,
  updateContactApi,
  deleteContactApi,
  Job,
  Referral,
  Contact,
  JobReferralsResult,
} from "@/lib/api";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import LoadingState from "@/components/ui/LoadingState";

export default function JobReferralsPage() {
  const params = useParams();
  const jobId = (params?.jobId as string) || "";

  const [job, setJob] = useState<Job | null>(null);
  const [referralsData, setReferralsData] = useState<JobReferralsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRelationship, setFilterRelationship] = useState<string>("all");
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Modal State for Add / Edit Contact
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState({
    name: "",
    company: "",
    role: "",
    department: "",
    university: "",
    source: "user_provided",
    profile_url: "",
    email: "",
    relationship: "",
    notes: "",
    skills: "",
  });
  const [savingContact, setSavingContact] = useState(false);

  // Status updating
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Initial Data Fetch
  useEffect(() => {
    async function loadData() {
      if (!jobId) return;
      setLoading(true);
      setError(null);

      try {
        const [jobRes, refRes] = await Promise.all([
          fetchJobApi(jobId),
          fetchJobReferralsApi(jobId),
        ]);

        if (jobRes.data) {
          setJob(jobRes.data);
        } else {
          setError(jobRes.error || "Failed to load job details");
        }

        if (refRes.data) {
          setReferralsData(refRes.data);
        }
      } catch (err: any) {
        setError(err?.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [jobId]);

  // Run Referral Discovery
  const handleDiscover = async () => {
    setDiscovering(true);
    setError(null);
    setSuccessMsg(null);

    const res = await discoverJobReferralsApi(jobId);
    setDiscovering(false);

    if (res.data) {
      setReferralsData(res.data);
      setSuccessMsg(
        `Discovered ${res.data.referrals.length} verified referral opportunities!`
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setError(res.error || "Referral discovery failed");
    }
  };

  // Status change handler
  const handleStatusChange = async (referralId: string, newStatus: string) => {
    setUpdatingStatusId(referralId);
    const res = await updateReferralStatusApi(jobId, referralId, newStatus);
    setUpdatingStatusId(null);

    if (res.data) {
      setReferralsData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          referrals: prev.referrals.map((r) =>
            r.id === referralId ? { ...r, status: newStatus } : r
          ),
        };
      });
    } else {
      setError(res.error || "Failed to update referral status");
    }
  };

  // Open Add Contact Modal
  const openAddModal = () => {
    setEditingContact(null);
    setContactForm({
      name: "",
      company: job?.company || "",
      role: "",
      department: "Engineering",
      university: "",
      source: "user_provided",
      profile_url: "",
      email: "",
      relationship: "",
      notes: "",
      skills: "",
    });
    setIsModalOpen(true);
  };

  // Open Edit Contact Modal
  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setContactForm({
      name: contact.name || "",
      company: contact.company || "",
      role: contact.role || "",
      department: contact.department || "",
      university: contact.university || "",
      source: contact.source || "user_provided",
      profile_url: contact.profile_url || "",
      email: contact.email || "",
      relationship: contact.relationship || "",
      notes: contact.notes || "",
      skills: (contact.skills || []).join(", "),
    });
    setIsModalOpen(true);
  };

  // Save Contact (Create or Edit)
  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.company || !contactForm.role) {
      setError("Please fill in Name, Company, and Role.");
      return;
    }

    setSavingContact(true);
    setError(null);

    const skillsArray = contactForm.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: Partial<Contact> = {
      name: contactForm.name.trim(),
      company: contactForm.company.trim(),
      role: contactForm.role.trim(),
      department: contactForm.department.trim() || undefined,
      university: contactForm.university.trim() || undefined,
      source: contactForm.source,
      profile_url: contactForm.profile_url.trim() || undefined,
      email: contactForm.email.trim() || undefined,
      relationship: contactForm.relationship.trim() || undefined,
      notes: contactForm.notes.trim() || undefined,
      skills: skillsArray,
    };

    if (editingContact?.id) {
      const res = await updateContactApi(editingContact.id, payload);
      setSavingContact(false);
      if (res.data) {
        setIsModalOpen(false);
        setSuccessMsg(`Updated contact "${res.data.name}"`);
        handleDiscover();
      } else {
        setError(res.error || "Failed to update contact");
      }
    } else {
      const res = await createContactApi(payload);
      setSavingContact(false);
      if (res.data) {
        setIsModalOpen(false);
        setSuccessMsg(`Added new contact "${res.data.name}"`);
        handleDiscover();
      } else {
        setError(res.error || "Failed to create contact");
      }
    }
  };

  // Delete Contact
  const handleDeleteContact = async (contactId: string, contactName: string) => {
    if (!confirm(`Are you sure you want to remove "${contactName}"?`)) return;

    const res = await deleteContactApi(contactId);
    if (res.data?.success) {
      setSuccessMsg(`Contact "${contactName}" deleted.`);
      setReferralsData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          referrals: prev.referrals.filter((r) => r.contact_id !== contactId),
        };
      });
    } else {
      setError(res.error || "Failed to delete contact");
    }
  };

  // Copy Email to clipboard
  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2500);
  };

  // Filtered referrals
  const filteredReferrals = useMemo(() => {
    if (!referralsData?.referrals) return [];
    return referralsData.referrals.filter((ref) => {
      const contact = ref.contact;
      if (!contact) return false;

      if (
        filterRelationship !== "all" &&
        ref.relationship_type.toLowerCase() !== filterRelationship.toLowerCase()
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = contact.name.toLowerCase().includes(query);
        const matchesCompany = contact.company.toLowerCase().includes(query);
        const matchesRole = contact.role.toLowerCase().includes(query);
        const matchesUni = (contact.university || "").toLowerCase().includes(query);
        const matchesSkills = (contact.skills || []).some((s) =>
          s.toLowerCase().includes(query)
        );
        if (!matchesName && !matchesCompany && !matchesRole && !matchesUni && !matchesSkills) {
          return false;
        }
      }

      return true;
    });
  }, [referralsData, filterRelationship, searchQuery]);

  const getRelationshipBadgeVariant = (type: string): "success" | "neutral" | "brand" => {
    switch (type.toLowerCase()) {
      case "current employee":
        return "success";
      case "university alumni":
        return "brand";
      default:
        return "neutral";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "contacted":
        return { label: "Contacted", variant: "brand" as const };
      case "drafted":
        return { label: "Outreach Drafted", variant: "neutral" as const };
      case "referred":
        return { label: "Referral Submitted", variant: "success" as const };
      case "declined":
        return { label: "Declined", variant: "error" as const };
      default:
        return { label: "Discovered", variant: "neutral" as const };
    }
  };

  if (loading) {
    return <LoadingState message="Discovering referral opportunities..." />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header & Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Link
              href={`/jobs/${jobId}`}
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Job Evaluation</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-900">Referrals</span>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                <span>Referral Discovery</span>
              </h1>
              <p className="text-xs text-slate-500">
                Target: <span className="font-semibold text-slate-800">{job?.role}</span> at{" "}
                <span className="font-semibold text-slate-900">{job?.company}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button type="button" onClick={openAddModal} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Add Connection</span>
          </Button>

          <Button
            type="button"
            onClick={handleDiscover}
            disabled={discovering}
            variant="primary"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${discovering ? "animate-spin" : ""}`} />
            <span>{discovering ? "Scoring..." : "Refresh Discovery"}</span>
          </Button>
        </div>
      </div>

      {/* Safety Policy & Ethics Compliance Notice */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start space-x-3 text-xs text-slate-700">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-slate-900">
            Ethical & Permitted Sourcing Compliance
          </p>
          <p className="text-slate-500 leading-relaxed">
            CareerPilot identifies referral pathways strictly through user-provided connections, verified alumni networks, and authorized company directories. We do{" "}
            <span className="text-slate-800 font-semibold">NOT</span> scrape LinkedIn without authorization, automate messaging, or send unsolicited bulk outreach.
          </p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-slate-400 hover:text-slate-700 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search and Relationship Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search contacts, roles, schools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
          />
        </div>

        <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All Contacts" },
            { id: "current employee", label: "Company Insiders" },
            { id: "university alumni", label: "Alumni" },
            { id: "former colleague", label: "Colleagues" },
            { id: "user-provided connection", label: "Direct Connections" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterRelationship(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filterRelationship === tab.id
                  ? "bg-slate-900 text-white font-semibold shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Discovered Referrals List */}
      {filteredReferrals.length === 0 ? (
        <EmptyState
          title="No Matching Referral Contacts Found"
          description={
            referralsData?.referrals.length === 0
              ? `You haven't added any contacts associated with ${job?.company || "this company"} or your alumni network yet. Add a colleague or insider contact to calculate referral relevance.`
              : "No contacts match the selected search and filter criteria."
          }
          action={{
            label: "Add Your First Contact",
            onClick: openAddModal,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredReferrals.map((referral) => {
            const contact = referral.contact;
            if (!contact) return null;

            const score = referral.relevance_score;
            const statusInfo = getStatusBadge(referral.status);

            return (
              <Card
                key={referral.id}
                className="p-6 space-y-5"
                hover
              >
                {/* Header: Contact Info & Relevance Gauge */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 font-bold text-base shrink-0">
                      {contact.name.charAt(0)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{contact.name}</h3>
                        <Badge variant={getRelationshipBadgeVariant(referral.relationship_type)}>
                          {referral.relationship_type}
                        </Badge>
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center space-x-1 text-slate-700">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          <span>{contact.role}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center space-x-1 text-slate-700">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{contact.company}</span>
                        </span>
                        {contact.university && (
                          <>
                            <span>•</span>
                            <span className="flex items-center space-x-1 text-slate-700">
                              <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                              <span>{contact.university}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Score Gauge */}
                  <div className="flex items-center space-x-3 shrink-0 self-end sm:self-auto">
                    <div className="text-right">
                      <div className="text-lg font-black font-mono text-emerald-700">
                        {score}%
                      </div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">
                        Relevance Score
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center p-1">
                      <div
                        className="w-full h-full rounded-full flex items-center justify-center font-bold text-xs"
                        style={{
                          background: `conic-gradient(#059669 ${score * 3.6}deg, #e2e8f0 0deg)`,
                        }}
                      >
                        <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-[10px] text-emerald-700 font-mono">
                          ★
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Relevance Reason Callout */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700 leading-relaxed flex items-start space-x-2.5">
                  <Sparkles className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <p>{referral.relevance_reason}</p>
                </div>

                {/* Transparent Evidence & Factor Breakdown */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Verifiable Evidence Breakdown</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {referral.evidence.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/70 text-xs space-y-1 flex items-start justify-between"
                      >
                        <div className="space-y-0.5 pr-2">
                          <span className="font-semibold text-slate-800 capitalize text-[11px]">
                            {item.factor.replace("_", " ")}
                          </span>
                          <p className="text-slate-500 text-[11px]">{item.evidence}</p>
                        </div>
                        {item.score_contribution > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px] font-bold shrink-0">
                            +{item.score_contribution}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contact Skills (if present) */}
                {contact.skills && contact.skills.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-slate-500 mr-1">
                      Technical Stack:
                    </span>
                    {contact.skills.map((skill, sIdx) => (
                      <span
                        key={sIdx}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] border border-slate-200/70 font-mono"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer Controls: Contact Details, Outreach Status & Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* Legitimate Contact Channels */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {contact.email ? (
                      <button
                        type="button"
                        onClick={() => handleCopyEmail(contact.email!)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-800 transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>{contact.email}</span>
                        {copiedEmail === contact.email ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 ml-1" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-400 ml-1" />
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        No direct email registered
                      </span>
                    )}

                    {contact.profile_url && (
                      <a
                        href={contact.profile_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-800 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                        <span>Profile Link</span>
                      </a>
                    )}
                  </div>

                  {/* Outreach Status Selector & CRUD actions */}
                  <div className="flex items-center space-x-2 self-end md:self-auto">
                    <Link href="/outreach">
                      <Button variant="primary" size="sm">
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        <span>Draft Outreach</span>
                      </Button>
                    </Link>

                    <span className="text-[11px] text-slate-500 font-semibold ml-1">Status:</span>
                    <select
                      value={referral.status}
                      disabled={updatingStatusId === referral.id}
                      onChange={(e) => handleStatusChange(referral.id, e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
                    >
                      <option value="suggested">Suggested</option>
                      <option value="drafted">Outreach Drafted</option>
                      <option value="contacted">Contacted</option>
                      <option value="referred">Referred</option>
                      <option value="declined">Declined</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => openEditModal(contact)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                      title="Edit Contact"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteContact(contact.id!, contact.name)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors"
                      title="Delete Contact"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <Users className="w-5 h-5 text-slate-700" />
                <h2 className="text-base font-bold text-slate-900">
                  {editingContact ? "Edit Professional Contact" : "Add Connection"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jordan Lee"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Company *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Google, Stripe"
                    value={contactForm.company}
                    onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Role / Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Staff Software Engineer"
                    value={contactForm.role}
                    onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Engineering, Product"
                    value={contactForm.department}
                    onChange={(e) => setContactForm({ ...contactForm, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    University / Alma Mater
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Stanford University"
                    value={contactForm.university}
                    onChange={(e) => setContactForm({ ...contactForm, university: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Source
                  </label>
                  <select
                    value={contactForm.source}
                    onChange={(e) => setContactForm({ ...contactForm, source: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="user_provided">User-Provided Connection</option>
                    <option value="university_alumni">University Alumni Network</option>
                    <option value="former_colleague">Former Colleague</option>
                    <option value="authorized_directory">Authorized Company Directory</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email (if legitimately available)
                  </label>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Profile URL (public / portfolio)
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={contactForm.profile_url}
                    onChange={(e) => setContactForm({ ...contactForm, profile_url: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Skills / Domain Expertise (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kubernetes, Go, Distributed Systems, Python"
                  value={contactForm.skills}
                  onChange={(e) => setContactForm({ ...contactForm, skills: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Relationship / Context Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Worked together on payments infra at Stripe; Stanford CS '21 classmate."
                  value={contactForm.notes}
                  onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  variant="ghost"
                  size="sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingContact}
                  variant="primary"
                  size="sm"
                >
                  {savingContact ? "Saving..." : editingContact ? "Update Contact" : "Add Contact"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
