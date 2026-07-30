# Grocery & Meal Planner App — Design Spec

Date: 2026-07-29
For: Brandon's wife (primary user, phone-only, no login)

## Purpose

A private web app that helps plan weekly meals, tracks the grocery lists built from
those plans (and any extra items), and suggests meals based on what's been recently
bought. Product data for the grocery list comes from Walmart's public product search
API. Alexa voice control is explicitly out of scope for this phase — see "Deferred"
below.

## Scope Decisions (from clarifying discussion)

- **No real Walmart cart/order integration.** Walmart does not expose a public API
  for reading a consumer's personal order history or driving their cart/checkout.
  The app's "cart" and "order history" are entirely internal concepts: you build a
  list in the app, mark it complete, and it's saved with a date. Actually purchasing
  (delivery, pickup, or in-store) happens separately and is not automated.
- **Walmart's product *search* API is used** (free, public, catalog-only) to populate
  item names/images/prices when adding to the list — legitimate use, no login or
  scraping involved.
- **Recipes** can be entered manually or imported by pasting a URL; the app attempts
  to auto-extract ingredients from the page's structured recipe data (schema.org
  Recipe / JSON-LD), falling back to manual paste if a site doesn't support it.
- **Meal suggestions** are AI-generated (Claude API, server-side call) using recent
  purchase history and saved recipes as context.
- **Weekly planner** auto-adds a recipe's missing ingredients (i.e., not covered by
  recent purchases) to the grocery list when a meal is assigned to a day.
- **Access** is a single private URL, no login/password, matching the pattern of
  other personal apps in this household.
- **Alexa voice integration is deferred to a phase 2 project.** It requires its own
  Amazon developer account and AWS Lambda setup, independent of this app's stack,
  and will be scoped separately once phase 1 is live.

## Architecture

- **Repo/Hosting:** Single GitHub repo containing a Next.js app (frontend pages +
  backend API routes together). Connected to Vercel; every push to `main`
  auto-deploys. No manual dashboard upload step.
- **Database:** Supabase (hosted Postgres, free tier).
- **External calls — all server-side only, API keys never reach the browser:**
  - Walmart product search API (item lookup: name/image/price)
  - Claude API (meal suggestion generation)
  - Recipe URL scraper (fetches a pasted URL, parses embedded JSON-LD recipe data)
- **Access:** No auth system. Single unlisted private URL.

## Data Model (Supabase tables)

- `recipes` — id, name, source ('manual' | 'url'), source_url (nullable),
  instructions (text)
- `recipe_ingredients` — id, recipe_id (fk), ingredient_name, quantity, unit
- `purchases` — id, completed_at (date), items (jsonb: [{name, quantity}])
- `weekly_plan` — id, week_start_date, day_of_week, recipe_id (fk, nullable)
- `grocery_list` — id, item_name, quantity, source ('planned' | 'manual'), added_at

## Screens

1. **This Week** (home) — 7-day grid; tap a day to assign a saved recipe; shows
   which ingredients for the week are missing versus recent purchases.
2. **Grocery List** — current in-progress list, grouped by planned vs. manually
   added; search Walmart products to add items; "Complete List" saves it to
   `purchases` with today's date and clears the working list.
3. **History** — past completed lists, newest first; tap one to see its items.
4. **Recipes** — browse/search saved recipes; "Add Recipe" (manual form) or
   "Import from URL" field; view/edit a recipe's ingredients.
5. **Suggestions** — "What can we make?" — sends recent purchase history and saved
   recipes to Claude, displays a few meal ideas, each addable directly to the
   weekly plan.

## Error Handling

- Walmart search failure/timeout: show an inline error, allow manual text entry so
  the list is never blocked.
- Recipe URL import failure (no structured data / scrape blocked): fall back to a
  manual ingredient-paste field for that recipe.
- Claude suggestion failure/quota: show "no suggestions available right now," rest
  of app unaffected.
- No purchase history yet: Suggestions screen explains more history is needed
  instead of erroring.
- Weekly plan referencing a deleted recipe: that day just renders empty, no crash.

## Testing Approach

Lightweight, matched to a 2-person household app rather than a team codebase:

- Manual verification of each screen in the browser as it's built, driven directly
  via browser preview tools before any screen is called done.
- Targeted automated tests only around logic most likely to silently break:
  - The "missing ingredients" calculation (weekly plan → grocery list)
  - The recipe URL parser (site structures vary; failures should degrade gracefully,
    not crash)
- No test suite for simple CRUD screens (recipe list, history view, etc.) — not
  worth the overhead at this scale.

## Deferred (Phase 2)

- **Alexa Skill** — "Alexa, add milk to my list." Requires a separate Amazon
  developer account, a custom Alexa Skill definition, and an AWS Lambda function
  (or a Next.js API route Lambda can call) to write into the same `grocery_list`
  table. Scoped as its own follow-up project once phase 1 is live and stable.
- **Walmart deep-linking** — pre-filling Walmart's site/app with list items as a
  convenience when ordering online for delivery/pickup. Nice-to-have, not core,
  since purchase method varies trip to trip.
