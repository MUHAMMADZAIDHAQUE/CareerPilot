import React from "react";
import { Loader2, AlertCircle, Inbox } from "lucide-react";
import { Button } from "./Button";

export interface EmptyStateProps {
  title: string;
  description: string;
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
  icon = <Inbox className="w-8 h-8 text-slate-400" />,
  actionText,
  onAction,
  action,
  className = "",
}) => {
  const btnLabel = action?.label || actionText;
  const btnAction = action?.onClick || onAction;

  return (
    <div className={`p-8 text-center flex flex-col items-center justify-center space-y-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 ${className}`}>
      <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-subtle">
        {icon}
      </div>
      <div className="max-w-sm">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
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
    <Loader2 className="w-6 h-6 animate-spin text-slate-700" />
    <p className="text-xs font-medium text-slate-500">{message}</p>
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  error: string;
  onRetry?: () => void;
  className?: string;
}> = ({ title = "Something went wrong", error, onRetry, className = "" }) => (
  <div className={`p-5 rounded-xl bg-rose-50/60 border border-rose-200 text-left space-y-2 ${className}`}>
    <div className="flex items-center space-x-2 text-rose-800">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <h4 className="text-sm font-semibold">{title}</h4>
    </div>
    <p className="text-xs text-rose-700">{error}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-2 text-xs font-semibold text-rose-800 hover:text-rose-900 underline"
      >
        Retry action
      </button>
    )}
  </div>
);
