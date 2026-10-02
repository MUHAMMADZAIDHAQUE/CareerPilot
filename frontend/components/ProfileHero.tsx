"use client";

import React, { useState } from "react";
import { Candidate, updateCandidateProfile } from "@/lib/api";
import {
  User,
  Mail,
  MapPin,
  Phone,
  Linkedin,
  Github,
  Globe,
  UploadCloud,
  CheckCircle2,
  Briefcase,
  Upload,
  Edit3,
  Save,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface ProfileHeroProps {
  candidate: Candidate | null;
  onOpenImportModal: () => void;
  onOpenUploadModal: () => void;
  onRefresh: () => void;
}

export default function ProfileHero({
  candidate,
  onOpenImportModal,
  onOpenUploadModal,
  onRefresh,
}: ProfileHeroProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: candidate?.full_name || "",
    headline: candidate?.headline || "",
    location: candidate?.location || "",
    phone: candidate?.phone || "",
    summary: candidate?.summary || "",
    linkedin_url: candidate?.linkedin_url || "",
    github_url: candidate?.github_url || "",
    portfolio_url: candidate?.portfolio_url || "",
  });

  const handleOpenEdit = () => {
    if (candidate) {
      setForm({
        full_name: candidate.full_name || "",
        headline: candidate.headline || "",
        location: candidate.location || "",
        phone: candidate.phone || "",
        summary: candidate.summary || "",
        linkedin_url: candidate.linkedin_url || "",
        github_url: candidate.github_url || "",
        portfolio_url: candidate.portfolio_url || "",
      });
    }
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate) return;
    setSaving(true);
    try {
      const res = await updateCandidateProfile(form, candidate.id);
      if (res.data) {
        setIsEditModalOpen(false);
        onRefresh();
      } else {
        alert(res.error || "Failed to update profile facts");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to update profile facts");
    } finally {
      setSaving(false);
    }
  };
  if (!candidate) {
    return (
      <div className="bg-white dark:bg-[#111827] rounded-2xl p-8 sm:p-12 text-center space-y-5 border-2 border-dashed border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300">
          <User className="w-6 h-6" />
        </div>
        <div className="max-w-md mx-auto space-y-1.5">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            No Verified Candidate Profile Found
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Upload your resume (.pdf, .tex, .txt) or import structured JSON to initialize your verified career profile and ground AI matching.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button onClick={onOpenUploadModal} variant="primary" size="md">
            <Upload className="w-4 h-4 mr-2" />
            Upload Resume (.pdf, .tex)
          </Button>
          <Button onClick={onOpenImportModal} variant="outline" size="md">
            <UploadCloud className="w-4 h-4 mr-2 text-slate-600 dark:text-slate-400" />
            Paste / Load JSON
          </Button>
        </div>
      </div>
    );
  }

  const initials = candidate.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="bg-white dark:bg-[#111827] rounded-2xl p-6 sm:p-8 space-y-6 border border-slate-200/90 dark:border-slate-800 shadow-card dark:shadow-none">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex items-start space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold text-2xl tracking-tight flex-shrink-0 shadow-sm">
            {initials || "CP"}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                {candidate.full_name}
              </h1>
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                Verified Candidate
              </span>
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center space-x-1.5">
              <Briefcase className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <span>{candidate.headline || "Software Engineer"}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button onClick={handleOpenEdit} variant="outline" size="sm" id="btn-edit-profile-facts">
            <Edit3 className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Edit Profile Facts
          </Button>
          <Button onClick={onOpenUploadModal} variant="primary" size="sm">
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Upload New File
          </Button>
          <Button onClick={onOpenImportModal} variant="outline" size="sm">
            <UploadCloud className="w-3.5 h-3.5 mr-1.5 text-slate-600 dark:text-slate-400" />
            Import JSON
          </Button>
        </div>
      </div>

      {/* Summary */}
      {candidate.summary && (
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700">
          {candidate.summary}
        </p>
      )}

      {/* Metadata & Links Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        <div className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
          <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="truncate">{candidate.email}</span>
        </div>

        {candidate.location && (
          <div className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="truncate">{candidate.location}</span>
          </div>
        )}

        {candidate.phone && (
          <div className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
            <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="truncate">{candidate.phone}</span>
          </div>
        )}

        <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
          {candidate.linkedin_url && (
            <a
              href={candidate.linkedin_url}
              target="_blank"
              rel="noreferrer"
              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </a>
          )}
          {candidate.github_url && (
            <a
              href={candidate.github_url}
              target="_blank"
              rel="noreferrer"
              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="GitHub"
            >
              <Github className="w-4 h-4" />
            </a>
          )}
          {candidate.portfolio_url && (
            <a
              href={candidate.portfolio_url}
              target="_blank"
              rel="noreferrer"
              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Portfolio"
            >
              <Globe className="w-4 h-4" />
            </a>
          )}
          {!candidate.linkedin_url && !candidate.github_url && !candidate.portfolio_url && (
            <span className="text-xs text-slate-400">No external links set</span>
          )}
        </div>
      </div>

      {/* Edit Profile Facts Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Master Career Profile Facts"
          description="Update your canonical profile details. Changes immediately ground downstream resume tailoring and outreach."
        >
          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Professional Headline</label>
                <input
                  type="text"
                  value={form.headline}
                  onChange={(e) => setForm({ ...form, headline: e.target.value })}
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. San Francisco, CA / Bengaluru, India"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. +1 555-0199"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">LinkedIn URL</label>
                <input
                  type="url"
                  value={form.linkedin_url}
                  onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">GitHub URL</label>
                <input
                  type="url"
                  value={form.github_url}
                  onChange={(e) => setForm({ ...form, github_url: e.target.value })}
                  placeholder="https://github.com/username"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Portfolio / Personal Website</label>
              <input
                type="url"
                value={form.portfolio_url}
                onChange={(e) => setForm({ ...form, portfolio_url: e.target.value })}
                placeholder="https://yourportfolio.dev"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Executive Summary / Bio</label>
              <textarea
                rows={3}
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="Brief summary of your technical background and career objectives..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                <span>Save Profile Facts</span>
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
