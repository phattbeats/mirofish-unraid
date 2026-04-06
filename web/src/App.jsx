import { useState, useEffect, useRef, useCallback } from "react";
import { fetchStatus, fetchSyncRuns, fetchSyncErrors, sendChatMessage } from "./api.js";

// ─── Fallback mock data (used when API is unreachable) ──────────────────────
const MOCK_SYNC_RUNS = [
  { id: "run_047", pipeline: "labor", bu: "Daystar", status: "success", records: 142, errors: 0, duration: "3m 12s", timestamp: "2026-04-04 06:00:00" },
  { id: "run_046", pipeline: "estimates", bu: "CST", status: "success", records: 8, errors: 0, duration: "0m 48s", timestamp: "2026-04-04 06:00:00" },
  { id: "run_045", pipeline: "labor", bu: "CST", status: "partial", records: 89, errors: 3, duration: "2m 44s", timestamp: "2026-04-03 06:00:00" },
  { id: "run_044", pipeline: "labor", bu: "Daystar", status: "success", records: 156, errors: 0, duration: "3m 38s", timestamp: "2026-04-03 06:00:00" },
  { id: "run_043", pipeline: "estimates", bu: "Daystar", status: "success", records: 12, errors: 0, duration: "1m 02s", timestamp: "2026-04-03 06:00:00" },
  { id: "run_042", pipeline: "labor", bu: "Precise", status: "error", records: 0, errors: 1, duration: "0m 04s", timestamp: "2026-04-02 06:00:00" },
  { id: "run_041", pipeline: "labor", bu: "CST", status: "success", records: 112, errors: 0, duration: "2m 56s", timestamp: "2026-04-02 06:00:00" },
  { id: "run_040", pipeline: "labor", bu: "Daystar", status: "success", records: 138, errors: 0, duration: "3m 22s", timestamp: "2026-04-02 06:00:00" },
];

const MOCK_ERRORS = [
  { run: "run_045", record: "TC-2026-0403-EMP127", error: "LaborItem 'VO3' not found in pay class map. Raw code passed through.", severity: "warn" },
  { run: "run_045", record: "TC-2026-0403-EMP089", error: "CostCode '01-200' has no matching ProjectTask on project 26-1044.", severity: "warn" },
  { run: "run_045", record: "TC-2026-0403-EMP089", error: "Acumatica returned 400: ProjectTaskID is required.", severity: "error" },
  { run: "run_042", record: "AUTH", error: "HCSS token request returned 401. Client secret may have been rotated.", severity: "error" },
];

const MOCK_STATUS = {
  online: true,
  pipelines: {
    labor: { status: "healthy", lastRun: "2h ago", lastRecords: 142 },
    estimates: { status: "healthy", lastRun: "2h ago", lastRecords: 8 },
  },
  businessUnits: [
    { name: "Daystar", status: "ok" },
    { name: "CST", status: "ok" },
    { name: "Precise", status: "auth_error", detail: "HCSS 401" },
  ],
  db: { size: "4.2 MB", path: "data/phatt-bridge.db" },
  nextSync: "2026-04-05 06:00:00",
  company: "Testing",
  version: "0.1.0",
};

// ─── Icons (inline SVG, stroke-width 1.5) ───────────────────────────────────
const Icon = ({ name, size = 18, className = "" }) => {
  const props = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round",
    strokeLinejoin: "round", className,
  };
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="4" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="11" width="7" height="10" rx="1" /></>,
    history: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
    chat: <><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></>,
    alert: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    send: <><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></>,
    bridge: <><path d="M4 18h16M6 12V6a2 2 0 012-2h8a2 2 0 012 2v6M2 18v-3a3 3 0 013-3h14a3 3 0 013 3v3" /></>,
    heavyjob: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 3v4M8 3v4M2 11h20" /></>,
    acumatica: <><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></>,
    error: <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>,
    menu: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>,
    close: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    info: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>,
    refresh: <><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></>,
    plug: <><path d="M12 22v-5M9 8V2M15 8V2M7 8h10a2 2 0 012 2v2a5 5 0 01-5 5h-4a5 5 0 01-5-5v-2a2 2 0 012-2z" /></>,
  };
  return <svg {...props}>{paths[name]}</svg>;
};

// ─── Status badge ───────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const styles = {
    success: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20",
    partial: "bg-amber-500/15 text-amber-400 ring-amber-500/20",
    error: "bg-red-500/15 text-red-400 ring-red-500/20",
    running: "bg-blue-500/15 text-blue-400 ring-blue-500/20",
  };
  const dots = {
    success: "bg-emerald-400",
    partial: "bg-amber-400",
    error: "bg-red-400",
    running: "bg-blue-400 animate-pulse",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ring-1 ${styles[status] || styles.error}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status] || dots.error}`} />
      {status}
    </span>
  );
};

// ─── Pipeline badge ─────────────────────────────────────────────────────────
const PipelineBadge = ({ pipeline }) => {
  const isLabor = pipeline === "labor";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${isLabor ? "bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/15" : "bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/15"}`}>
      {isLabor ? "Labor" : "Estimates"}
    </span>
  );
};

// ─── Metric card ────────────────────────────────────────────────────────────
const MetricCard = ({ label, value, sub, accent = false, delay = 0 }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100 + delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className="transition-all duration-700"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
      }}
    >
      <div className={`rounded-[1.25rem] p-[1px] ${accent ? "bg-gradient-to-br from-violet-500/20 via-transparent to-cyan-500/20" : "bg-white/[0.04]"}`}>
        <div className="rounded-[calc(1.25rem-1px)] bg-[#0d0d14]/80 p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
          <p className="text-[11px] uppercase tracking-[0.15em] text-white/40 font-medium mb-2">{label}</p>
          <p className={`text-3xl font-semibold tracking-tight ${accent ? "text-white" : "text-white/90"}`}>{value}</p>
          {sub && <p className="text-[12px] text-white/30 mt-1">{sub}</p>}
        </div>
      </div>
    </div>
  );
};

// ─── Pipeline card ──────────────────────────────────────────────────────────
const PipelineCard = ({ title, subtitle, icon, iconColor, ringColor, bgColor, status, lastRun, records, duration, chartData, chartColor }) => (
  <div className="rounded-[1.5rem] p-[1px] bg-white/[0.04]">
    <div className="rounded-[calc(1.5rem-1px)] bg-[#0a0a12]/70 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${bgColor} ring-1 ${ringColor} flex items-center justify-center`}>
            <Icon name={icon} size={15} className={iconColor} />
          </div>
          <div>
            <p className="text-sm font-medium text-white/80">{title}</p>
            <p className="text-[11px] text-white/30">{subtitle}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1">Last Run</p>
          <p className="text-sm text-white/70">{lastRun}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1">Records</p>
          <p className="text-sm text-white/70">{records}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1">Duration</p>
          <p className="text-sm text-white/70">{duration}</p>
        </div>
      </div>
      {chartData && (
        <>
          <div className="mt-5 flex items-end gap-1 h-12">
            {chartData.map((v, i) => {
              const max = Math.max(...chartData, 1);
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${v ? (v / max) * 100 : 4}%`,
                    background: v ? chartColor : "rgba(255,255,255,0.03)",
                    transition: "height 800ms cubic-bezier(0.32, 0.72, 0, 1)",
                    transitionDelay: `${i * 60}ms`,
                  }}
                />
              );
            })}
          </div>
          <p className="text-[10px] text-white/20 mt-1">Records per run, last 7 days</p>
        </>
      )}
    </div>
  </div>
);

// ─── Data hook ──────────────────────────────────────────────────────────────
function useBridgeData() {
  const [status, setStatus] = useState(MOCK_STATUS);
  const [syncRuns, setSyncRuns] = useState(MOCK_SYNC_RUNS);
  const [errors, setErrors] = useState(MOCK_ERRORS);
  const [apiConnected, setApiConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [s, r, e] = await Promise.all([
        fetchStatus(),
        fetchSyncRuns(20),
        fetchSyncErrors(20),
      ]);
      if (s) { setStatus(s); setApiConnected(true); }
      if (r) setSyncRuns(r);
      if (e) setErrors(e);
    } catch {
      // API not available, keep mock data
      setApiConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [refresh]);

  return { status, syncRuns, errors, apiConnected, loading, refresh };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [activeView, setActiveView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { status, syncRuns, errors, apiConnected, loading, refresh } = useBridgeData();

  // Chat state
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", content: "PHATT Bridge is online. Two pipelines active: Labor (HeavyJob → Acumatica TimeEntry) and Estimates (HeavyBid → Acumatica Opportunity). Ask me anything about sync status, labor hours, project costs, or bid estimates." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    const newMessages = [...chatMessages, { role: "user", content: msg }];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      // Try the real API first
      const response = await sendChatMessage(
        newMessages.map((m) => ({ role: m.role, content: m.content }))
      );
      if (response?.content) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: response.content },
        ]);
      } else {
        throw new Error("No response");
      }
    } catch {
      // Fallback: local pattern matching for demo
      const lower = msg.toLowerCase();
      let response = "";
      if (lower.includes("daystar") && lower.includes("hours")) {
        response = `Daystar synced ${syncRuns.filter((r) => r.bu === "Daystar" && r.pipeline === "labor").reduce((s, r) => s + r.records, 0)} labor records in recent runs. Most recent run: ${syncRuns.find((r) => r.bu === "Daystar")?.records || 0} records, status ${syncRuns.find((r) => r.bu === "Daystar")?.status || "unknown"}.`;
      } else if (lower.includes("error") || lower.includes("fail") || lower.includes("issue")) {
        response = errors.length > 0
          ? `${errors.length} issues found:\n\n${errors.map((e) => `• [${e.severity.toUpperCase()}] ${e.error} (${e.run}/${e.record})`).join("\n")}`
          : "No errors in recent sync runs. All clear.";
      } else if (lower.includes("estimate") || lower.includes("opportunity") || lower.includes("bid")) {
        const estRuns = syncRuns.filter((r) => r.pipeline === "estimates");
        response = `Estimates pipeline: ${estRuns.length} runs, ${estRuns.reduce((s, r) => s + r.records, 0)} total records synced. All mapped to Opportunity class CONSTBID.`;
      } else if (lower.includes("status") || lower.includes("health")) {
        response = `Bridge is ${status.online ? "online" : "offline"}. Labor pipeline: ${status.pipelines.labor.status}. Estimates pipeline: ${status.pipelines.estimates.status}. Next sync: ${status.nextSync}. ${status.businessUnits.filter((b) => b.status !== "ok").map((b) => `⚠ ${b.name}: ${b.detail}`).join(". ") || "All BUs healthy."}`;
      } else {
        response = "I can pull data from both HeavyJob and Acumatica. Try asking about labor hours by project, sync errors, estimate pipeline status, or overall bridge health.\n\n(Note: chat API is not connected yet; using local data.)";
      }
      setChatMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, syncRuns, errors, status]);

  // Derived metrics
  const totalRecords = syncRuns.reduce((s, r) => s + r.records, 0);
  const totalErrors = syncRuns.reduce((s, r) => s + r.errors, 0);
  const successRate = syncRuns.length > 0
    ? ((syncRuns.filter((r) => r.status === "success").length / syncRuns.length) * 100).toFixed(0)
    : "—";
  const laborRuns = syncRuns.filter((r) => r.pipeline === "labor");
  const estRuns = syncRuns.filter((r) => r.pipeline === "estimates");

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "history", label: "Sync History", icon: "history" },
    { id: "chat", label: "Ask Bridge", icon: "chat" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#050508] text-white/90 relative overflow-hidden font-sans">
      {/* ── Noise grain ── */}
      <div
        className="fixed inset-0 pointer-events-none z-50"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          opacity: 0.025,
        }}
      />

      {/* ── Mesh gradients ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-30%] right-[-15%] w-[50vw] h-[50vw] rounded-full" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.04) 0%, transparent 70%)" }} />
        <div className="absolute top-[40%] right-[20%] w-[30vw] h-[30vw] rounded-full" style={{ background: "radial-gradient(circle, rgba(16,185,129,0.03) 0%, transparent 70%)" }} />
      </div>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SIDEBAR                                                            */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full w-64 bg-[#08080e]/95 border-r border-white/[0.04] flex flex-col transition-transform duration-500 md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30 flex items-center justify-center ring-1 ring-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
              <Icon name="bridge" size={18} className="text-violet-300" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-white">PHATT Bridge</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-medium">
                {status.version || "v0.1.0"}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-medium px-3 mb-2">Navigation</p>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveView(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-300 mb-0.5 ${
                activeView === item.id
                  ? "bg-white/[0.06] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.02]"
              }`}
              style={{ transitionTimingFunction: "cubic-bezier(0.22, 0.61, 0.36, 1)" }}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.label}</span>
            </button>
          ))}

          {/* Pipelines */}
          <div className="mt-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-medium px-3 mb-2">Pipelines</p>
            {Object.entries(status.pipelines).map(([key, pipe]) => (
              <div key={key} className="px-3 py-2 flex items-center gap-2.5 text-sm text-white/40">
                <span className={`w-2 h-2 rounded-full ${pipe.status === "healthy" ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]" : "bg-red-400"}`} />
                <span className="capitalize">{key === "labor" ? "Labor Hours" : "Bid Estimates"}</span>
              </div>
            ))}
          </div>

          {/* Business Units */}
          <div className="mt-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-medium px-3 mb-2">Business Units</p>
            {status.businessUnits.map((bu) => (
              <div key={bu.name} className="px-3 py-1.5 flex items-center gap-2.5 text-sm text-white/35">
                <span className={`w-1.5 h-1.5 rounded-full ${bu.status === "ok" ? "bg-emerald-400" : "bg-red-400"}`} />
                <span>{bu.name}</span>
                {bu.status !== "ok" && (
                  <span className="text-[9px] text-red-400/70 ml-auto uppercase">{bu.detail || bu.status}</span>
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* Sidebar footer */}
        <div className="px-5 py-4 border-t border-white/[0.04]">
          <div className="flex items-center gap-2 mb-1">
            {!apiConnected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 ring-1 ring-amber-500/20 px-2 py-0.5 text-[9px] text-amber-400 uppercase tracking-wider font-medium">
                Mock Data
              </span>
            )}
          </div>
          <p className="text-[10px] text-white/20 tracking-wider">phatt.tech</p>
          <p className="text-[10px] text-white/15 mt-0.5">{status.company || "Testing"} Tenant</p>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <main className="md:ml-64 min-h-[100dvh] relative z-10">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-[#050508]/80 backdrop-blur-xl border-b border-white/[0.04] px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Icon name={sidebarOpen ? "close" : "menu"} size={20} className="text-white/50" />
            </button>
            <h1 className="text-base font-medium text-white/80 tracking-tight">
              {navItems.find((n) => n.id === activeView)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors duration-300"
              title="Refresh data"
            >
              <Icon name="refresh" size={16} className="text-white/30 hover:text-white/60" />
            </button>
            <div className="flex items-center gap-2 rounded-full bg-white/[0.04] ring-1 ring-white/[0.06] px-3 py-1.5">
              <span className={`w-2 h-2 rounded-full ${status.online ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-red-400"}`} />
              <span className="text-[11px] text-white/50 font-medium tracking-wide uppercase">
                {status.online ? "Online" : "Offline"}
              </span>
            </div>
          </div>
        </header>

        {/* View content */}
        <div className="px-4 md:px-8 py-6">

          {/* ─── DASHBOARD ─── */}
          {activeView === "dashboard" && (
            <div>
              {/* Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <MetricCard label="Records Synced" value={totalRecords.toLocaleString()} sub="Last 48 hours" accent delay={0} />
                <MetricCard label="Success Rate" value={`${successRate}%`} sub={`${syncRuns.filter((r) => r.status === "success").length}/${syncRuns.length} runs clean`} delay={75} />
                <MetricCard label="Errors" value={totalErrors} sub={totalErrors === 0 ? "All clear" : `${totalErrors} records need attention`} delay={150} />
                <MetricCard label="Next Sync" value={status.nextSync ? new Date(status.nextSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} sub={status.nextSync ? status.nextSync.split(" ")[0] : ""} delay={225} />
              </div>

              {/* Pipeline cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                <PipelineCard
                  title="Labor Hours Pipeline"
                  subtitle="HeavyJob → Acumatica TimeEntry"
                  icon="heavyjob"
                  iconColor="text-violet-400"
                  bgColor="bg-violet-500/10"
                  ringColor="ring-violet-500/20"
                  status={laborRuns[0]?.status || "success"}
                  lastRun={status.pipelines.labor.lastRun}
                  records={laborRuns[0]?.records || 0}
                  duration={laborRuns[0]?.duration || "—"}
                  chartData={laborRuns.slice(0, 7).reverse().map((r) => r.records)}
                  chartColor="rgba(139,92,246,0.25)"
                />
                <PipelineCard
                  title="Bid Estimates Pipeline"
                  subtitle="HeavyBid → Acumatica Opportunity"
                  icon="acumatica"
                  iconColor="text-cyan-400"
                  bgColor="bg-cyan-500/10"
                  ringColor="ring-cyan-500/20"
                  status={estRuns[0]?.status || "success"}
                  lastRun={status.pipelines.estimates.lastRun}
                  records={estRuns[0]?.records || 0}
                  duration={estRuns[0]?.duration || "—"}
                  chartData={estRuns.slice(0, 7).reverse().map((r) => r.records)}
                  chartColor="rgba(34,211,238,0.25)"
                />
              </div>

              {/* Recent errors */}
              <div className="rounded-[1.5rem] p-[1px] bg-white/[0.04]">
                <div className="rounded-[calc(1.5rem-1px)] bg-[#0a0a12]/70 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <Icon name="alert" size={16} className="text-amber-400/70" />
                      <p className="text-sm font-medium text-white/70">Recent Issues</p>
                    </div>
                    <span className="text-[10px] text-white/25 uppercase tracking-wider">
                      {errors.length} total
                    </span>
                  </div>
                  {errors.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-white/30">No issues to report. All syncs clean.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {errors.map((err, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors duration-300"
                          style={{ transitionTimingFunction: "cubic-bezier(0.22, 0.61, 0.36, 1)" }}
                        >
                          <Icon
                            name={err.severity === "error" ? "error" : "info"}
                            size={14}
                            className={`mt-0.5 flex-shrink-0 ${err.severity === "error" ? "text-red-400/70" : "text-amber-400/70"}`}
                          />
                          <div className="min-w-0">
                            <p className="text-[12px] text-white/60 leading-relaxed">{err.error}</p>
                            <p className="text-[10px] text-white/20 mt-1 font-mono">
                              {err.run} · {err.record}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── SYNC HISTORY ─── */}
          {activeView === "history" && (
            <div className="rounded-[1.5rem] p-[1px] bg-white/[0.04]">
              <div className="rounded-[calc(1.5rem-1px)] bg-[#0a0a12]/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] overflow-hidden">
                {/* Header */}
                <div className="hidden md:grid grid-cols-[1fr_100px_100px_80px_80px_80px_160px] gap-4 px-6 py-3 border-b border-white/[0.04]">
                  {["Run ID", "Pipeline", "BU", "Records", "Errors", "Duration", "Timestamp"].map((h) => (
                    <p key={h} className="text-[10px] uppercase tracking-[0.15em] text-white/25 font-medium">{h}</p>
                  ))}
                </div>
                {/* Rows */}
                {syncRuns.length === 0 ? (
                  <div className="text-center py-16">
                    <Icon name="history" size={32} className="text-white/10 mx-auto mb-3" />
                    <p className="text-sm text-white/30">No sync runs yet.</p>
                    <p className="text-[12px] text-white/15 mt-1">Runs appear here after the first scheduled or manual sync.</p>
                  </div>
                ) : (
                  syncRuns.map((run) => (
                    <div
                      key={run.id}
                      className="grid grid-cols-1 md:grid-cols-[1fr_100px_100px_80px_80px_80px_160px] gap-2 md:gap-4 px-6 py-3.5 border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors duration-300 cursor-pointer"
                      style={{ transitionTimingFunction: "cubic-bezier(0.22, 0.61, 0.36, 1)" }}
                    >
                      <div className="flex items-center gap-2">
                        <StatusBadge status={run.status} />
                        <span className="text-sm text-white/50 font-mono">{run.id}</span>
                      </div>
                      <div className="flex items-center"><PipelineBadge pipeline={run.pipeline} /></div>
                      <p className="text-sm text-white/50">{run.bu}</p>
                      <p className="text-sm text-white/60 font-mono">{run.records}</p>
                      <p className={`text-sm font-mono ${run.errors > 0 ? "text-amber-400/80" : "text-white/30"}`}>{run.errors}</p>
                      <p className="text-sm text-white/40">{run.duration}</p>
                      <p className="text-[12px] text-white/25 font-mono">{run.timestamp}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ─── CHAT ─── */}
          {activeView === "chat" && (
            <div className="max-w-3xl mx-auto">
              {/* Chat header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 ring-1 ring-violet-500/20 px-3 py-1 mb-4">
                  <Icon name="chat" size={12} className="text-violet-400" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-violet-300/80 font-medium">MCP Interface</span>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-white/90 mb-2">Ask the Bridge</h2>
                <p className="text-sm text-white/30 max-w-md mx-auto">
                  Query HeavyJob and Acumatica data in natural language. Sync status, labor hours, project costs, bid estimates.
                </p>
              </div>

              {/* Messages */}
              <div className="space-y-4 mb-6 max-h-[55vh] overflow-y-auto pr-2">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-violet-500/15 ring-1 ring-violet-500/20 text-white/85"
                          : "bg-white/[0.04] ring-1 ring-white/[0.06] text-white/65 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]"
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/[0.04] ring-1 ring-white/[0.06] rounded-2xl px-4 py-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map((d) => (
                          <div
                            key={d}
                            className="w-2 h-2 rounded-full bg-white/20"
                            style={{ animation: `pulse 1.2s cubic-bezier(0.32, 0.72, 0, 1) ${d * 150}ms infinite` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="rounded-2xl p-[1px] bg-gradient-to-r from-violet-500/15 via-white/[0.06] to-cyan-500/15">
                <div className="rounded-[calc(1rem-1px)] bg-[#0a0a12]/90 flex items-center gap-2 p-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                    placeholder="Ask about labor hours, sync errors, estimates..."
                    className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/20 outline-none px-3 py-2"
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={!chatInput.trim() || chatLoading}
                    className="group w-10 h-10 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 ring-1 ring-violet-500/25 flex items-center justify-center transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ transitionTimingFunction: "cubic-bezier(0.22, 0.61, 0.36, 1)" }}
                  >
                    <Icon
                      name="send"
                      size={15}
                      className="text-violet-300 group-hover:translate-x-[1px] group-hover:-translate-y-[1px] transition-transform duration-300"
                    />
                  </button>
                </div>
              </div>
              <p className="text-center text-[10px] text-white/15 mt-3">
                {apiConnected
                  ? "Connected to bridge API. Queries run against live HCSS and Acumatica via 14 MCP tools."
                  : "API not connected. Using local pattern matching against cached data."}
              </p>
            </div>
          )}

          {/* ─── SETTINGS ─── */}
          {activeView === "settings" && (
            <div className="max-w-2xl space-y-4">
              {[
                { title: "HCSS API", subtitle: "api.hcssapps.com", icon: "heavyjob", status: "Connected", ok: true },
                { title: "Acumatica", subtitle: `${status.company || "Testing"} Tenant · Default/25.200.001`, icon: "acumatica", status: "Connected", ok: true },
                { title: "SQLite Database", subtitle: status.db ? `${status.db.path} · ${status.db.size}` : "data/phatt-bridge.db", icon: "info", status: "Healthy", ok: true },
                { title: "Cron Scheduler", subtitle: `Next run: ${status.nextSync || "—"}`, icon: "refresh", status: "Active", ok: true },
                { title: "Web API", subtitle: apiConnected ? "localhost:3100" : "Not reachable", icon: "plug", status: apiConnected ? "Connected" : "Offline", ok: apiConnected },
              ].map((item, i) => (
                <div key={i} className="rounded-[1.25rem] p-[1px] bg-white/[0.04]">
                  <div className="rounded-[calc(1.25rem-1px)] bg-[#0a0a12]/70 p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon name={item.icon} size={16} className="text-white/30" />
                      <div>
                        <p className="text-sm font-medium text-white/70">{item.title}</p>
                        <p className="text-[12px] text-white/25 mt-0.5">{item.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${item.ok ? "bg-emerald-400" : "bg-red-400"}`} />
                      <span className="text-[11px] text-white/40">{item.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
