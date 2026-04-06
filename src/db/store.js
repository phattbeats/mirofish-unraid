// src/db/store.js — PHATT Bridge SQLite store stub
// TODO: Replace with the actual phatt-bridge SyncStore implementation.
// The real module should expose query methods matching the server.ts TODOs:
//   store.getLastRun(pipeline) → { status, timestamp, records }
//   store.queryRuns(limit) → [{ id, pipeline, bu, status, records, errors, duration, timestamp }]
//   store.queryErrors(limit) → [{ run, record, error, severity }]

class SyncStore {
  constructor(dbPath) {
    this.dbPath = dbPath;
    console.log(`[Store] Opened: ${dbPath} (stub — no real DB)`);
  }

  getLastRun(pipeline) {
    return { status: 'unknown', timestamp: null, records: 0 };
  }

  queryRuns(limit) {
    return [];
  }

  queryErrors(limit) {
    return [];
  }
}

module.exports = { SyncStore };
