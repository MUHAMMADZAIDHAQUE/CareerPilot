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
      bg: "bg-emerald-50 border-emerald-200 text-emerald-900",
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
    },
    error: {
      bg: "bg-rose-50 border-rose-200 text-rose-900",
      icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />,
    },
    info: {
      bg: "bg-slate-50 border-slate-200 text-slate-900",
      icon: <Info className="w-4 h-4 text-slate-600 shrink-0" />,
    },
  };

  const style = typeStyles[type];

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-3.5 rounded-xl border shadow-card transition-all ${style.bg} ${className}`}
    >
      <div className="mt-0.5">{style.icon}</div>
      <div className="flex-1">
        {title && <h5 className="text-xs font-semibold">{title}</h5>}
        <p className="text-xs opacity-90 leading-relaxed">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 transition-colors p-0.5 rounded"
          aria-label="Dismiss alert"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
