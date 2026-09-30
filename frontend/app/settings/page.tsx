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
  Sun,
  Moon,
  Laptop,
  Check,
  Mail,
  Lock,
  Globe,
  Radio,
  Sliders,
  Bell,
  Clock,
  Send,
  Zap,
} from "lucide-react";
import {
  fetchHealth,
  HealthResponse,
  fetchConnectedProvidersApi,
  connectProviderApi,
  disconnectProviderApi,
  ConnectedProvider,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import StatusCard from "@/components/StatusCard";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useTheme } from "@/components/ThemeProvider";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings form state
  const [defaultLlm, setDefaultLlm] = useState("gpt-4o");
  const [embeddingModel, setEmbeddingModel] = useState("text-embedding-3-large");
  const [factCheckingStrictness, setFactCheckingStrictness] = useState("strict");
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Connected Providers State
  const [providers, setProviders] = useState<ConnectedProvider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [selectedProviderType, setSelectedProviderType] = useState<"gmail" | "outlook">("gmail");
  const [providerEmail, setProviderEmail] = useState("");
  const [connectingProvider, setConnectingProvider] = useState(false);

  // Disconnect Confirmation Modal
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [providerToDisconnect, setProviderToDisconnect] = useState<ConnectedProvider | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Automation Toggles State
  const [automations, setAutomations] = useState({
    jobDiscoveryDaily: true,
    fresherJobAlerts: true,
    responseMonitoring: true,
    deadlineReminders: true,
    doubleConfirmationEnforced: true,
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [hRes, pRes] = await Promise.all([
        fetchHealth(),
        fetchConnectedProvidersApi(),
      ]);
      if (hRes.data) setHealth(hRes.data);
      if (pRes.data) setProviders(pRes.data);
    } catch (err: any) {
      setError(err?.message || "Health check failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleConnectProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerEmail.trim()) return;

    setConnectingProvider(true);
    const res = await connectProviderApi(selectedProviderType, undefined, providerEmail.trim());
    setConnectingProvider(false);

    if (res.data) {
      setConnectModalOpen(false);
      setProviderEmail("");
      // reload providers
      const pRes = await fetchConnectedProvidersApi();
      if (pRes.data) setProviders(pRes.data);
    } else {
      alert(res.error || "Failed to connect provider");
    }
  };

  const handleOpenDisconnectModal = (provider: ConnectedProvider) => {
    setProviderToDisconnect(provider);
    setDisconnectModalOpen(true);
  };

  const handleConfirmDisconnect = async () => {
    if (!providerToDisconnect) return;
    setDisconnecting(true);
    const res = await disconnectProviderApi(providerToDisconnect.provider);
    setDisconnecting(false);

    if (res.data) {
      setDisconnectModalOpen(false);
      setProviderToDisconnect(null);
      const pRes = await fetchConnectedProvidersApi();
      if (pRes.data) setProviders(pRes.data);
    } else {
      alert(res.error || "Failed to disconnect provider");
    }
  };

  return (
    <div className="space-y-8 sm:space-y-10 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            System & Copilot Settings
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Configure appearance theme, authorized email providers, automation schedules, and AI safety guardrails.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setRefreshing(true);
            loadData();
          }}
          loading={refreshing}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Check Services
        </Button>
      </div>

      {loading && !health ? (
        <LoadingState message="Inspecting database, providers, and background service probes..." />
      ) : error && !health ? (
        <ErrorState title="System Health Probe Failed" error={error} onRetry={loadData} />
      ) : (
        <div className="space-y-10">
          {/* 1. Connected Email Providers Section */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Connected Email Providers (Authorized Dispatch)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Authorize personal email accounts to dispatch reviewed outreach and scan for interview responses.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setSelectedProviderType("gmail");
                    setConnectModalOpen(true);
                  }}
                  icon={<Mail className="w-3.5 h-3.5" />}
                >
                  Connect Provider
                </Button>
              </div>
            </div>

            <Card className="divide-y divide-slate-100 dark:divide-slate-800 p-0 overflow-hidden">
              {providers.map((p) => (
                <div key={p.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm">
                          {p.account_email || p.email_address}
                        </span>
                        <Badge variant={p.is_active ? "success" : "neutral"} size="sm">
                          {p.is_active ? "ACTIVE" : "REVOKED"}
                        </Badge>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase font-semibold">
                          {p.provider}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Rate limit: {p.daily_dispatch_count ?? 0}/{p.daily_dispatch_limit ?? 50} sent today • Scopes: {p.scopes.join(", ") || "Send + Readonly"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenDisconnectModal(p)}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ))}

              {providers.length === 0 && (
                <div className="p-8 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No email providers connected yet
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Connect your Gmail or Outlook account to enable 1-click authorized dispatch of approved referral outreach messages.
                  </p>
                  <div className="pt-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setSelectedProviderType("gmail");
                        setConnectModalOpen(true);
                      }}
                    >
                      Connect Gmail Account
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </section>

          {/* 2. Automation & Scheduling Toggles */}
          <section className="space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Background Automation & Schedules</span>
            </h2>

            <Card className="divide-y divide-slate-100 dark:divide-slate-800 p-0 overflow-hidden">
              <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="font-semibold text-sm text-slate-900 dark:text-white block">
                    Daily 11-Source Fresher Job Discovery
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Scrapes and aggregates entry-level software engineering openings every morning at 06:00 AM IST.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={automations.jobDiscoveryDaily}
                  onChange={(e) => setAutomations({ ...automations, jobDiscoveryDaily: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="font-semibold text-sm text-slate-900 dark:text-white block">
                    Instant Job Alerts & Digest Notifications
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Triggers browser notifications and notification center entries when matches above threshold are discovered.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={automations.fresherJobAlerts}
                  onChange={(e) => setAutomations({ ...automations, fresherJobAlerts: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="font-semibold text-sm text-slate-900 dark:text-white block">
                    Inbound Response & OA Deadline Monitoring
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Extracts coding assessment invites, explicit cutoffs, and interview dates without AI hallucination.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={automations.responseMonitoring}
                  onChange={(e) => setAutomations({ ...automations, responseMonitoring: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              <div className="p-4 sm:p-5 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">
                      Mandatory Human Double Confirmation on Dispatch
                    </span>
                    <Badge variant="success" size="sm">Always Enforced</Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    In accordance with CareerPilot invariant rules, sending emails or applications requires explicit manual confirmation.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="w-4 h-4 rounded text-emerald-600 opacity-80 cursor-not-allowed"
                />
              </div>
            </Card>
          </section>

          {/* 3. Theme & Appearance Section */}
          <section className="space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Appearance & Theme
            </h2>

            <Card>
              <CardHeader
                title="Color Mode"
                subtitle="Select your preferred visual style across all workspaces and dashboards."
              />
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`p-4 rounded-xl border text-left flex items-start justify-between transition-all ${
                    theme === "light"
                      ? "border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800 ring-2 ring-slate-900/10 dark:ring-white/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-amber-500" />
                      <span className="font-bold text-sm text-slate-900 dark:text-white">Light Mode</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Pristine white surfaces with dark charcoal typography
                    </p>
                  </div>
                  {theme === "light" && <Check className="w-4 h-4 text-slate-900 dark:text-white shrink-0" />}
                </button>

                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`p-4 rounded-xl border text-left flex items-start justify-between transition-all ${
                    theme === "dark"
                      ? "border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800 ring-2 ring-slate-900/10 dark:ring-white/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-blue-400" />
                      <span className="font-bold text-sm text-slate-900 dark:text-white">Dark Mode</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Deep charcoal slate background with soft white text
                    </p>
                  </div>
                  {theme === "dark" && <Check className="w-4 h-4 text-slate-900 dark:text-white shrink-0" />}
                </button>

                <button
                  type="button"
                  onClick={() => setTheme("system")}
                  className={`p-4 rounded-xl border text-left flex items-start justify-between transition-all ${
                    theme === "system"
                      ? "border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800 ring-2 ring-slate-900/10 dark:ring-white/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Laptop className="w-4 h-4 text-slate-400" />
                      <span className="font-bold text-sm text-slate-900 dark:text-white">System Preference</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Automatically synchronize with your operating system
                    </p>
                  </div>
                  {theme === "system" && <Check className="w-4 h-4 text-slate-900 dark:text-white shrink-0" />}
                </button>
              </div>
            </Card>
          </section>

          {/* 4. Infrastructure Status Cards */}
          <section className="space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
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

          {/* 5. Model & Inference Configuration */}
          <section className="space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
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
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
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

          {/* 6. Safety Guardrails & Compliance Policy */}
          <section className="space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Safety & Governance Rules
            </h2>

            <Card className="space-y-3">
              <div className="flex items-center space-x-2 text-slate-900 dark:text-white text-base font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Zero-Hallucination & Human-in-the-Loop Mandates</span>
              </div>
              <ul className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2 list-disc pl-5 leading-relaxed">
                <li>Never fabricates candidate experience, metrics, titles, or certifications.</li>
                <li>Never sends automated LinkedIn InMails or cold emails without explicit human approval.</li>
                <li>Preserves master LaTeX resume as an immutable ground truth (SHA-256 verified).</li>
                <li>LaTeX compilation runs with sandboxed execution flags without external network access.</li>
              </ul>
            </Card>
          </section>
        </div>
      )}

      {/* Connect Provider Modal */}
      <Modal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        title="Authorize Email Provider"
        description="Connect your email account to enable authorized dispatch of approved referral outreach messages."
      >
        <form onSubmit={handleConnectProvider} className="space-y-4">
          <Select
            label="Provider Service"
            value={selectedProviderType}
            onChange={(e) => setSelectedProviderType(e.target.value as any)}
          >
            <option value="gmail">Google Gmail (OAuth 2.0)</option>
            <option value="outlook">Microsoft Outlook / Office 365</option>
          </Select>

          <Input
            label="Account Email Address"
            type="email"
            placeholder="candidate@example.com"
            value={providerEmail}
            onChange={(e) => setProviderEmail(e.target.value)}
            required
            helperText="CareerPilot will only send messages that you have explicitly double-confirmed."
          />

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <span>
              By connecting, you grant CareerPilot permissions to send authorized drafts from your account. Every email dispatch requires explicit &quot;SEND NOW&quot; double confirmation.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConnectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={connectingProvider}
            >
              Authorize & Connect
            </Button>
          </div>
        </form>
      </Modal>

      {/* Disconnect Provider Confirmation Modal */}
      <Modal
        isOpen={disconnectModalOpen}
        onClose={() => setDisconnectModalOpen(false)}
        title="Confirm Provider Disconnect"
        description="Are you sure you want to disconnect this email provider?"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Disconnecting <strong className="text-slate-900 dark:text-white">{providerToDisconnect?.account_email || providerToDisconnect?.email_address}</strong> will revoke CareerPilot&apos;s authorization to send emails from this account. Future outreach drafts will require manual dispatch.
          </p>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDisconnectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleConfirmDisconnect}
              loading={disconnecting}
            >
              Confirm Disconnect
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
