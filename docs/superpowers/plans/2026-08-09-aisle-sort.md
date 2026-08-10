# Aisle-Sort Grocery List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Let's go shopping" button to the Grocery List screen that sorts the list into the confirmed real-world walking order of the Shreveport Mansfield Rd Supercenter, using a Claude API call to match item names to aisles.

**Architecture:** Two new D1 tables (`aisle_directory`, `item_aisle_cache`) seeded with the confirmed store data via migration. Three new/extended Next.js API routes wire a pure-function matching/sorting core (in `lib/`) to D1 and to a raw `fetch` call against the Anthropic Messages API. Two UI changes: the Grocery List page gains sort/unmatched-picker behavior, and a new Edit Aisle Order page lets the walking order be adjusted later.

**Tech Stack:** Next.js 14 App Router, Cloudflare D1 (via `lib/d1.ts`'s `d1Query` helper — no ORM), TypeScript, Tailwind CSS, Vitest, raw `fetch` against the Anthropic Messages API (no SDK dependency, matching the codebase's existing zero-dependency style).

## Global Constraints

- Database access goes through `d1Query<T>(sql, params)` from `lib/d1.ts` — no other DB client.
- New row IDs are generated app-side with `randomUUID()` from `crypto`, except in raw SQL migrations, which use SQLite's `lower(hex(randomblob(16)))`.
- API routes live under `app/api/**/route.ts` and export `GET`/`POST`/`PUT` functions per existing convention (see `app/api/recipes/route.ts`).
- Path alias `@/` maps to the repo root (`tsconfig.json`, `vitest.config.ts`).
- Tests live in `__tests__/*.test.ts`, run via `npm test` (Vitest). Only pure-function logic gets automated tests, per the base spec's testing philosophy — no tests for simple CRUD routes/screens.
- UI is phone-only, Tailwind, pink-600 accent (`bg-pink-600` / `text-pink-600`), `"use client"` function components using `useState`/`useEffect` + `fetch` (see `app/grocery-list/page.tsx`).
- Claude API: model `claude-haiku-4-5`, endpoint `https://api.anthropic.com/v1/messages`, header `anthropic-version: 2023-06-01`, `ANTHROPIC_API_KEY` read from `process.env` (already present in `.env.local.example`). Called via raw `fetch`, no Anthropic SDK — matches the project's existing pattern of zero extra HTTP-client dependencies (see `lib/d1.ts`, `app/api/recipes/import/route.ts`).
- Migrations are numbered sequentially in `d1/migrations/` (existing files: `0002`, `0003`); `d1/schema.sql` is kept as the canonical full current schema (existing migrations were folded back into it) as well as being applied via `d1/migrations/`.
- Full spec: `docs/superpowers/specs/2026-08-09-aisle-sort-design.md`.

---

### Task 1: Aisle directory & item-cache schema

**Files:**
- Modify: `d1/schema.sql`
- Create: `d1/migrations/0004_add_aisle_directory.sql`
- Modify: `lib/types.ts`

**Interfaces:**
- Produces: `AisleDirectoryEntry { id: string; code: string; categories: string; walk_order: number | null }` and `ItemAisleCacheEntry { item_name: string; aisle_directory_id: string; matched_by: "ai" | "manual"; matched_at: string }`, exported from `lib/types.ts`, used by every later task.

- [ ] **Step 1: Add the migration file**

```sql
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
```

Save as `d1/migrations/0004_add_aisle_directory.sql`.

- [ ] **Step 2: Add the same tables to `d1/schema.sql`**

Append to the end of `d1/schema.sql` (after the existing `grocery_list` table):

```sql

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
```

- [ ] **Step 3: Add TypeScript types**

In `lib/types.ts`, append:

```typescript
export interface AisleDirectoryEntry {
  id: string;
  code: string;
  categories: string;
  walk_order: number | null;
}

export interface ItemAisleCacheEntry {
  item_name: string;
  aisle_directory_id: string;
  matched_by: "ai" | "manual";
  matched_at: string;
}
```

- [ ] **Step 4: Apply the migration to the remote D1 database**

Run (this is a live production database — confirm with the user before running):

```bash
npx wrangler d1 execute grocery-meal-planner --remote --file=./d1/migrations/0004_add_aisle_directory.sql
```

Verify the tables exist:

```bash
npx wrangler d1 execute grocery-meal-planner --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('aisle_directory','item_aisle_cache')"
```

Expected: both table names returned.

- [ ] **Step 5: Commit**

```bash
git add d1/schema.sql d1/migrations/0004_add_aisle_directory.sql lib/types.ts
git commit -m "Add aisle_directory and item_aisle_cache tables"
```

---

### Task 2: Seed the confirmed store data

**Files:**
- Create: `d1/migrations/0005_seed_aisle_directory.sql`

**Interfaces:**
- Consumes: `aisle_directory` table from Task 1.
- Produces: 49 populated `aisle_directory` rows (25 with a `walk_order` 1–25, 24 with `walk_order = NULL`) that Tasks 6–10 read.

- [ ] **Step 1: Write the seed migration**

Save as `d1/migrations/0005_seed_aisle_directory.sql`:

```sql
-- Confirmed walking route (entrance to exit), walk_order 1-25
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'DELI', '', 1);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'FRESH PRODUCE', '', 2);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'AB1', 'Bread/Bakery', 3);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A1', 'Fresh Vegetables', 4);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A2-A3', 'Waffles, Potatoes, Ice Cream, Frozen Breakfast', 5);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A4-A5', 'Frozen Pizza, Frozen Meals, Frozen Snacks', 6);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A6-A7', 'Candy, Frozen Vegetables', 7);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A8-A9', 'Pasta, Condiments, Canned Beans, Canned Vegetables', 8);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A10-A11', 'Soup, Rice & Beans, Canned Meat, International Foods', 9);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A12-A13', 'Spices, Baking, Shortening, Cake Mixes', 10);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A14-A15', 'Bread, Coffee, Snack Cakes, Canned Fruit', 11);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A16-A17', 'Granola & Snack Bars, Cereals, Syrup & Pancake Mix', 12);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A18-A19', 'Cookies, Popcorn, Crackers', 13);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A20-A21', 'Juice, Soft Drink', 14);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A22-A23', 'Trash Bags, Paper Goods, Paper Towels, Plastic Wraps', 15);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A24-A25', 'Insecticides, Mops & Brooms, Bathroom Tissue, All Purpose Cleaners', 16);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A26-A27', 'Bleach, Air Fresheners, Dish Detergent, Laundry', 17);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A28', 'Yogurt, Butter', 18);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A35, A29, A31, A33', 'Snacks, Beverages, Alcohol', 19);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A37', 'Milk, Creamer, Eggs, Juice', 20);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A39', 'Dairy, Cheese, Lunch', 21);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'AC3', 'Meats', 22);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A39', 'Breakfast, Poultry, Pork, Beef', 23);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'AC1', 'Meats', 24);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'A41', 'Seafood', 25);

-- Labeled, unordered (non-grocery departments) - walk_order left NULL
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'AUTO', '', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'I5', 'HOME', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), '', 'FURNITURE', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), '', 'LAUNDRY', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'H7', 'CRAFTS', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'E1 - E15', 'GIRLS', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'H1', 'ELECTRONICS', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), '', 'BEDDING', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), '', 'KITCHEN', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'H1 - H10', 'BATH & SHOWER', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'G1-G5', 'PHARMACY', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'E16 - E30', 'BOYS', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'D23 - D33', 'SHOES', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'GD1 - D25', 'MENS', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'G1 - G30', 'PERSONAL CARE', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'C15 - C25', 'BABY', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'B25 - B35', 'INTIMATES', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), '', 'ANIMAL PRODUCTS', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'C9 - C15', 'BABY', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'B1 - B13', '', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'B39-B47', 'WOMENS', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'B55 - B69', 'SHOES', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'B49 - B61', 'JEWELRY', NULL);
INSERT INTO aisle_directory (id, code, categories, walk_order) VALUES (lower(hex(randomblob(16))), 'B15-B37', 'WOMENS', NULL);
```

- [ ] **Step 2: Apply the migration to the remote D1 database**

```bash
npx wrangler d1 execute grocery-meal-planner --remote --file=./d1/migrations/0005_seed_aisle_directory.sql
```

- [ ] **Step 3: Verify the seed**

```bash
npx wrangler d1 execute grocery-meal-planner --remote --command="SELECT COUNT(*) AS total, COUNT(walk_order) AS ordered FROM aisle_directory"
```

Expected: `total = 49`, `ordered = 25`.

- [ ] **Step 4: Commit**

```bash
git add d1/migrations/0005_seed_aisle_directory.sql
git commit -m "Seed aisle_directory with confirmed store walking order"
```

---

### Task 3: Item-name normalization and Claude prompt/response parsing (pure functions)

**Files:**
- Create: `lib/aisleMatcher.ts`
- Test: `__tests__/aisleMatcher.test.ts`

**Interfaces:**
- Consumes: `AisleDirectoryEntry` from `lib/types.ts` (Task 1).
- Produces: `normalizeItemName(name: string): string`, `buildMatchPrompt(itemNames: string[], directory: AisleDirectoryEntry[]): string`, `parseMatchResponse(rawText: string, itemNames: string[], directory: AisleDirectoryEntry[]): Record<string, string | null>` — all exported from `lib/aisleMatcher.ts`. Task 4 adds `matchItemsToAisles` to this same file, consuming `buildMatchPrompt` and `parseMatchResponse`. Task 5 and Task 8 consume `normalizeItemName`.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/aisleMatcher.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { normalizeItemName, buildMatchPrompt, parseMatchResponse } from "@/lib/aisleMatcher";
import type { AisleDirectoryEntry } from "@/lib/types";

const directory: AisleDirectoryEntry[] = [
  { id: "aisle-a2", code: "A2-A3", categories: "Waffles, Potatoes, Ice Cream, Frozen Breakfast", walk_order: 5 },
  { id: "aisle-a37", code: "A37", categories: "Milk, Creamer, Eggs, Juice", walk_order: 20 },
];

describe("normalizeItemName", () => {
  it("trims and lowercases", () => {
    expect(normalizeItemName("  Milk  ")).toBe("milk");
  });

  it("treats different-case names as the same normalized value", () => {
    expect(normalizeItemName("EGGS")).toBe(normalizeItemName("eggs"));
  });
});

describe("buildMatchPrompt", () => {
  it("includes every item name and every directory entry", () => {
    const prompt = buildMatchPrompt(["milk", "batteries"], directory);
    expect(prompt).toContain("milk");
    expect(prompt).toContain("batteries");
    expect(prompt).toContain("aisle-a2");
    expect(prompt).toContain("A2-A3");
    expect(prompt).toContain("aisle-a37");
  });
});

describe("parseMatchResponse", () => {
  it("maps item names to aisle ids from valid JSON", () => {
    const raw = '{"milk": "aisle-a37", "batteries": null}';
    const result = parseMatchResponse(raw, ["milk", "batteries"], directory);
    expect(result).toEqual({ milk: "aisle-a37", batteries: null });
  });

  it("extracts JSON from surrounding markdown code fences", () => {
    const raw = '```json\n{"milk": "aisle-a37"}\n```';
    const result = parseMatchResponse(raw, ["milk"], directory);
    expect(result).toEqual({ milk: "aisle-a37" });
  });

  it("returns null for every item on malformed JSON instead of throwing", () => {
    const raw = "{not valid json";
    const result = parseMatchResponse(raw, ["milk", "eggs"], directory);
    expect(result).toEqual({ milk: null, eggs: null });
  });

  it("returns null for an aisle id that isn't in the directory", () => {
    const raw = '{"milk": "not-a-real-aisle-id"}';
    const result = parseMatchResponse(raw, ["milk"], directory);
    expect(result).toEqual({ milk: null });
  });

  it("returns null for an item name missing from the response", () => {
    const raw = '{"milk": "aisle-a37"}';
    const result = parseMatchResponse(raw, ["milk", "eggs"], directory);
    expect(result).toEqual({ milk: "aisle-a37", eggs: null });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- aisleMatcher`
Expected: FAIL — `lib/aisleMatcher.ts` does not exist / exports not found.

- [ ] **Step 3: Implement the pure functions**

Create `lib/aisleMatcher.ts`:

```typescript
import type { AisleDirectoryEntry } from "./types";

export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase();
}

export function buildMatchPrompt(itemNames: string[], directory: AisleDirectoryEntry[]): string {
  const directoryLines = directory
    .map((a) => `${a.id}: ${a.code} — ${a.categories || "(no listed categories)"}`)
    .join("\n");
  const itemLines = itemNames.map((n) => `- ${n}`).join("\n");
  return `You are matching grocery list items to store aisles for a Walmart Supercenter.

Aisles (id: code — categories):
${directoryLines}

Items to match:
${itemLines}

Respond with ONLY a JSON object mapping each item name exactly as given above to the id of its single best-matching aisle, or null if none of the aisles are a confident match. Do not include any text outside the JSON object.

Example: {"milk": "${directory[0]?.id ?? "aisle-id"}", "batteries": null}`;
}

export function parseMatchResponse(
  rawText: string,
  itemNames: string[],
  directory: AisleDirectoryEntry[]
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const name of itemNames) result[name] = null;

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return result;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return result;
  }
  if (!parsed || typeof parsed !== "object") return result;

  const validIds = new Set(directory.map((a) => a.id));
  for (const name of itemNames) {
    const value = (parsed as Record<string, unknown>)[name];
    if (typeof value === "string" && validIds.has(value)) {
      result[name] = value;
    }
  }
  return result;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- aisleMatcher`
Expected: PASS (all tests in `aisleMatcher.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add lib/aisleMatcher.ts __tests__/aisleMatcher.test.ts
git commit -m "Add item-name normalization and Claude match prompt/response parsing"
```

---

### Task 4: Claude batch-matching network call

**Files:**
- Modify: `lib/aisleMatcher.ts`
- Test: `__tests__/aisleMatcher.test.ts`

**Interfaces:**
- Consumes: `buildMatchPrompt`, `parseMatchResponse` from Task 3 (same file).
- Produces: `matchItemsToAisles(itemNames: string[], directory: AisleDirectoryEntry[]): Promise<Record<string, string | null>>`, exported from `lib/aisleMatcher.ts`. Task 8 consumes this.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/aisleMatcher.test.ts`:

```typescript
import { vi, beforeEach, afterEach } from "vitest";
import { matchItemsToAisles } from "@/lib/aisleMatcher";

describe("matchItemsToAisles", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("returns an empty object immediately for an empty item list", async () => {
    const result = await matchItemsToAisles([], directory);
    expect(result).toEqual({});
  });

  it("calls the Anthropic Messages API with the expected shape and parses the reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: '{"milk": "aisle-a37"}' }],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await matchItemsToAisles(["milk"], directory);

    expect(result).toEqual({ milk: "aisle-a37" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(options.method).toBe("POST");
    expect(options.headers["x-api-key"]).toBe("test-key");
    expect(options.headers["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(options.body);
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body.messages[0].content).toContain("milk");
  });

  it("returns null for every item when the API call fails, instead of throwing", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    const result = await matchItemsToAisles(["milk", "eggs"], directory);
    expect(result).toEqual({ milk: null, eggs: null });
  });

  it("returns null for every item when the network call throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const result = await matchItemsToAisles(["milk"], directory);
    expect(result).toEqual({ milk: null });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- aisleMatcher`
Expected: FAIL — `matchItemsToAisles` is not exported.

- [ ] **Step 3: Implement the network call**

Append to `lib/aisleMatcher.ts`:

```typescript
export async function matchItemsToAisles(
  itemNames: string[],
  directory: AisleDirectoryEntry[]
): Promise<Record<string, string | null>> {
  if (itemNames.length === 0) return {};

  const emptyResult = () => {
    const empty: Record<string, string | null> = {};
    for (const name of itemNames) empty[name] = null;
    return empty;
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return emptyResult();

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: buildMatchPrompt(itemNames, directory) }],
      }),
    });

    if (!res.ok) return emptyResult();

    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = json.content?.find((c) => c.type === "text")?.text ?? "";
    return parseMatchResponse(text, itemNames, directory);
  } catch {
    return emptyResult();
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- aisleMatcher`
Expected: PASS (all tests in `aisleMatcher.test.ts`, including the new `matchItemsToAisles` suite).

- [ ] **Step 5: Commit**

```bash
git add lib/aisleMatcher.ts __tests__/aisleMatcher.test.ts
git commit -m "Add Claude batch-matching call for item-to-aisle matching"
```

---

### Task 5: Sort and group grocery-list items by walk order

**Files:**
- Create: `lib/groceryOrder.ts`
- Test: `__tests__/groceryOrder.test.ts`

**Interfaces:**
- Consumes: `normalizeItemName` from `lib/aisleMatcher.ts` (Task 3), `AisleDirectoryEntry` and `GroceryListItem` from `lib/types.ts`.
- Produces: `SortedGroceryItem { item: GroceryListItem; aisle: AisleDirectoryEntry | null }`, `GroupedGroceryList { sorted: SortedGroceryItem[]; unmatched: SortedGroceryItem[] }`, and `sortAndGroupItems(items: GroceryListItem[], aisleByItemName: Map<string, AisleDirectoryEntry>): GroupedGroceryList`, all exported from `lib/groceryOrder.ts`. Task 8 (API route) and Task 9 (UI) consume these.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/groceryOrder.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { sortAndGroupItems } from "@/lib/groceryOrder";
import type { AisleDirectoryEntry, GroceryListItem } from "@/lib/types";

function item(id: string, name: string): GroceryListItem {
  return { id, item_name: name, quantity: null, source: "manual", walmart_item_id: null, added_at: "2026-08-09" };
}

function aisle(id: string, walk_order: number | null): AisleDirectoryEntry {
  return { id, code: `code-${id}`, categories: "", walk_order };
}

describe("sortAndGroupItems", () => {
  it("orders matched items ascending by the matched aisle's walk_order", () => {
    const items = [item("1", "Seafood item"), item("2", "Deli item")];
    const seafood = aisle("a41", 25);
    const deli = aisle("deli", 1);
    const aisleByItemName = new Map([
      ["seafood item", seafood],
      ["deli item", deli],
    ]);

    const result = sortAndGroupItems(items, aisleByItemName);

    expect(result.sorted.map((s) => s.item.id)).toEqual(["2", "1"]);
    expect(result.unmatched).toEqual([]);
  });

  it("groups an item matched to a null-walk_order aisle into unmatched", () => {
    const items = [item("1", "Auto item")];
    const auto = aisle("auto", null);
    const aisleByItemName = new Map([["auto item", auto]]);

    const result = sortAndGroupItems(items, aisleByItemName);

    expect(result.sorted).toEqual([]);
    expect(result.unmatched).toEqual([{ item: items[0], aisle: auto }]);
  });

  it("groups an item with no cache entry into unmatched with a null aisle", () => {
    const items = [item("1", "Mystery item")];
    const result = sortAndGroupItems(items, new Map());

    expect(result.sorted).toEqual([]);
    expect(result.unmatched).toEqual([{ item: items[0], aisle: null }]);
  });

  it("normalizes item name casing/whitespace when looking up the cache", () => {
    const items = [item("1", "  Milk  ")];
    const milkAisle = aisle("a37", 20);
    const aisleByItemName = new Map([["milk", milkAisle]]);

    const result = sortAndGroupItems(items, aisleByItemName);

    expect(result.sorted).toEqual([{ item: items[0], aisle: milkAisle }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- groceryOrder`
Expected: FAIL — `lib/groceryOrder.ts` does not exist.

- [ ] **Step 3: Implement the sort/group logic**

Create `lib/groceryOrder.ts`:

```typescript
import { normalizeItemName } from "./aisleMatcher";
import type { AisleDirectoryEntry, GroceryListItem } from "./types";

export interface SortedGroceryItem {
  item: GroceryListItem;
  aisle: AisleDirectoryEntry | null;
}

export interface GroupedGroceryList {
  sorted: SortedGroceryItem[];
  unmatched: SortedGroceryItem[];
}

export function sortAndGroupItems(
  items: GroceryListItem[],
  aisleByItemName: Map<string, AisleDirectoryEntry>
): GroupedGroceryList {
  const sorted: SortedGroceryItem[] = [];
  const unmatched: SortedGroceryItem[] = [];

  for (const item of items) {
    const aisle = aisleByItemName.get(normalizeItemName(item.item_name)) ?? null;
    if (aisle && aisle.walk_order !== null) {
      sorted.push({ item, aisle });
    } else {
      unmatched.push({ item, aisle });
    }
  }

  sorted.sort((a, b) => (a.aisle!.walk_order as number) - (b.aisle!.walk_order as number));

  return { sorted, unmatched };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- groceryOrder`
Expected: PASS (all tests in `groceryOrder.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add lib/groceryOrder.ts __tests__/groceryOrder.test.ts
git commit -m "Add sort/group logic for aisle-ordered grocery list"
```

---

### Task 6: Aisle directory list + reorder API route

**Files:**
- Create: `app/api/aisle-directory/route.ts`

**Interfaces:**
- Consumes: `d1Query` from `lib/d1.ts`, `AisleDirectoryEntry` from `lib/types.ts`.
- Produces: `GET /api/aisle-directory` → `AisleDirectoryEntry[]` (ordered rows first by `walk_order`, then unordered rows, ties broken by `code`). `PUT /api/aisle-directory` with body `{ orderedIds: string[]; unorderedIds: string[] }` → re-numbers `walk_order` 1..N for `orderedIds` in array order, sets `walk_order = NULL` for `unorderedIds`, returns the refreshed `AisleDirectoryEntry[]`. Consumed by Task 9 (Unmatched picker) and Task 10 (Edit Aisle Order page).

- [ ] **Step 1: Implement the route**

Create `app/api/aisle-directory/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import type { AisleDirectoryEntry } from "@/lib/types";

async function listDirectory(): Promise<AisleDirectoryEntry[]> {
  return d1Query<AisleDirectoryEntry>(
    "SELECT * FROM aisle_directory ORDER BY walk_order IS NULL, walk_order ASC, code ASC"
  );
}

export async function GET() {
  const rows = await listDirectory();
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const { orderedIds, unorderedIds } = await req.json();
  if (!Array.isArray(orderedIds) || !Array.isArray(unorderedIds)) {
    return NextResponse.json(
      { error: "orderedIds and unorderedIds must be arrays" },
      { status: 400 }
    );
  }

  for (let i = 0; i < orderedIds.length; i++) {
    await d1Query("UPDATE aisle_directory SET walk_order = ? WHERE id = ?", [i + 1, orderedIds[i]]);
  }
  for (const id of unorderedIds) {
    await d1Query("UPDATE aisle_directory SET walk_order = NULL WHERE id = ?", [id]);
  }

  const rows = await listDirectory();
  return NextResponse.json(rows);
}
```

- [ ] **Step 2: Manually verify against the dev server**

Run: `npm run dev`, then in another terminal:

```bash
curl http://localhost:3000/api/aisle-directory
```

Expected: JSON array of 49 objects, the first 25 having ascending `walk_order` 1–25, the rest `walk_order: null`.

- [ ] **Step 3: Commit**

```bash
git add app/api/aisle-directory/route.ts
git commit -m "Add aisle directory list and reorder API route"
```

---

### Task 7: Manual item-to-aisle pick API route

**Files:**
- Create: `app/api/item-aisle-cache/route.ts`

**Interfaces:**
- Consumes: `d1Query` from `lib/d1.ts`, `normalizeItemName` from `lib/aisleMatcher.ts`, `ItemAisleCacheEntry` from `lib/types.ts`.
- Produces: `POST /api/item-aisle-cache` with body `{ item_name: string; aisle_directory_id: string }` → upserts `item_aisle_cache` with `matched_by = 'manual'`, returns the `ItemAisleCacheEntry`. Consumed by Task 9 (Unmatched picker).

- [ ] **Step 1: Implement the route**

Create `app/api/item-aisle-cache/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import { normalizeItemName } from "@/lib/aisleMatcher";
import type { ItemAisleCacheEntry } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { item_name, aisle_directory_id } = await req.json();
  if (!item_name || !aisle_directory_id) {
    return NextResponse.json(
      { error: "item_name and aisle_directory_id are required" },
      { status: 400 }
    );
  }

  const normalized = normalizeItemName(item_name);
  const [entry] = await d1Query<ItemAisleCacheEntry>(
    `INSERT INTO item_aisle_cache (item_name, aisle_directory_id, matched_by)
     VALUES (?, ?, 'manual')
     ON CONFLICT(item_name) DO UPDATE SET
       aisle_directory_id = excluded.aisle_directory_id,
       matched_by = 'manual',
       matched_at = datetime('now')
     RETURNING *`,
    [normalized, aisle_directory_id]
  );

  return NextResponse.json(entry);
}
```

- [ ] **Step 2: Manually verify against the dev server**

With the dev server running, pick a real `id` from `GET /api/aisle-directory`'s output, then:

```bash
curl -X POST http://localhost:3000/api/item-aisle-cache \
  -H "Content-Type: application/json" \
  -d '{"item_name": "Test Item", "aisle_directory_id": "<paste an id here>"}'
```

Expected: JSON object with `item_name: "test item"`, the given `aisle_directory_id`, and `matched_by: "manual"`.

- [ ] **Step 3: Commit**

```bash
git add app/api/item-aisle-cache/route.ts
git commit -m "Add manual item-to-aisle pick API route"
```

---

### Task 8: "Let's go shopping" batch-match-and-sort API route

**Files:**
- Create: `app/api/grocery-list/shop/route.ts`

**Interfaces:**
- Consumes: `d1Query` from `lib/d1.ts`; `normalizeItemName`, `matchItemsToAisles` from `lib/aisleMatcher.ts`; `sortAndGroupItems` from `lib/groceryOrder.ts`; `AisleDirectoryEntry`, `GroceryListItem`, `ItemAisleCacheEntry` from `lib/types.ts`.
- Produces: `POST /api/grocery-list/shop` → `GroupedGroceryList` (see Task 5). Consumed by Task 9 (Grocery List page).

- [ ] **Step 1: Implement the route**

Create `app/api/grocery-list/shop/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import { normalizeItemName, matchItemsToAisles } from "@/lib/aisleMatcher";
import { sortAndGroupItems } from "@/lib/groceryOrder";
import type { AisleDirectoryEntry, GroceryListItem, ItemAisleCacheEntry } from "@/lib/types";

export async function POST() {
  const items = await d1Query<GroceryListItem>("SELECT * FROM grocery_list");
  const directory = await d1Query<AisleDirectoryEntry>("SELECT * FROM aisle_directory");
  const cacheRows = await d1Query<ItemAisleCacheEntry>("SELECT * FROM item_aisle_cache");

  const directoryById = new Map(directory.map((a) => [a.id, a]));
  const aisleByItemName = new Map<string, AisleDirectoryEntry>();
  for (const row of cacheRows) {
    const aisle = directoryById.get(row.aisle_directory_id);
    if (aisle) aisleByItemName.set(row.item_name, aisle);
  }

  const uncachedNames = Array.from(
    new Set(
      items
        .map((i) => normalizeItemName(i.item_name))
        .filter((name) => !aisleByItemName.has(name))
    )
  );

  if (uncachedNames.length > 0) {
    const matches = await matchItemsToAisles(uncachedNames, directory);
    for (const name of uncachedNames) {
      const aisleId = matches[name];
      if (!aisleId) continue;
      const aisle = directoryById.get(aisleId);
      if (!aisle) continue;
      aisleByItemName.set(name, aisle);
      await d1Query(
        `INSERT INTO item_aisle_cache (item_name, aisle_directory_id, matched_by)
         VALUES (?, ?, 'ai')
         ON CONFLICT(item_name) DO UPDATE SET
           aisle_directory_id = excluded.aisle_directory_id,
           matched_by = 'ai',
           matched_at = datetime('now')`,
        [name, aisleId]
      );
    }
  }

  const grouped = sortAndGroupItems(items, aisleByItemName);
  return NextResponse.json(grouped);
}
```

- [ ] **Step 2: Manually verify against the dev server**

With the dev server running, add a couple of items via the existing Grocery List UI (e.g. "Milk", "Bath Towels"), then:

```bash
curl -X POST http://localhost:3000/api/grocery-list/shop
```

Expected: JSON with a `sorted` array (items matched to a walk-ordered aisle, e.g. "Milk" → the A37 aisle) and an `unmatched` array (items with no confident match, e.g. "Bath Towels" if it doesn't match a directory entry). Re-running the same command should return the same result without materially changing latency (cache hit — no new Claude call for already-matched names).

- [ ] **Step 3: Commit**

```bash
git add app/api/grocery-list/shop/route.ts
git commit -m "Add batch item-to-aisle matching and sort API route"
```

---

### Task 9: Grocery List page — "Let's go shopping" and Unmatched picker

**Files:**
- Modify: `app/grocery-list/page.tsx`

**Interfaces:**
- Consumes: `GroupedGroceryList`, `SortedGroceryItem` from `lib/groceryOrder.ts`; `AisleDirectoryEntry` from `lib/types.ts`; `POST /api/grocery-list/shop` (Task 8), `POST /api/item-aisle-cache` (Task 7), `GET /api/aisle-directory` (Task 6).

- [ ] **Step 1: Update the page**

Replace the contents of `app/grocery-list/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import type { AisleDirectoryEntry, GroceryListItem } from "@/lib/types";
import type { GroupedGroceryList } from "@/lib/groceryOrder";

export default function GroceryListPage() {
  const [items, setItems] = useState<GroceryListItem[]>([]);
  const [itemName, setItemName] = useState("");
  const [loading, setLoading] = useState(true);
  const [grouped, setGrouped] = useState<GroupedGroceryList | null>(null);
  const [sorting, setSorting] = useState(false);
  const [aisleOptions, setAisleOptions] = useState<AisleDirectoryEntry[]>([]);

  useEffect(() => {
    fetch("/api/grocery-list")
      .then((r) => r.json())
      .then((data) => {
        setItems(data);
        setLoading(false);
      });
  }, []);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const name = itemName.trim();
    if (!name) return;
    const res = await fetch("/api/grocery-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_name: name }),
    });
    const item = await res.json();
    setItems((prev) => [item, ...prev]);
    setGrouped(null);
    setItemName("");
  }

  async function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setGrouped((prev) =>
      prev
        ? {
            sorted: prev.sorted.filter((g) => g.item.id !== id),
            unmatched: prev.unmatched.filter((g) => g.item.id !== id),
          }
        : null
    );
    await fetch(`/api/grocery-list/${id}`, { method: "DELETE" });
  }

  async function handleShop() {
    setSorting(true);
    const res = await fetch("/api/grocery-list/shop", { method: "POST" });
    const data: GroupedGroceryList = await res.json();
    setGrouped(data);
    if (data.unmatched.length > 0 && aisleOptions.length === 0) {
      const dirRes = await fetch("/api/aisle-directory");
      setAisleOptions(await dirRes.json());
    }
    setSorting(false);
  }

  async function handlePickAisle(name: string, aisleDirectoryId: string) {
    await fetch("/api/item-aisle-cache", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_name: name, aisle_directory_id: aisleDirectoryId }),
    });
    await handleShop();
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">Grocery List</h1>
      <form onSubmit={addItem} className="flex gap-2 mb-4">
        <input
          className="flex-1 border rounded p-2"
          placeholder="Add an item..."
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
        />
        <button type="submit" className="px-3 py-2 rounded bg-pink-600 text-white text-sm">
          Add
        </button>
      </form>

      {!loading && items.length > 0 && (
        <button
          onClick={handleShop}
          disabled={sorting}
          className="w-full px-3 py-2 rounded bg-pink-600 text-white text-sm mb-4 disabled:opacity-50"
        >
          {sorting ? "Sorting..." : "Let's go shopping"}
        </button>
      )}

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && items.length === 0 && (
        <p className="text-gray-500">Your list is empty. Add something above.</p>
      )}

      {!loading && items.length > 0 && !grouped && (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                className="h-5 w-5 accent-pink-600"
                onChange={() => removeItem(item.id)}
              />
              <span className="flex-1">{item.item_name}</span>
              {item.quantity != null && (
                <span className="text-sm text-gray-500">{item.quantity}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {grouped && (
        <div>
          <ul className="divide-y">
            {grouped.sorted.map(({ item, aisle }) => (
              <li key={item.id} className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-pink-600"
                  onChange={() => removeItem(item.id)}
                />
                <span className="flex-1">{item.item_name}</span>
                <span className="text-xs text-gray-400">{aisle?.code}</span>
              </li>
            ))}
          </ul>

          {grouped.unmatched.length > 0 && (
            <div className="mt-4">
              <h2 className="text-sm font-bold text-gray-500 mb-2">Unmatched</h2>
              <ul className="divide-y">
                {grouped.unmatched.map(({ item }) => (
                  <li key={item.id} className="flex items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-pink-600"
                      onChange={() => removeItem(item.id)}
                    />
                    <span className="flex-1">{item.item_name}</span>
                    <select
                      className="border rounded text-xs p-1"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) handlePickAisle(item.item_name, e.target.value);
                      }}
                    >
                      <option value="" disabled>
                        Pick aisle...
                      </option>
                      {aisleOptions.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.categories}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Manually verify in the browser**

Run: `npm run dev`, open `/grocery-list`.

- Add a couple of grocery items whose names clearly match seeded categories (e.g. "milk", "eggs") and one that won't match anything (e.g. "gift wrap").
- Click "Let's go shopping". Confirm the list re-renders sorted, with an "Unmatched" section at the bottom containing the non-matching item and a working aisle-picker dropdown.
- Pick an aisle from the dropdown for the unmatched item; confirm it moves out of "Unmatched" into the sorted list without a full page reload.
- Check off an item in either view; confirm it's removed from the list and from D1 (`GET /api/grocery-list` no longer includes it).
- Add a new item while the sorted view is showing; confirm the view resets to the plain unsorted list (matching the "unsorted until re-pressed" behavior in the spec).

- [ ] **Step 3: Commit**

```bash
git add app/grocery-list/page.tsx
git commit -m "Add aisle-sorted view and unmatched picker to Grocery List page"
```

---

### Task 10: Edit Aisle Order page

**Files:**
- Create: `app/aisle-order/page.tsx`
- Modify: `app/components/NavBar.tsx`

**Interfaces:**
- Consumes: `AisleDirectoryEntry` from `lib/types.ts`; `GET`/`PUT /api/aisle-directory` (Task 6).

- [ ] **Step 1: Create the page**

Create `app/aisle-order/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import type { AisleDirectoryEntry } from "@/lib/types";

export default function AisleOrderPage() {
  const [route, setRoute] = useState<AisleDirectoryEntry[]>([]);
  const [unordered, setUnordered] = useState<AisleDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/aisle-directory")
      .then((r) => r.json())
      .then((data: AisleDirectoryEntry[]) => {
        setRoute(data.filter((a) => a.walk_order !== null));
        setUnordered(data.filter((a) => a.walk_order === null));
        setLoading(false);
      });
  }, []);

  function moveUp(index: number) {
    if (index === 0) return;
    setRoute((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    setRoute((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function removeFromRoute(id: string) {
    setRoute((prev) => prev.filter((a) => a.id !== id));
    setUnordered((prev) => [...prev, route.find((a) => a.id === id)!]);
  }

  function addToRoute(id: string) {
    setUnordered((prev) => prev.filter((a) => a.id !== id));
    setRoute((prev) => [...prev, unordered.find((a) => a.id === id)!]);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/aisle-directory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderedIds: route.map((a) => a.id),
        unorderedIds: unordered.map((a) => a.id),
      }),
    });
    const data: AisleDirectoryEntry[] = await res.json();
    setRoute(data.filter((a) => a.walk_order !== null));
    setUnordered(data.filter((a) => a.walk_order === null));
    setSaving(false);
  }

  if (loading) return <main className="p-4">Loading...</main>;

  return (
    <main className="p-4 pb-20">
      <h1 className="text-xl font-bold mb-4">Edit Aisle Order</h1>

      <h2 className="text-sm font-bold text-gray-500 mb-2">Route</h2>
      <ul className="divide-y mb-6">
        {route.map((a, i) => (
          <li key={a.id} className="flex items-center gap-2 py-2">
            <span className="flex-1 text-sm">
              {a.code} — {a.categories}
            </span>
            <button
              onClick={() => moveUp(i)}
              className="px-2 py-1 text-xs border rounded"
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              onClick={() => moveDown(i)}
              className="px-2 py-1 text-xs border rounded"
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              onClick={() => removeFromRoute(a.id)}
              className="px-2 py-1 text-xs border rounded text-red-600"
            >
              Remove from route
            </button>
          </li>
        ))}
      </ul>

      <h2 className="text-sm font-bold text-gray-500 mb-2">Unordered</h2>
      <ul className="divide-y mb-6">
        {unordered.map((a) => (
          <li key={a.id} className="flex items-center gap-2 py-2">
            <span className="flex-1 text-sm">
              {a.code} — {a.categories}
            </span>
            <button
              onClick={() => addToRoute(a.id)}
              className="px-2 py-1 text-xs border rounded"
            >
              Add to route
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-3 py-2 rounded bg-pink-600 text-white text-sm disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </main>
  );
}
```

- [ ] **Step 2: Add the nav link**

In `app/components/NavBar.tsx`, update the `LINKS` array:

```typescript
const LINKS = [
  { href: "/", label: "This Week" },
  { href: "/grocery-list", label: "List" },
  { href: "/aisle-order", label: "Aisles" },
  { href: "/history", label: "History" },
  { href: "/recipes", label: "Recipes" },
  { href: "/suggestions", label: "Suggest" },
];
```

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev`, open `/aisle-order`.

- Confirm the "Route" section lists the 25 confirmed aisles in the seeded order (Deli first, Seafood last) and "Unordered" lists the remaining 24.
- Move an item up/down in Route; confirm the on-screen order changes.
- Click "Remove from route" on a Route item; confirm it moves into Unordered.
- Click "Add to route" on an Unordered item; confirm it appends to the bottom of Route.
- Click "Save"; reload the page; confirm the new order and grouping persisted.
- Confirm the "Aisles" tab appears in the bottom nav and is highlighted when active.

- [ ] **Step 4: Commit**

```bash
git add app/aisle-order/page.tsx app/components/NavBar.tsx
git commit -m "Add Edit Aisle Order page and nav link"
```

---

## Self-Review Notes

- **Spec coverage:** `aisle_directory`/`item_aisle_cache` data model (Task 1–2), batched Claude matching (Task 3–4, 8), sort/group with Unmatched fallback (Task 5, 8–9), Unmatched inline picker with permanent caching (Task 7, 9), Edit Aisle Order screen with Route/Unordered groups and Add-to-route/Remove-from-route (Task 10), error handling (Claude failure → empty match map → everything unmatched, Task 4) are all covered. Price/image and non-grocery walk ordering are explicitly out of scope per the spec and are not implemented here.
- **Type consistency:** `AisleDirectoryEntry`/`ItemAisleCacheEntry` (Task 1) are used unchanged through Tasks 3–10. `GroupedGroceryList`/`SortedGroceryItem` (Task 5) are used unchanged by the API route (Task 8) and the page (Task 9). `matchItemsToAisles`'s return shape (`Record<string, string | null>`) matches what Task 8 destructures.
- **Placeholder scan:** no TODOs; every step has runnable code and concrete verification commands.
