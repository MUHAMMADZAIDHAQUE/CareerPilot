"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  FileCode,
  ArrowRight,
  Loader2,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  GraduationCap,
  Briefcase,
  Award,
  FolderGit2,
  User,
  Sparkles,
} from "lucide-react";
import {
  uploadResumeFile,
  confirmResumeImport,
  ResumeUploadResult,
  Candidate,
  Skill,
  Experience,
  Education,
  Project,
  Certification,
} from "@/lib/api";
import { Button } from "./ui/Button";

interface ResumeUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (candidate: Candidate) => void;
}

type ReviewTab = "personal" | "skills" | "experience" | "education" | "projects";

export default function ResumeUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: ResumeUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [uploadResult, setUploadResult] = useState<ResumeUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable candidate facts in the review step
  const [activeTab, setActiveTab] = useState<ReviewTab>("personal");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");

  const [skills, setSkills] = useState<Skill[]>([]);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillCategory, setNewSkillCategory] = useState("Languages");

  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [educationList, setEducationList] = useState<Education[]>([]);
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [certificationsList, setCertificationsList] = useState<Certification[]>([]);

  // Initialize editable fields whenever uploadResult arrives
  useEffect(() => {
    if (uploadResult?.structured_candidate_data) {
      const d = uploadResult.structured_candidate_data;
      setFullName(d.full_name || "");
      setEmail(d.email || "");
      setHeadline(d.headline || "");
      setSummary(d.summary || "");
      setLocation(d.location || "");
      setPhone(d.phone || "");
      setLinkedinUrl(d.linkedin_url || "");
      setGithubUrl(d.github_url || "");
      setPortfolioUrl(d.portfolio_url || "");

      setSkills(d.skills ? [...d.skills] : []);
      setExperiences(d.experience ? [...d.experience] : []);
      setEducationList(d.education ? [...d.education] : []);
      setProjectsList(d.projects ? [...d.projects] : []);
      setCertificationsList(d.certifications ? [...d.certifications] : []);
      setActiveTab("personal");
    }
  }, [uploadResult]);

  if (!isOpen) return null;

  // Uncertainty & Missing Detection
  const missingOrUncertainFields: string[] = [];
  if (!fullName || fullName.trim() === "Candidate") {
    missingOrUncertainFields.push("Full Name appears generic or incomplete");
  }
  if (!email || email.includes("example.com")) {
    missingOrUncertainFields.push("Email address was not confidently detected");
  }
  if (!phone) {
    missingOrUncertainFields.push("Phone number is missing");
  }
  if (!location) {
    missingOrUncertainFields.push("Location is missing");
  }
  if (skills.length === 0) {
    missingOrUncertainFields.push("No technical skills were parsed");
  }
  if (educationList.length === 0) {
    missingOrUncertainFields.push("No education records were found");
  }
  if (experiences.length === 0) {
    missingOrUncertainFields.push("No work experience / internships detected");
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUploadAndExtract = async () => {
    if (!file) {
      setError("Please select a resume file first.");
      return;
    }

    setIsUploading(true);
    setError(null);

    const res = await uploadResumeFile(file);
    setIsUploading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setUploadResult(res.data);
    }
  };

  const handleAddSkill = () => {
    if (!newSkillName.trim()) return;
    const exists = skills.some((s) => s.name.toLowerCase() === newSkillName.trim().toLowerCase());
    if (!exists) {
      setSkills([
        ...skills,
        {
          name: newSkillName.trim(),
          category: newSkillCategory,
          proficiency_level: "Advanced",
        },
      ]);
    }
    setNewSkillName("");
  };

  const handleRemoveSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    if (!uploadResult) return;

    if (!fullName.trim()) {
      setError("Please provide your Full Name.");
      setActiveTab("personal");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please provide a valid email address.");
      setActiveTab("personal");
      return;
    }

    setIsConfirming(true);
    setError(null);

    // Build the user-verified Master Data structure
    const correctedData = {
      full_name: fullName.trim(),
      email: email.trim(),
      headline: headline.trim() || undefined,
      summary: summary.trim() || undefined,
      location: location.trim() || undefined,
      phone: phone.trim() || undefined,
      linkedin_url: linkedinUrl.trim() || undefined,
      github_url: githubUrl.trim() || undefined,
      portfolio_url: portfolioUrl.trim() || undefined,
      skills: skills.map((s) => ({
        name: s.name.trim(),
        category: s.category || "General",
        proficiency_level: s.proficiency_level || "Intermediate",
        years_of_experience: s.years_of_experience,
      })),
      experience: experiences.map((exp) => ({
        company: exp.company.trim(),
        role: exp.role.trim(),
        location: exp.location || undefined,
        start_date: exp.start_date || "2022-01",
        end_date: exp.end_date || undefined,
        is_current: exp.is_current || false,
        bullet_points: exp.bullet_points || [],
        technologies_used: exp.technologies_used || [],
      })),
      education: educationList.map((edu) => ({
        institution: edu.institution.trim(),
        degree: edu.degree.trim(),
        field_of_study: edu.field_of_study || undefined,
        start_date: edu.start_date || undefined,
        end_date: edu.end_date || undefined,
        gpa: edu.gpa || undefined,
        honors: edu.honors || [],
        coursework: edu.coursework || [],
      })),
      projects: projectsList.map((proj) => ({
        title: proj.title.trim(),
        description: proj.description || undefined,
        technologies: proj.technologies || [],
        repo_url: proj.repo_url || undefined,
        live_url: proj.live_url || undefined,
        bullet_points: proj.bullet_points || [],
      })),
      certifications: certificationsList,
      achievements: uploadResult.structured_candidate_data?.achievements || [],
      career_preference: uploadResult.structured_candidate_data?.career_preference || undefined,
    };

    const res = await confirmResumeImport(uploadResult.document_id, correctedData);
    setIsConfirming(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      onSuccess(res.data);
      resetModal();
      onClose();
    }
  };

  const resetModal = () => {
    setFile(null);
    setUploadResult(null);
    setError(null);
    setActiveTab("personal");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                {uploadResult ? "Review & Correct Extracted Resume Facts" : "Upload Master Resume"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {uploadResult
                  ? "Assistive extraction completed. Edit or add any information below before saving as your Master Profile."
                  : "Supports PDF (.pdf), LaTeX (.tex), Markdown, and Plain Text up to 10MB."}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetModal();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {!uploadResult ? (
            /* Upload Step */
            <div className="space-y-6">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20"
                    : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-900/40"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.tex,.txt,.md"
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 mx-auto flex items-center justify-center mb-3 shadow-sm">
                  <FileText className="w-7 h-7" />
                </div>

                <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  {file ? file.name : "Drag & drop your resume file here"}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB • Click to choose a different file`
                    : "PDF, LaTeX (.tex master), Markdown or Plain Text up to 10MB."}
                </p>
              </div>

              {/* Supported Formats Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-slate-900 dark:text-white">PDF Resumes</p>
                    <p className="text-slate-500 dark:text-slate-400">Structured AST Extraction</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center space-x-3">
                  <FileCode className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-slate-900 dark:text-white">LaTeX (.tex)</p>
                    <p className="text-slate-500 dark:text-slate-400">Master template kept verbatim</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center space-x-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-slate-900 dark:text-white">Non-Fabricating</p>
                    <p className="text-slate-500 dark:text-slate-400">Human-confirmed master data</p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            /* Review & Interactive Human Editing Step */
            <div className="space-y-5">
              {/* Extraction Confidence & Review Banner */}
              {missingOrUncertainFields.length > 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>We couldn&apos;t confidently extract some information. Please review and edit the fields below.</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-300 pl-2">
                    {missingOrUncertainFields.slice(0, 3).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      Successfully extracted facts from <strong>{uploadResult.filename}</strong>. Review and edit before confirming.
                    </span>
                  </div>
                  {uploadResult.is_latex && (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-mono text-[10px] font-semibold">
                      Master LaTeX Cached
                    </span>
                  )}
                </div>
              )}

              {/* Navigation Tabs for Editable Sections */}
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs pb-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("personal")}
                  className={`px-3 py-2 font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === "personal"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Personal Info</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("skills")}
                  className={`px-3 py-2 font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === "skills"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Skills ({skills.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("experience")}
                  className={`px-3 py-2 font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === "experience"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Experience ({experiences.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("education")}
                  className={`px-3 py-2 font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === "education"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Education ({educationList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("projects")}
                  className={`px-3 py-2 font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === "projects"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <FolderGit2 className="w-3.5 h-3.5" />
                  <span>Projects ({projectsList.length})</span>
                </button>
              </div>

              {/* TAB 1: Personal & Contact */}
              {activeTab === "personal" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Jane Doe"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. jane.doe@example.com"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +1 (555) 019-2834"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Location / City
                      </label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. San Francisco, CA or Bengaluru, India"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Professional Headline
                      </label>
                      <input
                        type="text"
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        placeholder="e.g. Full-Stack Software Engineer & Distributed Systems Architect"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        LinkedIn URL
                      </label>
                      <input
                        type="text"
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        placeholder="https://linkedin.com/in/janedoe"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        GitHub URL
                      </label>
                      <input
                        type="text"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        placeholder="https://github.com/janedoe"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Portfolio / Personal Website URL
                      </label>
                      <input
                        type="text"
                        value={portfolioUrl}
                        onChange={(e) => setPortfolioUrl(e.target.value)}
                        placeholder="https://janedoe.dev"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Executive Summary
                      </label>
                      <textarea
                        rows={3}
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        placeholder="Brief summary of professional background, focus areas, and key impact..."
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Skills */}
              {activeTab === "skills" && (
                <div className="space-y-4">
                  {/* Add Skill Form */}
                  <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <input
                      type="text"
                      value={newSkillName}
                      onChange={(e) => setNewSkillName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddSkill();
                        }
                      }}
                      placeholder="Add a skill (e.g. JavaScript, Python, Docker)..."
                      className="flex-1 min-w-[200px] px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <select
                      value={newSkillCategory}
                      onChange={(e) => setNewSkillCategory(e.target.value)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                    >
                      <option value="Languages">Languages</option>
                      <option value="Frameworks">Frameworks</option>
                      <option value="Databases">Databases</option>
                      <option value="Cloud & DevOps">Cloud & DevOps</option>
                      <option value="AI & ML">AI & ML</option>
                      <option value="General">General</option>
                    </select>

                    <Button size="sm" variant="primary" onClick={handleAddSkill}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Skill
                    </Button>
                  </div>

                  {/* Skills Cloud */}
                  <div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                      Extracted & Added Skills ({skills.length}): Click &apos;×&apos; to remove or fix misparsed names.
                    </span>
                    <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1">
                      {skills.map((s, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                        >
                          <span>{s.name}</span>
                          <span className="text-[10px] text-slate-400">({s.category || "General"})</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(idx)}
                            className="hover:text-red-500 p-0.5"
                            title="Remove skill"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {skills.length === 0 && (
                        <p className="text-xs text-slate-400 italic">No skills listed yet. Add some above.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Experience */}
              {activeTab === "experience" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Work Experience & Internships ({experiences.length})
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setExperiences([
                          ...experiences,
                          {
                            company: "New Company",
                            role: "Software Engineer",
                            start_date: "2023-01",
                            is_current: true,
                            bullet_points: ["Contributed to core product features."],
                            technologies_used: [],
                          },
                        ])
                      }
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Position
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {experiences.map((exp, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">Role / Title *</label>
                              <input
                                type="text"
                                value={exp.role}
                                onChange={(e) => {
                                  const updated = [...experiences];
                                  updated[idx].role = e.target.value;
                                  setExperiences(updated);
                                }}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">Company *</label>
                              <input
                                type="text"
                                value={exp.company}
                                onChange={(e) => {
                                  const updated = [...experiences];
                                  updated[idx].company = e.target.value;
                                  setExperiences(updated);
                                }}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">Start Date</label>
                              <input
                                type="text"
                                value={exp.start_date}
                                onChange={(e) => {
                                  const updated = [...experiences];
                                  updated[idx].start_date = e.target.value;
                                  setExperiences(updated);
                                }}
                                placeholder="e.g. 2022-06"
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">End Date</label>
                              <input
                                type="text"
                                value={exp.is_current ? "Present" : exp.end_date || ""}
                                disabled={exp.is_current}
                                onChange={(e) => {
                                  const updated = [...experiences];
                                  updated[idx].end_date = e.target.value;
                                  setExperiences(updated);
                                }}
                                placeholder="e.g. 2024-05"
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-50"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setExperiences(experiences.filter((_, i) => i !== idx))}
                            className="p-1 text-slate-400 hover:text-rose-500"
                            title="Remove position"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Bullet points editor */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-500 block">
                            Key Accomplishments & Bullet Points ({exp.bullet_points.length}):
                          </label>
                          <textarea
                            rows={2}
                            value={exp.bullet_points.join("\n")}
                            onChange={(e) => {
                              const updated = [...experiences];
                              updated[idx].bullet_points = e.target.value.split("\n").filter((b) => b.trim());
                              setExperiences(updated);
                            }}
                            placeholder="One bullet point per line..."
                            className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
                          />
                        </div>
                      </div>
                    ))}
                    {experiences.length === 0 && (
                      <p className="text-xs text-slate-400 italic">No experience added. Click &apos;Add Position&apos; above.</p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: Education */}
              {activeTab === "education" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      College & Academic Degrees ({educationList.length})
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEducationList([
                          ...educationList,
                          {
                            institution: "University / Institute",
                            degree: "Bachelor of Technology",
                            field_of_study: "Computer Science",
                            end_date: "2025",
                            gpa: "8.5",
                          },
                        ])
                      }
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Education
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {educationList.map((edu, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                                College / University *
                              </label>
                              <input
                                type="text"
                                value={edu.institution}
                                onChange={(e) => {
                                  const updated = [...educationList];
                                  updated[idx].institution = e.target.value;
                                  setEducationList(updated);
                                }}
                                placeholder="e.g. University of California, Berkeley"
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                                Degree (B.S., B.Tech, M.S.) *
                              </label>
                              <input
                                type="text"
                                value={edu.degree}
                                onChange={(e) => {
                                  const updated = [...educationList];
                                  updated[idx].degree = e.target.value;
                                  setEducationList(updated);
                                }}
                                placeholder="e.g. Bachelor of Science"
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                                Branch / Major
                              </label>
                              <input
                                type="text"
                                value={edu.field_of_study || ""}
                                onChange={(e) => {
                                  const updated = [...educationList];
                                  updated[idx].field_of_study = e.target.value;
                                  setEducationList(updated);
                                }}
                                placeholder="e.g. Computer Science & Engineering"
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">Grad Year</label>
                                <input
                                  type="text"
                                  value={edu.end_date || ""}
                                  onChange={(e) => {
                                    const updated = [...educationList];
                                    updated[idx].end_date = e.target.value;
                                    setEducationList(updated);
                                  }}
                                  placeholder="e.g. 2025"
                                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">CGPA / GPA</label>
                                <input
                                  type="text"
                                  value={edu.gpa || ""}
                                  onChange={(e) => {
                                    const updated = [...educationList];
                                    updated[idx].gpa = e.target.value;
                                    setEducationList(updated);
                                  }}
                                  placeholder="e.g. 3.8 / 8.9"
                                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                />
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setEducationList(educationList.filter((_, i) => i !== idx))}
                            className="p-1 text-slate-400 hover:text-rose-500"
                            title="Remove education"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {educationList.length === 0 && (
                      <p className="text-xs text-slate-400 italic">No education added. Click &apos;Add Education&apos; above.</p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: Projects */}
              {activeTab === "projects" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Technical Projects ({projectsList.length})
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setProjectsList([
                          ...projectsList,
                          {
                            title: "New Technical Project",
                            description: "Project description and technical achievements",
                            technologies: ["Python", "FastAPI"],
                            bullet_points: ["Engineered scalable architecture with 99.9% uptime."],
                          },
                        ])
                      }
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Project
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {projectsList.map((proj, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">Project Title *</label>
                              <input
                                type="text"
                                value={proj.title}
                                onChange={(e) => {
                                  const updated = [...projectsList];
                                  updated[idx].title = e.target.value;
                                  setProjectsList(updated);
                                }}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">Technologies (comma-separated)</label>
                              <input
                                type="text"
                                value={(proj.technologies || []).join(", ")}
                                onChange={(e) => {
                                  const updated = [...projectsList];
                                  updated[idx].technologies = e.target.value.split(",").map((t) => t.trim()).filter(Boolean);
                                  setProjectsList(updated);
                                }}
                                placeholder="React, Node.js, PostgreSQL"
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">Summary / Repo URL</label>
                              <input
                                type="text"
                                value={proj.repo_url || proj.description || ""}
                                onChange={(e) => {
                                  const updated = [...projectsList];
                                  updated[idx].description = e.target.value;
                                  setProjectsList(updated);
                                }}
                                placeholder="https://github.com/username/project or brief summary"
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setProjectsList(projectsList.filter((_, i) => i !== idx))}
                            className="p-1 text-slate-400 hover:text-rose-500"
                            title="Remove project"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {projectsList.length === 0 && (
                      <p className="text-xs text-slate-400 italic">No projects listed. Click &apos;Add Project&apos; above.</p>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          {!uploadResult ? (
            <>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleUploadAndExtract}
                disabled={!file}
                loading={isUploading}
                icon={<Upload className="w-4 h-4" />}
              >
                Upload & Extract
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={resetModal}>
                Upload Different File
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirm}
                  loading={isConfirming}
                  icon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Confirm & Save Master Profile
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
