"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Briefcase,
  FileText,
  Users2,
  Kanban,
  Layers,
  GraduationCap,
  TrendingUp,
  User,
  Settings,
  Menu,
  X,
  Sparkles,
  Command,
  Bell,
  Shield,
  LogOut,
  LogIn,
} from "lucide-react";
import ThemeSwitcher from "./ThemeSwitcher";
import AiCommandBar from "./AiCommandBar";
import { useAuth } from "@/lib/authContext";

export default function Header() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandBarOpen, setCommandBarOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Listen for Cmd+K globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandBarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navLinks = [
    { href: "/", label: "Dashboard", icon: Compass },
    { href: "/jobs", label: "Jobs", icon: Briefcase },
    { href: "/resumes", label: "Resume", icon: FileText },
    { href: "/referrals", label: "Referrals", icon: Users2 },
    { href: "/applications", label: "Applications", icon: Kanban },
    { href: "/pipeline", label: "Queue", icon: Layers },
    { href: "/interview", label: "Interview", icon: GraduationCap },
    { href: "/insights", label: "Insights", icon: TrendingUp },
  ];

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-all duration-200 ${
          scrolled ? "glass-nav-scrolled" : "glass-nav"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo & Brand */}
            <div className="flex items-center space-x-6">
              <Link href="/" className="flex items-center space-x-2.5 group select-none">
                <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold text-sm tracking-tight shadow-sm transition-transform group-hover:scale-105">
                  CP
                </div>
                <div className="flex items-baseline space-x-1">
                  <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
                    CareerPilot
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 font-medium">
                    AI
                  </span>
                </div>
              </Link>

              {/* Desktop Navigation Links */}
              <nav className="hidden lg:flex items-center space-x-1">
                {navLinks.map((item) => {
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors select-none ${
                        isActive
                          ? "text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 font-semibold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right: AI Command, Theme, Profile */}
            <div className="flex items-center space-x-2">
              {/* AI Command Bar Button */}
              <button
                type="button"
                onClick={() => setCommandBarOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 transition-colors text-xs select-none"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>Ask CareerPilot...</span>
                <kbd className="inline-flex items-center gap-0.5 text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  <Command className="w-2.5 h-2.5" />K
                </kbd>
              </button>

              {/* Mobile AI Command Button */}
              <button
                type="button"
                onClick={() => setCommandBarOpen(true)}
                className="sm:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Search and AI command"
              >
                <Sparkles className="w-4 h-4 text-blue-500" />
              </button>

              {/* Theme Switcher */}
              <ThemeSwitcher />

              {/* Profile & Settings (Desktop) */}
              <div className="hidden md:flex items-center space-x-1 pl-1 border-l border-slate-200 dark:border-slate-800">
                {isAdmin && (
                  <Link
                    href="/admin"
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold tracking-wide transition-colors flex items-center gap-1.5 ${
                      pathname.startsWith("/admin")
                        ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                        : "text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                    }`}
                    title="Admin Panel & Operator Governance"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Admin</span>
                  </Link>
                )}

                <Link
                  href="/profile"
                  className={`p-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    pathname.startsWith("/profile")
                      ? "text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                  title="Candidate Profile"
                >
                  <User className="w-4 h-4" />
                </Link>

                <Link
                  href="/settings"
                  className={`p-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    pathname.startsWith("/settings")
                      ? "text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                  title="Settings & System Diagnostics"
                >
                  <Settings className="w-4 h-4" />
                </Link>

                {user ? (
                  <button
                    onClick={logout}
                    className="p-2 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    title={`Sign Out (${user.email})`}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className="ml-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity flex items-center gap-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </Link>
                )}
              </div>

              {/* Mobile Menu Hamburger Toggle */}
              <div className="flex lg:hidden items-center">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Toggle Navigation Menu"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md px-4 pt-3 pb-5 space-y-1.5 animate-in slide-in-from-top-2 duration-150">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center space-x-2">
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
                >
                  <User className="w-4 h-4" />
                  <span>Profile</span>
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </Link>
              </div>

              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-semibold border border-amber-300 dark:border-amber-800"
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin Console</span>
                </Link>
              )}

              {user ? (
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 text-xs font-medium border border-rose-200 dark:border-rose-900/50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out ({user.email})</span>
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In / Register</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* AI Command Palette Modal */}
      <AiCommandBar isOpen={commandBarOpen} onClose={() => setCommandBarOpen(false)} />
    </>
  );
}
