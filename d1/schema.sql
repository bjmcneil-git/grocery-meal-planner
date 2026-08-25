CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual', 'url')),
  source_url TEXT,
  instructions TEXT,
  cuisine TEXT,
  image_url TEXT,
  cook_time_minutes INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE recipe_ingredients (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  quantity REAL,
  unit TEXT
);

CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  completed_at TEXT NOT NULL DEFAULT (date('now')),
  items TEXT NOT NULL
);

CREATE TABLE weekly_plan (
  id TEXT PRIMARY KEY,
  week_start_date TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  plan_date TEXT,
  UNIQUE (week_start_date, day_of_week)
);

CREATE UNIQUE INDEX idx_weekly_plan_plan_date ON weekly_plan(plan_date);

CREATE TABLE grocery_list (
  id TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,
  quantity REAL,
  source TEXT NOT NULL CHECK (source IN ('planned', 'manual', 'voice')),
  walmart_item_id TEXT,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE aisle_directory (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL DEFAULT '',
  categories TEXT NOT NULL DEFAULT '',
  walk_order INTEGER
);

CREATE TABLE item_aisle_cache (
  item_name TEXT PRIMARY KEY,
  aisle_directory_id TEXT NOT NULL REFERENCES aisle_directory(id),
  matched_by TEXT NOT NULL CHECK (matched_by IN ('ai', 'manual')),
  matched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
