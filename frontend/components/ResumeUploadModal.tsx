"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  FileCode,
  Briefcase,
  GraduationCap,
  Award,
  ArrowRight,
} from "lucide-react";
import { uploadResumeFile, confirmResumeImport, ResumeUploadResult, Candidate } from "@/lib/api";

interface ResumeUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (candidate: Candidate) => void;
}

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

  if (!isOpen) return null;

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

  const handleConfirm = async () => {
    if (!uploadResult) return;

    setIsConfirming(true);
    setError(null);

    const res = await confirmResumeImport(
      uploadResult.document_id,
      uploadResult.structured_candidate_data
    );
    setIsConfirming(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      onSuccess(res.data);
      onClose();
    }
  };

  const resetModal = () => {
    setFile(null);
    setUploadResult(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface-50 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">
                {uploadResult ? "Review & Confirm Extracted Resume" : "Upload Resume"}
              </h3>
              <p className="text-xs text-slate-400">
                {uploadResult
                  ? "Verify extracted facts before applying changes to your permanent profile."
                  : "Supports PDF (.pdf), LaTeX (.tex), and Plain Text (.txt, .md)."}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetModal();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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
                    ? "border-brand-400 bg-brand-500/10"
                    : "border-slate-700 hover:border-slate-600 bg-slate-900/40"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.tex,.txt,.md"
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-slate-800 text-brand-400 mx-auto flex items-center justify-center mb-4 shadow-lg shadow-brand-500/10">
                  <FileText className="w-7 h-7" />
                </div>

                <h4 className="text-base font-bold text-white mb-1">
                  {file ? file.name : "Drag & drop your resume file here"}
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB • Click to change file`
                    : "Supports PDF, LaTeX (.tex master), and Markdown/Plain text up to 10MB."}
                </p>
              </div>

              {/* Supported Formats Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-rose-400 flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-200">PDF Resumes</p>
                    <p className="text-slate-400">Extracted with PyPDF</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center space-x-3">
                  <FileCode className="w-5 h-5 text-accent-cyan flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-200">LaTeX (.tex)</p>
                    <p className="text-slate-400">Pristine master preserved</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center space-x-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-200">Zero Hallucination</p>
                    <p className="text-slate-400">Exact fact extraction</p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            /* Review & Human Confirmation Step */
            <div className="space-y-6">
              {/* Extraction Banner */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Successfully parsed <strong>{uploadResult.filename}</strong> ({uploadResult.file_type.toUpperCase()})
                  </span>
                </div>
                {uploadResult.is_latex && (
                  <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-mono text-[10px]">
                    Master LaTeX Cached
                  </span>
                )}
              </div>

              {/* Side-by-side Review */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Candidate Summary & Skills */}
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <h4 className="font-bold text-xs text-white uppercase tracking-wider text-brand-400">
                      Personal Information
                    </h4>
                    <div className="text-xs space-y-1">
                      <p className="text-base font-bold text-white">
                        {uploadResult.structured_candidate_data.full_name}
                      </p>
                      <p className="text-slate-300">
                        {uploadResult.structured_candidate_data.email}
                      </p>
                      {uploadResult.structured_candidate_data.location && (
                        <p className="text-slate-400">
                          {uploadResult.structured_candidate_data.location}
                        </p>
                      )}
                      {uploadResult.structured_candidate_data.headline && (
                        <p className="text-slate-400 italic">
                          &quot;{uploadResult.structured_candidate_data.headline}&quot;
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Extracted Skills */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <h4 className="font-bold text-xs text-white uppercase tracking-wider text-emerald-400 flex items-center justify-between">
                      <span>Extracted Skills ({uploadResult.structured_candidate_data.skills.length})</span>
                    </h4>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                      {uploadResult.structured_candidate_data.skills.map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 text-brand-300 border border-slate-800"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Work Experience & Education Preview */}
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <h4 className="font-bold text-xs text-white uppercase tracking-wider text-accent-cyan flex items-center justify-between">
                      <span>Work History ({uploadResult.structured_candidate_data.experience.length})</span>
                    </h4>
                    <div className="space-y-3 max-h-40 overflow-y-auto">
                      {uploadResult.structured_candidate_data.experience.map((exp, idx) => (
                        <div key={idx} className="text-xs border-b border-slate-900 pb-2 last:border-b-0">
                          <p className="font-semibold text-white">{exp.role}</p>
                          <p className="text-brand-400">{exp.company} • {exp.start_date}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <h4 className="font-bold text-xs text-white uppercase tracking-wider text-amber-400">
                      Education ({uploadResult.structured_candidate_data.education.length})
                    </h4>
                    <div className="space-y-2">
                      {uploadResult.structured_candidate_data.education.map((edu, idx) => (
                        <div key={idx} className="text-xs">
                          <p className="font-semibold text-white">{edu.institution}</p>
                          <p className="text-slate-400">{edu.degree}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/60">
          {!uploadResult ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadAndExtract}
                disabled={!file || isUploading}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/20 disabled:opacity-50 transition-all"
              >
                {isUploading ? (
                  <span>Extracting Content...</span>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload & Extract</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={resetModal}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
              >
                Upload Different File
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isConfirming}
                className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all"
              >
                {isConfirming ? (
                  <span>Applying to Profile...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Update Profile</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
