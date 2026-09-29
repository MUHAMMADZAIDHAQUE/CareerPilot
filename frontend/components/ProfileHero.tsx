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
} from "lucide-react";
import Button from "@/components/ui/Button";

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
}: ProfileHeroProps) {
  if (!candidate) {
    return (
      <div className="bg-white rounded-2xl p-8 sm:p-12 text-center space-y-5 border-2 border-dashed border-slate-200 shadow-sm">
        <div className="mx-auto w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
          <User className="w-6 h-6" />
        </div>
        <div className="max-w-md mx-auto space-y-1.5">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">No Verified Candidate Profile Found</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Upload your resume (.pdf, .tex, .txt) or import structured JSON to initialize your verified career profile and ground AI matching.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button onClick={onOpenUploadModal} variant="primary" size="md">
            <Upload className="w-4 h-4 mr-2" />
            Upload Resume (.pdf, .tex)
          </Button>
          <Button onClick={onOpenImportModal} variant="outline" size="md">
            <UploadCloud className="w-4 h-4 mr-2 text-slate-600" />
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
    <div className="bg-white rounded-2xl p-6 sm:p-8 space-y-6 border border-slate-200/80 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex items-start space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-2xl tracking-tight flex-shrink-0 shadow-sm">
            {initials || "CP"}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {candidate.full_name}
              </h1>
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Verified Candidate
              </span>
            </div>
            <p className="text-sm font-medium text-slate-600 flex items-center space-x-1.5">
              <Briefcase className="w-4 h-4 text-slate-400" />
              <span>{candidate.headline || "Software Engineer"}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button onClick={onOpenUploadModal} variant="primary" size="sm">
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Upload New File
          </Button>
          <Button onClick={onOpenImportModal} variant="outline" size="sm">
            <UploadCloud className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
            Import JSON
          </Button>
        </div>
      </div>

      {/* Summary */}
      {candidate.summary && (
        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50/70 p-4 rounded-xl border border-slate-200/60">
          {candidate.summary}
        </p>
      )}

      {/* Metadata & Links Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        <div className="flex items-center space-x-2 text-xs text-slate-700 p-2.5 rounded-xl bg-white border border-slate-200/80">
          <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="truncate">{candidate.email}</span>
        </div>

        {candidate.location && (
          <div className="flex items-center space-x-2 text-xs text-slate-700 p-2.5 rounded-xl bg-white border border-slate-200/80">
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="truncate">{candidate.location}</span>
          </div>
        )}

        {candidate.phone && (
          <div className="flex items-center space-x-2 text-xs text-slate-700 p-2.5 rounded-xl bg-white border border-slate-200/80">
            <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="truncate">{candidate.phone}</span>
          </div>
        )}

        <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-white border border-slate-200/80">
          {candidate.linkedin_url && (
            <a
              href={candidate.linkedin_url}
              target="_blank"
              rel="noreferrer"
              className="p-1 text-slate-500 hover:text-slate-900 transition-colors"
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
              className="p-1 text-slate-500 hover:text-slate-900 transition-colors"
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
              className="p-1 text-slate-500 hover:text-slate-900 transition-colors"
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
    </div>
  );
}
