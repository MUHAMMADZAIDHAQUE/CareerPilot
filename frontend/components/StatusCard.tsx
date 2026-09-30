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
    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-card dark:shadow-none hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm tracking-tight">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
            </div>
          </div>

          <div>
            {isLoading ? (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Checking</span>
              </span>
            ) : isHealthy ? (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>{badge || "Online"}</span>
              </span>
            ) : isDegraded ? (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>Degraded</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                <span>Disconnected</span>
              </span>
            )}
          </div>
        </div>

        {details && <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">{details}</div>}
      </div>
    </div>
  );
}
