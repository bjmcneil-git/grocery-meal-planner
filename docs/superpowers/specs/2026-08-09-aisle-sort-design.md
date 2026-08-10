# Aisle-Sort Grocery List — Design Spec

Date: 2026-08-09 (revised same day, mid-implementation)
For: Brandon's wife (primary user, phone-only, no login) — same household app as
[2026-07-29-grocery-meal-planner-design.md](2026-07-29-grocery-meal-planner-design.md)

**Revision note:** this spec originally called for a batched Claude API call
to auto-match item names to aisles (see git history for that version). Mid-
implementation, the user clarified they want the app to run at zero ongoing
cost — the Claude API has no free tier, so that call was removed entirely.
Matching is now 100% manual: the first time a new item name is added, the
user picks its aisle once from a dropdown, and that pick is cached forever.
Everything else in this spec (schema, walk order, screens) is unchanged by
that revision except where noted below.

## Purpose

Let the grocery list be sorted into the actual walking order of the Shreveport
Mansfield Rd Supercenter, so a shopping trip goes start to finish through the
store once, with no backtracking. This builds directly on prior groundwork:
the user photographed aisle signage and hand-labeled a floor-plan tool with
aisle codes and contents (see project memory "Walmart Aisle Map"), and has now
walked the store and confirmed the actual walking route.

Walmart exposes no public API for aisle location, price, or product images,
and server-side scraping of walmart.com is blocked by bot detection (confirmed
previously). So the aisle directory is manually curated by the user, not
fetched live — it changes rarely (only when the store rearranges) and is
edited through the app itself once entered.

## Scope Decisions (from clarifying discussion)

- **Store scope:** the aisle directory includes every department the user
  already labeled in the floor-plan tool (grocery side and non-grocery side
  alike — Apparel, Hardlines, Pharmacy, etc.), since some non-grocery items
  (paper towels, batteries) do occasionally end up on the list. Only the
  grocery-side aisles have a confirmed walking order right now; the rest are
  left alone for now with no order assigned.
- **Matching is manual only, cached forever.** No AI/API call of any kind —
  the Claude API has no free tier and the user wants this app to cost
  nothing to run. The first time a given item name appears with no cache
  entry, it shows up in an "Unmatched" group; the user taps to pick its
  aisle once, and that pick is cached by item name permanently. Since a
  household's grocery item names repeat trip to trip, this is a handful of
  one-time taps total, not a recurring chore.
- **Unmatched items never block the sort.** Any item with no cache entry
  (or cached to a department with no confirmed walk order) is grouped at
  the bottom of the sorted list under "Unmatched," where the user taps to
  pick an aisle manually.
- **Reordering:** the confirmed walking order is seeded once via a database
  migration (see Data Model), but the user can also fix it up later in-app
  through a new Edit Aisle Order screen — the store layout confirmed today
  could still be off in a spot, or could change later.
- **Product images / price:** explicitly out of scope for this spec. The user
  asked whether images could be pulled from a general web image search instead
  of manual entry — technically possible via an image-search API, but it's a
  new external dependency with no guarantee of matching the actual
  brand/size purchased, and it doesn't touch aisle-matching or sort order at
  all. Left as a candidate for its own future spec.
- **Multi-store support:** not built. This is a single-household app for one
  physical store; the aisle directory has no store identifier.

## Architecture

Extends the existing grocery-meal-planner Next.js app and Cloudflare D1
database (see base spec's Architecture section — unchanged: Vercel
auto-deploy, server-side-only external calls).

- **No external calls at all.** Matching is manual-only (see Scope
  Decisions), so this feature makes zero calls to Claude or any other
  external API — every screen is pure CRUD against D1 through the app's own
  API routes.

## Data Model (D1, additive to existing schema.sql)

```sql
CREATE TABLE aisle_directory (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
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

- `item_aisle_cache.item_name` is normalized (trimmed, lowercased) before
  lookup or insert, so "Milk" and "milk" share one cache entry. Different
  phrasings of the same product (e.g. "milk" vs "2% milk") are treated as
  distinct items and matched independently — no fuzzy synonym merging.
- `matched_by`'s `'ai'` value is currently unused by the application (no
  code path ever writes it, per the manual-only revision above) — the
  column and its CHECK constraint were kept as-is rather than migrated
  again, so the schema doesn't need to change if AI matching is ever
  revisited later. Every row written by this feature has `matched_by =
  'manual'`.
- `walk_order` is nullable. Null means "no confirmed position" — those aisles
  never appear in the primary sorted sequence; any item matched to one lands
  in the Unmatched group instead.
- A directory row's `code` is a display string, not a unique key — some
  physical sections share a painted code (e.g. two separate "A39" shelf runs
  for different content) and get two directory rows.

### Seed data (migration)

Seeded from the user's floor-plan tool export (2026-08-09) and the walking
route confirmed the same day. Entries with both an empty code and empty
categories in the export were dropped as unfilled placeholders.

**Ordered (confirmed walking route, entrance to exit):**

| walk_order | code | categories |
|---|---|---|
| 1 | DELI | (unlabeled — deli counter) |
| 2 | FRESH PRODUCE | (unlabeled — produce section) |
| 3 | AB1 | Bread/Bakery |
| 4 | A1 | Fresh Vegetables |
| 5 | A2-A3 | Waffles, Potatoes, Ice Cream, Frozen Breakfast |
| 6 | A4-A5 | Frozen Pizza, Frozen Meals, Frozen Snacks |
| 7 | A6-A7 | Candy, Frozen Vegetables |
| 8 | A8-A9 | Pasta, Condiments, Canned Beans, Canned Vegetables |
| 9 | A10-A11 | Soup, Rice & Beans, Canned Meat, International Foods |
| 10 | A12-A13 | Spices, Baking, Shortening, Cake Mixes |
| 11 | A14-A15 | Bread, Coffee, Snack Cakes, Canned Fruit |
| 12 | A16-A17 | Granola & Snack Bars, Cereals, Syrup & Pancake Mix |
| 13 | A18-A19 | Cookies, Popcorn, Crackers |
| 14 | A20-A21 | Juice, Soft Drink |
| 15 | A22-A23 | Trash Bags, Paper Goods, Paper Towels, Plastic Wraps |
| 16 | A24-A25 | Insecticides, Mops & Brooms, Bathroom Tissue, All Purpose Cleaners |
| 17 | A26-A27 | Bleach, Air Fresheners, Dish Detergent, Laundry |
| 18 | A28 | Yogurt, Butter |
| 19 | A35, A29, A31, A33 | Snacks, Beverages, Alcohol |
| 20 | A37 | Milk, Creamer, Eggs, Juice |
| 21 | A39 | Dairy, Cheese, Lunch |
| 22 | AC (AC3) | Meats |
| 23 | A39 | Breakfast, Poultry, Pork, Beef |
| 24 | AC (AC1) | Meats |
| 25 | A41 | Seafood |

**Unordered (labeled, no confirmed walk position — non-grocery side):**
AUTO; I5 — Home; Furniture; Laundry; H7 — Crafts; E1-E15 — Girls; H1 —
Electronics; Bedding; Kitchen; H1-H10 — Bath & Shower; G1-G5 — Pharmacy;
E16-E30 — Boys; D23-D33 — Shoes; GD1-D25 — Mens; G1-G30 — Personal Care;
C15-C25 — Baby; B25-B35 — Intimates; Animal Products; C9-C15 — Baby;
B1-B13; B39-B47 — Womens; B55-B69 — Shoes; B49-B61 — Jewelry; B15-B37 —
Womens.

These seed as `aisle_directory` rows with `walk_order = NULL`.

## Screens

1. **Grocery List (extended)** — adds a "Let's go shopping" button.
   - On press: normalizes every list item's name, looks up
     `item_aisle_cache` for each, and sorts. No API call of any kind —
     this is a read against D1 followed by an in-memory sort.
   - The list re-renders sorted ascending by `walk_order`. Items whose cached
     aisle has `walk_order IS NULL`, plus any item with no cache entry at
     all, are grouped in an "Unmatched" section at the bottom.
   - Each Unmatched row has a native `<select>` dropdown listing all
     `aisle_directory` entries by code + categories (ordered and unordered
     alike, since a manual pick might legitimately be a non-grocery
     department). Picking one writes
     `item_aisle_cache` with `matched_by = 'manual'` and moves the item into
     its sorted position (or leaves it in Unmatched if the picked aisle also
     has a null `walk_order`).
   - Pressing "Let's go shopping" again later (e.g. after adding more items)
     is idempotent — it re-reads the current cache state and re-sorts the
     current list; any newly-added item with no cache entry simply appears
     in Unmatched again until picked.
2. **Edit Aisle Order (new)** — a flat list of all `aisle_directory` rows in
   two groups: "Route" (sorted by current `walk_order`) and "Unordered"
   (everything else), each row showing its code and categories.
   - Rows in the Route group have up/down buttons to move within that group,
     plus a "Remove from route" button that moves the row into Unordered.
   - Rows in the Unordered group have a single "Add to route" button that
     appends the row to the bottom of the Route group.
   - Up/down buttons are used instead of drag-and-drop, which fights page
     scroll on mobile web without a dedicated library.
   - Save re-numbers the Route group's `walk_order` values sequentially
     top to bottom and sets every Unordered row's `walk_order` to null.

## Error Handling

- Item has no cache entry: it falls into Unmatched for manual picking; the
  rest of the list (already cached from a prior pick) still sorts and
  displays normally. There's no external call that can fail here — the
  only failure mode is a D1 read/write error, which surfaces like any other
  CRUD failure elsewhere in the app.
- Directory edited (order changed, or an aisle removed) after items were
  already cached against it: no special handling needed — the cache stores
  `aisle_directory_id`, so edits just change what that aisle's current
  `walk_order` is; nothing needs re-matching.
- Item added to the list after a "Let's go shopping" press: appears
  unsorted/at the end until the button is pressed again.

## Testing Approach

Consistent with the base spec's lightweight approach for a 2-person household
app:

- Targeted automated tests on the sort/grouping logic: matched items ordered
  by `walk_order` ascending, items with null `walk_order` and items with no
  match both land in Unmatched, and item-name normalization (trim/lowercase)
  used for cache lookups.
- Manual browser verification of the "Let's go shopping" flow (cache hit and
  miss paths) and the Edit Aisle Order screen's up/down reordering, driven
  directly in the browser before either is called done.
- No automated tests for the Edit Aisle Order screen's basic CRUD — not
  worth the overhead at this scale, matching the base spec's precedent for
  simple CRUD screens.

## Deferred

- **AI-assisted matching** — dropped, not just deferred, per the revision
  note above (no free tier, user wants zero ongoing cost). Could be
  revisited if the user's cost tolerance changes; the `matched_by` column
  already has an unused `'ai'` value reserved for that case.
- **Product images and price**, whether manual entry or web-image-search
  assisted — separate future spec, unrelated to aisle matching/sort order.
- **Walk order for non-grocery departments** — left unordered until/unless
  the user asks for it.
- **Multi-store support** — single store only, no store identifier in the
  schema.
