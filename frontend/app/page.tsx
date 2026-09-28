import Link from "next/link";
import {
  Compass,
  FileCheck2,
  Cpu,
  Mail,
  Users2,
  CalendarCheck,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Database,
  Terminal,
  Activity,
  Layers,
} from "lucide-react";
import SystemHealth from "@/components/SystemHealth";

export default function Home() {
  const capabilities = [
    {
      title: "Hybrid Semantic Matching",
      desc: "Structured rule matching + pgvector dense vector similarity with evidence citations.",
      icon: Cpu,
      phase: "Phase 2",
    },
    {
      title: "Zero-Hallucination LaTeX Tailor",
      desc: "AST fact-grounded rewording and reorganization. Never invents skills, companies, or metrics.",
      icon: FileCheck2,
      phase: "Phase 3",
    },
    {
      title: "Referral & Outreach Copilot",
      desc: "Authorized discovery and personalized draft generation with mandatory human approval.",
      icon: Users2,
      phase: "Phase 4",
    },
    {
      title: "Application & Interview Tracker",
      desc: "Kanban board workflow + customized STAR behavioral and technical interview prep packs.",
      icon: CalendarCheck,
      phase: "Phase 5",
    },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative pt-6 pb-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold mb-4">
          <span className="flex h-2 w-2 rounded-full bg-brand-400 animate-pulse" />
          <span>Phase 1 Implementation: Complete Local Development Foundation</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
          AI Career Assistant &{" "}
          <span className="bg-gradient-to-r from-brand-400 via-accent-cyan to-accent-violet bg-clip-text text-transparent">
            Resume Tailoring Copilot
          </span>
        </h1>

        <p className="mt-4 text-lg text-slate-300 max-w-3xl leading-relaxed">
          Production-quality career acceleration engine. Combines deterministic structured
          matching, dense vector semantic search with <code className="text-accent-cyan font-mono text-sm bg-slate-800/80 px-1.5 py-0.5 rounded">pgvector</code>,
          strict fact-grounded LaTeX tailoring, and ethical referral outreach.
        </p>

        <div className="mt-6 flex flex-wrap gap-4 items-center">
          <Link
            href="/health"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-medium text-sm shadow-lg shadow-brand-500/25 transition-all"
          >
            <Activity className="w-4 h-4" />
            <span>View System Diagnostics</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <a
            href="http://localhost:8000/api/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 font-medium text-sm transition-all"
          >
            <Terminal className="w-4 h-4 text-brand-400" />
            <span>FastAPI Interactive Docs</span>
          </a>
        </div>
      </section>

      {/* Live System Diagnostics Widget */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Activity className="w-5 h-5 text-brand-400" />
            <span>Live Local Stack Status</span>
          </h2>
          <span className="text-xs text-slate-400">Continuous health polling active</span>
        </div>
        <SystemHealth />
      </section>

      {/* Architecture Highlights & Safety Policy */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center space-x-3 text-brand-400">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h3 className="font-bold text-lg text-white">Strict Anti-Hallucination Invariant</h3>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            The resume agent operates under deterministic fact-checking guards. It strictly
            reorganizes, clarifies, and emphasizes existing verified candidate facts—never
            fabricating metrics, skills, degrees, or employers.
          </p>
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center space-x-2 text-xs text-emerald-400 font-medium">
              <CheckCircle className="w-4 h-4" />
              <span>AST Claim Verification Node Configured in LangGraph</span>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center space-x-3 text-brand-400">
            <Database className="w-6 h-6 text-accent-cyan" />
            <h3 className="font-bold text-lg text-white">PostgreSQL + pgvector Architecture</h3>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Unified data architecture combining transactional relational integrity with HNSW
            vector similarity search for high-throughput JD requirement matching without external
            vector DB lock-in.
          </p>
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center space-x-2 text-xs text-accent-cyan font-medium">
              <CheckCircle className="w-4 h-4" />
              <span>Alembic Migration & SQLAlchemy Async Models Ready</span>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Phase Architecture Modules */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center space-x-2">
          <Layers className="w-5 h-5 text-brand-400" />
          <span>Planned System Capabilities (Phased Roadmap)</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {capabilities.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="glass-card rounded-xl p-5 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-slate-800 text-brand-400">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      {item.phase}
                    </span>
                  </div>
                  <h4 className="font-semibold text-slate-100 text-sm mb-1">{item.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
