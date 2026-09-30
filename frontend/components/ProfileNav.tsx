"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Award, FolderGit2, Sliders } from "lucide-react";

export default function ProfileNav() {
  const pathname = usePathname();

  const tabs = [
    { href: "/profile", label: "Profile & Experience", icon: User },
    { href: "/profile/skills", label: "Skills Inventory", icon: Award },
    { href: "/profile/projects", label: "Projects & Portfolio", icon: FolderGit2 },
    { href: "/profile/preferences", label: "Career Preferences", icon: Sliders },
  ];

  return (
    <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-1 sm:space-x-2 overflow-x-auto pb-px">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
              isActive
                ? "border-slate-900 dark:border-white text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/80 rounded-t-lg"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
