import React from "react";

export const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-800 ${className}`} />
);

export const JobCardSkeleton: React.FC = () => (
  <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-card dark:shadow-none space-y-4">
    <div className="flex items-start justify-between">
      <div className="space-y-2 w-3/4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-48" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
    <div className="flex gap-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3 w-24" />
    </div>
    <div className="flex gap-1.5 pt-1">
      <Skeleton className="h-5 w-16 rounded-md" />
      <Skeleton className="h-5 w-20 rounded-md" />
      <Skeleton className="h-5 w-14 rounded-md" />
    </div>
    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-20 rounded-md" />
    </div>
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-8 animate-in fade-in duration-200">
    <div className="space-y-3">
      <Skeleton className="h-6 w-40 rounded-full" />
      <Skeleton className="h-12 w-96 max-w-full" />
      <Skeleton className="h-6 w-72 max-w-full" />
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  </div>
);

export const ResumeCardSkeleton: React.FC = () => (
  <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-card dark:shadow-none space-y-3">
    <div className="flex justify-between items-center">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
    <Skeleton className="h-3 w-28" />
    <Skeleton className="h-8 w-full rounded-lg" />
    <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-6 w-24" />
    </div>
  </div>
);

export default Skeleton;
