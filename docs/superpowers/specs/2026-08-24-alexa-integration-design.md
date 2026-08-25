# Alexa Voice Integration — Design

Date: 2026-08-24

## Goal

Let the user add and remove grocery list items by voice from the kitchen
Echo, without opening the app: "Alexa, tell my grocery list to add milk."

## Background / why a custom skill

Amazon turned off the third-party "List Skill API" on 2024-07-01, which is
what previously let apps sync into Alexa's native built-in shopping list
("Alexa, add milk to my shopping list"). That path no longer exists for
new integrations. The only viable pattern today is a **custom Alexa
Skill** with its own invocation name — the same approach apps like
AnyList switched to ("Alexa, tell AnyList to add milk").

Since this is single-user, the skill stays in Development stage on the
user's own Amazon developer account — no certification or public
publishing needed. It only works on Echo devices signed into that same
account.

## Alexa-side configuration

- **Skill type:** Custom Skill, Development stage only.
- **Invocation name:** "my grocery list"
- **Endpoint type:** self-hosted HTTPS web service (not Lambda), pointing
  at `https://grocery-meal-planner-sigma.vercel.app/api/alexa`. Vercel's
  cert satisfies Alexa's "trusted CA" endpoint requirement, so no AWS
  account or Lambda is needed.
- **Intents**, each with one `AMAZON.SearchQuery` slot named `ItemsText`
  that captures the full trailing phrase (Alexa has no native "list of
  items" slot type — capturing raw text and parsing it ourselves is the
  standard workaround for multi-item voice adds):
  - `AddItemsIntent` — sample utterances: "add {ItemsText}", "add
    {ItemsText} to my list", "put {ItemsText} on my list"
  - `RemoveItemsIntent` — sample utterances: "remove {ItemsText}",
    "remove {ItemsText} from my list", "take {ItemsText} off my list"
  - Standard `AMAZON.HelpIntent`, `AMAZON.CancelIntent`,
    `AMAZON.StopIntent`, `LaunchRequest`, `SessionEndedRequest` handled
    minimally (help text: "You can say things like add milk, or remove
    eggs.").
- Every response sets `shouldEndSession: true` — this is one-shot "tell X
  to do Y" phrasing, not a multi-turn conversation.

## Backend

New route: `app/api/alexa/route.ts` (Next.js API route, same Vercel
deploy as the rest of the app, Node runtime).

### Request verification

Every incoming request is verified as genuinely from Alexa before any
database access: validate the `SignatureCertChainUrl` header (must be an
Amazon-hosted cert), fetch and validate the certificate chain, verify the
request `Signature` against the raw body using that cert, and reject
requests with a timestamp more than ~150 seconds old (anti-replay). If
verification fails, respond 401 and stop — no DB access. This is what
makes it safe for the endpoint to be public.

### Shared insert path

The existing `POST /api/grocery-list` insert logic is factored into a
small shared helper (e.g. `lib/groceryList.ts`) so both the UI-triggered
API route and the new Alexa route use the same insert code. Voice-added
items are tagged `source = 'voice'`.

**Schema change:** `grocery_list.source` CHECK constraint currently only
allows `'planned'` / `'manual'`. Add `'voice'` as a third allowed value
(new migration, following the same pattern as migration `0006`).

### `lib/voiceItems.ts` — parsing

`parseVoiceItems(raw: string): { name: string; quantity: number }[]`

- Split `raw` on commas and the word " and " (case-insensitive), trim
  each segment, drop empty segments. Handles the Oxford-comma case
  ("milk, eggs, and bread" → 3 segments).
- For each segment, look for a leading quantity token:
  - a digit sequence (`"2 eggs"`)
  - a spelled-out number word one–twenty (`"two eggs"`)
  - `"a"` / `"an"` → 1 (`"a loaf of bread"`)
  - if none found, quantity defaults to **1** (per requirement) and the
    whole segment is the item name.
- Remaining text after the quantity token (or the whole segment, if no
  quantity token) is the item name, trimmed.
- Item names are stored as spoken (no forced casing), matching how
  manually-added items already work.

### `AddItemsIntent` handler

1. Verify request.
2. Read `ItemsText` slot, run through `parseVoiceItems`.
3. If parsing yields zero items (empty/garbled slot), respond "Sorry, I
   didn't catch what to add — try again," no DB write.
4. Otherwise insert each `{name, quantity}` via the shared helper with
   `source = 'voice'`.
5. Respond with a natural-language confirmation listing the item names,
   e.g. "Added milk, 2 eggs, and bread to your grocery list."
6. On any D1 failure, catch, `console.error` server-side (visible in
   Vercel logs), respond "Sorry, something went wrong adding that to your
   list." No retry logic — this is a single-user voice UI, the user just
   repeats the request.

### `RemoveItemsIntent` handler

1. Verify request.
2. Read `ItemsText` slot, run through `parseVoiceItems` (quantity is
   ignored for removal).
3. For each parsed name, normalize (lowercase, trim) and match against
   current `grocery_list.item_name` rows using the same word-boundary
   matching technique already used for aisle matching (avoids
   substring false-positives, e.g. matching "popcorn" when the user said
   "pop").
4. Delete **all** rows that match a given name (e.g. two separate
   "garlic" rows both get removed) — simplest, most predictable voice
   behavior; no attempt to disambiguate which specific row the user
   meant.
5. Respond confirming what was removed, and calling out by name any
   items that had no match, e.g. "Removed milk and eggs. I couldn't find
   bread on your list."
6. Same D1-failure handling as add.

## Error handling summary

| Case | Behavior |
|---|---|
| Invalid/missing Alexa signature | 401, no DB access |
| Empty/unparseable slot text | Ask user to repeat, no DB write |
| D1 failure | Logged server-side, spoken apology, no retry |
| Remove: item not found | Not an error — named in the spoken response, other items still removed |
| Remove: name matches multiple rows | All matching rows removed |

## Testing

- **Unit tests** for `parseVoiceItems()`: no quantity, digit quantity,
  word quantity ("two"), "a"/"an" → 1, comma-separated list,
  "and"-separated list, Oxford comma combination, stray whitespace.
- **Manual, via Amazon dev console simulator** (text or voice, no real
  device needed): verify both intents route correctly and check spoken
  responses. This hits the real `grocery_list` table (no test/prod
  split exists), so any test rows get cleaned up afterward by id, the
  same way the `weekly_plan` future-date testing trick worked.
- **Final live check:** say the phrase to the actual kitchen Echo,
  confirm the item appears on the `/grocery-list` page in the app.

## Out of scope for this pass

- Editing quantities of existing items by voice.
- Checking items off / marking purchased by voice.
- Multi-user / multi-household support (single Amazon account only).
- Any use of the newer "Alexa+" APIs — not publicly available yet.
