# PHATT Bridge Web UI — Integration Guide

## What You're Adding

A React-based web dashboard for the PHATT Bridge. Four views:

- **Dashboard**: sync metrics, pipeline health cards, recent errors
- **Sync History**: audit table of all sync runs
- **Ask Bridge**: chat interface backed by Anthropic API + bridge MCP tools
- **Settings**: connection status for HCSS, Acumatica, SQLite, cron

The UI fetches from Express API routes that query the same SQLite database
the bridge sync engine writes to. If the API isn't running, the UI falls
back to mock data so the design is always visible.

---

## File Inventory

### New files to add:

```
phatt-bridge/
├── web/                          ← NEW DIRECTORY (React app)
│   ├── package.json              ← Vite + React + Tailwind dependencies
│   ├── vite.config.ts            ← Dev server proxies /api to Express
│   ├── index.html                ← Entry HTML with Space Grotesk font
│   └── src/
│       ├── main.jsx              ← React mount point
│       ├── index.css             ← Tailwind v4 imports + custom theme
│       ├── api.js                ← API client (fetch wrappers)
│       └── App.jsx               ← Main UI component (~650 lines)
│
├── src/api/                      ← NEW DIRECTORY (Express API)
│   └── server.ts                 ← REST endpoints + Anthropic chat proxy
│
├── Dockerfile.web                ← NEW (multi-stage: React build + bridge)
└── docker-compose.web.yml        ← NEW (adds 'web' service)
```

### Files to modify:

```
├── package.json                  ← Add express, cors deps + "web" script
├── .env / .env.example           ← Add WEB_PORT, ANTHROPIC_API_KEY
├── tsconfig.json                 ← Possibly add src/api to include paths
```

---

## Step-by-Step Integration

### 1. Copy the `web/` directory into your repo root

```bash
# From wherever you downloaded these files:
cp -r web/ /path/to/phatt-bridge/web/
```

### 2. Copy `src/api/server.ts` into your bridge source

```bash
mkdir -p /path/to/phatt-bridge/src/api/
cp src/api/server.ts /path/to/phatt-bridge/src/api/
```

### 3. Install backend dependencies

```bash
cd /path/to/phatt-bridge
npm install express cors
npm install -D @types/express @types/cors
```

Add to package.json scripts:
```json
{
  "scripts": {
    "web": "tsx src/api/server.ts",
    "web:dev": "tsx watch src/api/server.ts"
  }
}
```

### 4. Install frontend dependencies

```bash
cd web
npm install
```

### 5. Add environment variables

Append to your `.env`:
```
WEB_PORT=3100
ANTHROPIC_API_KEY=sk-ant-...
```

### 6. Wire up the API server

The `src/api/server.ts` file has TODO comments where you need to connect
your actual SyncStore methods. The three things to wire:

**a) `GET /api/sync-runs`** — Query `sync_runs` table, return rows matching:
```typescript
{ id, pipeline, bu, status, records, errors, duration, timestamp }
```

**b) `GET /api/sync-errors`** — Query `sync_records` where status is error/warning:
```typescript
{ run, record, error, severity }
```

**c) `GET /api/status`** — Aggregate health info from last runs per pipeline/BU.

**d) `POST /api/chat`** — Already wired to call Anthropic API. Add your MCP
tool definitions to the `tools` array and wire the `switch` statement to
call your actual query functions.

### 7. Development workflow

Terminal 1 — Express API:
```bash
npm run web:dev
```

Terminal 2 — Vite dev server (hot reload):
```bash
cd web && npm run dev
```

Open http://localhost:5173 — Vite serves the React app and proxies
`/api/*` requests to Express on port 3100.

### 8. Production build

```bash
cd web && npm run build    # → web/dist/
```

Then Express serves `web/dist/` as static files. One port, one process.

### 9. Docker deployment

```bash
# Replace or merge with your existing docker-compose.yml
cp Dockerfile.web /path/to/phatt-bridge/
cp docker-compose.web.yml /path/to/phatt-bridge/

cd /path/to/phatt-bridge
docker compose -f docker-compose.web.yml up -d
```

The `web` service is accessible on port 3100. Both services share the
SQLite volume, so the web UI reads the same data the bridge writes.

---

## Architecture Notes

```
Browser (port 5173 dev / 3100 prod)
  │
  ├── GET /api/status         → Express → SQLite
  ├── GET /api/sync-runs      → Express → SQLite
  ├── GET /api/sync-errors    → Express → SQLite
  ├── POST /api/chat          → Express → Anthropic API (with tools)
  │                                         ↓
  │                                    tool_use response
  │                                         ↓
  │                                    Express executes tool locally
  │                                    (queries SQLite / HCSS / Acumatica)
  │                                         ↓
  │                                    returns tool_result to Anthropic
  │                                         ↓
  │                                    final text response → browser
  │
  └── Static files (React)    → Express serves web/dist/
```

The Anthropic API key **never** reaches the browser. The chat endpoint
runs tool calls server-side, so the LLM can query HCSS and Acumatica
through the same functions your MCP server uses.

---

## For Coding Agents

If you're handing this to Claude Code, Cursor, or another coding agent,
the key instruction is:

> "Wire up the TODO sections in `src/api/server.ts` to use the existing
> SyncStore class from `src/db/store.ts`. The three endpoints need to
> query `sync_runs` and `sync_records` tables and return JSON matching
> the shapes documented in the TODO comments. Also add the existing MCP
> tool definitions from `src/mcp/server.ts` to the `tools` array in the
> chat endpoint, and wire the tool execution switch statement to call the
> same functions those MCP tools call."

That's the only integration work. Everything else is drop-in.
