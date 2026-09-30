import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  subtle?: boolean;
  hoverable?: boolean;
  hover?: boolean;
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  subtle = false,
  hoverable = false,
  hover = false,
  padded = true,
  className = "",
  ...props
}) => {
  const isHoverable = hover || hoverable;
  return (
    <div
      className={`rounded-2xl border transition-all duration-200 ${
        subtle
          ? "bg-slate-50 dark:bg-[#182234] border-slate-200/80 dark:border-slate-800"
          : "bg-white dark:bg-[#111827] border-slate-200/90 dark:border-slate-800 shadow-card dark:shadow-none"
      } ${
        isHoverable
          ? "hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-dropdown dark:hover:shadow-darkDropdown hover:-translate-y-0.5"
          : ""
      } ${padded ? "p-5 sm:p-6" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, action, className = "" }) => (
  <div
    className={`flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 ${className}`}
  >
    <div className="space-y-1">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
        {title}
      </h3>
      {subtitle && (
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export default Card;
