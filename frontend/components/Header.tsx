"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Activity, User, Award, FolderGit2, Layers, Briefcase, Send, Kanban, GraduationCap, TrendingUp } from "lucide-react";

export default function Header() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Overview", icon: Layers },
    { href: "/jobs", label: "Jobs", icon: Briefcase },
    { href: "/jobs/analyze", label: "JD Analyzer", icon: Briefcase },
    { href: "/applications", label: "Applications", icon: Kanban },
    { href: "/career/skill-gaps", label: "Skill Gaps", icon: TrendingUp },
    { href: "/interview", label: "Interview", icon: GraduationCap },
    { href: "/outreach", label: "Outreach", icon: Send },
    { href: "/profile", label: "Profile", icon: User },
    { href: "/health", label: "Diagnostics", icon: Activity },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-cyan flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform duration-200">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white group-hover:text-brand-400 transition-colors">
                  CareerPilot<span className="text-brand-400">.AI</span>
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  Phase 4 Active
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                AI Career Copilot & Resume Tailoring
              </p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href) && item.href !== "/profile");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    pathname === item.href
                      ? "bg-slate-800 text-white shadow-sm border border-slate-700/60 font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${pathname === item.href ? "text-brand-400" : ""}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="hidden lg:flex items-center pl-3 border-l border-slate-800 ml-2">
              <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                <span>Profile Engine Online</span>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
