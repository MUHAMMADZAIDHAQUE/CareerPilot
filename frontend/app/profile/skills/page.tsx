"use client";

import React, { useEffect, useState } from "react";
import { fetchCandidateProfile, addSkillApi, Candidate, Skill } from "@/lib/api";
import ProfileNav from "@/components/ProfileNav";
import { Award, Plus, Search, Star, Layers, Sparkles, Check, AlertCircle } from "lucide-react";

const CATEGORIES = [
  "Languages",
  "Frameworks",
  "Databases",
  "Cloud & DevOps",
  "AI & ML",
  "Tools & Platforms",
  "General",
];

const PROFICIENCY_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];

export default function SkillsPage() {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isAddingSkill, setIsAddingSkill] = useState(false);

  // Add Skill Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Languages");
  const [proficiency, setProficiency] = useState("Advanced");
  const [years, setYears] = useState<number | "">("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSkills = async () => {
    const res = await fetchCandidateProfile();
    if (res.data) setCandidate(res.data);
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Skill name is required.");
      return;
    }

    setIsSubmitting(true);
    const res = await addSkillApi({
      name: name.trim(),
      category,
      proficiency_level: proficiency,
      years_of_experience: years !== "" ? Number(years) : undefined,
    });
    setIsSubmitting(false);

    if (res.error) {
      setFormError(res.error);
    } else {
      setName("");
      setYears("");
      setIsAddingSkill(false);
      await loadSkills();
    }
  };

  const allSkills = candidate?.skills || [];

  const filteredSkills = allSkills.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === "All" || s.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Group filtered skills by category
  const skillsByCategory: Record<string, Skill[]> = {};
  filteredSkills.forEach((s) => {
    const cat = s.category || "General";
    if (!skillsByCategory[cat]) skillsByCategory[cat] = [];
    skillsByCategory[cat].push(s);
  });

  return (
    <div className="space-y-8">
      <ProfileNav />

      {/* Header with Title & Add Skill Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center space-x-3">
            <Award className="w-7 h-7 text-brand-400" />
            <span>Verified Skills Inventory</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Canonical technical capabilities and tools verified for resume tailoring and job matching.
          </p>
        </div>

        <button
          onClick={() => setIsAddingSkill(!isAddingSkill)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{isAddingSkill ? "Cancel" : "Add New Skill"}</span>
        </button>
      </div>

      {/* Add Skill Form Drawer */}
      {isAddingSkill && (
        <form
          onSubmit={handleAddSkill}
          className="glass-card rounded-2xl p-6 space-y-4 border border-brand-500/30 animate-in fade-in slide-in-from-top-4 duration-200"
        >
          <h3 className="font-bold text-base text-white flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <span>Add Verified Skill</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Skill Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., PyTorch, Rust, AWS"
                className="w-full bg-slate-950 text-xs text-white border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 text-xs text-white border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Proficiency
              </label>
              <select
                value={proficiency}
                onChange={(e) => setProficiency(e.target.value)}
                className="w-full bg-slate-950 text-xs text-white border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
              >
                {PROFICIENCY_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Years of Experience
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={years}
                onChange={(e) => setYears(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g., 3.5"
                className="w-full bg-slate-950 text-xs text-white border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAddingSkill(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/20 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Skill"}
            </button>
          </div>
        </form>
      )}

      {/* Filter and Category Select Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search skills..."
            className="w-full bg-slate-950 text-xs text-white pl-9 pr-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center space-x-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {["All", ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Categorized Skills Grid */}
      {Object.keys(skillsByCategory).length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center space-y-3">
          <Award className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Skills Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm
              ? `No skills matched "${searchTerm}". Try a different search.`
              : "No verified skills logged. Import a resume JSON or add your top skills manually."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(skillsByCategory).map(([catName, skills]) => (
            <div key={catName} className="glass-card rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-brand-400" />
                  <span>{catName}</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {skills.length} {skills.length === 1 ? "skill" : "skills"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {skills.map((skill) => (
                  <div
                    key={skill.id || skill.name}
                    className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/90 flex flex-col justify-between space-y-2 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold text-sm text-slate-100">{skill.name}</h4>
                      {skill.proficiency_level && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            skill.proficiency_level === "Expert"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                              : skill.proficiency_level === "Advanced"
                              ? "bg-brand-500/10 text-brand-400 border-brand-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          }`}
                        >
                          {skill.proficiency_level}
                        </span>
                      )}
                    </div>

                    {skill.years_of_experience !== undefined && skill.years_of_experience !== null && (
                      <p className="text-[11px] text-slate-400 font-mono">
                        {skill.years_of_experience} {skill.years_of_experience === 1 ? "year" : "years"} exp
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
