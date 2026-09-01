# Recipe Import: Paste Text & Screenshot — Design

Date: 2026-08-31

## Goal

Add two more ways to get a recipe into the app, alongside the existing
"Import from a URL" box on the Add Recipe page:

1. **Paste text** — copy a recipe's visible text off any page and paste it
   in; Claude extracts the structured recipe.
2. **Screenshot** — attach one or more screenshots (dish photo + ingredient
   list) and Claude reads the recipe off the image(s).

## Background / why

The URL importer (`app/api/recipes/import/route.ts`) depends on fetching
the page server-side and finding schema.org `Recipe` JSON-LD in the HTML.
Two real failure modes have already been hit in production:

- The site has no structured recipe data at all → "No recipe data found on
  that page."
- The site blocks the server-side fetch outright (403/429) → "This site
  blocks automatic recipe imports."

Both failures are unrecoverable today except by typing the whole recipe in
by hand. Since the user can always *see* the recipe in their own browser
even when the server can't fetch it, letting them hand the visible
content (text or a screenshot) to Claude directly routes around both
failure modes without needing to fight each site's bot detection.

## Architecture

One new shared module, one new prompt/parsing contract, two new thin API
routes, reusing the existing Anthropic-calling pattern already used by
`lib/suggestions.ts` (raw `fetch` to `https://api.anthropic.com/v1/messages`,
no SDK dependency, matching this repo's zero-dependency style).

### `lib/recipeExtraction.ts` (new)

```ts
interface ExtractedRecipe {
  name: string;
  instructions: string;
  cuisine: string | null;
  cook_time_minutes: number | null;
  ingredients: { ingredient_name: string; quantity: number | null; unit: string | null }[];
}

function buildExtractionPrompt(): string
function parseExtractionResponse(rawText: string): ExtractedRecipe | null
async function fetchRecipeExtraction(
  content: ({ type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } })[]
): Promise<ExtractedRecipe | null>
```

- `buildExtractionPrompt()` is content-agnostic — it just describes the
  extraction task and the required JSON shape (name, instructions,
  cuisine, cook_time_minutes, ingredients). The same instruction text is
  used whether the actual recipe content arrives as a text block or image
  block(s); Claude reads whatever content blocks come with it.
- `parseExtractionResponse` reuses the same validation approach as
  `parseSuggestionsResponse` in `lib/suggestions.ts` (regex-extract a
  single JSON object this time, not an array; require non-empty
  `name`/`instructions` and at least one valid ingredient; drop anything
  malformed rather than throwing).
- `fetchRecipeExtraction` does the actual POST to
  `https://api.anthropic.com/v1/messages` with **model
  `claude-haiku-4-5`** (extraction is a well-defined structured task, not
  open-ended creativity — matches the aisle-matcher's model choice, not
  Suggestions' opus-5), a single user message combining the prompt text
  block plus whatever content blocks the caller passed in. No server
  tools (no web search) — single-turn, no `pause_turn` handling needed.
  Returns `null` on any fetch error, non-OK response, missing API key, or
  failed parse — callers turn `null` into the same friendly 422 the URL
  importer already uses.

### `POST /api/recipes/parse-text` (new route)

Body: `{ text: string }`. Rejects empty/missing text with 400. Calls
`fetchRecipeExtraction` with one text content block: the prompt plus the
pasted text. On `null`, responds 422: `"Could not find a recipe in that
text — paste the ingredients manually instead"`. On success, responds
with the same shape as the existing `/api/recipes/import` success
response (`name`, `ingredients` as string array converted from
`ExtractedRecipe.ingredients`, `cookTimeMinutes`, plus `cuisine` — the URL
importer's response today doesn't include cuisine, so the frontend
handler gains that one extra optional field; both existing and new
callers already tolerate unknown/undefined fields in the response).

### `POST /api/recipes/parse-image` (new route)

Body: `{ images: string[] }` — each a full `data:image/...;base64,...`
URI as produced by `FileReader.readAsDataURL`. Validates 1–5 images,
each ≤ 5MB decoded (reject with 400 and a clear message otherwise — this
is also enforced client-side before upload, see below, but the API
re-checks since it's a public-ish endpoint). Parses each data URI's
media type and base64 payload, builds one Anthropic image content block
per image (`type: "image", source: { type: "base64", media_type, data }`),
appends them after the shared prompt text block, calls
`fetchRecipeExtraction`. Same 422 error and same success shape as
parse-text (never returns an `image_url` — see Screenshot crop below for
how the thumbnail actually gets set).

## Add Recipe page (`app/recipes/new/page.tsx`)

### Import method switcher

The current single "Import from a URL" box becomes a tab switcher with
three tabs — **URL / Paste Text / Screenshot** — sharing the existing
box's visual style (`bg-gray-50 border rounded`). Only one tab's content
shows at a time; switching tabs doesn't clear anything already imported
into the form below.

- **URL tab**: unchanged, existing input + Import button.
- **Paste Text tab**: a `<textarea>` ("Paste the recipe text here") + a
  "Parse" button (disabled while empty or while a request is in flight,
  matching the existing `importing` pattern).
- **Screenshot tab**: a `<input type="file" accept="image/*" multiple>`
  behind a styled button, plus a paste target (`onPaste` handler checking
  `clipboardData.items` for `image/*` types, converting via
  `FileReader`) — either path appends to the same `images: File[]` state.
  Selected images render as a row of small thumbnails, each with a small
  ✕ to remove it before importing. An "Import" button sends everything
  currently in `images`.
  - Client-side validation before sending: reject (inline error, not
    added to the list) any file over 5MB or not an image MIME type.

### Shared field-population helper

`handleImport`'s current field-setting logic (name, ingredients,
cookTimeMinutes, imageUrl, sourceUrl) is factored into a small
`applyImportedFields(result)` helper, used by the URL path, the new
paste-text path (`source: "manual"`, `sourceUrl: null`, no `imageUrl`
change), and the new screenshot path (same as text, except it also kicks
off the crop step below when the parse succeeds and at least one image
was uploaded). Cuisine is auto-filled for text/screenshot results (unlike
URL import, which deliberately leaves it blank — this repo's rationale for
leaving it blank was that a whole *site's* schema.org cuisine tag is often
a generic site-wide default, which doesn't apply here since there's no
site-wide tag involved, only Claude's read of this one specific recipe).

### Screenshot → thumbnail crop step

After a successful screenshot parse, if `images.length > 0`, a crop panel
appears above the form (below the tab box): the first uploaded image is
shown full-size (if more than one was uploaded, small thumbnails let the
user switch which image to crop from) with a semi-transparent draggable,
resizable rectangle overlaid on top, default centered at ~60% of the
image's dimensions. Drag the body of the rectangle to move it, drag a
corner handle to resize (same interaction primitives as the existing
`aisle-map.html` block editor artifact, reused conceptually — not shared
code, since that tool is a standalone artifact, not part of this repo).

Two buttons: **"Use this crop"** and **"Skip"**.

- "Use this crop": an offscreen `<canvas>` is sized to the rectangle's
  width/height (scaled from displayed pixels to the image's natural
  width/height, since the preview `<img>` may be displayed smaller than
  its natural size), `drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)` copies
  just that region, `canvas.toDataURL("image/jpeg", 0.85)` becomes the new
  `imageUrl` state — the same field the URL importer already populates,
  so the rest of the save flow (and the recipes grid/detail pages that
  already render `image_url` as a plain `<img src>`) needs no changes.
- "Skip": crop panel closes, `imageUrl` stays whatever it already was
  (null, if this is a fresh screenshot import) — the recipe saves with the
  placeholder image, same as a manual/pasted-text recipe.

This crop step never asks Claude to guess a bounding box — it's an
explicit design choice against that approach, having already been burned
once on this project by trusting hand/AI-guessed pixel coordinates
against a real photo (the original aisle-map floor-plan attempt). The
user positions the crop themselves; it's always exactly right by
construction.

## Data model

No schema changes. Both new paths save with `source: "manual"` (the
`recipes.source` CHECK constraint already allows `'manual'` — neither new
path has a real external URL to store as `source_url`, so this is
accurate, not a workaround). The cropped image is stored as a `data:`
URI directly in the existing `image_url TEXT` column, same as any other
recipe's image URL, just a much longer string — no new storage system
(R2, etc.) needed for this pass.

## Error handling summary

| Case | Behavior |
|---|---|
| Paste Text: empty textarea | Parse button disabled, no request sent |
| Paste Text: Claude finds no recipe in the text | 422, "Could not find a recipe in that text — paste the ingredients manually instead" |
| Screenshot: file too large / not an image | Rejected client-side before upload, inline message, not added to the thumbnail list |
| Screenshot: >5 images selected | 6th+ selection rejected client-side with an inline message |
| Screenshot: Claude finds no recipe across all images | 422, "Could not find a recipe in those images — paste the ingredients manually instead" |
| No `ANTHROPIC_API_KEY` configured | `fetchRecipeExtraction` returns `null` (same as Suggestions/aisle-matcher today), surfaces as the standard 422 above |
| Any fetch/network error calling Anthropic | Caught, treated as `null`, same 422 |

## Testing

- **`lib/recipeExtraction.test.ts`** (new): `buildExtractionPrompt` output
  shape; `parseExtractionResponse` against a valid response, a response
  with extra prose around the JSON, malformed JSON, missing
  name/instructions, empty ingredients array, ingredients with missing
  fields — same style as `suggestions.test.ts`.
- **API routes**: no new route-level tests, consistent with
  `/api/recipes/import` and `/api/suggestions` having none today (this
  repo's convention is to unit-test the `lib/` logic and verify routes
  live).
- **Crop UI**: not unit-tested (no existing precedent for testing
  canvas/File/clipboard APIs in this repo's vitest setup) — verified live
  in the browser: upload a real screenshot, drag/resize the crop box,
  confirm the cropped thumbnail actually shows just the dish and renders
  correctly on the recipe's saved page.
- **Live end-to-end check** for both paths using one of the two real
  Pinterest pins that already failed in production (per the screenshots
  that prompted this feature): paste that page's visible text through the
  Paste Text tab, and separately try a screenshot of the same page,
  confirming both recover a usable recipe where the URL importer
  couldn't. Clean up any test recipe rows created during this check
  afterward, same as prior sessions' testing pattern.

## Out of scope for this pass

- Editing/re-adjusting a crop after saving (re-crop requires re-importing
  the screenshot).
- Any auto-detection or AI-assisted crop suggestion.
- Persisting the *uncropped* original screenshot anywhere (only the
  cropped `data:` URI is kept, in `image_url`).
- Multi-image *merging* (e.g. treating a "ingredients continued" second
  screenshot as one logical document) beyond simply handing all attached
  images to Claude in one call and letting it read across all of them.
