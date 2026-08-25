CREATE TABLE grocery_list_new (
  id TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,
  quantity REAL,
  source TEXT NOT NULL CHECK (source IN ('planned', 'manual', 'voice')),
  walmart_item_id TEXT,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO grocery_list_new SELECT * FROM grocery_list;

DROP TABLE grocery_list;

ALTER TABLE grocery_list_new RENAME TO grocery_list;
