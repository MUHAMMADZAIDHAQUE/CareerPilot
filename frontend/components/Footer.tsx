import Link from "next/link";
import { Shield, BookOpen, Terminal, Sparkles } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-background/90 mt-16 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-sm text-slate-400">
            <span className="font-semibold text-slate-200">CareerPilot AI</span>
            <span>•</span>
            <span className="flex items-center space-x-1 text-xs">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero-Hallucination Guaranteed</span>
            </span>
          </div>

          <div className="flex items-center space-x-6 text-xs text-slate-400">
            <span className="flex items-center space-x-1">
              <Terminal className="w-3.5 h-3.5 text-brand-400" />
              <span>FastAPI Backend • Next.js Frontend • PostgreSQL + pgvector</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
