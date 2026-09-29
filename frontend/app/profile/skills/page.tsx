"use client";

import React, { useEffect, useState } from "react";
import { fetchCandidateProfile, addSkillApi, Candidate, Skill } from "@/lib/api";
import ProfileNav from "@/components/ProfileNav";
import { Award, Plus, Search, Sparkles, AlertCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

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
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center space-x-3 tracking-tight">
            <Award className="w-6 h-6 text-slate-700" />
            <span>Verified Skills Inventory</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Canonical technical capabilities and tools verified for resume tailoring and job matching.
          </p>
        </div>

        <Button
          onClick={() => setIsAddingSkill(!isAddingSkill)}
          variant={isAddingSkill ? "outline" : "primary"}
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>{isAddingSkill ? "Cancel" : "Add New Skill"}</span>
        </Button>
      </div>

      {/* Add Skill Form Drawer */}
      {isAddingSkill && (
        <form
          onSubmit={handleAddSkill}
          className="bg-white rounded-2xl p-6 space-y-4 border border-slate-300 shadow-md animate-in fade-in slide-in-from-top-4 duration-200"
        >
          <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-slate-700" />
            <span>Add Verified Skill</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Skill Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., PyTorch, Rust, AWS"
                className="w-full bg-slate-50 text-xs text-slate-900 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 text-xs text-slate-900 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Proficiency
              </label>
              <select
                value={proficiency}
                onChange={(e) => setProficiency(e.target.value)}
                className="w-full bg-slate-50 text-xs text-slate-900 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              >
                {PROFICIENCY_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Years of Experience
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={years}
                onChange={(e) => setYears(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g., 3.5"
                className="w-full bg-slate-50 text-xs text-slate-900 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <Button
              type="button"
              onClick={() => setIsAddingSkill(false)}
              variant="ghost"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              variant="primary"
              size="sm"
            >
              {isSubmitting ? "Saving..." : "Save Skill"}
            </Button>
          </div>
        </form>
      )}

      {/* Filter and Category Select Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search skills..."
            className="w-full bg-slate-50 text-xs text-slate-900 pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {["All", ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white font-semibold shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Categorized Skills Grid */}
      {Object.keys(skillsByCategory).length === 0 ? (
        <EmptyState
          title="No Skills Found"
          description={
            searchTerm
              ? `No skills matched "${searchTerm}". Try a different search.`
              : "No verified skills logged. Import a resume JSON or add your top skills manually."
          }
          action={{
            label: "Add New Skill",
            onClick: () => setIsAddingSkill(true),
          }}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(skillsByCategory).map(([catName, skills]) => (
            <Card key={catName} className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-slate-900" />
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
                    className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between space-y-2 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-xs text-slate-900">{skill.name}</h4>
                      {skill.proficiency_level && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            skill.proficiency_level === "Expert"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : skill.proficiency_level === "Advanced"
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {skill.proficiency_level}
                        </span>
                      )}
                    </div>

                    {skill.years_of_experience !== undefined && skill.years_of_experience !== null && (
                      <p className="text-[11px] text-slate-500 font-mono">
                        {skill.years_of_experience} {skill.years_of_experience === 1 ? "year" : "years"} exp
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
