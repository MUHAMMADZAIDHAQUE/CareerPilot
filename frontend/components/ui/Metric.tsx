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
      className={`rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-card dark:shadow-none transition-all duration-200 ${
        onClick
          ? "cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-dropdown dark:hover:shadow-darkDropdown hover:-translate-y-0.5"
          : ""
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate" title={label}>
          {label}
        </span>
        {icon && <span className="text-slate-400 dark:text-slate-500 shrink-0">{icon}</span>}
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          {value}
        </span>
        {change && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
              change.trend === "up"
                ? "text-emerald-700 dark:text-emerald-400"
                : change.trend === "down"
                ? "text-rose-700 dark:text-rose-400"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            {change.trend === "up" && <TrendingUp className="w-3.5 h-3.5" />}
            {change.trend === "down" && <TrendingDown className="w-3.5 h-3.5" />}
            <span>{change.value}</span>
          </span>
        )}
      </div>

      {subtext && (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
          {subtext}
        </p>
      )}
    </div>
  );
};

export default Metric;
