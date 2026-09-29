"use client";

import React, { useState } from "react";
import { X, UploadCloud, Sparkles, AlertCircle } from "lucide-react";
import { importStructuredResumeApi, Candidate } from "@/lib/api";
import Button from "@/components/ui/Button";

interface StructuredImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (candidate: Candidate) => void;
}

const SAMPLE_STRUCTURED_RESUME = {
  full_name: "Alex Mercer",
  email: "alex.mercer@example.com",
  headline: "Staff Software Engineer & AI Systems Architect",
  summary: "Senior software engineer with 6+ years of experience designing high-throughput distributed systems, asynchronous microservices, and AI-assisted workflows.",
  location: "San Francisco, CA",
  phone: "+1 (555) 019-2834",
  linkedin_url: "https://linkedin.com/in/alexmercer",
  github_url: "https://github.com/alexmercer",
  portfolio_url: "https://alexmercer.dev",
  education: [
    {
      institution: "University of California, Berkeley",
      degree: "Bachelor of Science",
      field_of_study: "Computer Science",
      start_date: "2015-08",
      end_date: "2019-05",
      gpa: "3.85",
      honors: ["Dean's Honors List", "Eta Kappa Nu EECS Honor Society"],
      coursework: ["Distributed Systems", "Operating Systems", "Machine Learning", "Database Systems"]
    }
  ],
  experience: [
    {
      company: "Apex Cloud Technologies",
      role: "Staff Software Engineer",
      location: "San Francisco, CA",
      start_date: "2022-01",
      is_current: true,
      bullet_points: [
        "Architected scalable asynchronous backend services using FastAPI, PostgreSQL, and Redis processing 12M+ daily requests.",
        "Implemented hybrid semantic search engine leveraging pgvector HNSW indexing, reducing query latencies by 42%.",
        "Designed automated CI/CD deployment pipelines using Docker, GitHub Actions, and Kubernetes across 8 production clusters."
      ],
      technologies_used: ["Python", "FastAPI", "PostgreSQL", "pgvector", "Redis", "Docker", "Kubernetes"]
    },
    {
      company: "Nova Stream Inc.",
      role: "Senior Software Engineer",
      location: "New York, NY",
      start_date: "2019-08",
      end_date: "2021-12",
      is_current: false,
      bullet_points: [
        "Developed event-driven data streaming pipelines with Apache Kafka and Python, handling real-time telemetry.",
        "Led migration from monolith to microservices architecture, improving system uptime to 99.98%."
      ],
      technologies_used: ["Python", "Kafka", "PostgreSQL", "TypeScript", "React"]
    }
  ],
  skills: [
    { name: "Python", category: "Languages", proficiency_level: "Expert", years_of_experience: 6.0 },
    { name: "TypeScript", category: "Languages", proficiency_level: "Advanced", years_of_experience: 4.0 },
    { name: "SQL", category: "Languages", proficiency_level: "Expert", years_of_experience: 6.0 },
    { name: "FastAPI", category: "Frameworks", proficiency_level: "Expert", years_of_experience: 4.0 },
    { name: "Next.js", category: "Frameworks", proficiency_level: "Advanced", years_of_experience: 3.0 },
    { name: "React", category: "Frameworks", proficiency_level: "Advanced", years_of_experience: 4.0 },
    { name: "PostgreSQL", category: "Databases", proficiency_level: "Expert", years_of_experience: 5.0 },
    { name: "pgvector", category: "Databases", proficiency_level: "Advanced", years_of_experience: 2.0 },
    { name: "Docker", category: "Cloud & DevOps", proficiency_level: "Expert", years_of_experience: 5.0 },
    { name: "Kubernetes", category: "Cloud & DevOps", proficiency_level: "Intermediate", years_of_experience: 3.0 },
    { name: "LangGraph", category: "AI & ML", proficiency_level: "Advanced", years_of_experience: 1.5 }
  ],
  projects: [
    {
      title: "CareerPilot AI Engine",
      description: "Production career copilot for semantic job matching and zero-hallucination LaTeX resume tailoring.",
      technologies: ["FastAPI", "Next.js", "PostgreSQL", "pgvector", "LangGraph"],
      repo_url: "https://github.com/alexmercer/careerpilot",
      live_url: "https://careerpilot.ai",
      bullet_points: [
        "Engineered dual-tier hybrid matching combining exact skill overlap with HNSW dense vector cosine distance.",
        "Created AST fact verification gate ensuring 100% truthfulness in tailored LaTeX outputs."
      ]
    },
    {
      title: "Distributed Task Fabric",
      description: "High-throughput asynchronous distributed task scheduling daemon built with asyncio and Redis streams.",
      technologies: ["Python", "Redis", "asyncio"],
      repo_url: "https://github.com/alexmercer/task-fabric",
      bullet_points: [
        "Achieved 25k tasks/sec throughput with sub-5ms dispatch latency."
      ]
    }
  ],
  certifications: [
    {
      name: "AWS Certified Solutions Architect – Professional",
      issuing_organization: "Amazon Web Services",
      issue_date: "2023-04",
      credential_id: "AWS-PSA-994821"
    }
  ],
  achievements: [
    {
      title: "1st Place – Global Distributed Systems Hackathon",
      issuer: "Cloud Native Computing Foundation",
      date: "2023-10",
      description: "Awarded top honor for developing an ultra-low latency mesh replication protocol."
    }
  ],
  career_preference: {
    preferred_roles: ["Staff Software Engineer", "Principal AI Engineer", "Lead Backend Architect"],
    preferred_locations: ["San Francisco, CA", "Seattle, WA", "Remote"],
    work_mode: "Remote",
    preferred_employment_type: "Full-time",
    target_salary_min: 190000,
    target_salary_max: 260000,
    currency: "USD"
  }
};

export default function StructuredImportModal({
  isOpen,
  onClose,
  onSuccess,
}: StructuredImportModalProps) {
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleLoadSample = () => {
    setJsonText(JSON.stringify(SAMPLE_STRUCTURED_RESUME, null, 2));
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!jsonText.trim()) {
      setError("Please paste structured JSON or load the sample profile.");
      return;
    }

    try {
      const parsed = JSON.parse(jsonText);
      setIsLoading(true);
      const res = await importStructuredResumeApi(parsed);
      setIsLoading(false);

      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        onSuccess(res.data);
        onClose();
      }
    } catch (err: any) {
      setIsLoading(false);
      setError("Invalid JSON format: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200/80 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-800">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Import Structured Resume JSON</h3>
              <p className="text-xs text-slate-500">
                Populate complete profile: experiences, skills, education, projects & preferences.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Resume JSON Payload</span>
            <button
              type="button"
              onClick={handleLoadSample}
              className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-slate-600" />
              <span>Load Full Sample Resume</span>
            </button>
          </div>

          <textarea
            rows={12}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder="Paste your JSON structured resume here..."
            className="w-full bg-slate-50 font-mono text-xs text-slate-800 border border-slate-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 resize-none leading-relaxed"
          />

          {error && (
            <div className="flex items-start space-x-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <Button type="button" onClick={onClose} variant="ghost" size="sm">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            variant="primary"
            size="sm"
          >
            {isLoading ? (
              <span>Importing Profile...</span>
            ) : (
              <>
                <UploadCloud className="w-4 h-4 mr-1.5" />
                <span>Import Profile</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
