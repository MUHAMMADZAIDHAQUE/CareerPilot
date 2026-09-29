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
  GraduationCap,
  TrendingUp,
  User,
  Settings,
  Menu,
  X,
} from "lucide-react";

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 12);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/", label: "Dashboard", icon: Compass },
    { href: "/jobs", label: "Jobs", icon: Briefcase },
    { href: "/resumes", label: "Resume", icon: FileText },
    { href: "/referrals", label: "Referrals", icon: Users2 },
    { href: "/applications", label: "Applications", icon: Kanban },
    { href: "/interview", label: "Interview", icon: GraduationCap },
    { href: "/insights", label: "Insights", icon: TrendingUp },
  ];

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 ${
        scrolled ? "glass-nav-scrolled" : "glass-nav"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center space-x-2.5 group select-none">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-sm transition-transform group-hover:scale-105">
              CP
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="font-bold text-base tracking-tight text-slate-900">
                CareerPilot
              </span>
              <span className="text-[11px] font-mono text-slate-400 font-medium">AI</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors select-none ${
                    isActive
                      ? "text-slate-900 bg-slate-100 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Side Actions: Profile & Settings */}
          <div className="hidden md:flex items-center space-x-2 border-l border-slate-200/80 pl-3">
            <Link
              href="/profile"
              className={`p-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                pathname.startsWith("/profile")
                  ? "text-slate-900 bg-slate-100 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
              title="Career Profile"
            >
              <User className="w-4 h-4" />
              <span className="text-xs">Profile</span>
            </Link>

            <Link
              href="/settings"
              className={`p-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                pathname.startsWith("/settings")
                  ? "text-slate-900 bg-slate-100 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 pt-2 pb-4 space-y-1">
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
                className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive
                    ? "bg-slate-100 text-slate-900 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className="w-4 h-4 text-slate-500" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-2 mt-2 border-t border-slate-100 flex items-center space-x-2">
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium"
            >
              <User className="w-3.5 h-3.5" />
              <span>Profile</span>
            </Link>
            <Link
              href="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className="flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-medium"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
