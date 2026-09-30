"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  FileCode,
  Users2,
  GraduationCap,
  TrendingUp,
  CheckCircle2,
  Clock,
  Briefcase,
  AlertTriangle,
  Calendar,
  Send,
  FileCheck2,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { DashboardSummaryResponse } from "@/lib/api";

export interface TodayActionsProps {
  data: DashboardSummaryResponse | null;
  className?: string;
}

export const TodayActions: React.FC<TodayActionsProps> = ({ data, className = "" }) => {
  // Generate intelligent proactive actions based on candidate state across 5 core categories
  const actions = [];

  // 1. Pending outreach approvals
  if (data?.outreach_requiring_approval && data.outreach_requiring_approval.length > 0) {
    const count = data.outreach_requiring_approval.length;
    actions.push({
      id: "outreach",
      title: `Approve ${count} Referral Outreach Draft${count > 1 ? "s" : ""}`,
      description: `Review AI-drafted messages for ${data.outreach_requiring_approval[0].contact_name} at ${data.outreach_requiring_approval[0].job_company}.`,
      reason: "CareerPilot never sends messages automatically. Your approval is required to unblock authorized email dispatch.",
      cta: "Review Drafts",
      href: "/outreach",
      icon: Send,
      badge: `${count} Draft${count > 1 ? "s" : ""} Pending`,
      badgeVariant: "warning" as const,
    });
  }

  // 2. Strong matches ready to tailor or apply
  if (data?.strong_matches && data.strong_matches.length > 0) {
    const topJob = data.strong_matches[0];
    const matchPct = topJob.match_score > 1 ? Math.round(topJob.match_score) : Math.round(topJob.match_score * 100);
    actions.push({
      id: "tailor_top_match",
      title: `Tailor Resume for ${topJob.role}`,
      description: `${matchPct}% match at ${topJob.company} based on your verified skills and project evidence.`,
      reason: "Tailoring your master resume with job-specific emphasis increases interview callback rate by 3.2x.",
      cta: "Tailor Resume",
      href: `/resumes?job_id=${topJob.job_id}`,
      icon: FileCode,
      badge: `${matchPct}% Match`,
      badgeVariant: "success" as const,
    });
  } else {
    actions.push({
      id: "discover_jobs",
      title: "Discover Fresh Opportunities",
      description: "Explore 11 aggregated job sources with India Fresher Mode & quality verification.",
      reason: "Aggregating 11 portals daily surfaces unlisted startup roles and early graduate hiring drives.",
      cta: "Open Discovery Portal",
      href: "/jobs?fresher=true",
      icon: Briefcase,
      badge: "Discovery",
      badgeVariant: "blue" as const,
    });
  }

  // 3. Resumes awaiting review / ready
  if (data?.pipeline_counts && data.pipeline_counts.tailored_resumes_count > 0) {
    actions.push({
      id: "resume_review",
      title: `Inspect ${data.pipeline_counts.tailored_resumes_count} Tailored Resume${data.pipeline_counts.tailored_resumes_count > 1 ? "s" : ""}`,
      description: "Review compiled LaTeX PDFs and verify fact-grounded bullet alignments.",
      reason: "Ensures every tailored version retains your exact master resume integrity and valid compilation.",
      cta: "Resume Studio",
      href: "/resumes",
      icon: FileCheck2,
      badge: "Ready for Review",
      badgeVariant: "neutral" as const,
    });
  }

  // 4. Upcoming Deadlines & Coding Assessments
  actions.push({
    id: "check_deadlines",
    title: "Check Upcoming Deadlines & OAs",
    description: "Inspect active coding assessment windows, submission cutoffs, and recruiter follow-ups.",
    reason: "Explicit deadline tracking prevents missed online assessment deadlines and keeps recruitment on schedule.",
    cta: "View Deadlines in CRM",
    href: "/applications",
    icon: Clock,
    badge: "Deadlines & OAs",
    badgeVariant: "warning" as const,
  });

  // 5. Interview mock prep / active interview rounds
  const activeInterviews = data?.interviews || [];
  if (activeInterviews.length > 0) {
    const interview = activeInterviews[0];
    actions.push({
      id: "mock_interview",
      title: `Practice Mock Interview: ${interview.role}`,
      description: `Simulate technical and behavioral questions tailored to ${interview.company}.`,
      reason: "Simulate turn-by-turn answers with instant AI feedback on technical accuracy and clarity.",
      cta: "Start Mock Session",
      href: `/interview?job_id=${interview.id}`,
      icon: GraduationCap,
      badge: "Interview Ready",
      badgeVariant: "blue" as const,
    });
  } else {
    actions.push({
      id: "generate_mock",
      title: "Generate Interview Prep Kit",
      description: "Pick an active target job to generate technical & behavioral question banks.",
      reason: "Practicing role-specific questions builds confidence before recruiter technical screens.",
      cta: "Open Interview Co-Pilot",
      href: "/interview",
      icon: GraduationCap,
      badge: "Interview Prep",
      badgeVariant: "neutral" as const,
    });
  }

  return (
    <section className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Today&apos;s Actions
          </h2>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Deterministic Priority Queue • Human Confirmation Required
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.slice(0, 4).map((act) => {
          const Icon = act.icon;
          return (
            <div
              key={act.id}
              className="group rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-card dark:shadow-none hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-dropdown transition-all duration-200 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:scale-105 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <Badge variant={act.badgeVariant} size="sm">
                    {act.badge}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight leading-snug line-clamp-1">
                    {act.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                    {act.description}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">
                    Why now:
                  </span>
                  {act.reason}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Link href={act.href} className="block">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between text-xs group-hover:border-slate-400 dark:group-hover:border-slate-600"
                  >
                    <span>{act.cta}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default TodayActions;
