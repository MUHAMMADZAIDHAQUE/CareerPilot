"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCode,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Users2,
  AlertTriangle,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  ApplicationDetail,
  fetchApplicationDetailApi,
  updateApplicationApi,
  ApplicationStatus,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LoadingState, ErrorState } from "@/components/ui/States";

const ALL_16_STATUSES = [
  "DISCOVERED",
  "SAVED",
  "ANALYZING",
  "RESUME_PREPARED",
  "RESUME_APPROVED",
  "REFERRAL_RESEARCH",
  "OUTREACH_PREPARED",
  "OUTREACH_APPROVED",
  "OUTREACH_SENT",
  "APPLICATION_READY",
  "APPLIED",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
];

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = (params?.applicationId as string) || "";

  const [data, setData] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "resume" | "outreach" | "responses" | "assessments" | "interviews" | "timeline"
  >("overview");

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApplicationDetailApi(applicationId);
      if (res.data) {
        setData(res.data);
      } else {
        setError(res.error || "Failed to load application details");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load application details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (applicationId) loadDetail();
  }, [applicationId]);

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const res = await updateApplicationApi(applicationId, { status: newStatus });
      if (res.data) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                application: {
                  ...prev.application,
                  status: newStatus,
                },
              }
            : null
        );
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading application lifecycle and timeline..." />;
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ErrorState message={error || "Application not found"} onRetry={loadDetail} />
      </div>
    );
  }

  const {
    application,
    job,
    resume_version,
    contacts,
    outreach_drafts,
    dispatches,
    responses,
    assessments,
    deadlines,
    interviews,
    timeline,
  } = data;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/applications"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Applications CRM</span>
        </Link>
      </div>

      {/* Main Header Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {job?.role || "Software Opportunity"}
            </h1>
            <Badge variant="outline" className="text-xs uppercase font-mono">
              {job?.source_type || "External"}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
              <Building2 className="w-4 h-4 text-slate-400" />
              {job?.company}
            </span>
            {job?.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {job.location}
              </span>
            )}
            {job?.experience_level && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {job.experience_level}
              </span>
            )}
            {job?.salary && (
              <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                {job.salary}
              </span>
            )}
          </div>
        </div>

        {/* Status Dropdown & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Stage Lifecycle
            </label>
            <select
              value={application.status}
              disabled={updatingStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ALL_16_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {(job?.application_url || job?.canonical_url) && (
            <a
              href={(job.official_company_url || job.application_url || job.canonical_url)!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors mt-4 sm:mt-0"
            >
              <span>Open Posting</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs border-b border-slate-200 dark:border-slate-800">
        {[
          { id: "overview", label: "01 Overview & JD" },
          { id: "resume", label: `02 Tailored Resume (${resume_version ? "1" : "0"})` },
          { id: "outreach", label: `03 Outreach & Dispatches (${dispatches.length + outreach_drafts.length})` },
          { id: "responses", label: `04 Responses (${responses.length})` },
          { id: "assessments", label: `05 Assessments & Deadlines (${assessments.length + deadlines.length})` },
          { id: "interviews", label: `06 Interviews (${interviews.length})` },
          { id: "timeline", label: `07 Full Timeline (${timeline.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2 font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600 dark:text-blue-400 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview & JD */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <Card className="p-5 space-y-3">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-500" />
                Job Description
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {job?.raw_description || "No full description available."}
              </p>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5 space-y-3">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                Application Method
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Notice: Applications are submitted directly on the employer&apos;s verified careers portal. CareerPilot prepares and validates all materials, but does not perform automated submissions without candidate oversight.
              </p>
              {(job?.application_url || job?.canonical_url) && (
                <a
                  href={(job.official_company_url || job.application_url || job.canonical_url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  <span>Submit on Career Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </Card>

            <Card className="p-5 space-y-3">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                Application Notes
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                {application.notes || "No candidate notes recorded yet."}
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Resume */}
      {activeTab === "resume" && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <FileCode className="w-5 h-5 text-blue-600" />
              Tailored Resume Version
            </h3>
            {resume_version?.id && (
              <Link
                href={`/resumes/${resume_version.id}`}
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                <span>View Full Resume Studio</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {resume_version ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Version {resume_version.version_number || 1}
                </span>
                <Badge variant={resume_version.is_approved ? "success" : "default"}>
                  {resume_version.is_approved ? "Human Approved" : "Draft Prepared"}
                </Badge>
              </div>
              <p className="text-slate-500">
                Created: {new Date(resume_version.created_at).toLocaleString()}
              </p>
            </div>
          ) : (
            <div className="text-center py-8 space-y-3">
              <p className="text-xs text-slate-500">No tailored resume linked to this application yet.</p>
              <Link href={`/resumes?job_id=${job?.id}`}>
                <Button size="sm" className="bg-blue-600 text-white">
                  Prepare Tailored Resume
                </Button>
              </Link>
            </div>
          )}
        </Card>
      )}

      {/* Tab 3: Outreach & Dispatches */}
      {activeTab === "outreach" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-purple-600" />
              Outreach Dispatches & Prepared Messages
            </h3>
            <Link href={`/outreach?job_id=${job?.id}`}>
              <Button size="sm" variant="outline" className="text-xs">
                <span>Open Outreach Studio</span>
              </Button>
            </Link>
          </div>

          {dispatches.length === 0 && outreach_drafts.length === 0 ? (
            <Card className="p-8 text-center text-xs text-slate-500">
              No outreach drafts or sent messages for this application yet.
            </Card>
          ) : (
            <div className="space-y-3">
              {dispatches.map((disp) => (
                <Card key={disp.id} className="p-4 space-y-2 text-xs border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                      Dispatched to {disp.recipient_name} ({disp.recipient_address})
                    </span>
                    <Badge variant="success">{disp.status}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-slate-500 font-mono text-[11px]">
                    <span>Provider: {disp.provider}</span>
                    <span>Sent: {disp.sent_at ? new Date(disp.sent_at).toLocaleString() : "Manual"}</span>
                  </div>
                </Card>
              ))}

              {outreach_drafts.map((dr: any) => (
                <Card key={dr.id} className="p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Draft for {dr.contact_name || dr.recipient_name || "Contact"} ({dr.channel})
                    </span>
                    <Badge variant={dr.status === "APPROVED_FOR_DISPATCH" ? "success" : "default"}>
                      {dr.status}
                    </Badge>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 line-clamp-2">{dr.body}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Inbound Responses */}
      {activeTab === "responses" && (
        <div className="space-y-4">
          <h3 className="font-semibold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-600" />
            Inbound Communications ({responses.length})
          </h3>

          {responses.length === 0 ? (
            <Card className="p-8 text-center text-xs text-slate-500">
              No employer or referral responses recorded yet.
            </Card>
          ) : (
            <div className="space-y-3">
              {responses.map((resp) => (
                <Card key={resp.id} className="p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      From: {resp.sender} ({resp.channel})
                    </span>
                    <Badge variant="outline" className="font-mono uppercase text-[10px]">
                      {resp.classification.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  {resp.subject && <div className="font-medium text-slate-700">{resp.subject}</div>}
                  <p className="text-slate-500 text-[11px]">
                    Received: {new Date(resp.received_at).toLocaleString()}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Assessments & Deadlines */}
      {activeTab === "assessments" && (
        <div className="space-y-4">
          <h3 className="font-semibold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Assessments & Critical Deadlines
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 space-y-3">
              <h4 className="font-semibold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Coding & Skill Assessments ({assessments.length})
              </h4>
              {assessments.length === 0 ? (
                <p className="text-xs text-slate-400">No assessments scheduled.</p>
              ) : (
                assessments.map((ass) => (
                  <div key={ass.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
                    <div className="font-medium text-slate-800 dark:text-slate-200">{ass.title}</div>
                    <div className="text-slate-400 text-[11px] font-mono">Platform: {ass.platform || "N/A"}</div>
                    {ass.deadline && (
                      <div className="text-amber-600 text-[11px] font-medium">Due: {ass.deadline}</div>
                    )}
                  </div>
                ))
              )}
            </Card>

            <Card className="p-4 space-y-3">
              <h4 className="font-semibold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Explicit Deadlines ({deadlines.length})
              </h4>
              {deadlines.length === 0 ? (
                <p className="text-xs text-slate-400">No active deadlines recorded.</p>
              ) : (
                deadlines.map((dl) => (
                  <div key={dl.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
                    <div className="font-medium text-slate-800 dark:text-slate-200">{dl.title}</div>
                    <div className="text-rose-600 font-semibold text-[11px]">Due: {dl.due_date}</div>
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Tab 6: Interviews */}
      {activeTab === "interviews" && (
        <div className="space-y-4">
          <h3 className="font-semibold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Interview Rounds & Prep Checklist
          </h3>

          {interviews.length === 0 ? (
            <Card className="p-8 text-center text-xs text-slate-500">
              No interview rounds scheduled yet for this application.
            </Card>
          ) : (
            <div className="space-y-3">
              {interviews.map((iv) => (
                <Card key={iv.id} className="p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">
                      {iv.interview_type}
                    </span>
                    <Badge variant="outline">{iv.status}</Badge>
                  </div>
                  <div className="text-slate-500 text-xs font-mono">
                    Scheduled: {new Date(iv.scheduled_at).toLocaleString()}
                  </div>
                  {iv.meeting_url && (
                    <a
                      href={iv.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-blue-600 hover:underline text-xs"
                    >
                      <span>Join Meeting Link</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 7: Timeline */}
      {activeTab === "timeline" && (
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-base text-slate-900 dark:text-white">
            Chronological Lifecycle History
          </h3>

          <div className="space-y-4 relative pl-4 border-l-2 border-slate-200 dark:border-slate-800 ml-2 text-xs">
            {timeline.map((item, idx) => (
              <div key={idx} className="relative space-y-1">
                <div className="absolute -left-[21px] top-0 w-3 h-3 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900" />
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {item.event}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {new Date(item.date).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-slate-500">{item.details}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
