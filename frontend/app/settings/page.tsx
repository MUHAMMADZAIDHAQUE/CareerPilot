"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Settings,
  ShieldCheck,
  Cpu,
  Database,
  Terminal,
  RefreshCw,
  Sparkles,
  Key,
  HardDrive,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Server,
  Layers,
} from "lucide-react";
import { fetchHealth, HealthResponse } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import StatusCard from "@/components/StatusCard";
import { LoadingState, ErrorState } from "@/components/ui/States";

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings form mock state
  const [defaultLlm, setDefaultLlm] = useState("gpt-4o");
  const [embeddingModel, setEmbeddingModel] = useState("text-embedding-3-large");
  const [factCheckingStrictness, setFactCheckingStrictness] = useState("strict");
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchHealth();
      if (res.data) {
        setHealth(res.data);
      } else {
        setError(res.error || "Failed to query system health");
      }
    } catch (err: any) {
      setError(err?.message || "Health check failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            System & Copilot Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure LLM inference models, inspect infrastructure status, and manage local storage.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setRefreshing(true);
            loadHealth();
          }}
          loading={refreshing}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Check Services
        </Button>
      </div>

      {loading && !health ? (
        <LoadingState message="Inspecting database and background service probes..." />
      ) : error && !health ? (
        <ErrorState title="System Health Probe Failed" error={error} onRetry={loadHealth} />
      ) : (
        <div className="space-y-8">
          {/* 1. Infrastructure Status Cards */}
          <section className="space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Infrastructure & Database Health
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatusCard
                title="FastAPI Core"
                status={health?.status === "healthy" ? "healthy" : "degraded"}
                description={`v${health?.version || "1.0.0"} • ${health?.environment || "development"}`}
                icon={Server}
                badge={health?.status === "healthy" ? "Healthy" : "Degraded"}
              />

              <StatusCard
                title="Database Engine"
                status={health?.database.status || "connected"}
                description={
                  health?.database.pgvector_enabled
                    ? "PostgreSQL with pgvector enabled"
                    : "SQLite development fallback active"
                }
                icon={Database}
                badge={health?.database.status === "connected" ? "Connected" : "Fallback"}
              />

              <StatusCard
                title="LangGraph Agents"
                status="healthy"
                description="Tailor, Validator, Outreach & Interview agents"
                icon={Cpu}
                badge="Ready"
              />

              <StatusCard
                title="LaTeX PDF Engine"
                status="healthy"
                description="Secure isolated sandbox compiler runner"
                icon={Terminal}
                badge="Sandbox Active"
              />
            </div>
          </section>

          {/* 2. Model & Inference Configuration */}
          <section className="space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              AI Copilot Preferences
            </h2>

            <Card>
              <form onSubmit={handleSavePreferences} className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Primary LLM Model"
                    value={defaultLlm}
                    onChange={(e) => setDefaultLlm(e.target.value)}
                    helperText="Used for tailoring, interview prep, and matching"
                  >
                    <option value="gpt-4o">OpenAI GPT-4o (Recommended)</option>
                    <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                    <option value="gemini-1.5-pro">Google Gemini 1.5 Pro</option>
                  </Select>

                  <Select
                    label="Vector Embedding Model"
                    value={embeddingModel}
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                    helperText="1536-dimensional semantic embeddings"
                  >
                    <option value="text-embedding-3-large">text-embedding-3-large</option>
                    <option value="text-embedding-3-small">text-embedding-3-small</option>
                  </Select>
                </div>

                <Select
                  label="AST Fact-Checking Strictness"
                  value={factCheckingStrictness}
                  onChange={(e) => setFactCheckingStrictness(e.target.value)}
                  helperText="Enforces zero-hallucination validation before accepting tailored resumes"
                >
                  <option value="strict">Strict (Reject any unverified metric, skill, or project)</option>
                  <option value="balanced">Balanced (Permit semantic paraphrasing of existing bullets)</option>
                </Select>

                {savedSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Preferences updated successfully!</span>
                  </div>
                )}

                <div className="pt-2">
                  <Button type="submit" variant="primary" size="sm">
                    Save Configuration
                  </Button>
                </div>
              </form>
            </Card>
          </section>

          {/* 3. Safety Guardrails & Compliance Policy */}
          <section className="space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Safety & Governance Rules
            </h2>

            <Card className="space-y-3">
              <div className="flex items-center space-x-2 text-slate-900 text-sm font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Zero-Hallucination & Human-in-the-Loop Mandates</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5 leading-relaxed">
                <li>Never fabricates candidate experience, metrics, titles, or certifications.</li>
                <li>Never sends automated LinkedIn InMails or cold emails without explicit human approval.</li>
                <li>Preserves master LaTeX resume as an immutable ground truth.</li>
                <li>LaTeX compilation runs with sandboxed execution flags without external network access.</li>
              </ul>
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
