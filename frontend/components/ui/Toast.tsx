import React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export interface ToastProps {
  type?: "success" | "error" | "info";
  title?: string;
  message: string;
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  type = "info",
  title,
  message,
  onClose,
  className = "",
}) => {
  const typeStyles = {
    success: {
      bg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200",
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
    },
    error: {
      bg: "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200",
      icon: <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />,
    },
    info: {
      bg: "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100",
      icon: <Info className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" />,
    },
  };

  const style = typeStyles[type];

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-3.5 rounded-2xl border shadow-card dark:shadow-darkDropdown transition-all animate-in fade-in slide-in-from-bottom-2 duration-150 ${style.bg} ${className}`}
    >
      <div className="mt-0.5">{style.icon}</div>
      <div className="flex-1">
        {title && <h5 className="text-xs font-semibold">{title}</h5>}
        <p className="text-xs opacity-90 leading-relaxed">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-0.5 rounded"
          aria-label="Dismiss alert"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default Toast;
