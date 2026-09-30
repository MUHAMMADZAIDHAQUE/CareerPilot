import React from "react";
import { Loader2, AlertCircle, Inbox, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "./Button";

export interface EmptyStateProps {
  title: string;
  description: string;
  whyItMatters?: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  whyItMatters,
  icon = <Inbox className="w-8 h-8 text-slate-400 dark:text-slate-500" />,
  actionText,
  onAction,
  action,
  className = "",
}) => {
  const btnLabel = action?.label || actionText;
  const btnAction = action?.onClick || onAction;

  return (
    <div
      className={`p-8 sm:p-10 text-center flex flex-col items-center justify-center space-y-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-subtle dark:shadow-none text-slate-500 dark:text-slate-400">
        {icon}
      </div>

      <div className="max-w-md space-y-1.5">
        <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {description}
        </p>
        {whyItMatters && (
          <p className="text-xs text-slate-500 dark:text-slate-400 pt-1 leading-relaxed italic">
            {whyItMatters}
          </p>
        )}
      </div>

      {btnLabel && btnAction && (
        <Button size="sm" onClick={btnAction} className="mt-2">
          {btnLabel}
        </Button>
      )}
    </div>
  );
};

export const LoadingState: React.FC<{
  message?: string;
  className?: string;
}> = ({ message = "Loading data...", className = "" }) => (
  <div className={`p-12 text-center flex flex-col items-center justify-center space-y-3 ${className}`}>
    <Loader2 className="w-6 h-6 animate-spin text-slate-700 dark:text-slate-300" />
    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{message}</p>
  </div>
);

export const AiOperationProgress: React.FC<{
  currentStepIndex: number;
  steps: string[];
  className?: string;
}> = ({
  currentStepIndex,
  steps = [
    "Analyzing job requirements...",
    "Matching your experience...",
    "Checking skill coverage...",
    "Preparing recommendations...",
  ],
  className = "",
}) => (
  <div className={`p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-card space-y-3.5 ${className}`}>
    <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
      <Sparkles className="w-3.5 h-3.5 animate-pulse" />
      <span>AI Copilot In Progress</span>
    </div>

    <div className="space-y-2">
      {steps.map((step, idx) => {
        const isDone = idx < currentStepIndex;
        const isCurrent = idx === currentStepIndex;
        return (
          <div
            key={idx}
            className={`flex items-center gap-2.5 text-xs transition-colors ${
              isDone
                ? "text-emerald-700 dark:text-emerald-400 font-medium"
                : isCurrent
                ? "text-slate-900 dark:text-white font-semibold"
                : "text-slate-400 dark:text-slate-600"
            }`}
          >
            {isDone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : isCurrent ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" />
            )}
            <span>{step}</span>
          </div>
        );
      })}
    </div>
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  error?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}> = ({ title = "Something went wrong", error, message, onRetry, className = "" }) => {
  const displayError = error || message || "An unexpected error occurred.";
  return (
    <div className={`p-5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-left space-y-2 ${className}`}>
      <div className="flex items-center space-x-2 text-rose-800 dark:text-rose-300">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <p className="text-xs text-rose-700 dark:text-rose-400">{displayError}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-xs font-semibold text-rose-800 dark:text-rose-300 hover:underline"
        >
          Retry action
        </button>
      )}
    </div>
  );
};

export default EmptyState;
