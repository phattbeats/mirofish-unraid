import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from './api.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  if (!ts) return '—'
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function StatusBadge({ status }) {
  const map = {
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }
  const cls = map[status?.toLowerCase()] || map.pending
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${cls}`}>
      {status || 'unknown'}
    </span>
  )
}

function Card({ title, children, className = '' }) {
  return (
    <div className={`bg-surface border border-border rounded-lg p-4 ${className}`}>
      {title && <h3 className="text-xs font-mono text-text-muted uppercase tracking-widest mb-3">{title}</h3>}
      {children}
    </div>
  )
}

// ── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, accent }) {
  return (
    <Card>
      <div className="text-3xl font-bold font-mono" style={{ color: accent || 'var(--color-text)' }}>{value ?? '—'}</div>
      <div className="text-sm text-text-muted mt-1">{label}</div>
      {sub && <div className="text-xs text-text-muted/60 mt-0.5">{sub}</div>}
    </Card>
  )
}

// ── Nav ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'history', label: 'Sync History' },
  { id: 'ask', label: 'Ask Bridge' },
  { id: 'settings', label: 'Settings' },
]

function Nav({ active, onSelect }) {
  return (
    <nav className="flex items-center gap-1 px-4 py-3 border-b border-border bg-surface">
      <span className="font-mono text-sm font-semibold text-accent mr-4">PHATT Bridge</span>
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`px-3 py-1.5 rounded text-sm transition-colors ${
            active === t.id
              ? 'bg-accent text-white'
              : 'text-text-muted hover:text-text hover:bg-surface-2'
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}

// ── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ onToast }) {
  const [status, setStatus] = useState(null)
  const [recentErrors, setRecentErrors] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, errs] = await Promise.all([api.getStatus(), api.getSyncErrors(5)])
      setStatus(s)
      setRecentErrors(errs || [])
    } catch (e) {
      onToast('error', e.message)
    } finally {
      setLoading(false)
    }
  }, [onToast])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="p-8 text-text-muted font-mono text-sm animate-pulse">Fetching status…</div>

  const pipelines = status?.pipelines || []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <button onClick={load} className="text-xs font-mono text-text-muted hover:text-text px-2 py-1 rounded bg-surface-2 border border-border">
          ↻ Refresh
        </button>
      </div>

      {/* Top-level metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Syncs" value={status?.total_syncs ?? 0} accent="var(--color-text)" />
        <MetricCard label="Success Rate" value={status?.success_rate != null ? `${status.success_rate}%` : '—'} accent="var(--color-green)" />
        <MetricCard label="Last Run" value={status?.last_run ? timeAgo(status.last_run) : '—'} accent="var(--color-blue)" />
        <MetricCard label="Active Errors" value={status?.active_errors ?? 0} accent={status?.active_errors > 0 ? 'var(--color-red)' : 'var(--color-green)'} />
      </div>

      {/* Pipeline health cards */}
      {pipelines.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pipelines.map(p => (
            <Card key={`${p.pipeline}-${p.bu}`} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold">{p.pipeline}</span>
                <StatusBadge status={p.status} />
              </div>
              <div className="text-xs text-text-muted">{p.bu || 'All BUs'}</div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-bg rounded p-2">
                  <div className="text-lg font-mono font-bold">{p.last_records ?? 0}</div>
                  <div className="text-xs text-text-muted">records</div>
                </div>
                <div className="bg-bg rounded p-2">
                  <div className="text-lg font-mono font-bold">{p.last_duration ? `${p.last_duration}s` : '—'}</div>
                  <div className="text-xs text-text-muted">duration</div>
                </div>
              </div>
              {p.last_error && (
                <div className="text-xs text-red-400 bg-red-500/10 rounded p-2 border border-red-500/20">
                  {p.last_error}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center text-text-muted py-8 font-mono text-sm">
            No pipeline data yet. Run a sync to populate the dashboard.
          </div>
        </Card>
      )}

      {/* Recent errors */}
      {recentErrors.length > 0 && (
        <Card title="Recent Errors">
          <div className="space-y-2">
            {recentErrors.map((e, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded bg-bg">
                <span className={`mt-0.5 text-xs font-mono ${e.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {e.severity?.toUpperCase() || 'ERR'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-text-muted">{e.run} / {e.record}</div>
                  <div className="text-sm text-text truncate">{e.error}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ── SyncHistory ──────────────────────────────────────────────────────────────

function SyncHistory({ onToast }) {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getSyncRuns(100)
      setRuns(data || [])
    } catch (e) {
      onToast('error', e.message)
    } finally {
      setLoading(false)
    }
  }, [onToast])

  useEffect(() => { load() }, [load])

  const filtered = runs.filter(r =>
    !filter ||
    r.pipeline?.toLowerCase().includes(filter.toLowerCase()) ||
    r.bu?.toLowerCase().includes(filter.toLowerCase()) ||
    r.status?.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sync History</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-surface border border-border rounded px-3 py-1.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-accent font-mono"
          />
          <button onClick={load} className="text-xs font-mono text-text-muted hover:text-text px-2 py-1 rounded bg-surface-2 border border-border">
            ↻ Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-text-muted font-mono text-sm py-12 animate-pulse">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card><div className="text-center text-text-muted py-8 font-mono text-sm">No sync runs found.</div></Card>
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {['Pipeline', 'BU', 'Status', 'Records', 'Errors', 'Duration', 'Timestamp'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-mono text-text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm">{r.pipeline || '—'}</td>
                  <td className="px-4 py-3 text-text-muted">{r.bu || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 font-mono text-right">{r.records ?? 0}</td>
                  <td className="px-4 py-3 font-mono text-right">
                    {r.errors > 0
                      ? <span className="text-red-400">{r.errors}</span>
                      : <span className="text-text-muted">0</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-right text-text-muted">{r.duration ? `${r.duration}s` : '—'}</td>
                  <td className="px-4 py-3 text-text-muted text-xs font-mono">{timeAgo(r.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── AskBridge (Chat) ─────────────────────────────────────────────────────────

function AskBridge({ onToast }) {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: 'Ask me anything about your HCSS, Acumatica, or sync data. I have access to your MCP tools.'
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content: text }])
    setLoading(true)
    try {
      const res = await api.postChat({ message: text })
      setMessages(m => [...m, { role: 'assistant', content: res.content || res.message || JSON.stringify(res) }])
    } catch (e) {
      onToast('error', e.message)
      setMessages(m => [...m, { role: 'assistant', content: `Error: ${e.message}` }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ask Bridge</h2>
          <p className="text-xs text-text-muted font-mono mt-0.5">Powered by Anthropic API · Bridge MCP tools</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-2xl rounded-lg px-4 py-3 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-accent text-white'
                : 'bg-surface border border-border text-text'
            }`}>
              <pre className="whitespace-pre-wrap font-sans" style={{ fontFamily: 'inherit' }}>{m.content}</pre>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface border border-border rounded-lg px-4 py-3 text-sm text-text-muted font-mono animate-pulse">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about sync runs, HCSS projects, Acumatica records…"
            rows={1}
            className="flex-1 bg-surface border border-border rounded-lg px-4 py-3 text-sm text-text placeholder-text-muted focus:outline-none focus:border-accent resize-none font-sans"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-5 py-3 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            Send
          </button>
        </div>
        <div className="text-xs text-text-muted/60 mt-2 font-mono px-1">
          Press Enter to send · Shift+Enter for newline
        </div>
      </div>
    </div>
  )
}

// ── Settings ─────────────────────────────────────────────────────────────────

function ServiceRow({ name, status, detail }) {
  return (
    <div className="flex items-center justify-between p-3 bg-bg rounded-lg">
      <div>
        <div className="text-sm font-medium">{name}</div>
        {detail && <div className="text-xs text-text-muted font-mono mt-0.5">{detail}</div>}
      </div>
      <StatusBadge status={status} />
    </div>
  )
}

function Settings() {
  const [env, setEnv] = useState({
    WEB_PORT: '3100',
    ANTHROPIC_API_KEY: '',
    HCSS_API_KEY: '',
    ACUMATICA_URL: '',
    ACUMATICA_API_KEY: '',
    DATABASE_PATH: '',
    CRON_SCHEDULE: '',
  })
  const [saved, setSaved] = useState(false)

  function handleChange(key, value) {
    setEnv(e => ({ ...e, [key]: value }))
    setSaved(false)
  }

  function handleSave() {
    // In a real deployment this would write to .env or a config file
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const fields = [
    { key: 'WEB_PORT', label: 'Web UI Port', placeholder: '3100', type: 'text' },
    { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', placeholder: 'sk-ant-…', type: 'password' },
    { key: 'HCSS_API_KEY', label: 'HCSS API Key', placeholder: 'HCSS API key', type: 'password' },
    { key: 'ACUMATICA_URL', label: 'Acumatica URL', placeholder: 'https://…', type: 'text' },
    { key: 'ACUMATICA_API_KEY', label: 'Acumatica API Key', placeholder: 'Acumatica key', type: 'password' },
    { key: 'DATABASE_PATH', label: 'SQLite Database Path', placeholder: 'data/bridge.db', type: 'text' },
    { key: 'CRON_SCHEDULE', label: 'Sync Cron Schedule', placeholder: '0 2 * * *', type: 'text' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Settings</h2>
        <button
          onClick={handleSave}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            saved
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-accent hover:bg-accent-hover text-white'
          }`}
        >
          {saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      {/* Connection Status */}
      <Card title="Connection Status">
        <div className="space-y-2">
          <ServiceRow name="HCSS API" status="unknown" detail="HeavyBid / HeavyJob endpoint" />
          <ServiceRow name="Acumatica ERP" status="unknown" detail="ERP integration endpoint" />
          <ServiceRow name="SQLite Database" status="unknown" detail="Sync run records" />
          <ServiceRow name="Cron Scheduler" status="unknown" detail="Automated sync trigger" />
        </div>
      </Card>

      {/* Environment Variables */}
      <Card title="Environment Variables">
        <div className="space-y-4">
          {fields.map(({ key, label, placeholder, type }) => (
            <div key={key}>
              <label className="block text-xs font-mono text-text-muted uppercase tracking-wider mb-1.5">{label}</label>
              <input
                type={type === 'password' ? 'password' : 'text'}
                value={env[key]}
                onChange={e => handleChange(key, e.target.value)}
                placeholder={placeholder}
                className="w-full bg-bg border border-border rounded-lg px-4 py-2.5 text-sm text-text placeholder-text-muted/50 focus:outline-none focus:border-accent font-mono"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* API Docs note */}
      <Card title="API Endpoints">
        <div className="space-y-2 font-mono text-xs">
          {[
            ['GET', '/api/status', 'Pipeline health summary'],
            ['GET', '/api/sync-runs', 'Audit table of sync runs'],
            ['GET', '/api/sync-errors', 'Sync records with errors/warnings'],
            ['POST', '/api/chat', 'Anthropic chat with MCP tool access'],
          ].map(([method, path, desc]) => (
            <div key={path} className="flex items-center gap-3 p-2 bg-bg rounded">
              <span className={`font-bold shrink-0 ${
                method === 'GET' ? 'text-blue-400' : 'text-green-400'
              }`}>{method}</span>
              <span className="text-text">{path}</span>
              <span className="text-text-muted">— {desc}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toasts }) {
  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      {toasts.map(t => (
        <div key={t.id} className={`px-4 py-3 rounded-lg text-sm font-mono border shadow-lg animate-fade-in ${
          t.type === 'error'
            ? 'bg-red-500/20 text-red-300 border-red-500/30'
            : 'bg-surface border-border text-text'
        }`}>
          {t.type === 'error' && <span className="text-red-400 mr-2">✗</span>}{t.msg}
        </div>
      ))}
    </div>
  )
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [toasts, setToasts] = useState([])

  const onToast = useCallback((type, msg) => {
    const id = Date.now()
    setToasts(t => [...t, { id, type, msg }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      <Nav active={tab} onSelect={setTab} />
      <main className="flex-1 overflow-auto">
        {tab === 'dashboard' && <Dashboard onToast={onToast} />}
        {tab === 'history' && <SyncHistory onToast={onToast} />}
        {tab === 'ask' && <AskBridge onToast={onToast} />}
        {tab === 'settings' && <Settings />}
      </main>
      <Toast toasts={toasts} />
    </div>
  )
}
