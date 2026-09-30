"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sun, Moon, Laptop, Check } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export const ThemeSwitcher: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600"
        aria-label="Switch Theme"
        aria-expanded={open}
        title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}
      >
        {resolvedTheme === "dark" ? (
          <Moon className="w-4 h-4 text-blue-400 transition-transform hover:rotate-12" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500 transition-transform hover:rotate-45" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-36 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-dropdown dark:shadow-darkDropdown p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 px-2 py-1 uppercase tracking-wider">
            Theme
          </div>

          <button
            role="menuitem"
            onClick={() => {
              setTheme("light");
              setOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              theme === "light"
                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Light</span>
            </div>
            {theme === "light" && <Check className="w-3 h-3 text-slate-700 dark:text-slate-300" />}
          </button>

          <button
            role="menuitem"
            onClick={() => {
              setTheme("dark");
              setOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              theme === "dark"
                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <Moon className="w-3.5 h-3.5 text-blue-400" />
              <span>Dark</span>
            </div>
            {theme === "dark" && <Check className="w-3 h-3 text-slate-700 dark:text-slate-300" />}
          </button>

          <button
            role="menuitem"
            onClick={() => {
              setTheme("system");
              setOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              theme === "system"
                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <Laptop className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>System</span>
            </div>
            {theme === "system" && <Check className="w-3 h-3 text-slate-700 dark:text-slate-300" />}
          </button>
        </div>
      )}
    </div>
  );
};

export default ThemeSwitcher;
