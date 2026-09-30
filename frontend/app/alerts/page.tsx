"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Plus,
  Trash2,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  MapPin,
  Globe,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
  RefreshCw,
  Clock,
  Sparkles,
  Layers,
} from "lucide-react";
import {
  JobAlert,
  fetchJobAlertsApi,
  createJobAlertApi,
  updateJobAlertApi,
  deleteJobAlertApi,
  fetchCandidateProfile,
  Candidate,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

const ALL_SOURCES = [
  "linkedin",
  "naukri",
  "internshala",
  "freshersworld",
  "indeed",
  "company_careers",
  "wellfound",
  "foundit",
  "glassdoor",
  "public_feed",
];

const INDIA_CITIES = [
  "Bengaluru",
  "Hyderabad",
  "Pune",
  "Mumbai",
  "Delhi NCR",
  "Remote India",
];

export default function JobAlertsPage() {
  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal create state
  const [showModal, setShowModal] = useState(false);
  const [alertName, setAlertName] = useState("");
  const [selectedRoles, setSelectedRoles] = useState("Software Engineer, Data Analyst");
  const [selectedLocations, setSelectedLocations] = useState<string[]>(["Bengaluru", "Remote India"]);
  const [selectedSources, setSelectedSources] = useState<string[]>([
    "linkedin",
    "naukri",
    "internshala",
    "freshersworld",
  ]);
  const [minScore, setMinScore] = useState(70);
  const [frequency, setFrequency] = useState("DAILY");
  const [emailNotify, setEmailNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const candRes = await fetchCandidateProfile();
      if (candRes.data) setCandidate(candRes.data);
      const res = await fetchJobAlertsApi(candRes.data?.id);
      if (res.data) {
        setAlerts(res.data);
      } else {
        setError(res.error || "Failed to load alerts");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleToggleActive = async (alert: JobAlert) => {
    const updated = !alert.is_active;
    const res = await updateJobAlertApi(alert.id, { is_active: updated });
    if (res.data) {
      setAlerts((prev) => prev.map((a) => (a.id === alert.id ? res.data! : a)));
    }
  };

  const handleDeleteAlert = async (id: string) => {
    const ok = window.confirm("Are you sure you want to delete this job search alert?");
    if (!ok) return;
    const res = await deleteJobAlertApi(id);
    if (res.data) {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertName.trim()) return;
    setSaving(true);
    try {
      const rolesArray = selectedRoles.split(",").map((r) => r.trim()).filter(Boolean);
      const payload: Partial<JobAlert> = {
        name: alertName.trim(),
        candidate_id: candidate?.id,
        roles: rolesArray,
        locations: selectedLocations,
        sources: selectedSources,
        experience_levels: ["Fresher", "0-1 years"],
        work_modes: ["Remote", "Hybrid", "On-site"],
        min_match_score: minScore,
        frequency,
        email_notifications: emailNotify,
        is_active: true,
      };
      const res = await createJobAlertApi(payload);
      if (res.data) {
        setAlerts((prev) => [res.data!, ...prev]);
        setShowModal(false);
        setAlertName("");
      } else {
        alert(res.error || "Failed to create alert");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            <Link href="/jobs" className="hover:text-blue-600 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Jobs Portal
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Bell className="w-7 h-7 text-blue-600" />
            Automated Job Search Alerts
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure multi-source background alerts. CareerPilot monitors 11 portals and surfaces only verified high-fit roles.
          </p>
        </div>

        <Button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2 shrink-0"
          id="btn-create-alert"
        >
          <Plus className="w-4 h-4" />
          <span>CREATE NEW ALERT</span>
        </Button>
      </div>

      {/* Main Alerts List */}
      {loading ? (
        <LoadingState message="Loading your configured job alerts..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadAlerts} />
      ) : alerts.length === 0 ? (
        <EmptyState
          title="No Job Alerts Configured"
          description="Create your first automated search alert to receive daily or weekly high-match job opportunities."
          actionText="Create Search Alert"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              className={`p-5 space-y-4 border transition-all ${
                alert.is_active
                  ? "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
                  : "border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base text-slate-900 dark:text-white">
                      {alert.name}
                    </h3>
                    <Badge variant={alert.is_active ? "success" : "default"}>
                      {alert.is_active ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Frequency: {alert.frequency}</span>
                    <span>•</span>
                    <span>Min Score: {alert.min_match_score}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleToggleActive(alert)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={alert.is_active ? "Pause Alert" : "Activate Alert"}
                  >
                    {alert.is_active ? (
                      <ToggleRight className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-400" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteAlert(alert.id)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Delete Alert"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Roles */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span>Target Roles:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {alert.roles.map((r, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              {/* Locations */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Locations:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {alert.locations.map((loc, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[11px]"
                    >
                      {loc}
                    </span>
                  ))}
                </div>
              </div>

              {/* Sources */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span>Monitored Portals ({alert.sources.length}):</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {alert.sources.map((s, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 text-[10px] uppercase font-mono text-slate-600 dark:text-slate-400"
                    >
                      {s.replace("_", " ")}
                    </span>
                  ))}
                </div>
              </div>

              {/* Footer info */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Last checked: {alert.last_triggered_at ? alert.last_triggered_at.slice(0, 10) : "Pending first run"}
                </span>
                <span className={alert.email_notifications ? "text-emerald-600 font-medium" : "text-slate-400"}>
                  {alert.email_notifications ? "✓ Email Alerts On" : "In-App Only"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Create Job Search Alert"
        >
          <form onSubmit={handleCreateAlert} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Alert Name *
              </label>
              <input
                type="text"
                value={alertName}
                onChange={(e) => setAlertName(e.target.value)}
                placeholder="e.g. Bangalore Fresher SDE Alerts"
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Roles (comma-separated)
              </label>
              <input
                type="text"
                value={selectedRoles}
                onChange={(e) => setSelectedRoles(e.target.value)}
                placeholder="Software Engineer, Data Analyst, Associate SWE"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Locations
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {INDIA_CITIES.map((c) => (
                  <label key={c} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLocations.includes(c)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedLocations([...selectedLocations, c]);
                        else setSelectedLocations(selectedLocations.filter((x) => x !== c));
                      }}
                      className="rounded text-blue-600"
                    />
                    <span>{c}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Portals to Monitor
              </label>
              <div className="grid grid-cols-2 gap-1.5 text-xs max-h-36 overflow-y-auto pr-1">
                {ALL_SOURCES.map((s) => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSources.includes(s)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedSources([...selectedSources, s]);
                        else setSelectedSources(selectedSources.filter((x) => x !== s));
                      }}
                      className="rounded text-blue-600"
                    />
                    <span className="capitalize">{s.replace("_", " ")}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Min Match Score ({minScore}%)
                </label>
                <input
                  type="range"
                  min="50"
                  max="90"
                  step="5"
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                >
                  <option value="DAILY">Daily (9:00 AM IST)</option>
                  <option value="TWICE_DAILY">Twice Daily</option>
                  <option value="WEEKLY">Weekly Digest</option>
                </select>
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailNotify}
                  onChange={(e) => setEmailNotify(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Send email summary when new verified matches are discovered</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={saving}>
                {saving ? "Saving Alert..." : "Save Alert"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
