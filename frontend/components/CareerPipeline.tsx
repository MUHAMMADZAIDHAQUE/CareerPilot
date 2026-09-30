"use client";

import React from "react";
import Link from "next/link";
import {
  Compass,
  FileSearch,
  Sparkles,
  FileCode,
  Users2,
  Kanban,
  GraduationCap,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export interface PipelineStep {
  id: string;
  name: string;
  count?: number;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export interface CareerPipelineProps {
  counts?: {
    jobs?: number;
    analyzed?: number;
    matched?: number;
    tailored?: number;
    referrals?: number;
    applied?: number;
    interviews?: number;
    gaps?: number;
  };
  currentStepId?: string;
  className?: string;
}

export const CareerPipeline: React.FC<CareerPipelineProps> = ({
  counts,
  currentStepId,
  className = "",
}) => {
  const steps: PipelineStep[] = [
    {
      id: "discover",
      name: "Discover",
      label: "Find Jobs",
      href: "/jobs",
      count: counts?.jobs,
      icon: Compass,
      description: "Sourced positions & auto deduplication",
    },
    {
      id: "analyze",
      name: "Analyze",
      label: "JD Breakdown",
      href: "/jobs/analyze",
      count: counts?.analyzed,
      icon: FileSearch,
      description: "Extract required skills & responsibilities",
    },
    {
      id: "match",
      name: "Match",
      label: "Deterministic Fit",
      href: "/jobs",
      count: counts?.matched,
      icon: Sparkles,
      description: "Evidence-based match scoring",
    },
    {
      id: "tailor",
      name: "Tailor",
      label: "Resume Studio",
      href: "/resumes",
      count: counts?.tailored,
      icon: FileCode,
      description: "Fact-grounded LaTeX with zero hallucination",
    },
    {
      id: "referral",
      name: "Referral",
      label: "Network CRM",
      href: "/referrals",
      count: counts?.referrals,
      icon: Users2,
      description: "Warm connection discovery & HITL drafts",
    },
    {
      id: "apply",
      name: "Apply",
      label: "Track Pipeline",
      href: "/applications",
      count: counts?.applied,
      icon: Kanban,
      description: "Kanban board & follow-up scheduler",
    },
    {
      id: "interview",
      name: "Interview",
      label: "Mock Prep",
      href: "/interview",
      count: counts?.interviews,
      icon: GraduationCap,
      description: "Targeted question kits & AI simulator",
    },
    {
      id: "improve",
      name: "Improve",
      label: "Skill Insights",
      href: "/insights",
      count: counts?.gaps,
      icon: TrendingUp,
      description: "3-phase learning roadmap & GitHub proof",
    },
  ];

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Career Copilot Progression Pipeline
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Click any phase to navigate directly to its dedicated workspace.
          </p>
        </div>
        <span className="hidden sm:inline-flex text-[11px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
          8 Workspaces Integrated
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isCurrent = currentStepId === step.id;

          return (
            <Link
              key={step.id}
              href={step.href}
              className={`group relative p-3 rounded-xl border transition-all duration-200 flex flex-col justify-between select-none min-w-0 ${
                isCurrent
                  ? "bg-blue-50/60 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-sm"
                  : "bg-white dark:bg-[#111827] border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-subtle hover:-translate-y-0.5"
              }`}
            >
              {/* Header: Step Number and Arrow */}
              <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                <span className="font-mono font-medium text-[11px]">0{idx + 1}</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-blue-600 dark:text-blue-400" />
              </div>

              {/* Icon & Title */}
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                  <span className="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {step.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-mono gap-1 min-w-0">
                  <span className="truncate">{step.label}</span>
                  {step.count !== undefined && (
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {step.count}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default CareerPipeline;
