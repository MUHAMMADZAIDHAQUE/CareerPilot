import React from "react";
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
} from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";

export interface JobCardProps {
  id: string;
  role: string;
  company: string;
  location?: string | null;
  experience?: string | null;
  matchScore?: number | null;
  requiredSkills?: string[];
  missingSkills?: string[];
  source?: string | null;
  applied?: boolean;
  saved?: boolean;
  onSave?: () => void;
  className?: string;
}

export const JobCard: React.FC<JobCardProps> = ({
  id,
  role,
  company,
  location,
  experience,
  matchScore,
  requiredSkills = [],
  missingSkills = [],
  source,
  applied = false,
  saved = false,
  onSave,
  className = "",
}) => {
  const scorePercent = matchScore !== undefined && matchScore !== null ? Math.round(matchScore * 100) : null;

  return (
    <div
      className={`group rounded-xl border border-slate-200/90 bg-white p-5 shadow-card hover:border-slate-300 hover:shadow-dropdown transition-all flex flex-col justify-between ${className}`}
    >
      <div>
        {/* Top Header: Company, Source, Score */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {company}
              </span>
              {source && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 uppercase">
                  {source}
                </span>
              )}
            </div>
            <Link
              href={`/jobs/${id}`}
              className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors tracking-tight line-clamp-1 block"
            >
              {role}
            </Link>
          </div>

          {scorePercent !== null && (
            <div
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                scorePercent >= 80
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : scorePercent >= 60
                  ? "bg-blue-50 text-blue-800 border border-blue-200"
                  : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}
            >
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>{scorePercent}%</span>
            </div>
          )}
        </div>

        {/* Metadata row: Location & Experience */}
        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {location}
            </span>
          )}
          {experience && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
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
                  className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
                    isMissing
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-slate-50 text-slate-700 border border-slate-200/80"
                  }`}
                >
                  {skill}
                </span>
              );
            })}
            {requiredSkills.length > 4 && (
              <span className="text-[11px] px-1.5 py-0.5 text-slate-400 font-mono">
                +{requiredSkills.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Actions Row */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-500">
          <Link
            href={`/jobs/${id}`}
            className="hover:text-slate-900 transition-colors flex items-center gap-1 font-medium text-slate-700"
          >
            <span>View Match</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href={`/jobs/${id}#tailor`}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Tailor Resume"
          >
            <FileCode className="w-4 h-4" />
          </Link>
          <Link
            href={`/jobs/${id}/referrals`}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Find Referrals"
          >
            <Users2 className="w-4 h-4" />
          </Link>
          <Link
            href={`/interview?job_id=${id}`}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Prepare Interview"
          >
            <GraduationCap className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};
