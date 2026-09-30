"use client";

import React, { useState } from "react";
import { Sparkles, HelpCircle, CheckCircle2, AlertTriangle, ShieldCheck, X } from "lucide-react";
import { Modal } from "./Modal";
import { Badge } from "./Badge";

export interface MatchScoreProps {
  score: number | null | undefined;
  company?: string;
  role?: string;
  requiredSkills?: string[];
  missingSkills?: string[];
  breakdown?: {
    skillsScore?: number;
    experienceScore?: number;
    projectsScore?: number;
    educationScore?: number;
    semanticScore?: number;
  };
  size?: "sm" | "md" | "lg";
  showExplainer?: boolean;
  className?: string;
}

export const MatchScore: React.FC<MatchScoreProps> = ({
  score,
  company,
  role,
  requiredSkills = [],
  missingSkills = [],
  breakdown,
  size = "md",
  showExplainer = true,
  className = "",
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  if (score === null || score === undefined) {
    return (
      <span className="text-xs text-slate-400 font-mono">Not scored</span>
    );
  }

  const percent = score > 1 ? Math.round(score) : Math.round(score * 100);

  // Match rating tier
  const tier =
    percent >= 80
      ? { label: "Strong Match", color: "emerald", badge: "success" as const }
      : percent >= 60
      ? { label: "Good Match", color: "blue", badge: "blue" as const }
      : { label: "Moderate Match", color: "amber", badge: "warning" as const };

  const matchedSkills = requiredSkills.filter((s) => !missingSkills.includes(s));

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Visual Badge */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold transition-all ${
          percent >= 80
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
            : percent >= 60
            ? "bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
            : "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
        } ${size === "sm" ? "text-xs" : size === "lg" ? "text-sm px-3.5 py-1.5" : "text-xs"}`}
      >
        <Sparkles className="w-3.5 h-3.5 text-current shrink-0" />
        <span className="font-bold">{percent}%</span>
        <span className="opacity-90 font-medium hidden sm:inline">• {tier.label}</span>
      </div>

      {/* Why % trigger button */}
      {showExplainer && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setModalOpen(true);
          }}
          className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline underline-offset-2 flex items-center gap-1 transition-colors"
          title="Explain match calculation"
        >
          <span>Why {percent}%?</span>
        </button>
      )}

      {/* Explainer Modal */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Match Analysis: ${percent}% ${tier.label}`}
          description={`${role ? `${role} at ` : ""}${company || "Target Opportunity"} — Grounded Match Engine Evidence`}
          maxWidth="max-w-xl"
        >
          <div className="space-y-5 text-sm">
            {/* Deterministic Rubric Bar */}
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                <span>Deterministic Match Score</span>
                <span className="font-bold text-slate-900 dark:text-white">{percent}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    percent >= 80 ? "bg-emerald-500" : percent >= 60 ? "bg-blue-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            {/* Rubric Breakdown Weights */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2.5">
              <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Deterministic Scoring Rubric (Zero-Hallucination)
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-300">Required Skills</span>
                  <span className="font-semibold text-slate-900 dark:text-white">35% weight</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-300">Semantic Fit</span>
                  <span className="font-semibold text-slate-900 dark:text-white">25% weight</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-300">Experience Years</span>
                  <span className="font-semibold text-slate-900 dark:text-white">15% weight</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-300">Project Proof</span>
                  <span className="font-semibold text-slate-900 dark:text-white">15% weight</span>
                </div>
              </div>
            </div>

            {/* Matched Skills vs Missing Skills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Matched */}
              <div className="p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Matched Skills ({matchedSkills.length})</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {matchedSkills.length > 0 ? (
                    matchedSkills.map((sk, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-medium"
                      >
                        {sk}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">None matched</span>
                  )}
                </div>
              </div>

              {/* Missing */}
              <div className="p-3.5 rounded-xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800 dark:text-rose-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Missing Skills ({missingSkills.length})</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {missingSkills.length > 0 ? (
                    missingSkills.map((sk, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-rose-900/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 font-medium"
                      >
                        {sk}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-emerald-700 dark:text-emerald-300">Full skill coverage!</span>
                  )}
                </div>
              </div>
            </div>

            {/* Grounding note */}
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Grounded directly in candidate profile facts and parsed JD requirements.</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MatchScore;
