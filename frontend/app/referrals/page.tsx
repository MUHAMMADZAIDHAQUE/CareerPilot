"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Users2,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Building2,
  Mail,
  Linkedin,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Check,
  X,
  Send,
  UserCheck,
  Briefcase,
  GraduationCap,
} from "lucide-react";
import {
  fetchContactsApi,
  createContactApi,
  generateOutreachApi,
  fetchJobsApi,
  Contact,
  Job,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/States";

export default function ReferralWorkspacePage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [relationshipFilter, setRelationshipFilter] = useState("all");

  // Add Contact Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    company: "",
    role: "",
    source: "Manual",
    profile_url: "",
    email: "",
    relationship: "Alumni",
    university: "",
    skills: "",
    notes: "",
  });
  const [addingContact, setAddingContact] = useState(false);

  // Generate Outreach Modal State
  const [selectedContactForOutreach, setSelectedContactForOutreach] = useState<Contact | null>(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<"LINKEDIN" | "EMAIL">("LINKEDIN");
  const [customPrompt, setCustomPrompt] = useState("");
  const [generatingOutreach, setGeneratingOutreach] = useState(false);
  const [outreachSuccess, setOutreachSuccess] = useState<string | null>(null);
  const [outreachError, setOutreachError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [contactsRes, jobsRes] = await Promise.all([
        fetchContactsApi(),
        fetchJobsApi({ limit: 50 }),
      ]);

      if (contactsRes.data) setContacts(contactsRes.data);
      if (jobsRes.data) setJobs(jobsRes.data);
    } catch (err: any) {
      setError(err?.message || "Failed to load referral contacts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleAddContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.company.trim() || !addForm.role.trim()) return;

    setAddingContact(true);
    const skillsArray = addForm.skills
      ? addForm.skills.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const res = await createContactApi({
      name: addForm.name.trim(),
      company: addForm.company.trim(),
      role: addForm.role.trim(),
      source: addForm.source,
      profile_url: addForm.profile_url.trim() || undefined,
      email: addForm.email.trim() || undefined,
      relationship: addForm.relationship,
      university: addForm.university.trim() || undefined,
      skills: skillsArray,
      notes: addForm.notes.trim() || undefined,
    });

    setAddingContact(false);

    if (res.data) {
      setShowAddModal(false);
      setAddForm({
        name: "",
        company: "",
        role: "",
        source: "Manual",
        profile_url: "",
        email: "",
        relationship: "Alumni",
        university: "",
        skills: "",
        notes: "",
      });
      loadData();
    } else {
      alert(res.error || "Failed to add contact");
    }
  };

  const handleGenerateOutreachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactForOutreach?.id) return;

    if (!selectedJobId) {
      setOutreachError("Please select a target job opportunity for grounded referral outreach.");
      return;
    }

    setGeneratingOutreach(true);
    setOutreachSuccess(null);
    setOutreachError(null);

    const res = await generateOutreachApi({
      contact_id: selectedContactForOutreach.id,
      job_id: selectedJobId,
      channel: selectedChannel.toLowerCase() === "email" ? "email" : "linkedin",
      custom_instructions: customPrompt.trim() || undefined,
    });

    setGeneratingOutreach(false);

    if (res.data) {
      setOutreachSuccess(
        `Draft generated successfully! Added to your Outreach review queue.`
      );
    } else {
      setOutreachError(res.error || "Failed to generate outreach message");
    }
  };

  // Distinct company options for filter
  const uniqueCompanies = useMemo(() => {
    const set = new Set(contacts.map((c) => c.company));
    return Array.from(set);
  }, [contacts]);

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const matchSearch =
        !searchQuery.trim() ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.role.toLowerCase().includes(searchQuery.toLowerCase());

      const matchComp = companyFilter === "all" || c.company.toLowerCase() === companyFilter.toLowerCase();

      const matchRel =
        relationshipFilter === "all" ||
        (c.relationship && c.relationship.toLowerCase() === relationshipFilter.toLowerCase());

      return matchSearch && matchComp && matchRel;
    });
  }, [contacts, searchQuery, companyFilter, relationshipFilter]);

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
            Referral Workspace
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Discover internal champions, map organizational relationships, and generate grounded outreach drafts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            loading={refreshing}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Add Contact
          </Button>
        </div>
      </div>

      {/* Toolbar: Search & Filters */}
      <div className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-card grid grid-cols-1 md:grid-cols-3 gap-3">
        <Input
          placeholder="Search by contact name, company, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search className="w-4 h-4" />}
        />

        <Select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
        >
          <option value="all">All Companies ({uniqueCompanies.length})</option>
          {uniqueCompanies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>

        <Select
          value={relationshipFilter}
          onChange={(e) => setRelationshipFilter(e.target.value)}
        >
          <option value="all">All Relationship Types</option>
          <option value="alumni">Alumni Network</option>
          <option value="former colleague">Former Colleague</option>
          <option value="domain fit">Domain Fit</option>
          <option value="first degree">First Degree</option>
        </Select>
      </div>

      {/* Contacts List Grid */}
      {loading ? (
        <LoadingState message="Loading potential referral contacts..." />
      ) : error ? (
        <ErrorState title="Could not load contacts" error={error} onRetry={loadData} />
      ) : filteredContacts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header: Name & Relationship */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                      {contact.name}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{contact.role} at {contact.company}</span>
                    </p>
                  </div>

                  <Badge variant="blue" size="sm">
                    {contact.relationship || "Contact"}
                  </Badge>
                </div>

                {/* Details */}
                <div className="text-xs text-slate-500 space-y-1.5 pt-1">
                  {contact.university && (
                    <p className="flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                      <span>{contact.university}</span>
                    </p>
                  )}
                  {contact.email && (
                    <p className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{contact.email}</span>
                    </p>
                  )}
                  {contact.source && (
                    <p className="text-[11px] font-mono text-slate-400">
                      Source: {contact.source}
                    </p>
                  )}
                </div>

                {/* Skills tags */}
                {contact.skills && contact.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {contact.skills.slice(0, 3).map((sk, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
                {contact.profile_url ? (
                  <a
                    href={contact.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    <span>Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-slate-400 text-[11px]">No profile URL</span>
                )}

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedContactForOutreach(contact);
                      setSelectedChannel("LINKEDIN");
                      setOutreachSuccess(null);
                      setOutreachError(null);
                    }}
                    icon={<Linkedin className="w-3.5 h-3.5 text-blue-600" />}
                  >
                    LinkedIn
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setSelectedContactForOutreach(contact);
                      setSelectedChannel("EMAIL");
                      setOutreachSuccess(null);
                      setOutreachError(null);
                    }}
                    icon={<Mail className="w-3.5 h-3.5" />}
                  >
                    Email
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No Referral Contacts Found"
          description="Build your warm introduction network by adding colleagues, alumni, or domain contacts."
          actionText="Add New Contact"
          onAction={() => setShowAddModal(true)}
        />
      )}

      {/* Add Contact Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Referral Contact"
        description="Save trusted contacts for tailored outreach generation and referral tracking."
      >
        <form onSubmit={handleAddContactSubmit} className="space-y-4">
          <Input
            label="Full Name *"
            placeholder="e.g. Sarah Jenkins"
            value={addForm.name}
            onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Company *"
              placeholder="e.g. Stripe"
              value={addForm.company}
              onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
              required
            />
            <Input
              label="Role *"
              placeholder="e.g. Staff Software Engineer"
              value={addForm.role}
              onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Relationship"
              value={addForm.relationship}
              onChange={(e) => setAddForm({ ...addForm, relationship: e.target.value })}
            >
              <option value="Alumni">Alumni</option>
              <option value="Former Colleague">Former Colleague</option>
              <option value="Domain Fit">Domain Fit</option>
              <option value="Mutual Connection">Mutual Connection</option>
            </Select>

            <Input
              label="University / Organization"
              placeholder="e.g. UC Berkeley"
              value={addForm.university}
              onChange={(e) => setAddForm({ ...addForm, university: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="LinkedIn Profile URL"
              placeholder="https://linkedin.com/in/..."
              value={addForm.profile_url}
              onChange={(e) => setAddForm({ ...addForm, profile_url: e.target.value })}
            />
            <Input
              label="Email Address"
              placeholder="sarah@example.com"
              type="email"
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
            />
          </div>

          <Input
            label="Domain Skills / Focus (comma-separated)"
            placeholder="e.g. Distributed Systems, Kubernetes, Go"
            value={addForm.skills}
            onChange={(e) => setAddForm({ ...addForm, skills: e.target.value })}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={addingContact}
              disabled={!addForm.name.trim() || !addForm.company.trim()}
            >
              Save Contact
            </Button>
          </div>
        </form>
      </Modal>

      {/* Generate Outreach Message Modal */}
      <Modal
        isOpen={Boolean(selectedContactForOutreach)}
        onClose={() => {
          setSelectedContactForOutreach(null);
          setOutreachSuccess(null);
          setOutreachError(null);
        }}
        title={`Generate Outreach for ${selectedContactForOutreach?.name}`}
        description="Synthesize a personalized, fact-grounded referral message. No automated sending."
      >
        <form onSubmit={handleGenerateOutreachSubmit} className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <span className="font-semibold text-slate-900 block">
              {selectedContactForOutreach?.name} • {selectedContactForOutreach?.role} at {selectedContactForOutreach?.company}
            </span>
            <span className="text-slate-500">
              Relationship: {selectedContactForOutreach?.relationship || "Contact"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Outreach Channel"
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value as any)}
            >
              <option value="LINKEDIN">LinkedIn InMail / Message (under 300 words)</option>
              <option value="EMAIL">Professional Email</option>
            </Select>

            <Select
              label="Target Job Opportunity (Required)"
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              required
            >
              <option value="">Select target job...</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.role} at {j.company}
                </option>
              ))}
            </Select>
          </div>

          <Input
            label="Specific Angle / Note (Optional)"
            placeholder="e.g. Mention mutual interest in distributed consensus and our shared university alumni..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
          />

          {outreachSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{outreachSuccess}</span>
              </div>
              <Link
                href="/outreach"
                className="text-xs font-semibold text-emerald-950 underline shrink-0 ml-2"
              >
                Go to Outreach Queue →
              </Link>
            </div>
          )}

          {outreachError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center space-x-2">
              <X className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{outreachError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedContactForOutreach(null)}
            >
              Close
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={generatingOutreach}
              icon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Generate Draft Message
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
