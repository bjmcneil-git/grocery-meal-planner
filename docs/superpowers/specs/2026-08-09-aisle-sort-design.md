# Aisle-Sort Grocery List — Design Spec

Date: 2026-08-09
For: Brandon's wife (primary user, phone-only, no login) — same household app as
[2026-07-29-grocery-meal-planner-design.md](2026-07-29-grocery-meal-planner-design.md)

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
- **Matching timing:** items are matched to an aisle in a single batched
  call, triggered by pressing a new "Let's go shopping" button on the Grocery
  List screen — not as each item is added. Matching only matters right before
  a shopping trip, so this minimizes API calls versus matching on every add.
- **Unmatched items:** never block the sort. Any item with no confident match
  (or matched to a department with no confirmed walk order) is grouped at the
  bottom of the sorted list under "Unmatched," where the user taps to pick an
  aisle manually. That pick is cached forever by item name, so it's never
  asked again.
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

- **New external call:** Claude API (text), server-side only, for batched
  item-to-aisle matching. Same pattern as the existing meal-suggestion call in
  the base spec.
- **No new client-side external calls.** The Edit Aisle Order and Unmatched
  picker screens are pure CRUD against D1 through the app's own API routes.

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
     `item_aisle_cache`, and for any item not already cached, sends the
     uncached names plus the full `aisle_directory` (code + categories) to
     Claude in one batched call. Claude returns, per item, either a matching
     `aisle_directory_id` or no match. Confident matches are cached
     (`matched_by = 'ai'`).
   - The list re-renders sorted ascending by `walk_order`. Items whose cached
     aisle has `walk_order IS NULL`, plus any item with no match at all, are
     grouped in an "Unmatched" section at the bottom.
   - Each Unmatched row has a native `<select>` dropdown listing all
     `aisle_directory` entries by code + categories (ordered and unordered
     alike, since a manual pick might legitimately be a non-grocery
     department). Picking one writes
     `item_aisle_cache` with `matched_by = 'manual'` and moves the item into
     its sorted position (or leaves it in Unmatched if the picked aisle also
     has a null `walk_order`).
   - Pressing "Let's go shopping" again later (e.g. after adding more items)
     is idempotent — it only re-matches items not yet in the cache and
     re-sorts the current list.
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

- Claude batch-match call fails or times out: every currently-uncached item
  falls into Unmatched for manual picking; the rest of the list (already
  cached from a prior trip) still sorts and displays normally. Matches the
  existing app's "Claude failure degrades gracefully" pattern from the base
  spec.
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

- **Product images and price**, whether manual entry or web-image-search
  assisted — separate future spec, unrelated to aisle matching/sort order.
- **Walk order for non-grocery departments** — left unordered until/unless
  the user asks for it.
- **Multi-store support** — single store only, no store identifier in the
  schema.
