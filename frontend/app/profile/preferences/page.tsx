"use client";

import React, { useEffect, useState } from "react";
import { fetchCandidateProfile, updateCandidateProfile, Candidate } from "@/lib/api";
import ProfileNav from "@/components/ProfileNav";
import {
  Sliders,
  CheckCircle2,
  DollarSign,
  MapPin,
  Briefcase,
  Laptop,
  Building,
  Sparkles,
  AlertCircle,
  Save,
} from "lucide-react";

export default function PreferencesPage() {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [preferredRoles, setPreferredRoles] = useState<string>("");
  const [preferredLocations, setPreferredLocations] = useState<string>("");
  const [workMode, setWorkMode] = useState<string>("Remote");
  const [employmentType, setEmploymentType] = useState<string>("Full-time");
  const [salaryMin, setSalaryMin] = useState<number | "">("");
  const [salaryMax, setSalaryMax] = useState<number | "">("");
  const [currency, setCurrency] = useState<string>("USD");

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadPreferences = async () => {
    const res = await fetchCandidateProfile();
    if (res.data) {
      setCandidate(res.data);
      const pref = res.data.career_preference;
      if (pref) {
        setPreferredRoles((pref.preferred_roles || []).join(", "));
        setPreferredLocations((pref.preferred_locations || []).join(", "));
        setWorkMode(pref.work_mode || "Remote");
        setEmploymentType(pref.preferred_employment_type || "Full-time");
        setSalaryMin(pref.target_salary_min || "");
        setSalaryMax(pref.target_salary_max || "");
        setCurrency(pref.currency || "USD");
      }
    }
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    const rolesArray = preferredRoles
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    const locationsArray = preferredLocations
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);

    const payload = {
      career_preference: {
        preferred_roles: rolesArray,
        preferred_locations: locationsArray,
        work_mode: workMode,
        preferred_employment_type: employmentType,
        target_salary_min: salaryMin !== "" ? Number(salaryMin) : null,
        target_salary_max: salaryMax !== "" ? Number(salaryMax) : null,
        currency,
      },
    };

    const res = await updateCandidateProfile(payload, candidate?.id);
    setIsSaving(false);

    if (res.error) {
      setSaveError(res.error);
    } else {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
      if (res.data) setCandidate(res.data);
    }
  };

  const workModes = [
    { value: "Remote", label: "Remote", icon: Laptop },
    { value: "Hybrid", label: "Hybrid", icon: Building },
    { value: "On-site", label: "On-site", icon: Briefcase },
    { value: "Any", label: "Any / Flexible", icon: Sparkles },
  ];

  const employmentTypes = ["Full-time", "Contract", "Part-time", "Internship"];

  return (
    <div className="space-y-8">
      <ProfileNav />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center space-x-3">
          <Sliders className="w-7 h-7 text-brand-400" />
          <span>Job Search & Career Preferences</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure target criteria for job discovery, matching filters, and referral targeting.
        </p>
      </div>

      <form onSubmit={handleSave} className="glass-card rounded-2xl p-6 sm:p-8 space-y-8">
        {/* Work Mode Selector */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-white">
            Target Work Mode
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {workModes.map((mode) => {
              const Icon = mode.icon;
              const isSelected = workMode === mode.value;
              return (
                <button
                  type="button"
                  key={mode.value}
                  onClick={() => setWorkMode(mode.value)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all ${
                    isSelected
                      ? "bg-brand-600/20 border-brand-500 text-white shadow-lg shadow-brand-500/10 font-semibold"
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1.5 ${isSelected ? "text-brand-400" : ""}`} />
                  <span className="text-xs">{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Roles & Locations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
              <Briefcase className="w-4 h-4 text-brand-400" />
              <span>Preferred Job Roles (comma-separated)</span>
            </label>
            <input
              type="text"
              value={preferredRoles}
              onChange={(e) => setPreferredRoles(e.target.value)}
              placeholder="e.g., Staff AI Engineer, Senior Backend Engineer, Lead Architect"
              className="w-full bg-slate-950 text-xs text-white border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500"
            />
            <p className="text-[11px] text-slate-500">Used to filter job titles and matching relevance.</p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
              <MapPin className="w-4 h-4 text-accent-cyan" />
              <span>Preferred Locations (comma-separated)</span>
            </label>
            <input
              type="text"
              value={preferredLocations}
              onChange={(e) => setPreferredLocations(e.target.value)}
              placeholder="e.g., San Francisco, CA, Seattle, WA, Remote"
              className="w-full bg-slate-950 text-xs text-white border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:border-accent-cyan"
            />
            <p className="text-[11px] text-slate-500">Locations you are open to relocating or commuting to.</p>
          </div>
        </div>

        {/* Employment Type & Compensation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-800">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-200">
              Employment Type
            </label>
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              className="w-full bg-slate-950 text-xs text-white border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500"
            >
              {employmentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-200 flex items-center space-x-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Target Salary Minimum</span>
            </label>
            <input
              type="number"
              step="5000"
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="180000"
              className="w-full bg-slate-950 text-xs text-white border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-200 flex items-center space-x-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Target Salary Maximum</span>
            </label>
            <input
              type="number"
              step="5000"
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="250000"
              className="w-full bg-slate-950 text-xs text-white border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {saveSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Career preferences updated successfully!</span>
          </div>
        )}

        {saveError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Footer Submit */}
        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold text-xs shadow-lg shadow-brand-500/20 disabled:opacity-50 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Saving Preferences..." : "Save Preferences"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
