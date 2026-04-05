// src/api/server.ts — PHATT Bridge Express API + Anthropic chat proxy
// TODO: Wire to actual SyncStore / SQLite in the sections marked TODO below.

import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.WEB_PORT || 3100

// ── Mock data (shown when API is unavailable) ─────────────────────────────

const MOCK_STATUS = {
  total_syncs: 47,
  success_rate: 94,
  last_run: new Date(Date.now() - 1000 * 60 * 34).toISOString(),
  active_errors: 2,
  pipelines: [
    { pipeline: 'HeavyBid → Acumatica', bu: 'CST Utilities', status: 'success', last_records: 12, last_duration: 8, last_error: null },
    { pipeline: 'HeavyJob → Acumatica', bu: 'CST Utilities', status: 'warning', last_records: 5, last_duration: 14, last_error: 'Partial match on cost code C-442' },
    { pipeline: 'HeavyBid → Acumatica', bu: 'Terry Sherman Law', status: 'success', last_records: 3, last_duration: 6, last_error: null },
  ]
}

const MOCK_RUNS = [
  { id: '1', pipeline: 'HeavyBid → Acumatica', bu: 'CST Utilities', status: 'success', records: 12, errors: 0, duration: 8, timestamp: new Date(Date.now() - 1000 * 60 * 34).toISOString() },
  { id: '2', pipeline: 'HeavyJob → Acumatica', bu: 'CST Utilities', status: 'warning', records: 5, errors: 1, duration: 14, timestamp: new Date(Date.now() - 1000 * 60 * 62).toISOString() },
  { id: '3', pipeline: 'HeavyBid → Acumatica', bu: 'Terry Sherman Law', status: 'success', records: 3, errors: 0, duration: 6, timestamp: new Date(Date.now() - 1000 * 60 * 95).toISOString() },
  { id: '4', pipeline: 'HeavyBid → Acumatica', bu: 'CST Utilities', status: 'failed', records: 12, errors: 3, duration: 3, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
  { id: '5', pipeline: 'HeavyJob → Acumatica', bu: 'CST Utilities', status: 'success', records: 8, errors: 0, duration: 11, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString() },
]

const MOCK_ERRORS = [
  { run: '4', record: 'HB-2024-0112', error: 'Cost code C-442 not found in Acumatica', severity: 'error' },
  { run: '2', record: 'HJ-LINE-088', error: 'Duplicate employee ID detected', severity: 'warning' },
]

// ── TODO (a): Wire to your SyncStore.query_runs() ───────────────────────────
// Replace the mock returns below with actual DB queries against your SQLite:
//   const runs = await store.queryRuns(limit)
//   return runs.map(r => ({ id: r.id, pipeline: r.pipeline, bu: r.bu, ... }))

app.get('/api/status', async (req, res) => {
  try {
    // TODO: const store = new SyncStore(process.env.DATABASE_PATH)
    // TODO: const pipelines = await store.getPipelineHealth()
    // TODO: res.json(pipelines)
    res.json(MOCK_STATUS)
  } catch (err) {
    console.error('GET /api/status error:', err)
    res.json(MOCK_STATUS)
  }
})

app.get('/api/sync-runs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50')
    // TODO: const runs = await store.queryRuns(limit)
    // TODO: res.json(runs)
    res.json(MOCK_RUNS.slice(0, limit))
  } catch (err) {
    console.error('GET /api/sync-runs error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/sync-errors', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50')
    // TODO: const errors = await store.queryErrors(limit)
    // TODO: res.json(errors)
    res.json(MOCK_ERRORS.slice(0, limit))
  } catch (err) {
    console.error('GET /api/sync-errors error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── TODO (d): Wire MCP tool definitions from src/mcp/server.ts ──────────────
// Add your MCP tool schemas here. Example:
//
// const MCP_TOOLS = [
//   {
//     name: 'query_hcss_projects',
//     description: 'Query HCSS HeavyBid/HeavyJob projects',
//     input_schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] }
//   },
//   ...
// ]

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

app.post('/api/chat', async (req, res) => {
  const { message } = req.body
  if (!message) return res.status(400).json({ error: 'message is required' })

  if (!ANTHROPIC_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured. Add it to your .env file.' })
  }

  try {
    // TODO (d): Add your MCP tool definitions here.
    // const tools = MCP_TOOLS  // ← wire your real tools

    const tools = [] // placeholder until MCP tools are wired

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        tools,
        messages: [
          {
            role: 'user',
            content: message
          }
        ]
      })
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error('Anthropic error:', response.status, errBody)
      return res.status(502).json({ error: `Anthropic API error: ${response.status}` })
    }

    const data = await response.json()

    // Handle tool_use — execute locally then return result to Anthropic
    if (data.stop_reason === 'tool_use') {
      const toolResult = await handleToolCall(data.content, tools)
      // Continue conversation with tool result
      const followUp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 1024,
          tools,
          messages: [
            { role: 'user', content: message },
            { role: 'assistant', content: data.content },
            { role: 'user', content: toolResult }
          ]
        })
      })
      const followData = await followUp.json()
      return res.json({ content: followData.content?.[0]?.text || 'No response.' })
    }

    const text = data.content?.[0]?.text
    res.json({ content: text || 'No response.' })
  } catch (err) {
    console.error('POST /api/chat error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── Tool call handler (TODO: wire to real MCP functions) ────────────────────
// TODO (d): Replace this switch with your actual MCP tool implementations:
//
// switch (tool_name) {
//   case 'query_hcss_projects':
//     const projects = await hcssClient.queryProjects(args.status)
//     return formatToolResult(projects)
//   case 'query_acumatica_jobs':
//     const jobs = await acumaticaClient.queryJobs(args)
//     return formatToolResult(jobs)
//   ...
// }

async function handleToolCall(content, tools) {
  const toolUses = content.filter(b => b.type === 'tool_use')
  if (!toolUses.length) return ''

  const results = []
  for (const use of toolUses) {
    const { name, input } = use
    console.log(`[Bridge MCP] Tool call: ${name}`, input)

    // TODO: Wire to real functions
    let result = `{ "note": "MCP tool '${name}' is not yet wired. Wire it in src/api/server.ts handleToolCall()." }`

    // Example wiring (commented out until SyncStore is available):
    // switch (name) {
    //   case 'query_hcss_projects':
    //     result = await store.queryHcssProjects(input.status)
    //     break
    //   case 'query_acumatica_cost_codes':
    //     result = await store.queryAcumaticaCostCodes(input.bu)
    //     break
    // }

    results.push({
      type: 'tool_result',
      tool_use_id: use.id,
      content: typeof result === 'string' ? result : JSON.stringify(result)
    })
  }

  return results.map(r =>
    `Tool: ${r.tool_use_id}\nResult: ${r.content}`
  ).join('\n\n')
}

// ── Health check ────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

// ── Static file serving (production) ───────────────────────────────────────
// In production, Express serves the built React app:
// app.use(express.static(process.env.WEB_DIST || 'web/dist'))

// ── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[Bridge API] Listening on http://localhost:${PORT}`)
  console.log(`[Bridge API] WEB_PORT=${PORT}, ANTHROPIC_API_KEY=${ANTHROPIC_KEY ? '✓ set' : '✗ MISSING'}`)
})
