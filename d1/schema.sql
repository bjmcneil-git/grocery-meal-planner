CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual', 'url')),
  source_url TEXT,
  instructions TEXT,
  cuisine TEXT,
  image_url TEXT,
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
  UNIQUE (week_start_date, day_of_week)
);

CREATE TABLE grocery_list (
  id TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,
  quantity REAL,
  source TEXT NOT NULL CHECK (source IN ('planned', 'manual')),
  walmart_item_id TEXT,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);
