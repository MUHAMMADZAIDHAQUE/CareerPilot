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
      className={`rounded-xl border transition-all ${
        subtle
          ? "bg-slate-50 border-slate-200/80"
          : "bg-white border-slate-200/90 shadow-card"
      } ${isHoverable ? "hover:border-slate-300 hover:shadow-dropdown" : ""} ${
        padded ? "p-5 sm:p-6" : ""
      } ${className}`}
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
  <div className={`flex items-start justify-between gap-4 pb-4 border-b border-slate-100 ${className}`}>
    <div>
      <h3 className="text-base font-semibold text-slate-900 tracking-tight">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export default Card;
