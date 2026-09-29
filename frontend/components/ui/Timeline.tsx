import React from "react";

export interface TimelineItem {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  date?: string;
  icon?: React.ReactNode;
  status?: "completed" | "current" | "upcoming";
  content?: React.ReactNode;
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ items, className = "" }) => {
  return (
    <div className={`relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-200 ${className}`}>
      {items.map((item, idx) => {
        const isCompleted = item.status === "completed";
        const isCurrent = item.status === "current";

        return (
          <div key={item.id || idx} className="relative group">
            {/* Dot / Icon */}
            <div
              className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] border transition-colors ${
                isCompleted
                  ? "bg-slate-900 border-slate-900 text-white"
                  : isCurrent
                  ? "bg-white border-slate-900 text-slate-900 ring-2 ring-slate-900/10"
                  : "bg-white border-slate-300 text-slate-400"
              }`}
            >
              {item.icon || (
                <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? "bg-white" : isCurrent ? "bg-slate-900" : "bg-slate-300"}`} />
              )}
            </div>

            {/* Content */}
            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-xs font-semibold text-slate-900 tracking-tight">{item.title}</h4>
                {item.date && <span className="text-[11px] font-mono text-slate-400 shrink-0">{item.date}</span>}
              </div>
              {item.subtitle && <p className="text-xs text-slate-500">{item.subtitle}</p>}
              {item.content && <div className="mt-2 text-xs text-slate-600">{item.content}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
