"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Kanban,
  Building2,
  Briefcase,
  Calendar,
  Clock,
  Sparkles,
  FileCode,
  Users,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit2,
  Trash2,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Tag,
  Flame,
  Award,
  Send,
  MoreVertical,
} from "lucide-react";
import {
  fetchKanbanBoardApi,
  createApplicationApi,
  updateApplicationApi,
  deleteApplicationApi,
  fetchJobsApi,
  Application,
  Job,
  KanbanBoardResult,
} from "@/lib/api";

const KANBAN_STAGES = [
  { id: "Saved", label: "Saved", status: "SAVED", color: "border-slate-700 bg-slate-900/60 text-slate-300" },
  { id: "Ready", label: "Ready to Apply", status: "READY_TO_APPLY", color: "border-amber-500/30 bg-amber-500/5 text-amber-300" },
  { id: "Applied", label: "Applied", status: "APPLIED", color: "border-sky-500/30 bg-sky-500/5 text-sky-300" },
  { id: "Screening", label: "Screening", status: "SCREENING", color: "border-indigo-500/30 bg-indigo-500/5 text-indigo-300" },
  { id: "Interview", label: "Interviewing", status: "INTERVIEW", color: "border-purple-500/30 bg-purple-500/5 text-purple-300" },
  { id: "Offer", label: "Offer Received", status: "OFFER", color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" },
  { id: "Rejected", label: "Archived / Rejected", status: "REJECTED", color: "border-rose-500/30 bg-rose-500/5 text-rose-300" },
];

export default function ApplicationsPage() {
  const [board, setBoard] = useState<Record<string, Application[]>>({
    Saved: [],
    Ready: [],
    Applied: [],
    Screening: [],
    Interview: [],
    Offer: [],
    Rejected: [],
  });
  const [totalApps, setTotalApps] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Drag and Drop state
  const [draggedAppId, setDraggedAppId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Edit / Details Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [editForm, setEditForm] = useState({
    status: "SAVED",
    interview_stage: "",
    referral_status: "none",
    notes: "",
    next_action: "",
    next_followup_date: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Add Application Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [addStatus, setAddStatus] = useState("SAVED");
  const [addNotes, setAddNotes] = useState("");
  const [addNextAction, setAddNextAction] = useState("");
  const [creatingApp, setCreatingApp] = useState(false);

  // Load Kanban Data
  const loadKanban = async (query = searchQuery) => {
    setLoading(true);
    setError(null);
    const res = await fetchKanbanBoardApi({ search: query.trim() || undefined });
    setLoading(false);

    if (res.data) {
      setBoard(res.data.columns);
      setTotalApps(res.data.total_applications);
    } else {
      setError(res.error || "Failed to load Kanban board");
    }
  };

  useEffect(() => {
    loadKanban();
  }, []);

  // Stage transition via drag-and-drop or dropdown
  const handleMoveStage = async (appId: string, targetStage: string) => {
    // Find target status from column
    const stageObj = KANBAN_STAGES.find((s) => s.id === targetStage);
    const targetStatus = stageObj ? stageObj.status : targetStage;

    // Optimistically update local UI
    let foundApp: Application | null = null;
    const newBoard = { ...board };

    for (const col of Object.keys(newBoard)) {
      const idx = newBoard[col].findIndex((a) => a.id === appId);
      if (idx !== -1) {
        foundApp = { ...newBoard[col][idx], status: targetStatus };
        newBoard[col].splice(idx, 1);
        break;
      }
    }

    if (foundApp) {
      newBoard[targetStage] = [foundApp, ...(newBoard[targetStage] || [])];
      setBoard(newBoard);
    }

    // Call API
    const res = await updateApplicationApi(appId, { status: targetStatus });
    if (!res.data) {
      setError(res.error || "Failed to move stage");
      // Revert
      loadKanban();
    } else {
      setSuccessMsg(`Moved to ${targetStage}`);
      setTimeout(() => setSuccessMsg(null), 2500);
    }
  };

  // Open Edit Modal
  const openEdit = (app: Application) => {
    setEditingApp(app);
    setEditForm({
      status: app.status || "SAVED",
      interview_stage: app.interview_stage || "",
      referral_status: app.referral_status || "none",
      notes: app.notes || "",
      next_action: app.next_action || "",
      next_followup_date: app.next_followup_date
        ? new Date(app.next_followup_date).toISOString().slice(0, 16)
        : "",
    });
    setIsEditModalOpen(true);
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApp) return;

    setSavingEdit(true);
    const res = await updateApplicationApi(editingApp.id, {
      status: editForm.status,
      interview_stage: editForm.interview_stage.trim() || undefined,
      referral_status: editForm.referral_status,
      notes: editForm.notes.trim() || undefined,
      next_action: editForm.next_action.trim() || undefined,
      next_followup_date: editForm.next_followup_date
        ? new Date(editForm.next_followup_date).toISOString()
        : undefined,
    });
    setSavingEdit(false);

    if (res.data) {
      setIsEditModalOpen(false);
      setSuccessMsg("Application updated.");
      setTimeout(() => setSuccessMsg(null), 2500);
      loadKanban();
    } else {
      setError(res.error || "Failed to save application changes");
    }
  };

  // Delete Application
  const handleDelete = async (appId: string, company: string, role: string) => {
    if (!confirm(`Are you sure you want to remove ${role} at ${company} from CRM?`)) return;

    const res = await deleteApplicationApi(appId);
    if (res.data?.success) {
      setSuccessMsg("Application removed.");
      setTimeout(() => setSuccessMsg(null), 2500);
      loadKanban();
    } else {
      setError(res.error || "Failed to delete application");
    }
  };

  // Open Add Application Modal
  const openAddModal = async () => {
    setIsAddModalOpen(true);
    const res = await fetchJobsApi();
    if (res.data) {
      setJobs(res.data);
      if (res.data.length > 0 && !selectedJobId) {
        setSelectedJobId(res.data[0].id);
      }
    }
  };

  // Submit Add Application
  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId) {
      setError("Please select a target job.");
      return;
    }

    setCreatingApp(true);
    const res = await createApplicationApi({
      job_id: selectedJobId,
      status: addStatus,
      notes: addNotes.trim() || undefined,
      next_action: addNextAction.trim() || undefined,
    });
    setCreatingApp(false);

    if (res.data) {
      setIsAddModalOpen(false);
      setSuccessMsg(`Added ${res.data.job?.role || "application"} to ${addStatus} stage!`);
      setTimeout(() => setSuccessMsg(null), 3000);
      loadKanban();
    } else {
      setError(res.error || "Failed to track application");
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, appId: string) => {
    e.dataTransfer.setData("text/plain", appId);
    setDraggedAppId(appId);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverColumn(colId);
  };

  const handleDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    const appId = e.dataTransfer.getData("text/plain");
    setDragOverColumn(null);
    setDraggedAppId(null);
    if (appId) {
      handleMoveStage(appId, targetColId);
    }
  };

  const getMatchScoreBadge = (score?: number | null) => {
    if (!score) return null;
    let color = "text-rose-400 bg-rose-500/10 border-rose-500/20";
    if (score >= 80) color = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    else if (score >= 60) color = "text-amber-400 bg-amber-500/10 border-amber-500/20";

    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${color}`}>
        {score}% Match
      </span>
    );
  };

  const getReferralBadge = (referralStatus?: string | null) => {
    if (!referralStatus || referralStatus === "none") return null;
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 flex items-center space-x-1">
        <Users className="w-2.5 h-2.5 text-indigo-400" />
        <span className="capitalize">{referralStatus}</span>
      </span>
    );
  };

  const formatFollowup = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const isPast = date < now;

    return (
      <span
        className={`flex items-center space-x-1 text-[11px] font-medium ${
          isPast ? "text-rose-400 font-semibold" : "text-slate-400"
        }`}
        title={`Follow-up deadline: ${date.toLocaleString()}`}
      >
        <Calendar className="w-3 h-3 text-slate-500" />
        <span>{date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
      </span>
    );
  };

  return (
    <div className="max-w-[1700px] mx-auto px-4 py-8 space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">
              Phase 11
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-xs text-slate-400">Application CRM & Kanban</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center space-x-3">
            <span>Application Kanban Board</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 font-mono">
              {totalApps} Total
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            Track applications, tailored resumes, referral connections, follow-ups, and interview rounds.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Bar */}
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search applications..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                loadKanban(e.target.value);
              }}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <button
            type="button"
            onClick={() => loadKanban()}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all shadow-sm disabled:opacity-50"
            title="Refresh Board"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-brand-500/25 flex items-center space-x-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Track Application</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Kanban Board Horizontal Columns Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 pb-6 overflow-x-auto min-h-[680px]">
        {KANBAN_STAGES.map((stage) => {
          const appsInColumn = board[stage.id] || [];
          const isDragOver = dragOverColumn === stage.id;

          return (
            <div
              key={stage.id}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDrop={(e) => handleDrop(e, stage.id)}
              className={`rounded-3xl border flex flex-col transition-all min-h-[580px] p-3.5 space-y-3.5 ${stage.color} ${
                isDragOver ? "ring-2 ring-brand-400 bg-slate-900/90" : "bg-slate-950/40"
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-1 pt-1 border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-xs text-white">{stage.label}</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-mono font-bold text-slate-300">
                    {appsInColumn.length}
                  </span>
                </div>
              </div>

              {/* Cards List */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[640px] pr-1">
                {appsInColumn.length === 0 ? (
                  <div className="h-32 border-2 border-dashed border-slate-800/70 rounded-2xl flex flex-col items-center justify-center p-3 text-center text-slate-600 text-xs">
                    <span>Drop application here</span>
                  </div>
                ) : (
                  appsInColumn.map((app) => {
                    const job = app.job;
                    if (!job) return null;

                    return (
                      <div
                        key={app.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, app.id)}
                        className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-brand-500/40 transition-all shadow-md shadow-black/30 space-y-3 cursor-grab active:cursor-grabbing group hover:shadow-lg"
                      >
                        {/* Company & Role */}
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-[140px]">
                              {job.company}
                            </span>
                            {getMatchScoreBadge(app.match_score)}
                          </div>
                          <Link
                            href={`/jobs/${job.id}`}
                            className="font-bold text-xs text-white hover:text-brand-300 transition-colors line-clamp-2"
                          >
                            {job.role}
                          </Link>
                        </div>

                        {/* Badges: Resume Version & Referral Status */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {app.resume_version && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center space-x-1">
                              <FileCode className="w-2.5 h-2.5" />
                              <span>Tailored v{app.resume_version.version_number}</span>
                            </span>
                          )}
                          {getReferralBadge(app.referral_status)}
                          {app.interview_stage && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              {app.interview_stage}
                            </span>
                          )}
                        </div>

                        {/* Next Action & Followup Deadline */}
                        {app.next_action && (
                          <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-300 space-y-0.5">
                            <div className="text-[9px] uppercase font-bold text-brand-400">
                              Next Action
                            </div>
                            <p className="line-clamp-2">{app.next_action}</p>
                          </div>
                        )}

                        {/* Footer: Date & Quick Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                          {formatFollowup(app.next_followup_date) || (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(app.updated_at).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}

                          <div className="flex items-center space-x-1">
                            {/* Quick Stage Shift Dropdown */}
                            <select
                              value={stage.id}
                              onChange={(e) => handleMoveStage(app.id, e.target.value)}
                              className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300 focus:outline-none"
                              title="Move stage"
                            >
                              {KANBAN_STAGES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => openEdit(app)}
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                              title="Edit application"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(app.id, job.company, job.role)}
                              className="p-1 rounded hover:bg-rose-900/30 text-slate-500 hover:text-rose-400 transition-colors"
                              title="Delete from CRM"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Application Modal */}
      {isEditModalOpen && editingApp && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white">Edit Application Tracking</h2>
                <p className="text-xs text-slate-400">
                  {editingApp.job?.role} at {editingApp.job?.company}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Application Stage *
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="SAVED">Saved</option>
                    <option value="READY_TO_APPLY">Ready to Apply</option>
                    <option value="APPLIED">Applied</option>
                    <option value="SCREENING">Screening</option>
                    <option value="INTERVIEW">Interview</option>
                    <option value="TECHNICAL">Technical Round</option>
                    <option value="FINAL_ROUND">Final Round</option>
                    <option value="OFFER">Offer</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="WITHDRAWN">Withdrawn</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Referral Status
                  </label>
                  <select
                    value={editForm.referral_status}
                    onChange={(e) => setEditForm({ ...editForm, referral_status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="none">None</option>
                    <option value="requested">Referral Requested</option>
                    <option value="referred">Referred by Contact</option>
                    <option value="contact_reached">Contact Reached</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Interview Sub-Stage (if applicable)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hiring Manager Screen, System Design, Behavioral"
                  value={editForm.interview_stage}
                  onChange={(e) => setEditForm({ ...editForm, interview_stage: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Next Action
                </label>
                <input
                  type="text"
                  placeholder="e.g. Prepare 1-pager on distributed systems..."
                  value={editForm.next_action}
                  onChange={(e) => setEditForm({ ...editForm, next_action: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Next Follow-up Reminder
                </label>
                <input
                  type="datetime-local"
                  value={editForm.next_followup_date}
                  onChange={(e) => setEditForm({ ...editForm, next_followup_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Interview questions, recruiter feedback, salary notes..."
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white shadow-md shadow-brand-500/20 disabled:opacity-50"
                >
                  {savingEdit ? "Saving..." : "Save Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Application Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Track New Opportunity in CRM</h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateApplication} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Job *
                </label>
                {jobs.length === 0 ? (
                  <p className="text-xs text-amber-400">
                    No jobs analyzed yet. Please import or analyze a job first.
                  </p>
                ) : (
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.role} at {j.company}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Initial Stage *
                </label>
                <select
                  value={addStatus}
                  onChange={(e) => setAddStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="SAVED">Saved</option>
                  <option value="READY_TO_APPLY">Ready to Apply</option>
                  <option value="APPLIED">Applied</option>
                  <option value="SCREENING">Screening</option>
                  <option value="INTERVIEW">Interview</option>
                  <option value="OFFER">Offer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Next Action (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Request referral or tailor resume..."
                  value={addNextAction}
                  onChange={(e) => setAddNextAction(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Direct referral pathway identified; tailoring resume..."
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingApp || jobs.length === 0}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white shadow-md shadow-brand-500/20 disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{creatingApp ? "Tracking..." : "Add Application"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
