CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  page TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
