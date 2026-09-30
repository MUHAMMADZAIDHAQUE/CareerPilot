import React from "react";
import Link from "next/link";
import { ShieldCheck, Cpu } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0f17] mt-16 py-8 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <span className="font-semibold text-slate-900 dark:text-white">CareerPilot AI</span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Fact-Grounded & Non-Fabricating Career Copilot</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 sm:gap-6">
            <span className="flex items-center space-x-1.5 text-center">
              <Cpu className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="text-[11px] sm:text-xs">FastAPI • LangGraph • Next.js • PostgreSQL + pgvector</span>
            </span>
            <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">v1.0.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
