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
    <div className="flex border-b border-slate-200 space-x-1 sm:space-x-2 overflow-x-auto pb-px">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
              isActive
                ? "border-slate-900 text-slate-900 bg-slate-50 rounded-t-lg"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? "text-slate-900" : "text-slate-400"}`} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
