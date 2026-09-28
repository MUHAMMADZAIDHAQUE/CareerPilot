"use client";

import React, { useEffect, useState } from "react";
import { fetchCandidateProfile, Candidate, Experience, Education } from "@/lib/api";
import ProfileNav from "@/components/ProfileNav";
import ProfileHero from "@/components/ProfileHero";
import StructuredImportModal from "@/components/StructuredImportModal";
import {
  Briefcase,
  GraduationCap,
  Award,
  Calendar,
  MapPin,
  Plus,
  Layers,
  Sparkles,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const loadProfile = async () => {
    setIsLoading(true);
    const res = await fetchCandidateProfile();
    setCandidate(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  return (
    <div className="space-y-8">
      {/* Profile Navigation Tabs */}
      <ProfileNav />

      {/* Hero Profile Header */}
      <ProfileHero
        candidate={candidate}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onRefresh={loadProfile}
      />

      {candidate && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column: Work Experience Timeline */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-brand-400" />
                <span>Verified Work Experience</span>
              </h2>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {candidate.experiences.length} Positions
              </span>
            </div>

            {candidate.experiences.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center text-slate-400 text-sm border-dashed border border-slate-700">
                No work experience records found. Click &quot;Import / Refresh JSON&quot; above to add.
              </div>
            ) : (
              <div className="space-y-4">
                {candidate.experiences.map((exp, idx) => (
                  <div
                    key={exp.id || idx}
                    className="glass-card rounded-xl p-6 space-y-4 glass-card-hover"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <h3 className="text-lg font-bold text-white">{exp.role}</h3>
                        <p className="text-sm font-medium text-brand-400">{exp.company}</p>
                      </div>
                      <div className="flex flex-col sm:items-end text-xs text-slate-400">
                        <span className="flex items-center space-x-1 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {exp.start_date} – {exp.is_current ? "Present" : exp.end_date || "N/A"}
                          </span>
                        </span>
                        {exp.location && (
                          <span className="flex items-center space-x-1 text-slate-400 mt-0.5">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{exp.location}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Achievement Bullets */}
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-300 list-disc list-outside ml-4">
                      {exp.bullet_points.map((bullet, bIdx) => (
                        <li key={bIdx} className="leading-relaxed">
                          {bullet}
                        </li>
                      ))}
                    </ul>

                    {/* Tech stack chips */}
                    {exp.technologies_used && exp.technologies_used.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/80">
                        {exp.technologies_used.map((tech, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800/80 text-brand-300 border border-slate-700/60"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Education, Stats & Quick Actions */}
          <div className="space-y-6">
            {/* Quick Profile Stats */}
            <div className="glass-card rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-accent-cyan" />
                <span>Career Profile Matrix</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/profile/skills"
                  className="p-3 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-slate-800 transition-colors block"
                >
                  <span className="text-2xl font-extrabold text-brand-400">
                    {candidate.skills.length}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">Skills Logged</p>
                </Link>

                <Link
                  href="/profile/projects"
                  className="p-3 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-slate-800 transition-colors block"
                >
                  <span className="text-2xl font-extrabold text-accent-cyan">
                    {candidate.projects.length}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">Projects</p>
                </Link>

                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="text-2xl font-extrabold text-emerald-400">
                    {candidate.education.length}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">Degrees</p>
                </div>

                <Link
                  href="/profile/preferences"
                  className="p-3 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-slate-800 transition-colors block"
                >
                  <span className="text-xs font-bold text-white truncate block">
                    {candidate.career_preference?.work_mode || "Set"}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">Target Mode</p>
                </Link>
              </div>
            </div>

            {/* Education Card */}
            <div className="glass-card rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                <span>Education History</span>
              </h3>

              {candidate.education.length === 0 ? (
                <p className="text-xs text-slate-400">No education entries found.</p>
              ) : (
                <div className="space-y-4">
                  {candidate.education.map((edu, idx) => (
                    <div key={edu.id || idx} className="space-y-1 border-b border-slate-800/80 pb-3 last:border-b-0">
                      <h4 className="font-semibold text-sm text-slate-100">{edu.institution}</h4>
                      <p className="text-xs text-brand-400 font-medium">
                        {edu.degree} {edu.field_of_study ? `in ${edu.field_of_study}` : ""}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 font-mono">
                        <span>
                          {edu.start_date || ""} {edu.end_date ? `– ${edu.end_date}` : ""}
                        </span>
                        {edu.gpa && <span className="text-emerald-400">GPA: {edu.gpa}</span>}
                      </div>
                      {edu.honors && edu.honors.length > 0 && (
                        <div className="text-[11px] text-slate-400 pt-1">
                          <span className="text-slate-300 font-medium">Honors: </span>
                          {edu.honors.join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Certifications & Achievements */}
            {(candidate.certifications.length > 0 || candidate.achievements.length > 0) && (
              <div className="glass-card rounded-xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Certifications & Honors</span>
                </h3>
                <div className="space-y-3">
                  {candidate.certifications.map((cert, idx) => (
                    <div key={idx} className="text-xs space-y-0.5">
                      <p className="font-semibold text-slate-200">{cert.name}</p>
                      <p className="text-slate-400">{cert.issuing_organization}</p>
                    </div>
                  ))}
                  {candidate.achievements.map((ach, idx) => (
                    <div key={idx} className="text-xs space-y-0.5 pt-2 border-t border-slate-800">
                      <p className="font-semibold text-emerald-400">{ach.title}</p>
                      <p className="text-slate-400">{ach.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Structured Resume Import Modal */}
      <StructuredImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(updated) => setCandidate(updated)}
      />
    </div>
  );
}
