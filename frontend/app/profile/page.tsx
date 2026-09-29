"use client";

import React, { useEffect, useState } from "react";
import { fetchCandidateProfile, Candidate } from "@/lib/api";
import ProfileNav from "@/components/ProfileNav";
import ProfileHero from "@/components/ProfileHero";
import StructuredImportModal from "@/components/StructuredImportModal";
import ResumeUploadModal from "@/components/ResumeUploadModal";
import {
  Briefcase,
  GraduationCap,
  Award,
  Calendar,
  MapPin,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import LoadingState from "@/components/ui/LoadingState";

export default function ProfilePage() {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

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
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        onRefresh={loadProfile}
      />

      {isLoading ? (
        <LoadingState message="Loading candidate career profile..." />
      ) : candidate ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column: Work Experience Timeline */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-slate-700" />
                <span>Verified Work Experience</span>
              </h2>
              <Badge variant="neutral">
                {candidate.experiences.length} Positions
              </Badge>
            </div>

            {candidate.experiences.length === 0 ? (
              <EmptyState
                title="No work experience records logged"
                description="Upload your resume or import JSON to populate your employment history."
                action={{
                  label: "Upload Resume File",
                  onClick: () => setIsUploadModalOpen(true),
                }}
              />
            ) : (
              <div className="space-y-4">
                {candidate.experiences.map((exp, idx) => (
                  <Card
                    key={exp.id || idx}
                    className="p-6 space-y-4"
                    hover
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{exp.role}</h3>
                        <p className="text-sm font-semibold text-slate-700">{exp.company}</p>
                      </div>
                      <div className="flex flex-col sm:items-end text-xs text-slate-500">
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
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-600 list-disc list-outside ml-4">
                      {exp.bullet_points.map((bullet, bIdx) => (
                        <li key={bIdx} className="leading-relaxed">
                          {bullet}
                        </li>
                      ))}
                    </ul>

                    {/* Tech stack chips */}
                    {exp.technologies_used && exp.technologies_used.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                        {exp.technologies_used.map((tech, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200/60"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Education, Stats & Quick Actions */}
          <div className="space-y-6">
            {/* Quick Profile Stats */}
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-slate-700" />
                <span>Career Profile Matrix</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/profile/skills"
                  className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 transition-colors block"
                >
                  <span className="text-2xl font-black text-slate-900">
                    {candidate.skills.length}
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">Skills Logged</p>
                </Link>

                <Link
                  href="/profile/projects"
                  className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 transition-colors block"
                >
                  <span className="text-2xl font-black text-slate-900">
                    {candidate.projects.length}
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">Projects</p>
                </Link>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-2xl font-black text-slate-900">
                    {candidate.education.length}
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">Degrees</p>
                </div>

                <Link
                  href="/profile/preferences"
                  className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 transition-colors block"
                >
                  <span className="text-xs font-bold text-slate-900 truncate block mt-1">
                    {candidate.career_preference?.work_mode || "Configured"}
                  </span>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Target Mode</p>
                </Link>
              </div>
            </Card>

            {/* Education Card */}
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <GraduationCap className="w-4 h-4 text-slate-700" />
                <span>Education History</span>
              </h3>

              {candidate.education.length === 0 ? (
                <p className="text-xs text-slate-500">No education entries found.</p>
              ) : (
                <div className="space-y-4">
                  {candidate.education.map((edu, idx) => (
                    <div key={edu.id || idx} className="space-y-1 border-b border-slate-100 pb-3 last:border-b-0">
                      <h4 className="font-semibold text-xs text-slate-900">{edu.institution}</h4>
                      <p className="text-xs text-slate-600 font-medium">
                        {edu.degree} {edu.field_of_study ? `in ${edu.field_of_study}` : ""}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 font-mono">
                        <span>
                          {edu.start_date || ""} {edu.end_date ? `– ${edu.end_date}` : ""}
                        </span>
                        {edu.gpa && <span className="text-emerald-700 font-semibold">GPA: {edu.gpa}</span>}
                      </div>
                      {edu.honors && edu.honors.length > 0 && (
                        <div className="text-[11px] text-slate-500 pt-1">
                          <span className="text-slate-700 font-medium">Honors: </span>
                          {edu.honors.join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Certifications & Achievements */}
            {(candidate.certifications.length > 0 || candidate.achievements.length > 0) && (
              <Card className="p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Award className="w-4 h-4 text-slate-700" />
                  <span>Certifications & Honors</span>
                </h3>
                <div className="space-y-3">
                  {candidate.certifications.map((cert, idx) => (
                    <div key={idx} className="text-xs space-y-0.5">
                      <p className="font-semibold text-slate-800">{cert.name}</p>
                      <p className="text-slate-500">{cert.issuing_organization}</p>
                    </div>
                  ))}
                  {candidate.achievements.map((ach, idx) => (
                    <div key={idx} className="text-xs space-y-0.5 pt-2 border-t border-slate-100">
                      <p className="font-semibold text-slate-900">{ach.title}</p>
                      <p className="text-slate-500">{ach.description}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      ) : null}

      {/* Structured Resume Import Modal */}
      <StructuredImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(updated) => setCandidate(updated)}
      />

      {/* Resume File Upload Modal */}
      <ResumeUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={(updated) => setCandidate(updated)}
      />
    </div>
  );
}
