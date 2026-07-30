# Grocery & Meal Planner App — Design Spec

Date: 2026-07-29
For: Brandon's wife (primary user, phone-only, no login)

## Purpose

A private web app that helps plan weekly meals, tracks the grocery lists built from
those plans (and any extra items), and suggests meals based on what's been recently
bought. Optionally, a list item can be linked to a real Walmart product page, and the
whole list of linked items can be sent to a real Walmart.com cart in one click. Alexa
voice control is explicitly out of scope for this phase — see "Deferred" below.

## Scope Decisions (from clarifying discussion)

- **The app's own "cart" and order history are internal concepts.** You build a list
  in the app, mark it complete, and it's saved with a date — that part is entirely
  the app's own data, not read from or written to Walmart's systems. Walmart does not
  expose any public API for reading a consumer's personal order history, so that
  direction (Walmart → app) is still not possible.
- **The other direction (app → Walmart cart) *is* possible and has been verified.**
  Walmart supports an unauthenticated "add to cart" deep link
  (`https://www.walmart.com/sc/cart/addToCart?items=ITEM_ID,...`) that, when opened
  in a browser where the shopper is already logged into walmart.com, adds those items
  straight to their real cart — confirmed working against a live account on
  2026-07-29. It needs no API key and no Walmart affiliate/developer approval. The
  app captures a product's numeric Walmart item ID when someone pastes a Walmart
  product page URL while adding a grocery-list item (the ID is just the number at the
  end of the product's `/ip/...` URL — no scraping or lookup call involved), and a
  "Send to Walmart Cart" button builds the deep link from every linked item currently
  on the list. Items without a linked Walmart URL are unaffected and stay in the list
  as plain manual entries.
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
  - Claude API (meal suggestion generation)
  - Recipe URL scraper (fetches a pasted URL, parses embedded JSON-LD recipe data)
- **Walmart cart deep link is not an external call at all** — it's pure URL
  construction from a stored item ID, opened directly in the browser (`window.open`).
  No key, no server round-trip, nothing to be "gated" on.
- **Access:** No auth system. Single unlisted private URL.

## Data Model (Supabase tables)

- `recipes` — id, name, source ('manual' | 'url'), source_url (nullable),
  instructions (text)
- `recipe_ingredients` — id, recipe_id (fk), ingredient_name, quantity, unit
- `purchases` — id, completed_at (date), items (jsonb: [{name, quantity}])
- `weekly_plan` — id, week_start_date, day_of_week, recipe_id (fk, nullable)
- `grocery_list` — id, item_name, quantity, source ('planned' | 'manual'),
  walmart_item_id (nullable), added_at

## Screens

1. **This Week** (home) — 7-day grid; tap a day to assign a saved recipe; shows
   which ingredients for the week are missing versus recent purchases.
2. **Grocery List** — current in-progress list, grouped by planned vs. manually
   added; adding an item can optionally include a pasted Walmart product link;
   "Send to Walmart Cart" opens a deep link that adds every linked item to a real
   Walmart cart; "Complete List" saves the list to `purchases` with today's date and
   clears the working list (independent of whether it was sent to Walmart).
3. **History** — past completed lists, newest first; tap one to see its items.
4. **Recipes** — browse/search saved recipes; "Add Recipe" (manual form) or
   "Import from URL" field; view/edit a recipe's ingredients.
5. **Suggestions** — "What can we make?" — sends recent purchase history and saved
   recipes to Claude, displays a few meal ideas, each addable directly to the
   weekly plan.

## Error Handling

- Pasted Walmart link isn't a recognizable product URL: the item is still added to
  the list as a normal manual entry (no link), never blocks adding the item.
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
  - The Walmart item-ID extractor and cart-link builder (URL parsing edge cases;
    should return `null`/skip rather than throw on unrecognized input)
- No test suite for simple CRUD screens (recipe list, history view, etc.) — not
  worth the overhead at this scale.

## Deferred (Phase 2)

- **Alexa Skill** — "Alexa, add milk to my list." Requires a separate Amazon
  developer account, a custom Alexa Skill definition, and an AWS Lambda function
  (or a Next.js API route Lambda can call) to write into the same `grocery_list`
  table. Scoped as its own follow-up project once phase 1 is live and stable.
