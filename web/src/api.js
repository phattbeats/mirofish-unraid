const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  getStatus: () => request('/status'),
  getSyncRuns: (limit = 50) => request(`/sync-runs?limit=${limit}`),
  getSyncErrors: (limit = 50) => request(`/sync-errors?limit=${limit}`),
  postChat: (body) => request('/chat', { method: 'POST', body: JSON.stringify(body) })
}
