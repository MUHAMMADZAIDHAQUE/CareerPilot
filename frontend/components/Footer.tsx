import React from "react";
import Link from "next/link";
import { ShieldCheck, Cpu } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-16 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-900">CareerPilot</span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Fact-Grounded & Non-Fabricating AI</span>
            </span>
          </div>

          <div className="flex items-center space-x-6">
            <span className="flex items-center space-x-1.5">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <span>FastAPI • LangGraph • Next.js • PostgreSQL + pgvector</span>
            </span>
            <span className="text-slate-400 font-mono">v1.0.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
