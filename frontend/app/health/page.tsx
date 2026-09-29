import SystemHealth from "@/components/SystemHealth";
import { Activity, Terminal, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Card from "@/components/ui/Card";

export default function HealthPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <Link
          href="/"
          className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors mb-3 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Overview</span>
        </Link>
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              System Health & Diagnostics
            </h1>
            <p className="text-sm text-slate-500">
              Live telemetry monitoring for FastAPI API gateway, PostgreSQL database, and pgvector extension.
            </p>
          </div>
        </div>
      </div>

      <SystemHealth />

      {/* Diagnostics Instructions */}
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-slate-600" />
          <span>Manual CLI Diagnostics</span>
        </h3>
        <p className="text-xs text-slate-500">
          You can verify backend connectivity directly from your terminal:
        </p>
        <div className="space-y-2">
          <div className="p-3 rounded-xl bg-slate-50 font-mono text-xs text-slate-800 border border-slate-200">
            curl -s http://localhost:8000/api/health | jq .
          </div>
          <div className="p-3 rounded-xl bg-slate-50 font-mono text-xs text-slate-800 border border-slate-200">
            curl -s http://localhost:8000/api/v1/readyz
          </div>
        </div>
      </Card>
    </div>
  );
}
