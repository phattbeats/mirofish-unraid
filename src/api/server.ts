/**
 * PHATT Bridge — Web API Server
 *
 * Serves the React UI (static files from web/dist/) and exposes REST endpoints
 * that the UI consumes. Also proxies chat messages to the Anthropic API with
 * MCP tool definitions that call the bridge's existing query functions.
 *
 * This file lives at src/api/server.ts in the phatt-bridge repo.
 *
 * ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
 * │  React UI   │────→│ Express API  │────→│   SQLite DB  │
 * │ (web/dist/) │     │ (this file)  │────→│ Anthropic API│
 * └─────────────┘     └──────────────┘     └──────────────┘
 *
 * SETUP:
 *   1. npm install express cors
 *   2. Add to package.json scripts: "web": "tsx src/api/server.ts"
 *   3. Build React app: cd web && npm run build
 *   4. Run: npm run web (or include in docker-compose)
 */

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// ─── IMPORT YOUR EXISTING BRIDGE MODULES ────────────────────────────────────
// Adjust these paths to match your actual exports.
// The store module should already expose query methods for sync_runs and sync_records.
import { SyncStore } from "../db/store.js";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.WEB_PORT ? parseInt(process.env.WEB_PORT) : 3100;

app.use(cors());
app.use(express.json());

// ─── Initialize SQLite store ────────────────────────────────────────────────
// Uses the same DB file the bridge sync engine writes to.
const store = new SyncStore(process.env.DB_PATH || "data/phatt-bridge.db");

// ═══════════════════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/status
 * Overall bridge health: pipeline status, BU health, DB info, next sync time.
 */
app.get("/api/status", (_req, res) => {
  try {
    // TODO: Adapt these queries to your actual SyncStore methods.
    // The mock shape below matches what the UI expects.
    // Replace with real queries like:
    //   const lastLabor = store.getLastRun("labor");
    //   const lastEstimates = store.getLastRun("estimates");

    const status = {
      online: true,
      version: "0.1.0",
      company: process.env.ACUMATICA_COMPANY || "Testing",
      pipelines: {
        labor: {
          status: "healthy", // derive from last run status
          lastRun: "—",      // derive from last run timestamp
          lastRecords: 0,    // derive from last run record count
        },
        estimates: {
          status: "healthy",
          lastRun: "—",
          lastRecords: 0,
        },
      },
      businessUnits: config.businessUnits?.map((bu: any) => ({
        name: bu.name,
        status: "ok", // TODO: check last run per BU for errors
        detail: null,
      })) || [
        { name: "Daystar", status: "ok" },
        { name: "CST", status: "ok" },
        { name: "Precise", status: "ok" },
      ],
      db: {
        path: process.env.DB_PATH || "data/phatt-bridge.db",
        size: "—", // TODO: fs.statSync(dbPath).size formatted
      },
      nextSync: "—", // TODO: derive from cron schedule
    };

    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sync-runs?limit=20
 * Recent sync runs from the sync_runs table.
 */
app.get("/api/sync-runs", (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    // TODO: Replace with your actual SyncStore method.
    // Expected shape per row:
    // { id, pipeline, bu, status, records, errors, duration, timestamp }
    //
    // Example query against your schema:
    //   const runs = store.db.prepare(`
    //     SELECT
    //       id,
    //       sync_type AS pipeline,
    //       business_unit AS bu,
    //       status,
    //       records_synced AS records,
    //       records_errored AS errors,
    //       duration,
    //       started_at AS timestamp
    //     FROM sync_runs
    //     ORDER BY started_at DESC
    //     LIMIT ?
    //   `).all(limit);

    const runs: any[] = []; // ← replace with real query
    res.json(runs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sync-errors?limit=20
 * Recent error/warning records from sync_records.
 */
app.get("/api/sync-errors", (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    // TODO: Replace with your actual SyncStore method.
    // Expected shape per row:
    // { run, record, error, severity }
    //
    // Example query:
    //   const errors = store.db.prepare(`
    //     SELECT
    //       run_id AS run,
    //       external_ref AS record,
    //       error_message AS error,
    //       CASE WHEN status = 'error' THEN 'error' ELSE 'warn' END AS severity
    //     FROM sync_records
    //     WHERE status IN ('error', 'warning')
    //     ORDER BY created_at DESC
    //     LIMIT ?
    //   `).all(limit);

    const errors: any[] = []; // ← replace with real query
    res.json(errors);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/chat
 * Proxies chat messages to the Anthropic API with bridge MCP tool definitions.
 * The API key stays server-side; the browser never sees it.
 *
 * Request body: { messages: [{ role, content }] }
 * Response: { content: string }
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array required" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "ANTHROPIC_API_KEY not set. Chat requires an API key.",
      });
    }

    // ── Define tool schemas for the LLM ──────────────────────────────────
    // These match your existing MCP tool signatures. The LLM calls tools,
    // we execute them locally against the bridge's data, and return results.
    const tools = [
      {
        name: "get_sync_status",
        description: "Get current bridge sync status including pipeline health, last run times, error counts, and business unit status.",
        input_schema: { type: "object" as const, properties: {} },
      },
      {
        name: "get_recent_sync_runs",
        description: "Get recent sync run history. Returns run ID, pipeline type, business unit, record counts, errors, and timestamps.",
        input_schema: {
          type: "object" as const,
          properties: {
            limit: { type: "number", description: "Number of runs to return (default 10)" },
            pipeline: { type: "string", description: "Filter by pipeline: 'labor' or 'estimates'" },
            bu: { type: "string", description: "Filter by business unit: 'Daystar', 'CST', or 'Precise'" },
          },
        },
      },
      {
        name: "get_sync_errors",
        description: "Get recent sync errors and warnings. Returns error messages, affected records, severity, and which run they occurred in.",
        input_schema: {
          type: "object" as const,
          properties: {
            limit: { type: "number", description: "Number of errors to return (default 20)" },
            run_id: { type: "string", description: "Filter errors for a specific run ID" },
          },
        },
      },
      // TODO: Add your existing MCP tool definitions here:
      // - hcss_list_employees
      // - hcss_get_employee_hours
      // - hcss_list_jobs
      // - acumatica_list_projects
      // - acumatica_get_time_entries
      // - bridge_get_payclass_map
      // - etc.
    ];

    // ── Call Anthropic API ────────────────────────────────────────────────
    const systemPrompt = `You are the PHATT Bridge assistant, a construction data platform that connects HCSS HeavyJob/HeavyBid with Acumatica ERP. You have access to tools that query sync status, labor hours, bid estimates, and error logs. Answer questions about bridge health, sync history, labor data, and project costs. Be concise and data-driven. When you have numbers, lead with them.`;

    let anthropicMessages = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    // Multi-turn tool use loop
    let finalResponse = "";
    let maxLoops = 5;

    while (maxLoops-- > 0) {
      const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemPrompt,
          tools,
          messages: anthropicMessages,
        }),
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        throw new Error(`Anthropic API error ${apiRes.status}: ${errText}`);
      }

      const data = await apiRes.json();

      // Check if the model wants to use tools
      const toolUseBlocks = data.content.filter((b: any) => b.type === "tool_use");
      const textBlocks = data.content.filter((b: any) => b.type === "text");

      if (toolUseBlocks.length === 0) {
        // No tool calls, extract text response
        finalResponse = textBlocks.map((b: any) => b.text).join("\n");
        break;
      }

      // ── Execute tool calls locally ──────────────────────────────────
      // Add assistant message with tool use to conversation
      anthropicMessages.push({ role: "assistant", content: data.content });

      const toolResults: any[] = [];
      for (const toolUse of toolUseBlocks) {
        let result: any;
        try {
          // TODO: Wire these to your actual SyncStore / HCSS / Acumatica query methods
          switch (toolUse.name) {
            case "get_sync_status":
              // result = { ...status object... };
              result = { status: "healthy", message: "Both pipelines operational" };
              break;
            case "get_recent_sync_runs":
              // result = store.getRecentRuns(toolUse.input.limit, toolUse.input.pipeline, toolUse.input.bu);
              result = [];
              break;
            case "get_sync_errors":
              // result = store.getRecentErrors(toolUse.input.limit, toolUse.input.run_id);
              result = [];
              break;
            default:
              result = { error: `Unknown tool: ${toolUse.name}` };
          }
        } catch (err: any) {
          result = { error: err.message };
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Add tool results and continue the loop
      anthropicMessages.push({ role: "user", content: toolResults });
    }

    res.json({ content: finalResponse });
  } catch (err: any) {
    console.error("Chat API error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// STATIC FILE SERVING (production)
// ═══════════════════════════════════════════════════════════════════════════
// In production, the built React app is served from web/dist/.
// In development, Vite dev server handles this and proxies /api to us.

const distPath = path.resolve(__dirname, "../../web/dist");
app.use(express.static(distPath));

// SPA fallback — any non-API route serves index.html
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// ═══════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`PHATT Bridge Web UI → http://localhost:${PORT}`);
  console.log(`API endpoints → http://localhost:${PORT}/api/`);
});

export default app;
