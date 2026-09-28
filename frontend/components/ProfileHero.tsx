"use client";

import React from "react";
import { Candidate } from "@/lib/api";
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
  FileText,
} from "lucide-react";

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
  if (!candidate) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center space-y-4 border-dashed border-2 border-slate-700">
        <div className="mx-auto w-12 h-12 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">No Candidate Profile Found</h2>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Upload your resume (.pdf, .tex, .txt) or import structured JSON to initialize your verified profile.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={onOpenUploadModal}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-sm font-semibold shadow-lg shadow-brand-500/20 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Resume File (.pdf, .tex)</span>
          </button>
          <button
            onClick={onOpenImportModal}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <UploadCloud className="w-4 h-4 text-brand-400" />
            <span>Paste / Load JSON</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
      {/* Decorative gradient glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative">
        <div className="flex items-start space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-500 to-accent-cyan flex items-center justify-center text-white font-extrabold text-2xl shadow-xl shadow-brand-500/20 flex-shrink-0">
            {candidate.full_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {candidate.full_name}
              </h1>
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified Profile</span>
              </span>
            </div>
            <p className="text-sm font-medium text-brand-400 flex items-center space-x-1.5">
              <Briefcase className="w-4 h-4" />
              <span>{candidate.headline || "Software Engineer"}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenUploadModal}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-xs font-semibold shadow-lg shadow-brand-500/20 transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Resume File</span>
          </button>
          <button
            onClick={onOpenImportModal}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/80 transition-colors"
          >
            <UploadCloud className="w-3.5 h-3.5 text-brand-400" />
            <span>Paste JSON</span>
          </button>
        </div>
      </div>

      {/* Summary */}
      {candidate.summary && (
        <p className="text-sm text-slate-300 leading-relaxed max-w-4xl bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
          {candidate.summary}
        </p>
      )}

      {/* Metadata & Links Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
        <div className="flex items-center space-x-2 text-xs text-slate-300 p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
          <Mail className="w-4 h-4 text-brand-400 flex-shrink-0" />
          <span className="truncate">{candidate.email}</span>
        </div>

        {candidate.location && (
          <div className="flex items-center space-x-2 text-xs text-slate-300 p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
            <MapPin className="w-4 h-4 text-accent-cyan flex-shrink-0" />
            <span className="truncate">{candidate.location}</span>
          </div>
        )}

        {candidate.phone && (
          <div className="flex items-center space-x-2 text-xs text-slate-300 p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
            <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="truncate">{candidate.phone}</span>
          </div>
        )}

        <div className="flex items-center space-x-2 p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
          {candidate.linkedin_url && (
            <a
              href={candidate.linkedin_url}
              target="_blank"
              rel="noreferrer"
              className="p-1 text-slate-400 hover:text-white transition-colors"
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
              className="p-1 text-slate-400 hover:text-white transition-colors"
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
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title="Portfolio"
            >
              <Globe className="w-4 h-4" />
            </a>
          )}
          {!candidate.linkedin_url && !candidate.github_url && !candidate.portfolio_url && (
            <span className="text-xs text-slate-500">No external links set</span>
          )}
        </div>
      </div>
    </div>
  );
}
