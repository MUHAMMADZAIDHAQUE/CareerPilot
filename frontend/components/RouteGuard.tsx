"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";

/**
 * Public routes that do not require authentication.
 */
const PUBLIC_EXACT = ["/", "/login", "/register", "/health"];
const PUBLIC_PREFIXES = ["/login", "/register", "/health", "/jobs"];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = isPublicRoute(pathname);

  useEffect(() => {
    if (!loading && !user && !isPublic) {
      const search = typeof window !== "undefined" ? window.location.search : "";
      const redirectUrl = `/login?redirect=${encodeURIComponent(pathname + search)}`;
      router.replace(redirectUrl);
    }
  }, [loading, user, isPublic, pathname, router]);

  // Public routes always render without auth gate
  if (isPublic) {
    return <>{children}</>;
  }

  // Waiting for initial auth check from localStorage
  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Verifying session...</p>
      </div>
    );
  }

  // Not authenticated on protected route: hold render while router.replace executes
  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Redirecting to login...</p>
      </div>
    );
  }

  // Authenticated user on protected route
  return <>{children}</>;
}
