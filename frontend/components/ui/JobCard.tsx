"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  ChevronRight,
  FileCode,
  Users2,
  GraduationCap,
  Bookmark,
  MoreVertical,
  FileSearch,
  ExternalLink,
  Check,
} from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { MatchScore } from "./MatchScore";

export interface JobCardProps {
  id: string;
  role: string;
  company: string;
  location?: string | null;
  experience?: string | null;
  employmentType?: string | null;
  matchScore?: number | null;
  matchCategory?: string | null;
  requiredSkills?: string[];
  missingSkills?: string[];
  source?: string | null;
  isFresherEligible?: boolean;
  sourceReferences?: Array<{ source: string; url?: string }>;
  applied?: boolean;
  saved?: boolean;
  onSave?: () => void;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}

export const JobCard: React.FC<JobCardProps> = ({
  id,
  role,
  company,
  location,
  experience,
  matchScore,
  matchCategory,
  requiredSkills = [],
  missingSkills = [],
  source,
  isFresherEligible = false,
  sourceReferences = [],
  applied = false,
  saved = false,
  onSave,
  className = "",
}) => {
  const [isSaved, setIsSaved] = useState(saved);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSaved(!isSaved);
    if (onSave) onSave();
  };

  return (
    <div
      className={`group rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 shadow-card dark:shadow-none hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-dropdown dark:hover:shadow-darkDropdown hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between ${className}`}
    >
      <div>
        {/* Top Header: Company, Source, Bookmark & Menu */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                {company}
              </span>
              {source && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase">
                  {source}
                </span>
              )}
              {isFresherEligible && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Fresher Eligible
                </span>
              )}
              {sourceReferences && sourceReferences.length > 1 && (
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900"
                  title={sourceReferences.map((s) => s.source).join(", ")}
                >
                  {sourceReferences.length} Sources
                </span>
              )}
            </div>

            <Link
              href={`/jobs/${id}`}
              className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors tracking-tight line-clamp-1 block"
            >
              {role}
            </Link>
          </div>

          {/* Quick Actions: Bookmark & Menu */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleToggleSave}
              className={`p-1.5 rounded-lg transition-colors ${
                isSaved
                  ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              title={isSaved ? "Saved to target list" : "Save job"}
              aria-label="Save job"
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
            </button>

            {/* Contextual ... Menu */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="More actions"
                aria-label="More actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-1 w-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-dropdown dark:shadow-darkDropdown p-1.5 z-40 animate-in fade-in zoom-in-95 duration-100 text-xs">
                  <Link
                    href={`/jobs/${id}`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    <span>View Match Inspector</span>
                  </Link>
                  <Link
                    href={`/jobs/analyze?job_id=${id}`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <FileSearch className="w-3.5 h-3.5 text-slate-400" />
                    <span>Analyze Description</span>
                  </Link>
                  <Link
                    href={`/resumes?job_id=${id}`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <FileCode className="w-3.5 h-3.5 text-slate-400" />
                    <span>Tailor LaTeX Resume</span>
                  </Link>
                  <Link
                    href={`/jobs/${id}/referrals`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <Users2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Find Referrals</span>
                  </Link>
                  <Link
                    href={`/interview?job_id=${id}`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                    <span>Prepare Interview</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Match Score Component */}
        <div className="mt-3">
          <MatchScore
            score={matchScore}
            company={company}
            role={role}
            requiredSkills={requiredSkills}
            missingSkills={missingSkills}
            size="sm"
          />
        </div>

        {/* Metadata row: Location & Experience */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          {location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              {location}
            </span>
          )}
          {experience && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              {experience}
            </span>
          )}
          {applied && (
            <Badge variant="success" size="sm">
              Applied
            </Badge>
          )}
        </div>

        {/* Skills Pills */}
        {requiredSkills.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {requiredSkills.slice(0, 4).map((skill, idx) => {
              const isMissing = missingSkills.includes(skill);
              return (
                <span
                  key={idx}
                  className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition-colors ${
                    isMissing
                      ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700"
                  }`}
                >
                  {skill}
                </span>
              );
            })}
            {requiredSkills.length > 4 && (
              <span className="text-[11px] px-1.5 py-0.5 text-slate-400 dark:text-slate-500 font-mono">
                +{requiredSkills.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Actions Row */}
      <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <Link
          href={`/jobs/${id}`}
          className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
        >
          <span>View Match</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href={`/resumes?job_id=${id}`}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Tailor Resume"
          >
            <FileCode className="w-4 h-4" />
          </Link>
          <Link
            href={`/jobs/${id}/referrals`}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Find Referrals"
          >
            <Users2 className="w-4 h-4" />
          </Link>
          <Link
            href={`/interview?job_id=${id}`}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Prepare Interview"
          >
            <GraduationCap className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default JobCard;
