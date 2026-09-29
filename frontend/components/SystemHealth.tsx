"use client";

import { useEffect, useState } from "react";
import { fetchHealth, HealthResponse } from "@/lib/api";
import StatusCard from "@/components/StatusCard";
import { Server, Database, Cpu, RefreshCw, Layers, ShieldCheck, Zap, Activity } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

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
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const isDbConnected = health?.database.status === "connected";
  const isPgvectorReady = health?.database.pgvector_enabled === true;

  return (
    <div className="space-y-6">
      {/* Top Banner Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
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
            <h2 className="text-sm font-semibold text-slate-800">
              System State:{" "}
              <span className="capitalize font-bold text-slate-900">
                {health ? health.status : error ? "Backend Unreachable" : "Connecting..."}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Last checked: {lastChecked.toLocaleTimeString()} • Latency:{" "}
              <span className="text-slate-800 font-mono font-medium">
                {latency !== null ? `${latency}ms` : "--"}
              </span>
            </p>
          </div>
        </div>

        <Button
          onClick={checkHealth}
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Diagnostics</span>
        </Button>
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
                <span className="text-slate-500">Environment:</span>
                <span className="font-mono text-slate-800 font-medium">{health?.environment || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Endpoint:</span>
                <span className="font-mono text-slate-800 font-medium">GET /api/health</span>
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
                <span className="text-slate-500">Connection:</span>
                <span className="font-mono text-slate-800 font-medium">{health?.database.status || "Checking"}</span>
              </div>
              {health?.database.error && (
                <p className="text-rose-600 text-xs truncate mt-1">
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
                <span className="text-slate-500">Extension:</span>
                <span className="font-mono text-slate-800 font-medium">
                  {isPgvectorReady ? "Active (vector)" : "Not Detected"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Dimensions:</span>
                <span className="font-mono text-slate-800 font-medium">1536 (pgvector / HNSW)</span>
              </div>
            </div>
          }
        />
      </div>

      {/* Subsystems & Orchestration Status */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center space-x-2">
          <Layers className="w-4 h-4 text-slate-600" />
          <span>Core Subsystem Readiness Matrix</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-800 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Clean Architecture</span>
            </div>
            <p className="text-xs text-slate-500">Decoupled domain, services & API</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-800 mb-1">
              <Zap className="w-4 h-4 text-emerald-600" />
              <span>Pydantic v2 Types</span>
            </div>
            <p className="text-xs text-slate-500">Validated candidate & job schemas</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-800 mb-1">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Alembic Migrations</span>
            </div>
            <p className="text-xs text-slate-500">Initial pgvector migration ready</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-800 mb-1">
              <Server className="w-4 h-4 text-emerald-600" />
              <span>Docker Orchestration</span>
            </div>
            <p className="text-xs text-slate-500">Compose multi-service stack</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
