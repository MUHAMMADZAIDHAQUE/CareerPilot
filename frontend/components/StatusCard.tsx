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
    <div className="glass-card rounded-xl p-6 glass-card-hover flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/50 text-brand-400">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-base">{title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            </div>
          </div>

          <div>
            {isLoading ? (
              <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Checking</span>
              </span>
            ) : isHealthy ? (
              <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                <span>{badge || "Online"}</span>
              </span>
            ) : isDegraded ? (
              <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-3 h-3" />
                <span>Degraded</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <XCircle className="w-3 h-3" />
                <span>Disconnected</span>
              </span>
            )}
          </div>
        </div>

        {details && (
          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-300">
            {details}
          </div>
        )}
      </div>
    </div>
  );
}
