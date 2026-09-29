"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Kanban,
  List,
  Building2,
  Calendar,
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
  Check,
  X,
  Users2,
  FileCode,
  GraduationCap,
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
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Column } from "@/components/ui/Table";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/States";

const KANBAN_COLUMNS = [
  { id: "SAVED", label: "Saved" },
  { id: "READY_TO_APPLY", label: "Analyzing" },
  { id: "APPLIED", label: "Applied" },
  { id: "SCREENING", label: "Referral Requested" },
  { id: "INTERVIEW", label: "Interview" },
  { id: "OFFER", label: "Offer" },
  { id: "REJECTED", label: "Rejected" },
  { id: "WITHDRAWN", label: "Withdrawn" },
];

export default function ApplicationsPage() {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [boardData, setBoardData] = useState<Record<string, Application[]>>({});
  const [totalApps, setTotalApps] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
        // Group into our standard columns
        const grouped: Record<string, Application[]> = {
          SAVED: [],
          READY_TO_APPLY: [],
          APPLIED: [],
          SCREENING: [],
          INTERVIEW: [],
          OFFER: [],
          REJECTED: [],
          WITHDRAWN: [],
        };

        // Populate from server columns
        const serverBoard = res.data.columns || {};
        Object.keys(serverBoard).forEach((colKey) => {
          const list = serverBoard[colKey] || [];
          list.forEach((app) => {
            const st = app.status || "SAVED";
            if (grouped[st]) {
              grouped[st].push(app);
            } else if (st === "TECHNICAL" || st === "FINAL_ROUND") {
              grouped["INTERVIEW"].push(app);
            } else {
              grouped["SAVED"].push(app);
            }
          });
        });

        setBoardData(grouped);
        setTotalApps(res.data.total_applications);
      } else {
        setError(res.error || "Failed to load applications");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load applications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // Load available jobs for Add modal
    fetchJobsApi({ limit: 80 }).then((res) => {
      if (res.data) {
        setJobs(res.data);
        if (res.data.length > 0) setSelectedJobId(res.data[0].id);
      }
    });
  }, []);

  const handleStatusChange = async (appId: string, newStatus: string) => {
    const res = await updateApplicationApi(appId, { status: newStatus as any });
    if (res.data) {
      loadData();
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
      next_followup_date: app.next_followup_date ? app.next_followup_date.substring(0, 10) : "",
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

  // Flattened applications for List View
  const allApplicationsList = useMemo(() => {
    const list: Application[] = [];
    Object.values(boardData).forEach((col) => {
      list.push(...col);
    });
    return list;
  }, [boardData]);

  // List View Columns
  const listColumns: Column<Application>[] = [
    {
      key: "role",
      header: "Role & Company",
      render: (app) => (
        <div>
          <span className="font-semibold text-slate-900 block">{app.job?.role || "Software Engineer"}</span>
          <span className="text-slate-500">{app.job?.company || "Company"}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (app) => (
        <Badge
          variant={
            app.status === "OFFER"
              ? "success"
              : app.status === "INTERVIEW"
              ? "blue"
              : app.status === "REJECTED"
              ? "error"
              : "neutral"
          }
          size="sm"
        >
          {app.status}
        </Badge>
      ),
    },
    {
      key: "next_action",
      header: "Next Action",
      render: (app) => (
        <span className="text-slate-600 line-clamp-1">
          {app.next_action || "—"}
        </span>
      ),
    },
    {
      key: "next_followup_date",
      header: "Follow-up",
      render: (app) => (
        <span className="font-mono text-slate-500">
          {app.next_followup_date ? new Date(app.next_followup_date).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Tracked Date",
      render: (app) => (
        <span className="font-mono text-slate-500">
          {new Date(app.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (app) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleEditClick(app);
            }}
          >
            Edit
          </Button>
          <Link
            href={`/jobs/${app.job_id}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded text-slate-400 hover:text-slate-700"
            title="View Job"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Application Pipeline CRM
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track job opportunities through all stages, schedule follow-ups, and coordinate interviews.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="p-1 rounded-xl bg-slate-100 border border-slate-200 flex items-center">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                viewMode === "kanban"
                  ? "bg-white text-slate-900 shadow-subtle font-semibold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                viewMode === "list"
                  ? "bg-white text-slate-900 shadow-subtle font-semibold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List View</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData()}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
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

        <div className="text-xs text-slate-500 font-mono">
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
          <div className="flex gap-4 min-w-[1280px]">
            {KANBAN_COLUMNS.map((col) => {
              const items = boardData[col.id] || [];

              return (
                <div
                  key={col.id}
                  className="flex-1 min-w-[280px] rounded-2xl border border-slate-200/90 bg-slate-50/50 p-3.5 flex flex-col justify-between"
                >
                  {/* Column Header */}
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-slate-900 tracking-tight">
                          {col.label}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.2 rounded-full bg-white border border-slate-200 text-slate-600 font-medium">
                          {items.length}
                        </span>
                      </div>
                    </div>

                    {/* Column Cards */}
                    <div className="space-y-2.5">
                      {items.map((app) => (
                        <div
                          key={app.id}
                          onClick={() => handleEditClick(app)}
                          className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-card hover:border-slate-300 hover:shadow-dropdown transition-all cursor-pointer space-y-2"
                        >
                          {/* Company & Role */}
                          <div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-500 truncate">
                                {app.job?.company || "Company"}
                              </span>
                              {app.job?.location && (
                                <span className="text-[11px] text-slate-400 truncate">
                                  {app.job.location}
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-semibold text-slate-900 tracking-tight line-clamp-1 mt-0.5">
                              {app.job?.role || "Software Engineer"}
                            </h4>
                          </div>

                          {/* Next Action & Follow-up */}
                          {app.next_action && (
                            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-700 line-clamp-2">
                              <strong className="text-slate-900 font-medium">Next:</strong> {app.next_action}
                            </div>
                          )}

                          {/* Footer */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                            <span className="font-mono">
                              {new Date(app.created_at).toLocaleDateString()}
                            </span>
                            {app.next_followup_date && (
                              <span className="flex items-center gap-1 text-slate-600">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{new Date(app.next_followup_date).toLocaleDateString()}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      ))}

                      {items.length === 0 && (
                        <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                          No applications
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* DENSE LIST VIEW */
        <Table
          columns={listColumns}
          data={allApplicationsList}
          keyExtractor={(app) => app.id}
          onRowClick={(app) => handleEditClick(app)}
          emptyText="No applications tracked yet."
        />
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
                <option key={col.id} value={col.id}>
                  {col.label}
                </option>
              ))}
            </Select>

            <Input
              label="Interview Stage (Optional)"
              placeholder="e.g. System Design, Recruiter Screen"
              value={editForm.interview_stage}
              onChange={(e) => setEditForm({ ...editForm, interview_stage: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Next Actionable Step"
              placeholder="e.g. Prepare system design doc, Send thank you email"
              value={editForm.next_action}
              onChange={(e) => setEditForm({ ...editForm, next_action: e.target.value })}
            />

            <Input
              label="Next Follow-up Date"
              type="date"
              value={editForm.next_followup_date}
              onChange={(e) => setEditForm({ ...editForm, next_followup_date: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Internal Notes & Interview Takeaways
            </label>
            <textarea
              rows={3}
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              placeholder="Notes on recruiters, questions asked, salary discussion..."
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
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
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={savingEdit}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Add Application Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Track New Application"
        description="Select a discovered job opportunity to track in your CRM pipeline."
      >
        <form onSubmit={handleCreateApp} className="space-y-4">
          <Select
            label="Job Opportunity *"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            required
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.role} at {j.company} ({j.location || "Remote"})
              </option>
            ))}
          </Select>

          <Select
            label="Initial Status"
            value={addStatus}
            onChange={(e) => setAddStatus(e.target.value)}
          >
            {KANBAN_COLUMNS.map((col) => (
              <option key={col.id} value={col.id}>
                {col.label}
              </option>
            ))}
          </Select>

          <Input
            label="Next Action Step (Optional)"
            placeholder="e.g. Tailor resume and find alumni contact"
            value={addNextAction}
            onChange={(e) => setAddNextAction(e.target.value)}
          />

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Initial Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              placeholder="e.g. Applied via internal referral link..."
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={creatingApp}
              disabled={!selectedJobId}
            >
              Track Opportunity
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
