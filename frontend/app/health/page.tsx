import SystemHealth from "@/components/SystemHealth";
import { Activity, Shield, Terminal, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function HealthPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/"
          className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Overview</span>
        </Link>
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              System Health & Service Diagnostics
            </h1>
            <p className="text-sm text-slate-400">
              Live telemetry monitoring for FastAPI API gateway, PostgreSQL database, and pgvector extension.
            </p>
          </div>
        </div>
      </div>

      <SystemHealth />

      {/* Diagnostics Instructions */}
      <div className="glass-card rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-accent-cyan" />
          <span>Manual CLI Diagnostics</span>
        </h3>
        <p className="text-xs text-slate-400">
          You can also verify backend connectivity directly from your terminal:
        </p>
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-slate-950 font-mono text-xs text-emerald-400 border border-slate-800">
            curl -s http://localhost:8000/api/health | jq .
          </div>
          <div className="p-3 rounded-lg bg-slate-950 font-mono text-xs text-accent-cyan border border-slate-800">
            curl -s http://localhost:8000/api/v1/readyz
          </div>
        </div>
      </div>
    </div>
  );
}
