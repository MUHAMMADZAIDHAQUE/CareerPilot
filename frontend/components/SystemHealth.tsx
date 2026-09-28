"use client";

import { useEffect, useState } from "react";
import { fetchHealth, HealthResponse } from "@/lib/api";
import StatusCard from "@/components/StatusCard";
import { Server, Database, Cpu, Activity, RefreshCw, Layers, ShieldCheck, Zap } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function SystemHealth() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const checkHealth = async () => {
    setIsLoading(true);
    const result = await fetchHealth();
    setHealth(result.data);
    setError(result.error);
    setLatency(result.latencyMs);
    setIsLoading(false);
    setLastChecked(new Date());
  };

  useEffect(() => {
    checkHealth();
    // Periodic refresh every 15 seconds
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const isDbConnected = health?.database.status === "connected";
  const isPgvectorReady = health?.database.pgvector_enabled === true;

  return (
    <div className="space-y-6">
      {/* Top Banner Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="relative flex h-3 w-3">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                health?.status === "healthy"
                  ? "bg-emerald-400"
                  : health?.status === "degraded"
                  ? "bg-amber-400"
                  : "bg-rose-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                health?.status === "healthy"
                  ? "bg-emerald-500"
                  : health?.status === "degraded"
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
            />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">
              System State:{" "}
              <span className="capitalize text-white">
                {health ? health.status : error ? "Backend Unreachable" : "Connecting..."}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Last checked: {lastChecked.toLocaleTimeString()} • Latency:{" "}
              <span className="text-brand-400 font-mono">
                {latency !== null ? `${latency}ms` : "--"}
              </span>
            </p>
          </div>
        </div>

        <button
          onClick={checkHealth}
          disabled={isLoading}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/80 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Diagnostics</span>
        </button>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* FastAPI Backend Card */}
        <StatusCard
          title="FastAPI Core Engine"
          description="Python 3.11+ REST / SSE Gateway"
          icon={Server}
          status={isLoading ? "loading" : health ? "healthy" : "disconnected"}
          badge={health ? `v${health.version}` : undefined}
          details={
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Environment:</span>
                <span className="font-mono text-slate-200">{health?.environment || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Endpoint:</span>
                <span className="font-mono text-slate-200">GET /api/health</span>
              </div>
            </div>
          }
        />

        {/* PostgreSQL Database Card */}
        <StatusCard
          title="PostgreSQL 16 Engine"
          description="Relational ACID & Profile Store"
          icon={Database}
          status={isLoading ? "loading" : isDbConnected ? "connected" : "disconnected"}
          badge={isDbConnected ? "Connected" : "Disconnected"}
          details={
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Connection:</span>
                <span className="font-mono text-slate-200">{health?.database.status || "Checking"}</span>
              </div>
              {health?.database.error && (
                <p className="text-rose-400 text-xs truncate mt-1">
                  {health.database.error}
                </p>
              )}
            </div>
          }
        />

        {/* pgvector Semantic Vector Extension Card */}
        <StatusCard
          title="pgvector Extension"
          description="HNSW Dense Vector Similarity Index"
          icon={Cpu}
          status={isLoading ? "loading" : isPgvectorReady ? "ready" : "degraded"}
          badge={isPgvectorReady ? "Enabled" : "Pending DB"}
          details={
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Extension:</span>
                <span className="font-mono text-slate-200">
                  {isPgvectorReady ? "Active (vector)" : "Not Detected"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dimensions:</span>
                <span className="font-mono text-slate-200">1536 (OpenAI / pgvector)</span>
              </div>
            </div>
          }
        />
      </div>

      {/* Subsystems & Orchestration Status */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center space-x-2">
          <Layers className="w-4 h-4 text-brand-400" />
          <span>Core Subsystem Readiness Matrix (Phase 1 Baseline)</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-lg bg-slate-800/40 border border-slate-700/40">
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400 mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Clean Architecture</span>
            </div>
            <p className="text-xs text-slate-400">Decoupled domain, services & API</p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-800/40 border border-slate-700/40">
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400 mb-1">
              <Zap className="w-4 h-4" />
              <span>Pydantic v2 Types</span>
            </div>
            <p className="text-xs text-slate-400">Validated candidate & job schemas</p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-800/40 border border-slate-700/40">
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400 mb-1">
              <Activity className="w-4 h-4" />
              <span>Alembic Migrations</span>
            </div>
            <p className="text-xs text-slate-400">Initial pgvector migration ready</p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-800/40 border border-slate-700/40">
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400 mb-1">
              <Server className="w-4 h-4" />
              <span>Docker Orchestration</span>
            </div>
            <p className="text-xs text-slate-400">Compose multi-service stack</p>
          </div>
        </div>
      </div>
    </div>
  );
}
