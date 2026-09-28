"use client";

import React, { useEffect, useState } from "react";
import { fetchCandidateProfile, addProjectApi, Candidate, Project } from "@/lib/api";
import ProfileNav from "@/components/ProfileNav";
import { FolderGit2, Plus, Github, Globe, Sparkles, AlertCircle, Layers, Calendar } from "lucide-react";

export default function ProjectsPage() {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [technologies, setTechnologies] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [bulletPoint, setBulletPoint] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadProjects = async () => {
    const res = await fetchCandidateProfile();
    if (res.data) setCandidate(res.data);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError("Project title is required.");
      return;
    }

    const techArray = technologies
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const bulletArray = bulletPoint
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);

    setIsSubmitting(true);
    const res = await addProjectApi({
      title: title.trim(),
      description: description.trim() || undefined,
      technologies: techArray,
      repo_url: repoUrl.trim() || undefined,
      live_url: liveUrl.trim() || undefined,
      bullet_points: bulletArray,
    });
    setIsSubmitting(false);

    if (res.error) {
      setFormError(res.error);
    } else {
      setTitle("");
      setDescription("");
      setTechnologies("");
      setRepoUrl("");
      setLiveUrl("");
      setBulletPoint("");
      setIsAdding(false);
      await loadProjects();
    }
  };

  const projects = candidate?.projects || [];

  return (
    <div className="space-y-8">
      <ProfileNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center space-x-3">
            <FolderGit2 className="w-7 h-7 text-accent-cyan" />
            <span>Technical Projects & Portfolio</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Verified software projects and architectural implementations for semantic matching and evidence citation.
          </p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{isAdding ? "Cancel" : "Add Project"}</span>
        </button>
      </div>

      {/* Add Project Form Drawer */}
      {isAdding && (
        <form
          onSubmit={handleAddProject}
          className="glass-card rounded-2xl p-6 space-y-4 border border-accent-cyan/30 animate-in fade-in slide-in-from-top-4 duration-200"
        >
          <h3 className="font-bold text-base text-white flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-accent-cyan" />
            <span>Add New Technical Project</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Project Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Distributed Vector Search Engine"
                className="w-full bg-slate-950 text-xs text-white border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-accent-cyan"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Technologies (comma-separated)
              </label>
              <input
                type="text"
                value={technologies}
                onChange={(e) => setTechnologies(e.target.value)}
                placeholder="e.g., Python, FastAPI, pgvector, Docker"
                className="w-full bg-slate-950 text-xs text-white border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-accent-cyan"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                GitHub / Repository URL
              </label>
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/project"
                className="w-full bg-slate-950 text-xs text-white border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-accent-cyan"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Live Deployment / Demo URL
              </label>
              <input
                type="url"
                value={liveUrl}
                onChange={(e) => setLiveUrl(e.target.value)}
                placeholder="https://project.example.com"
                className="w-full bg-slate-950 text-xs text-white border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-accent-cyan"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Short Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="High-throughput distributed consensus engine with sub-10ms replication"
              className="w-full bg-slate-950 text-xs text-white border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-accent-cyan"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Key Achievements / Highlights (one per line)
            </label>
            <textarea
              rows={3}
              value={bulletPoint}
              onChange={(e) => setBulletPoint(e.target.value)}
              placeholder="Architected custom HNSW index wrapper reducing memory footprint by 35%&#10;Benchmarked against 10M vector dataset with 99.4% recall"
              className="w-full bg-slate-950 text-xs text-white border border-slate-800 rounded-lg p-3 focus:outline-none focus:border-accent-cyan resize-none font-mono"
            />
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
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-accent-cyan/90 hover:bg-accent-cyan text-slate-950 text-xs font-bold shadow-lg shadow-accent-cyan/20 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Project"}
            </button>
          </div>
        </form>
      )}

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center space-y-3">
          <FolderGit2 className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Projects Logged</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Add your key projects to provide evidence for matching algorithms and resume tailoring.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((proj, idx) => (
            <div
              key={proj.id || idx}
              className="glass-card rounded-2xl p-6 flex flex-col justify-between space-y-4 glass-card-hover"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg text-white">{proj.title}</h3>
                    {proj.description && (
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {proj.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {proj.repo_url && (
                      <a
                        href={proj.repo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                        title="Repository"
                      >
                        <Github className="w-4 h-4" />
                      </a>
                    )}
                    {proj.live_url && (
                      <a
                        href={proj.live_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                        title="Live Demo"
                      >
                        <Globe className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Highlights */}
                {proj.bullet_points && proj.bullet_points.length > 0 && (
                  <ul className="space-y-1 text-xs text-slate-400 list-disc list-outside ml-4">
                    {proj.bullet_points.map((b, bIdx) => (
                      <li key={bIdx}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Technologies */}
              {proj.technologies && proj.technologies.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-800">
                  {proj.technologies.map((tech, tIdx) => (
                    <span
                      key={tIdx}
                      className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 text-accent-cyan border border-accent-cyan/20"
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
  );
}
