/**
 * PHATT Bridge API Client
 *
 * All endpoints are relative — in dev, Vite proxies /api/* to localhost:3100.
 * In production, Express serves both the UI and the API on the same port.
 */

const API_BASE = "/api";

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText}: ${body}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      // Network error — API server not running
      return null;
    }
    throw err;
  }
}

/** GET /api/status — overall bridge health */
export async function fetchStatus() {
  return request("/status");
}

/** GET /api/sync-runs?limit=N — recent sync runs */
export async function fetchSyncRuns(limit = 20) {
  return request(`/sync-runs?limit=${limit}`);
}

/** GET /api/sync-errors?limit=N — recent sync errors */
export async function fetchSyncErrors(limit = 20) {
  return request(`/sync-errors?limit=${limit}`);
}

/** POST /api/chat — send a message, get an LLM response */
export async function sendChatMessage(messages) {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
}
