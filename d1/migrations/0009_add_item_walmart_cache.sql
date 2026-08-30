CREATE TABLE item_walmart_cache (
  item_name TEXT PRIMARY KEY,
  walmart_item_id TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
