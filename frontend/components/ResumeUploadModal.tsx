"use client";

import React, { useState, useRef } from "react";
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
} from "lucide-react";
import { uploadResumeFile, confirmResumeImport, ResumeUploadResult, Candidate } from "@/lib/api";
import { Button } from "./ui/Button";

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
      resetModal();
      onClose();
    }
  };

  const resetModal = () => {
    setFile(null);
    setUploadResult(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-elevated overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-800">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-slate-900 tracking-tight">
                {uploadResult ? "Review Extracted Facts" : "Upload Master Resume"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {uploadResult
                  ? "Verify extracted skills and experiences before updating your profile."
                  : "Supports PDF (.pdf), LaTeX (.tex), and Markdown/Text (.txt, .md)."}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetModal();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
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
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.tex,.txt,.md"
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 text-slate-700 mx-auto flex items-center justify-center mb-3 shadow-subtle">
                  <FileText className="w-6 h-6" />
                </div>

                <h4 className="text-sm font-semibold text-slate-900 mb-1">
                  {file ? file.name : "Drag & drop your resume file here"}
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB • Click to choose a different file`
                    : "PDF, LaTeX (.tex master), Markdown or Plain Text up to 10MB."}
                </p>
              </div>

              {/* Supported Formats Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center space-x-3">
                  <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-900">PDF Resumes</p>
                    <p className="text-slate-500">Parsed via PyPDF</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center space-x-3">
                  <FileCode className="w-4 h-4 text-slate-600 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-900">LaTeX (.tex)</p>
                    <p className="text-slate-500">Master template kept</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center space-x-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-900">Non-Fabricating</p>
                    <p className="text-slate-500">Zero hallucinations</p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            /* Review & Human Confirmation Step */
            <div className="space-y-5">
              {/* Extraction Banner */}
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Successfully parsed <strong>{uploadResult.filename}</strong> ({uploadResult.file_type.toUpperCase()})
                  </span>
                </div>
                {uploadResult.is_latex && (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-semibold">
                    Master LaTeX Cached
                  </span>
                )}
              </div>

              {/* Side-by-side Review */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: Candidate Summary & Skills */}
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-wider">
                      Personal Information
                    </h4>
                    <div className="text-xs space-y-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {uploadResult.structured_candidate_data.full_name}
                      </p>
                      <p className="text-slate-600">
                        {uploadResult.structured_candidate_data.email}
                      </p>
                      {uploadResult.structured_candidate_data.location && (
                        <p className="text-slate-500">
                          {uploadResult.structured_candidate_data.location}
                        </p>
                      )}
                      {uploadResult.structured_candidate_data.headline && (
                        <p className="text-slate-500 italic">
                          &quot;{uploadResult.structured_candidate_data.headline}&quot;
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Extracted Skills */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Extracted Skills ({uploadResult.structured_candidate_data.skills.length})</span>
                    </h4>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                      {uploadResult.structured_candidate_data.skills.map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white text-slate-700 border border-slate-200"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Work Experience & Education Preview */}
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Work History ({uploadResult.structured_candidate_data.experience.length})</span>
                    </h4>
                    <div className="space-y-2.5 max-h-36 overflow-y-auto">
                      {uploadResult.structured_candidate_data.experience.map((exp, idx) => (
                        <div key={idx} className="text-xs border-b border-slate-200/60 pb-2 last:border-b-0">
                          <p className="font-semibold text-slate-900">{exp.role}</p>
                          <p className="text-slate-500">{exp.company} • {exp.start_date}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-wider">
                      Education ({uploadResult.structured_candidate_data.education.length})
                    </h4>
                    <div className="space-y-1.5">
                      {uploadResult.structured_candidate_data.education.map((edu, idx) => (
                        <div key={idx} className="text-xs">
                          <p className="font-semibold text-slate-900">{edu.institution}</p>
                          <p className="text-slate-500">{edu.degree}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          {!uploadResult ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
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
              <Button
                variant="outline"
                size="sm"
                onClick={resetModal}
              >
                Upload Different File
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirm}
                loading={isConfirming}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Confirm & Update Profile
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
