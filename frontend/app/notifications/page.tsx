"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  Mail,
  Send,
  MessageSquare,
  FileCode,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight,
  Filter,
  Check,
  Briefcase,
  AlertCircle,
  Users2,
  ExternalLink,
} from "lucide-react";
import {
  NotificationItem,
  fetchNotificationsApi,
  markNotificationReadApi,
  fetchCandidateProfile,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

const CATEGORIES = [
  { id: "ALL", label: "All Notifications" },
  { id: "JOB_MATCH", label: "Job Matches", icon: Briefcase },
  { id: "OUTREACH_REVIEW", label: "Outreach Review", icon: Send },
  { id: "MESSAGE_SENT", label: "Dispatches", icon: CheckCircle2 },
  { id: "RESPONSE_RECEIVED", label: "Inbound Responses", icon: MessageSquare },
  { id: "ASSESSMENT", label: "Assessments", icon: FileCode },
  { id: "INTERVIEW", label: "Interviews", icon: Calendar },
  { id: "DEADLINE", label: "Deadlines", icon: Clock },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const candRes = await fetchCandidateProfile();
      const res = await fetchNotificationsApi(candRes.data?.id);
      if (res.data) {
        setNotifications(res.data);
      } else {
        setError(res.error || "Failed to load notifications");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkRead = async (id: string) => {
    const res = await markNotificationReadApi(id);
    if (!res.error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    for (const n of unread) {
      await markNotificationReadApi(n.id);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const filtered = notifications.filter((n) => {
    if (selectedCategory === "ALL") return true;
    return n.category === selectedCategory;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "JOB_MATCH":
        return <Briefcase className="w-4 h-4 text-blue-500" />;
      case "MESSAGE_SENT":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "RESPONSE_RECEIVED":
        return <MessageSquare className="w-4 h-4 text-purple-500" />;
      case "ASSESSMENT":
        return <FileCode className="w-4 h-4 text-amber-500" />;
      case "INTERVIEW":
        return <Calendar className="w-4 h-4 text-indigo-500" />;
      case "DEADLINE":
        return <Clock className="w-4 h-4 text-rose-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <Bell className="w-7 h-7 text-blue-600" />
              Notifications Center
            </h1>
            {unreadCount > 0 && (
              <Badge variant="default" className="bg-blue-600 text-white font-mono text-xs">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time activity across outreach dispatches, incoming responses, interview invitations, and upcoming deadlines.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 shrink-0 text-xs"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Mark All as Read</span>
          </Button>
        )}
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-all flex items-center gap-1.5 ${
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {cat.icon && <cat.icon className="w-3.5 h-3.5" />}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Notification Stream */}
      {loading ? (
        <LoadingState message="Loading your activity notifications..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadNotifications} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No notifications in this category"
          description="You are completely caught up. Activity will appear here when outreach messages send, employers respond, or interview deadlines trigger."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <Card
              key={item.id}
              className={`p-4 transition-all flex items-start gap-4 border ${
                item.is_read
                  ? "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800"
                  : "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60 shadow-sm"
              }`}
            >
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                {getCategoryIcon(item.category)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                    {item.title}
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {item.message}
                </p>

                <div className="flex items-center gap-3 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  {item.deep_link && (
                    <Link
                      href={item.deep_link}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}

                  {!item.is_read && (
                    <button
                      onClick={() => handleMarkRead(item.id)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
