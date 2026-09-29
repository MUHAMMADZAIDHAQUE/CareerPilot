import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface MetricProps {
  label: string;
  value: string | number;
  subtext?: string;
  change?: {
    value: string;
    trend: "up" | "down" | "neutral";
  };
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Metric: React.FC<MetricProps> = ({
  label,
  value,
  subtext,
  change,
  icon,
  className = "",
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-slate-200/90 bg-white p-5 shadow-card transition-all ${
        onClick ? "cursor-pointer hover:border-slate-300 hover:shadow-dropdown" : ""
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 tracking-tight">{label}</span>
        {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-slate-900 tracking-tight">{value}</span>
        {change && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-medium ${
              change.trend === "up"
                ? "text-emerald-700"
                : change.trend === "down"
                ? "text-rose-700"
                : "text-slate-600"
            }`}
          >
            {change.trend === "up" && <TrendingUp className="w-3.5 h-3.5" />}
            {change.trend === "down" && <TrendingDown className="w-3.5 h-3.5" />}
            <span>{change.value}</span>
          </span>
        )}
      </div>

      {subtext && <p className="mt-1 text-xs text-slate-400">{subtext}</p>}
    </div>
  );
};
