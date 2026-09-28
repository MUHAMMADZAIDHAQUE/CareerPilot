"use client";

import React, { useState } from "react";
import {
  Briefcase,
  Search,
  Sparkles,
  MapPin,
  Clock,
  DollarSign,
  Calendar,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Code2,
  Cpu,
  GraduationCap,
  Layers,
  Building2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  HelpCircle,
} from "lucide-react";
import { analyzeJobApi, Job, AnalyzeJobPayload } from "@/lib/api";

const SAMPLE_JDS = [
  {
    label: "Staff Backend Engineer (Apex Cloud)",
    company: "Apex Cloud Systems",
    role: "Staff Backend Engineer",
    url: "https://apexcloud.io/careers/staff-backend",
    text: `Apex Cloud Systems
Role: Staff Backend Engineer
Location: San Francisco, CA (Hybrid)
Salary: $180,000 - $220,000 / year
Application Deadline: December 15, 2026

ABOUT US:
Apex Cloud Systems is pioneering high-throughput distributed database platforms and cloud streaming engines.

RESPONSIBILITIES:
• Architect, build, and maintain mission-critical distributed microservices.
• Optimize low-latency event processing pipelines using Kafka and Redis.
• Lead architectural reviews and mentor junior engineering staff.
• Ensure 99.99% uptime across multi-region Kubernetes clusters on AWS.

REQUIREMENTS:
• 5+ years of software engineering experience.
• Bachelor of Science in Computer Science or equivalent field.
• Extensive production experience with Python, FastAPI, and SQL.
• Hands-on mastery with PostgreSQL, Docker, and Kubernetes on AWS.

PREFERRED QUALIFICATIONS:
• Experience with Rust, Golang, and high-concurrency event-driven systems.
• Familiarity with pgvector and vector database indexing.
• Contributions to open-source infrastructure projects.`,
  },
  {
    label: "Senior AI Engineer (NeuralPath)",
    company: "NeuralPath AI",
    role: "Senior AI Engineer",
    url: "https://neuralpath.ai/jobs/senior-ai",
    text: `NeuralPath AI
Position: Senior AI Engineer
Location: Remote (USA)
Employment Type: Full-time

ABOUT THE ROLE:
We are seeking a Senior AI Engineer to scale our autonomous agent platforms and LLM evaluation infrastructure.

WHAT YOU'LL DO:
- Build agentic workflows and multi-agent coordination systems using LangChain and LangGraph.
- Fine-tune and evaluate LLMs on domain-specific reasoning benchmarks.
- Deploy low-latency inference pipelines with FastAPI and Docker.
- Collaborate with product to embed semantic vector search into production apps.

MINIMUM QUALIFICATIONS:
- 4+ years of Python and PyTorch experience in production.
- Strong grounding in LangChain, LangGraph, RAG, and LLMs.
- Master's degree in Artificial Intelligence or Computer Science.
- Experience with vector databases and embedding generation.

NICE TO HAVE:
- Experience with Kubernetes and Triton inference server.
- Familiarity with TypeScript and Next.js frontends.
- Published research in NLP or generative models.`,
  },
];

export default function JobAnalyzePage() {
  const [jobDescription, setJobDescription] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzedJob, setAnalyzedJob] = useState<Job | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSelectSample = (sample: typeof SAMPLE_JDS[0]) => {
    setJobDescription(sample.text);
    setCompany(sample.company);
    setRole(sample.role);
    setJobUrl(sample.url);
    setError(null);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobDescription.trim() || jobDescription.trim().length < 20) {
      setError("Please paste a job description with at least 20 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    const payload: AnalyzeJobPayload = {
      job_description: jobDescription,
      job_url: jobUrl.trim() || undefined,
      company: company.trim() || undefined,
      role: role.trim() || undefined,
    };

    const res = await analyzeJobApi(payload);
    setLoading(false);

    if (res.error || !res.data) {
      setError(res.error || "Failed to analyze job description");
    } else {
      setAnalyzedJob(res.data);
      // Scroll smoothly down to results
      setTimeout(() => {
        document.getElementById("analysis-results")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  const copyResultsJson = () => {
    if (!analyzedJob) return;
    navigator.clipboard.writeText(JSON.stringify(analyzedJob, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-10">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Phase 4 Active • Structured JD Analyzer</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Job Description <span className="text-gradient">Analyzer</span>
          </h1>
          <p className="text-slate-400 mt-2 max-w-2xl text-sm sm:text-base">
            Extract verified requirements, categorize mandatory vs preferred skills, and dissect architectural expectations with strict anti-hallucination guarantees.
          </p>
        </div>

        {/* Quick Sample Selector */}
        <div className="flex flex-col items-start md:items-end gap-2">
          <span className="text-xs text-slate-400 font-medium">Quick Test with Sample JDs:</span>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_JDS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSample(sample)}
                className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-medium text-slate-300 hover:text-white transition-all hover:border-brand-500/50 shadow-sm"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Analysis Form */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl -z-10" />

        <form onSubmit={handleAnalyze} className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="job-description-input" className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-brand-400" />
                <span>Job Description Content *</span>
              </label>
              <span className="text-xs text-slate-400 font-mono">
                {jobDescription.length} characters
              </span>
            </div>
            <textarea
              id="job-description-input"
              rows={10}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste raw job description here... (e.g. from LinkedIn, Greenhouse, Lever, Workday)"
              className="w-full rounded-xl bg-slate-950/70 border border-slate-800/80 p-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all font-mono leading-relaxed"
              required
            />
          </div>

          {/* Optional Fields Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowOptionalFields(!showOptionalFields)}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1.5 transition-colors"
            >
              <span>{showOptionalFields ? "Hide optional metadata fields" : "Add optional metadata (Company, Role, URL)"}</span>
              {showOptionalFields ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showOptionalFields && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/60">
                <div>
                  <label htmlFor="job-company-input" className="text-xs font-medium text-slate-300 block mb-1">
                    Company Name
                  </label>
                  <input
                    id="job-company-input"
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Stripe, OpenAI, Apex"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950/70 border border-slate-800 text-slate-100 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="job-role-input" className="text-xs font-medium text-slate-300 block mb-1">
                    Role Title
                  </label>
                  <input
                    id="job-role-input"
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Staff Backend Engineer"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950/70 border border-slate-800 text-slate-100 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="job-url-input" className="text-xs font-medium text-slate-300 block mb-1">
                    Job / Application URL
                  </label>
                  <input
                    id="job-url-input"
                    type="url"
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950/70 border border-slate-800 text-slate-100 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Analysis Failed</p>
                <p className="text-xs text-red-300/80 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                setJobDescription("");
                setCompany("");
                setRole("");
                setJobUrl("");
                setError(null);
                setAnalyzedJob(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all"
            >
              Clear Form
            </button>

            <button
              type="submit"
              id="analyze-job-button"
              disabled={loading || !jobDescription.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-accent-cyan hover:from-brand-500 hover:to-accent-cyan text-white text-sm font-semibold shadow-lg shadow-brand-500/20 transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Extracting Structured Facts...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Analyze Job</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Analysis Results Display */}
      {analyzedJob && (
        <div id="analysis-results" className="space-y-8 animate-fadeIn">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-xl relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                    {analyzedJob.domain || "Technology"}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    ID: {analyzedJob.id.slice(0, 8)}...
                  </span>
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {analyzedJob.role}
                  </h2>
                  <div className="flex items-center space-x-2 text-slate-300 mt-1 font-medium">
                    <Building2 className="w-4 h-4 text-brand-400" />
                    <span>{analyzedJob.company}</span>
                  </div>
                </div>

                {/* Metadata Pills */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-2">
                  <div className="flex items-center space-x-1.5">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>{analyzedJob.location || "Remote"}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>{analyzedJob.employment_type || "Full-time"}</span>
                  </div>
                  {analyzedJob.salary && (
                    <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-semibold">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>{analyzedJob.salary}</span>
                    </div>
                  )}
                  {analyzedJob.deadline && (
                    <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Apply by {analyzedJob.deadline}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap lg:flex-col gap-3 justify-end items-end">
                {analyzedJob.application_url && (
                  <a
                    href={analyzedJob.application_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white flex items-center space-x-1.5 transition-all shadow-sm"
                  >
                    <span>View Application</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={copyResultsJson}
                  className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-medium text-slate-300 hover:text-white flex items-center space-x-1.5 transition-all"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied JSON" : "Copy Structured Data"}</span>
                </button>
              </div>
            </div>

            {/* Summary */}
            {analyzedJob.summary && (
              <div className="mt-6 pt-6 border-t border-slate-800">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Job Summary
                </h3>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {analyzedJob.summary}
                </p>
              </div>
            )}
          </div>

          {/* Skills Breakdown: Required vs Preferred vs Inferred */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Required Skills */}
            <div className="bg-slate-900/60 border border-emerald-500/30 rounded-2xl p-6 backdrop-blur-xl shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Required Skills</h3>
                    <p className="text-xs text-emerald-400/80">Strict Minimums</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {analyzedJob.required_skills.length}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {analyzedJob.required_skills.length > 0 ? (
                  analyzedJob.required_skills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No explicit required skills found.</p>
                )}
              </div>
            </div>

            {/* 2. Preferred Skills */}
            <div className="bg-slate-900/60 border border-cyan-500/30 rounded-2xl p-6 backdrop-blur-xl shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Preferred Skills</h3>
                    <p className="text-xs text-cyan-400/80">Nice-to-Have Pluses</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {analyzedJob.preferred_skills.length}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {analyzedJob.preferred_skills.length > 0 ? (
                  analyzedJob.preferred_skills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No optional preferred skills stated.</p>
                )}
              </div>
            </div>

            {/* 3. Inferred Architectural Concepts */}
            <div className="bg-slate-900/60 border border-purple-500/30 rounded-2xl p-6 backdrop-blur-xl shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Inferred Concepts</h3>
                    <p className="text-xs text-purple-400/80">Domain Architecture</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {analyzedJob.inferred_concepts.length}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {analyzedJob.inferred_concepts.length > 0 ? (
                  analyzedJob.inferred_concepts.map((concept, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/30"
                    >
                      {concept}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No inferred concepts extracted.</p>
                )}
              </div>
            </div>
          </div>

          {/* Responsibilities & Qualifications Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Responsibilities */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
              <h3 className="font-bold text-base text-white flex items-center space-x-2 mb-4">
                <Layers className="w-4 h-4 text-brand-400" />
                <span>Key Responsibilities</span>
              </h3>
              {analyzedJob.responsibilities.length > 0 ? (
                <ul className="space-y-3">
                  {analyzedJob.responsibilities.map((resp, i) => (
                    <li key={i} className="flex items-start space-x-3 text-xs sm:text-sm text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-2 flex-shrink-0" />
                      <span className="leading-relaxed">{resp}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 italic">No bulleted responsibilities parsed.</p>
              )}
            </div>

            {/* Experience & Education & Qualifications */}
            <div className="space-y-6">
              {/* Experience Requirement */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
                <h3 className="font-bold text-sm text-white flex items-center space-x-2 mb-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Experience Requirement</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-200">
                  {analyzedJob.experience_requirement || "Not explicitly specified in years."}
                </p>
              </div>

              {/* Education Requirement */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
                <h3 className="font-bold text-sm text-white flex items-center space-x-2 mb-2">
                  <GraduationCap className="w-4 h-4 text-cyan-400" />
                  <span>Education Requirements</span>
                </h3>
                {analyzedJob.education_requirements.length > 0 ? (
                  <ul className="space-y-2">
                    {analyzedJob.education_requirements.map((edu, i) => (
                      <li key={i} className="text-xs sm:text-sm text-slate-300 flex items-center space-x-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <span>{edu}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic">No specific degrees required.</p>
                )}
              </div>

              {/* Technologies Mentioned */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
                <h3 className="font-bold text-sm text-white flex items-center space-x-2 mb-3">
                  <Code2 className="w-4 h-4 text-brand-400" />
                  <span>All Technologies & Tools</span>
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {analyzedJob.technologies.map((tech, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Granular Requirements Breakdown & Evidence Grounding */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base text-white flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Verified Factual Grounding (Anti-Hallucination Audit)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Each extracted item is mapped directly to its supporting quote in the source job description.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {analyzedJob.requirements.length} itemized facts
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {analyzedJob.requirements.map((req, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-white">{req.name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        req.requirement_type === "required"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : req.requirement_type === "preferred"
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                          : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      }`}
                    >
                      {req.requirement_type}
                    </span>
                  </div>
                  {req.context && (
                    <p className="text-xs text-slate-400 font-mono italic line-clamp-2 mt-1 bg-slate-900/40 p-2 rounded border border-slate-800/40">
                      "{req.context}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
