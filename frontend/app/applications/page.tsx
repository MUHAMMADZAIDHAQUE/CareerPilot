"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Kanban,
  List,
  Clock,
  Sparkles,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit2,
  Trash2,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  GripVertical,
  Calendar,
  Building2,
  Activity,
  FileText,
  Users2,
  ArrowUpRight,
  Layers,
} from "lucide-react";
import {
  fetchKanbanBoardApi,
  createApplicationApi,
  updateApplicationApi,
  deleteApplicationApi,
  fetchJobsApi,
  Application,
  Job,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Column } from "@/components/ui/Table";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/States";

const KANBAN_COLUMNS = [
  { id: "Saved", label: "Saved / Discovered", defaultStatus: "SAVED" },
  { id: "Ready", label: "Ready to Apply", defaultStatus: "APPLICATION_READY" },
  { id: "Applied", label: "Applied", defaultStatus: "APPLIED" },
  { id: "Screening", label: "Screening & Assessment", defaultStatus: "ASSESSMENT" },
  { id: "Interview", label: "Interview", defaultStatus: "INTERVIEW" },
  { id: "Offer", label: "Offer", defaultStatus: "OFFER" },
  { id: "Rejected", label: "Rejected / Withdrawn", defaultStatus: "REJECTED" },
];

const COLUMN_DEFAULT_STATUS: Record<string, string> = {
  Saved: "SAVED",
  Ready: "APPLICATION_READY",
  Applied: "APPLIED",
  Screening: "ASSESSMENT",
  Interview: "INTERVIEW",
  Offer: "OFFER",
  Rejected: "REJECTED",
};

export default function ApplicationsPage() {
  const [viewMode, setViewMode] = useState<"kanban" | "list" | "timeline">("kanban");
  const [boardData, setBoardData] = useState<Record<string, Application[]>>({
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Drag and drop state
  const [draggedAppId, setDraggedAppId] = useState<string | null>(null);
  const [dragSourceCol, setDragSourceCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

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

  // Load Kanban & Applications
  const loadData = async (query = searchQuery) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchKanbanBoardApi({ search: query.trim() || undefined });
      if (res.data) {
        const grouped: Record<string, Application[]> = {
          Saved: [],
          Ready: [],
          Applied: [],
          Screening: [],
          Interview: [],
          Offer: [],
          Rejected: [],
        };

        let count = 0;
        if (res.data.columns) {
          Object.entries(res.data.columns).forEach(([colId, apps]) => {
            if (grouped[colId] !== undefined) {
              grouped[colId] = apps;
              count += apps.length;
            }
          });
        }

        setBoardData(grouped);
        setTotalApps(res.data.total_applications ?? count);
      } else {
        setError(res.error || "Failed to load application pipeline");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load application pipeline");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenAddModal = async () => {
    setIsAddModalOpen(true);
    if (jobs.length === 0) {
      const res = await fetchJobsApi();
      if (res.data) {
        setJobs(res.data);
        if (res.data.length > 0) setSelectedJobId(res.data[0].id);
      }
    }
  };

  const handleEditClick = (app: Application) => {
    setEditingApp(app);
    setEditForm({
      status: app.status,
      interview_stage: app.interview_stage || "",
      referral_status: app.referral_status || "none",
      notes: app.notes || "",
      next_action: app.next_action || "",
      next_followup_date: app.next_followup_date ? app.next_followup_date.split("T")[0] : "",
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApp) return;

    setSavingEdit(true);
    const res = await updateApplicationApi(editingApp.id, {
      status: editForm.status as any,
      interview_stage: editForm.interview_stage || undefined,
      referral_status: editForm.referral_status || undefined,
      notes: editForm.notes || undefined,
      next_action: editForm.next_action || undefined,
      next_followup_date: editForm.next_followup_date ? new Date(editForm.next_followup_date).toISOString() : undefined,
    });
    setSavingEdit(false);

    if (res.data) {
      setIsEditModalOpen(false);
      loadData();
    } else {
      alert(res.error || "Failed to save application changes");
    }
  };

  const handleDeleteApp = async (appId: string) => {
    if (!confirm("Are you sure you want to remove this application?")) return;
    const res = await deleteApplicationApi(appId);
    if (res.data) {
      setIsEditModalOpen(false);
      loadData();
    }
  };

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId) return;

    setCreatingApp(true);
    const res = await createApplicationApi({
      job_id: selectedJobId,
      status: addStatus as any,
      notes: addNotes || undefined,
      next_action: addNextAction || undefined,
    });
    setCreatingApp(false);

    if (res.data) {
      setIsAddModalOpen(false);
      setAddNotes("");
      setAddNextAction("");
      loadData();
    } else {
      alert(res.error || "Failed to track application");
    }
  };

  // Drag and Drop Event Handlers (Persisted to Backend)
  const handleDragStart = (e: React.DragEvent, appId: string, sourceCol: string) => {
    setDraggedAppId(appId);
    setDragSourceCol(sourceCol);
    e.dataTransfer.setData("text/plain", appId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetCol: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== targetCol) {
      setDragOverCol(targetCol);
    }
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = async (e: React.DragEvent, targetCol: string) => {
    e.preventDefault();
    setDragOverCol(null);

    const appId = draggedAppId || e.dataTransfer.getData("text/plain");
    if (!appId || !dragSourceCol || dragSourceCol === targetCol) {
      setDraggedAppId(null);
      setDragSourceCol(null);
      return;
    }

    // Find the item being moved
    const sourceItems = boardData[dragSourceCol] || [];
    const itemToMove = sourceItems.find((app) => app.id === appId);
    if (!itemToMove) return;

    const newStatus = COLUMN_DEFAULT_STATUS[targetCol] || targetCol.toUpperCase();

    // Optimistically update board state
    const updatedSource = sourceItems.filter((app) => app.id !== appId);
    const updatedTarget = [{ ...itemToMove, status: newStatus as any }, ...(boardData[targetCol] || [])];

    setBoardData((prev) => ({
      ...prev,
      [dragSourceCol]: updatedSource,
      [targetCol]: updatedTarget,
    }));

    setDraggedAppId(null);
    setDragSourceCol(null);

    // Persist to Backend API
    const res = await updateApplicationApi(appId, {
      status: newStatus as any,
    });

    if (!res.data) {
      // Revert if backend error
      alert(res.error || "Failed to persist application status update");
      loadData();
    }
  };

  // Flattened applications for List & Timeline View
  const allApplicationsList = useMemo(() => {
    const list: Application[] = [];
    Object.values(boardData).forEach((col) => {
      list.push(...col);
    });
    return list.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
  }, [boardData]);

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    let variant: "success" | "blue" | "error" | "warning" | "neutral" = "neutral";
    if (status === "OFFER") variant = "success";
    else if (status.includes("INTERVIEW") || status.includes("TECHNICAL")) variant = "blue";
    else if (status === "REJECTED" || status === "WITHDRAWN") variant = "error";
    else if (status.includes("SCREENING") || status.includes("ASSESSMENT")) variant = "warning";
    else if (status === "APPLIED") variant = "blue";

    return (
      <Badge variant={variant} size="sm">
        {status.replace(/_/g, " ")}
      </Badge>
    );
  };

  // List View Columns
  const listColumns: Column<Application>[] = [
    {
      key: "role",
      header: "Role & Company",
      render: (app) => (
        <div>
          <Link
            href={`/applications/${app.id}`}
            className="font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 block"
          >
            {app.job?.role || "Software Engineer"}
          </Link>
          <span className="text-slate-500 dark:text-slate-400 text-xs">{app.job?.company || "Company"}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Stage",
      render: (app) => renderStatusBadge(app.status),
    },
    {
      key: "next_action",
      header: "Next Action",
      render: (app) => (
        <span className="text-slate-600 dark:text-slate-300 text-xs">
          {app.next_action || "—"}
        </span>
      ),
    },
    {
      key: "followup",
      header: "Follow-up",
      render: (app) => (
        <span className="text-slate-500 dark:text-slate-400 text-xs font-mono">
          {app.next_followup_date
            ? new Date(app.next_followup_date).toLocaleDateString()
            : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (app) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Link href={`/applications/${app.id}`}>
            <Button size="sm" variant="ghost" title="Open Full CRM Details">
              <ArrowUpRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </Button>
          </Link>
          <Button size="sm" variant="ghost" onClick={() => handleEditClick(app)} title="Quick Edit">
            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleDeleteApp(app.id)} title="Remove">
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 sm:space-y-10 pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold mb-2">
            <Kanban className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Application CRM Pipeline • 16 Stages & Live Timelines</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Application Pipeline
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Drag cards across recruitment stages to automatically update follow-up schedules, view assessments, and inspect sub-entity logs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle (Kanban / List / Timeline) */}
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 p-0.5 text-xs">
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors font-medium ${
                viewMode === "kanban"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-subtle"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors font-medium ${
                viewMode === "list"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-subtle"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors font-medium ${
                viewMode === "timeline"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-subtle"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>
          </div>

          <Link href="/pipeline">
            <Button
              variant="outline"
              size="sm"
              icon={<Layers className="w-3.5 h-3.5 text-indigo-500" />}
            >
              Execution Queue
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />}
          >
            Sync
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddModal}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Track Application
          </Button>
        </div>
      </div>

      {/* Search Input Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="max-w-md w-full">
          <Input
            placeholder="Search tracked applications..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              loadData(e.target.value);
            }}
            icon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          {totalApps} Total Applications Tracked
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading CRM pipeline stages..." />
      ) : error ? (
        <ErrorState title="Failed to load applications" error={error} onRetry={() => loadData()} />
      ) : viewMode === "kanban" ? (
        /* KANBAN BOARD VIEW */
        <div className="overflow-x-auto pb-6">
          <div className="flex gap-4 min-w-[1340px]">
            {KANBAN_COLUMNS.map((col) => {
              const items = boardData[col.id] || [];
              const isOver = dragOverCol === col.id;

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`flex-1 min-w-[280px] rounded-2xl border transition-all duration-150 p-3.5 flex flex-col justify-between ${
                    isOver
                      ? "border-blue-400 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/30"
                      : "border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111827]/60"
                  }`}
                >
                  {/* Column Header */}
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                          {col.label}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                          {items.length}
                        </span>
                      </div>
                    </div>

                    {/* Column Cards */}
                    <div className="space-y-2.5">
                      {items.map((app) => (
                        <div
                          key={app.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, app.id, col.id)}
                          className="group rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-3.5 shadow-card dark:shadow-none hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-dropdown transition-all cursor-grab active:cursor-grabbing space-y-2 select-none"
                        >
                          {/* Company & Drag Indicator */}
                          <div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-500 dark:text-slate-400 truncate">
                                {app.job?.company || "Company"}
                              </span>
                              <div className="flex items-center gap-1">
                                <Link
                                  href={`/applications/${app.id}`}
                                  className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-0.5"
                                  title="View full application CRM detail"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </Link>
                                <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors" />
                              </div>
                            </div>
                            <Link
                              href={`/applications/${app.id}`}
                              className="text-sm font-bold text-slate-900 dark:text-white tracking-tight line-clamp-1 mt-0.5 hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              {app.job?.role || "Software Engineer"}
                            </Link>
                          </div>

                          {/* Next Action */}
                          {app.next_action && (
                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 line-clamp-2">
                              <strong className="text-slate-900 dark:text-white font-medium">Next:</strong> {app.next_action}
                            </div>
                          )}

                          {/* Card Footer */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                            <button
                              onClick={() => handleEditClick(app)}
                              className="hover:text-slate-700 dark:hover:text-slate-300 text-[10px] underline font-medium"
                            >
                              Edit Note
                            </button>
                            {app.next_followup_date ? (
                              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-mono">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{new Date(app.next_followup_date).toLocaleDateString()}</span>
                              </span>
                            ) : (
                              <span className="font-mono text-[10px]">
                                {new Date(app.created_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}

                      {items.length === 0 && (
                        <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                          Drop cards here
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === "list" ? (
        /* DENSE LIST VIEW */
        <Table
          columns={listColumns}
          data={allApplicationsList}
          keyExtractor={(app) => app.id}
          onRowClick={(app) => handleEditClick(app)}
          emptyText="No applications tracked yet."
        />
      ) : (
        /* CHRONOLOGICAL TIMELINE VIEW */
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 text-xs text-blue-800 dark:text-blue-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Chronological Event Stream: Tracking milestones, status transitions, and pending actions across all applications.</span>
            </span>
            <span className="font-mono font-semibold">{allApplicationsList.length} Events</span>
          </div>

          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {allApplicationsList.map((app) => (
              <div key={app.id} className="relative group">
                {/* Timeline Dot */}
                <div className="absolute -left-6 sm:-left-8 top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-[#0f172a] bg-blue-600 shadow-sm transition-transform group-hover:scale-125" />

                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-card dark:shadow-none hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/applications/${app.id}`}
                          className="text-base font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5"
                        >
                          <span>{app.job?.role || "Software Engineer"}</span>
                          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                        </Link>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {app.job?.company || "Company"} {app.job?.location ? `• ${app.job.location}` : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {renderStatusBadge(app.status)}
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                        {new Date(app.updated_at || app.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {app.next_action && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                      <strong className="text-slate-900 dark:text-white">Next Step: </strong>
                      {app.next_action}
                    </div>
                  )}

                  {app.notes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {app.notes}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <span className="text-slate-400">
                      {app.next_followup_date ? (
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          Follow-up: {new Date(app.next_followup_date).toLocaleDateString()}
                        </span>
                      ) : (
                        "No follow-up scheduled"
                      )}
                    </span>

                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handleEditClick(app)}>
                        Quick Edit
                      </Button>
                      <Link href={`/applications/${app.id}`}>
                        <Button size="sm" variant="outline">
                          Full CRM Record
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {allApplicationsList.length === 0 && (
              <EmptyState
                title="No applications tracked yet"
                description="Start tracking applications from the Job Discovery Portal or click 'Track Application'."
              />
            )}
          </div>
        </div>
      )}

      {/* Edit / Details Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={editingApp?.job?.role || "Application Details"}
        description={`${editingApp?.job?.company || "Company"} • Tracked since ${editingApp?.created_at ? new Date(editingApp.created_at).toLocaleDateString() : ""}`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Application Stage"
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
            >
              {KANBAN_COLUMNS.map((col) => (
                <option key={col.id} value={col.defaultStatus}>
                  {col.label} ({col.defaultStatus})
                </option>
              ))}
            </Select>

            <Input
              label="Interview Stage (Optional)"
              placeholder="e.g. Technical Round 1"
              value={editForm.interview_stage}
              onChange={(e) => setEditForm({ ...editForm, interview_stage: e.target.value })}
            />
          </div>

          <Input
            label="Next Action Step"
            placeholder="e.g. Send thank you email to hiring manager"
            value={editForm.next_action}
            onChange={(e) => setEditForm({ ...editForm, next_action: e.target.value })}
          />

          <Input
            label="Follow-up Target Date"
            type="date"
            value={editForm.next_followup_date}
            onChange={(e) => setEditForm({ ...editForm, next_followup_date: e.target.value })}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Private Notes & Feedback
            </label>
            <textarea
              rows={3}
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              placeholder="Add personal interview feedback or questions asked..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => editingApp && handleDeleteApp(editingApp.id)}
            >
              Remove
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={savingEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Track New Application Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Track New Application"
        description="Add a target position to your recruitment CRM"
      >
        <form onSubmit={handleCreateApp} className="space-y-4">
          <Select
            label="Select Discovered Job"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.role} at {j.company} ({j.location || "Remote"})
              </option>
            ))}
          </Select>

          <Select
            label="Initial Stage"
            value={addStatus}
            onChange={(e) => setAddStatus(e.target.value)}
          >
            {KANBAN_COLUMNS.map((col) => (
              <option key={col.id} value={col.defaultStatus}>
                {col.label}
              </option>
            ))}
          </Select>

          <Input
            label="Next Action (Optional)"
            placeholder="e.g. Tailor resume for position"
            value={addNextAction}
            onChange={(e) => setAddNextAction(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Initial Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              placeholder="e.g. Sourced via employee referral"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={creatingApp}>
              Add to CRM
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
