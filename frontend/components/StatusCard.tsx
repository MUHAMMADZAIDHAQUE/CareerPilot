import React from "react";
import { LucideIcon, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";

interface StatusCardProps {
  title: string;
  status: "connected" | "disconnected" | "healthy" | "degraded" | "ready" | "loading" | "unknown";
  description: string;
  icon: LucideIcon;
  badge?: string;
  details?: React.ReactNode;
}

export default function StatusCard({
  title,
  status,
  description,
  icon: Icon,
  badge,
  details,
}: StatusCardProps) {
  const isHealthy = status === "connected" || status === "healthy" || status === "ready";
  const isDegraded = status === "degraded";
  const isLoading = status === "loading";

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-card hover:border-slate-300 transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm tracking-tight">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            </div>
          </div>

          <div>
            {isLoading ? (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Checking</span>
              </span>
            ) : isHealthy ? (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>{badge || "Online"}</span>
              </span>
            ) : isDegraded ? (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>Degraded</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200">
                <XCircle className="w-3 h-3 text-rose-600" />
                <span>Disconnected</span>
              </span>
            )}
          </div>
        </div>

        {details && (
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
            {details}
          </div>
        )}
      </div>
    </div>
  );
}
