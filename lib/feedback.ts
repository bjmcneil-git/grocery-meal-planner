import { d1Query } from "./d1";

// The feedback table creates itself on first use, so notes work without a
// manual migration step. The promise is cached per server instance; a failed
// attempt is cleared so the next request retries.
let ensured: Promise<void> | null = null;

export function ensureFeedbackTable(): Promise<void> {
  if (!ensured) {
    ensured = d1Query(
      `CREATE TABLE IF NOT EXISTS feedback (
         id TEXT PRIMARY KEY,
         message TEXT NOT NULL,
         page TEXT,
         created_at TEXT NOT NULL DEFAULT (datetime('now'))
       )`
    ).then(
      () => undefined,
      (err) => {
        ensured = null;
        throw err;
      }
    );
  }
  return ensured;
}

export function resetFeedbackTableCacheForTests() {
  ensured = null;
}
