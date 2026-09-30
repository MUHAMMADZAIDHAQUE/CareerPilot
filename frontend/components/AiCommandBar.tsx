"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Sparkles,
  Briefcase,
  FileCode,
  GraduationCap,
  TrendingUp,
  Users2,
  Kanban,
  FileText,
  User,
  Settings,
  ArrowRight,
  Command,
  X,
  Compass,
  Bell,
  Clock,
  Send,
} from "lucide-react";
import { Button } from "./ui/Button";

export function parseNaturalLanguageQuery(query: string): string {
  const q = query.toLowerCase().trim();
  if (!q) return "/";

  // Check for fresher / jobs
  const isFresher = q.includes("fresher") || q.includes("entry") || q.includes("grad") || q.includes("junior");
  const isRemote = q.includes("remote") || q.includes("wfh");
  const isJob = q.includes("job") || q.includes("role") || q.includes("opening") || q.includes("hire") || q.includes("hiring");

  // Deadlines / Assessments
  if (q.includes("deadline") || q.includes("assessment") || q.includes("coding test") || q.includes("oa") || q.includes("interview date")) {
    return "/applications";
  }

  // Alerts
  if (q.includes("alert") || q.includes("job alert")) {
    return "/alerts";
  }

  // Notifications
  if (q.includes("notification") || q.includes("inbox") || q.includes("unread")) {
    return "/notifications";
  }

  // Outreach / Drafts
  if (q.includes("outreach") || q.includes("draft") || q.includes("approved for dispatch") || q.includes("bulk send")) {
    return "/outreach";
  }

  // Referrals
  if (q.includes("referral") || q.includes("alumni") || q.includes("contact") || q.includes("network")) {
    return "/referrals";
  }

  // Resumes
  if (q.includes("resume") || q.includes("tailor") || q.includes("cv") || q.includes("latex")) {
    return "/resumes";
  }

  // Interview / Mock
  if (q.includes("mock") || q.includes("practice interview") || q.includes("prep")) {
    return "/interview";
  }

  // Insights / Skill gaps
  if (q.includes("gap") || q.includes("skill") || q.includes("market") || q.includes("roadmap")) {
    return "/insights";
  }

  // Settings / Providers
  if (q.includes("setting") || q.includes("provider") || q.includes("gmail") || q.includes("outlook") || q.includes("connected")) {
    return "/settings";
  }

  // Application CRM
  if (q.includes("application") || q.includes("kanban") || q.includes("crm") || q.includes("pipeline") || q.includes("applied")) {
    return "/applications";
  }

  // If search query mentions a specific skill or role like "react", "python", "frontend", etc. or job keywords
  if (isJob || isFresher || isRemote || q.includes("developer") || q.includes("engineer")) {
    const searchTerms = q
      .replace(/show\s+me|find\s+me|find|search|jobs|job|openings|roles|for|looking|all|please/gi, "")
      .trim();
    const params = new URLSearchParams();
    if (searchTerms) params.set("search", searchTerms);
    if (isFresher) params.set("fresher", "true");
    if (isRemote) params.set("remote", "true");
    const qs = params.toString();
    return qs ? `/jobs?${qs}` : "/jobs";
  }

  return `/jobs?search=${encodeURIComponent(q)}`;
}

interface AiCommandBarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiCommandBar: React.FC<AiCommandBarProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const aiSuggestions = [
    {
      label: "Show me remote React fresher jobs",
      description: "Filter discovery portal for entry-level React remote roles across 11 platforms",
      href: "/jobs?search=React&fresher=true&remote=true",
      icon: Briefcase,
    },
    {
      label: "Check my upcoming deadlines & assessments",
      description: "Inspect active coding tests, OA deadlines, and recruiter interview milestones",
      href: "/applications",
      icon: Clock,
    },
    {
      label: "Review referral outreach drafts awaiting approval",
      description: "Review personalized 12-point verified drafts ready for human dispatch",
      href: "/outreach",
      icon: Send,
    },
    {
      label: "Manage Job Alerts & Daily Digests",
      description: "Configure automated notifications for fresher backend & frontend roles",
      href: "/alerts",
      icon: Bell,
    },
    {
      label: "Find jobs matching my skills",
      description: "Search discovered jobs with deterministic skill & project match",
      href: "/jobs",
      icon: Briefcase,
    },
    {
      label: "Tailor my resume for a job",
      description: "Generate fact-grounded LaTeX resume with zero hallucination",
      href: "/resumes",
      icon: FileCode,
    },
    {
      label: "Launch Mock Interview Co-Pilot",
      description: "Simulate turn-by-turn answers with instant AI feedback on technical accuracy",
      href: "/interview",
      icon: GraduationCap,
    },
    {
      label: "Connected Email Providers & Automation Settings",
      description: "Authorize Gmail or Outlook dispatch and configure automated monitoring",
      href: "/settings",
      icon: Settings,
    },
  ];

  const quickNav = [
    { label: "Dashboard", href: "/", icon: Compass },
    { label: "Jobs Discovery", href: "/jobs", icon: Briefcase },
    { label: "Resume Studio", href: "/resumes", icon: FileText },
    { label: "Referral Network", href: "/referrals", icon: Users2 },
    { label: "Outreach Dispatch", href: "/outreach", icon: Send },
    { label: "Application CRM", href: "/applications", icon: Kanban },
    { label: "Job Alerts", href: "/alerts", icon: Bell },
    { label: "Notifications", href: "/notifications", icon: Bell },
    { label: "Mock Interview", href: "/interview", icon: GraduationCap },
    { label: "Insights & Skills", href: "/insights", icon: TrendingUp },
    { label: "Candidate Profile", href: "/profile", icon: User },
    { label: "Settings & Providers", href: "/settings", icon: Settings },
  ];

  const filteredAi = aiSuggestions.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase())
  );

  const filteredNav = quickNav.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (href: string) => {
    onClose();
    router.push(href);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim()) {
      e.preventDefault();
      const targetUrl = parseNaturalLanguageQuery(query);
      handleSelect(targetUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <Sparkles className="w-5 h-5 text-blue-500 shrink-0 mr-3 animate-pulse" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ask CareerPilot anything or jump to a tool (e.g. 'remote React fresher jobs')..."
            className="w-full bg-transparent text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mr-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <Button
            size="sm"
            variant="primary"
            className="text-xs px-2.5 py-1 shrink-0"
            onClick={() => {
              if (query.trim()) handleSelect(parseNaturalLanguageQuery(query));
            }}
          >
            Execute
          </Button>
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 dark:text-slate-500 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ml-2">
            ESC
          </span>
        </div>

        {/* Content List */}
        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
          {/* AI Prompts Section */}
          {filteredAi.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 pb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-blue-500" />
                <span>Suggested AI Career Actions</span>
              </div>
              <div className="space-y-1">
                {filteredAi.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelect(item.href)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {item.label}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 block line-clamp-1">
                            {item.description}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Navigation Section */}
          {filteredNav.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 pb-1.5 flex items-center gap-1.5">
                <Compass className="w-3 h-3 text-slate-400" />
                <span>Workspaces & Navigation</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {filteredNav.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelect(item.href)}
                      className="flex items-center gap-2 p-2 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    >
                      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filteredAi.length === 0 && filteredNav.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              No direct matches found. Press &quot;Execute&quot; or Enter to run natural language search.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <span>CareerPilot AI Command Center • Zero Hallucination</span>
          <span className="flex items-center gap-1">
            Navigate with <Command className="w-3 h-3" />K
          </span>
        </div>
      </div>
    </div>
  );
};

export default AiCommandBar;
