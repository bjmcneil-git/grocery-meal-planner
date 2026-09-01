# Recipe Import: Paste Text & Screenshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Paste Text" and "Screenshot" tabs to the Add Recipe page's import box, alongside the existing URL importer, so a recipe can be extracted by Claude from pasted text or an uploaded screenshot when the site-scraping importer fails.

**Architecture:** One new pure-logic module (`lib/recipeExtraction.ts`) shared by two new thin Next.js API routes (`/api/recipes/parse-text`, `/api/recipes/parse-image`), following the exact pattern `lib/suggestions.ts` + `/api/suggestions` already established in this repo. The Add Recipe page gains a 3-way tab switcher and a new `CropPanel` component for turning an uploaded screenshot into a cropped thumbnail image, entirely client-side.

**Tech Stack:** Next.js App Router, TypeScript, Cloudflare D1 (unchanged — no schema changes this plan), Vitest, Tailwind, raw `fetch` against the Anthropic Messages API (no SDK).

## Global Constraints

- Model for both new extraction calls: `claude-haiku-4-5` (per the design spec — cheap/fast, matches the aisle-matcher's model choice for a well-defined extraction task, not `claude-opus-5` which is reserved for open-ended Suggestions).
- No `@anthropic-ai/sdk` dependency — raw `fetch` to `https://api.anthropic.com/v1/messages`, matching `lib/suggestions.ts` and `lib/aisleMatcher.ts`.
- No database schema changes. Both new import paths save with `source: "manual"` (existing CHECK constraint already allows this value).
- The cropped screenshot is stored as a `data:` URI directly in the existing `image_url TEXT` column — no new storage system.
- Path alias `@/*` maps to the repo root (see existing imports like `@/lib/suggestions`) — use it in all new files.
- Tests use Vitest (`npm test`), following the existing style in `__tests__/suggestions.test.ts` and `__tests__/pinterest.test.ts` (`describe`/`it`/`expect`, no mocking framework needed since only pure functions are unit-tested — the network-calling function itself is not unit-tested, consistent with `fetchRecipeSuggestions` having no test today).
- Match existing Tailwind conventions on this page: `border rounded p-2` for inputs, `bg-gray-800 text-white rounded px-3` for secondary action buttons, `bg-pink-600 text-white` for the primary action, `text-red-600 text-sm` for inline errors.

---

### Task 1: `lib/recipeExtraction.ts` — extraction types, prompt, parser

**Files:**
- Create: `lib/recipeExtraction.ts`
- Test: `__tests__/recipeExtraction.test.ts`

**Interfaces:**
- Produces (used by Tasks 2 and 3):
  - `interface ExtractedIngredient { ingredient_name: string; quantity: number | null; unit: string | null }`
  - `interface ExtractedRecipe { name: string; instructions: string; cuisine: string | null; cook_time_minutes: number | null; ingredients: ExtractedIngredient[] }`
  - `type AnthropicContentBlockInput = { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } }`
  - `function buildExtractionPrompt(): string`
  - `function parseExtractionResponse(rawText: string): ExtractedRecipe | null`
  - `function toImportResponse(result: ExtractedRecipe): { name: string; ingredients: string[]; cookTimeMinutes: number | null; cuisine: string | null; instructions: string }`
  - `async function fetchRecipeExtraction(content: AnthropicContentBlockInput[]): Promise<ExtractedRecipe | null>`

- [ ] **Step 1: Write the failing tests for `parseExtractionResponse` and `toImportResponse`**

Create `__tests__/recipeExtraction.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildExtractionPrompt, parseExtractionResponse, toImportResponse } from "@/lib/recipeExtraction";

describe("buildExtractionPrompt", () => {
  it("describes the required JSON shape", () => {
    const prompt = buildExtractionPrompt();
    expect(prompt).toContain("ingredient_name");
    expect(prompt).toContain("instructions");
  });
});

describe("parseExtractionResponse", () => {
  it("parses a valid recipe object", () => {
    const raw = JSON.stringify({
      name: "Lemon Chicken",
      cuisine: "Mediterranean",
      cook_time_minutes: 30,
      instructions: "Season and roast.",
      ingredients: [{ ingredient_name: "chicken", quantity: 2, unit: "lb" }],
    });
    expect(parseExtractionResponse(raw)).toEqual({
      name: "Lemon Chicken",
      cuisine: "Mediterranean",
      cook_time_minutes: 30,
      instructions: "Season and roast.",
      ingredients: [{ ingredient_name: "chicken", quantity: 2, unit: "lb" }],
    });
  });

  it("extracts a JSON object embedded in surrounding prose", () => {
    const raw = `Sure, here it is:\n${JSON.stringify({
      name: "Soup",
      instructions: "Simmer.",
      ingredients: [{ ingredient_name: "broth" }],
    })}\nEnjoy!`;
    const result = parseExtractionResponse(raw);
    expect(result?.name).toBe("Soup");
    expect(result?.ingredients).toEqual([{ ingredient_name: "broth", quantity: null, unit: null }]);
  });

  it("returns null for malformed JSON", () => {
    expect(parseExtractionResponse("{not valid json")).toBeNull();
  });

  it("returns null when name is missing", () => {
    const raw = JSON.stringify({ instructions: "Do it.", ingredients: [{ ingredient_name: "a" }] });
    expect(parseExtractionResponse(raw)).toBeNull();
  });

  it("returns null when instructions is missing", () => {
    const raw = JSON.stringify({ name: "X", ingredients: [{ ingredient_name: "a" }] });
    expect(parseExtractionResponse(raw)).toBeNull();
  });

  it("returns null when ingredients is empty", () => {
    const raw = JSON.stringify({ name: "X", instructions: "Do it.", ingredients: [] });
    expect(parseExtractionResponse(raw)).toBeNull();
  });

  it("drops an ingredient with no name and keeps valid ones", () => {
    const raw = JSON.stringify({
      name: "X",
      instructions: "Do it.",
      ingredients: [{ quantity: 1 }, { ingredient_name: "salt" }],
    });
    expect(parseExtractionResponse(raw)?.ingredients).toEqual([
      { ingredient_name: "salt", quantity: null, unit: null },
    ]);
  });

  it("drops an invalid cuisine rather than keeping it", () => {
    const raw = JSON.stringify({
      name: "X",
      cuisine: "Not A Real Cuisine",
      instructions: "Do it.",
      ingredients: [{ ingredient_name: "a" }],
    });
    expect(parseExtractionResponse(raw)?.cuisine).toBeNull();
  });

  it("returns null for unparseable text", () => {
    expect(parseExtractionResponse("not json at all")).toBeNull();
  });
});

describe("toImportResponse", () => {
  it("maps an ExtractedRecipe to the frontend import response shape", () => {
    const response = toImportResponse({
      name: "Lemon Chicken",
      instructions: "Season and roast.",
      cuisine: "Mediterranean",
      cook_time_minutes: 30,
      ingredients: [{ ingredient_name: "chicken", quantity: 2, unit: "lb" }],
    });
    expect(response).toEqual({
      name: "Lemon Chicken",
      ingredients: ["chicken"],
      cookTimeMinutes: 30,
      cuisine: "Mediterranean",
      instructions: "Season and roast.",
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- recipeExtraction`
Expected: FAIL — `lib/recipeExtraction.ts` does not exist yet.

- [ ] **Step 3: Implement `lib/recipeExtraction.ts`**

```ts
import { CUISINES } from "./cuisines";

export interface ExtractedIngredient {
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
}

export interface ExtractedRecipe {
  name: string;
  instructions: string;
  cuisine: string | null;
  cook_time_minutes: number | null;
  ingredients: ExtractedIngredient[];
}

export type AnthropicContentBlockInput =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export function buildExtractionPrompt(): string {
  return `You are helping extract a recipe from content a user found online (either pasted page text or a screenshot). Read the content provided below/attached and extract the recipe from it.

Respond with ONLY a JSON object (no markdown fences, no other text) shaped exactly like:
{"name": string, "cuisine": one of [${CUISINES.join(", ")}] or null, "cook_time_minutes": number or null, "instructions": string (step-by-step), "ingredients": [{"ingredient_name": string, "quantity": number or null, "unit": string or null}]}

If the content does not contain a real recipe, respond with exactly: {"name": null}`;
}

export function parseExtractionResponse(rawText: string): ExtractedRecipe | null {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.name !== "string" || !obj.name.trim()) return null;
  if (typeof obj.instructions !== "string" || !obj.instructions.trim()) return null;
  if (!Array.isArray(obj.ingredients)) return null;

  const validCuisines: readonly string[] = CUISINES;

  const ingredients = obj.ingredients
    .filter((ing): ing is Record<string, unknown> => !!ing && typeof ing === "object")
    .map((ing) => ({
      ingredient_name: typeof ing.ingredient_name === "string" ? ing.ingredient_name : "",
      quantity: typeof ing.quantity === "number" ? ing.quantity : null,
      unit: typeof ing.unit === "string" ? ing.unit : null,
    }))
    .filter((ing) => ing.ingredient_name.trim() !== "");
  if (ingredients.length === 0) return null;

  return {
    name: obj.name,
    instructions: obj.instructions,
    cuisine: typeof obj.cuisine === "string" && validCuisines.includes(obj.cuisine) ? obj.cuisine : null,
    cook_time_minutes: typeof obj.cook_time_minutes === "number" ? obj.cook_time_minutes : null,
    ingredients,
  };
}

export function toImportResponse(result: ExtractedRecipe) {
  return {
    name: result.name,
    ingredients: result.ingredients.map((i) => i.ingredient_name),
    cookTimeMinutes: result.cook_time_minutes,
    cuisine: result.cuisine,
    instructions: result.instructions,
  };
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

export async function fetchRecipeExtraction(
  content: AnthropicContentBlockInput[]
): Promise<ExtractedRecipe | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const headers = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 4000,
        messages: [
          { role: "user", content: [{ type: "text", text: buildExtractionPrompt() }, ...content] },
        ],
      }),
    });

    if (!res.ok) return null;

    const json = (await res.json()) as { content?: AnthropicContentBlock[] };
    const text = (json.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n");

    return parseExtractionResponse(text);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- recipeExtraction`
Expected: PASS (all tests green).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/recipeExtraction.ts __tests__/recipeExtraction.test.ts
git commit -m "Add shared recipe-extraction lib (prompt, parser, Claude call)"
```

---

### Task 2: `POST /api/recipes/parse-text`

**Files:**
- Create: `app/api/recipes/parse-text/route.ts`

**Interfaces:**
- Consumes: `fetchRecipeExtraction`, `toImportResponse` from `@/lib/recipeExtraction` (Task 1).
- Produces: `POST /api/recipes/parse-text` accepting `{ text: string }`, returning `toImportResponse`'s shape on success (200) or `{ error: string }` on failure (400/422) — consumed by Task 4's frontend wiring.

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { fetchRecipeExtraction, toImportResponse } from "@/lib/recipeExtraction";

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const result = await fetchRecipeExtraction([{ type: "text", text }]);
  if (!result) {
    return NextResponse.json(
      { error: "Could not find a recipe in that text — paste the ingredients manually instead" },
      { status: 422 }
    );
  }

  return NextResponse.json(toImportResponse(result));
}
```

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 3: Manual verification against the local dev server**

Start the dev server if it isn't already running (`npm run dev`, port 3002 per `.claude/launch.json`'s `grocery-meal-planner` entry — confirm the `ANTHROPIC_API_KEY` env var is present in `.env.local` first, since Suggestions already depends on it working locally). Then:

```bash
curl -s -X POST http://localhost:3002/api/recipes/parse-text \
  -H "Content-Type: application/json" \
  -d '{"text":"Grandma'\''s Pancakes. Mix 2 cups flour, 1 cup milk, 2 eggs, 1 tbsp sugar. Cook on a griddle until golden, about 3 minutes per side."}'
```

Expected: a 200 response with a JSON body containing `name`, `ingredients` (array of strings including flour/milk/eggs/sugar), `instructions`, and likely `cuisine: "American"` or `null`.

Also verify the empty-input case:

```bash
curl -s -X POST http://localhost:3002/api/recipes/parse-text \
  -H "Content-Type: application/json" \
  -d '{"text":""}'
```

Expected: 400 with `{"error":"Missing text"}`.

- [ ] **Step 4: Commit**

```bash
git add app/api/recipes/parse-text/route.ts
git commit -m "Add POST /api/recipes/parse-text route"
```

---

### Task 3: `POST /api/recipes/parse-image`

**Files:**
- Create: `app/api/recipes/parse-image/route.ts`

**Interfaces:**
- Consumes: `fetchRecipeExtraction`, `toImportResponse`, `AnthropicContentBlockInput` from `@/lib/recipeExtraction` (Task 1).
- Produces: `POST /api/recipes/parse-image` accepting `{ images: string[] }` (each a full `data:image/...;base64,...` URI), returning the same success/error shape as Task 2 — consumed by Task 5's frontend wiring.

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import {
  fetchRecipeExtraction,
  toImportResponse,
  type AnthropicContentBlockInput,
} from "@/lib/recipeExtraction";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DATA_URL_REGEX = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/;

export async function POST(req: NextRequest) {
  const { images } = await req.json();
  if (!Array.isArray(images) || images.length === 0) {
    return NextResponse.json({ error: "Missing images" }, { status: 400 });
  }
  if (images.length > MAX_IMAGES) {
    return NextResponse.json({ error: `You can attach up to ${MAX_IMAGES} images` }, { status: 400 });
  }

  const content: AnthropicContentBlockInput[] = [];
  for (const image of images) {
    if (typeof image !== "string") {
      return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
    }
    const match = DATA_URL_REGEX.exec(image);
    if (!match) {
      return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
    }
    const [, mediaType, base64Data] = match;
    if (base64Data.length * 0.75 > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Each image must be under 5MB" }, { status: 400 });
    }
    content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } });
  }

  const result = await fetchRecipeExtraction(content);
  if (!result) {
    return NextResponse.json(
      { error: "Could not find a recipe in those images — paste the ingredients manually instead" },
      { status: 422 }
    );
  }

  return NextResponse.json(toImportResponse(result));
}
```

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 3: Manual verification against the local dev server**

Create a tiny real test image and confirm the route round-trips it:

```bash
node -e "console.log(require('fs').readFileSync('public/icon-192.png').toString('base64'))" > /tmp/icon-b64.txt
node -e "
const fs = require('fs');
const b64 = fs.readFileSync('/tmp/icon-b64.txt', 'utf8').trim();
fs.writeFileSync('/tmp/parse-image-body.json', JSON.stringify({ images: ['data:image/png;base64,' + b64] }));
"
curl -s -X POST http://localhost:3002/api/recipes/parse-image \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/parse-image-body.json
```

Expected: since `public/icon-192.png` is the app's own icon (not a real recipe photo), this should return 422 with `"Could not find a recipe in those images — paste the ingredients manually instead"` — confirming the route correctly rejects a non-recipe image rather than hallucinating one. (Real end-to-end verification with an actual recipe screenshot happens in Task 7.)

Also verify the too-many-images case:

```bash
node -e "
const fs = require('fs');
const b64 = fs.readFileSync('/tmp/icon-b64.txt', 'utf8').trim();
const uri = 'data:image/png;base64,' + b64;
fs.writeFileSync('/tmp/parse-image-toomany.json', JSON.stringify({ images: Array(6).fill(uri) }));
"
curl -s -X POST http://localhost:3002/api/recipes/parse-image \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/parse-image-toomany.json
```

Expected: 400 with `{"error":"You can attach up to 5 images"}`.

- [ ] **Step 4: Commit**

```bash
git add app/api/recipes/parse-image/route.ts
git commit -m "Add POST /api/recipes/parse-image route"
```

---

### Task 4: Add Recipe page — tab switcher + Paste Text tab

**Files:**
- Modify: `app/recipes/new/page.tsx`

**Interfaces:**
- Consumes: `POST /api/recipes/parse-text` (Task 2).
- Produces: `applyImportedFields(result)` helper — Task 5 and Task 6 both call this same helper with their own route's response.

- [ ] **Step 1: Extract `applyImportedFields` and add Paste Text state/handler**

In `app/recipes/new/page.tsx`, replace the body of `NewRecipePageInner` from the top through `handleImport` with the version below (this factors the field-setting logic out of `handleImport` into a reusable helper, and adds the paste-text state/handler used by the new tab):

```tsx
function NewRecipePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [cookTimeMinutes, setCookTimeMinutes] = useState("");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { ingredient_name: "", quantity: "", unit: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"url" | "text" | "screenshot">("url");

  const [importUrl, setImportUrl] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [pasteText, setPasteText] = useState("");
  const [textImportError, setTextImportError] = useState<string | null>(null);
  const [textImporting, setTextImporting] = useState(false);

  function updateIngredient(index: number, field: keyof IngredientRow, value: string) {
    setIngredients((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function applyImportedFields(result: {
    name: string;
    ingredients: string[];
    cookTimeMinutes?: number | null;
    cuisine?: string | null;
    instructions?: string | null;
    image?: string | null;
  }) {
    setName(result.name);
    setIngredients(
      result.ingredients.map((text) => ({ ingredient_name: text, quantity: "", unit: "" }))
    );
    if (result.cookTimeMinutes) setCookTimeMinutes(String(result.cookTimeMinutes));
    if (result.cuisine) setCuisine(result.cuisine);
    if (result.instructions) setInstructions(result.instructions);
    if (result.image) setImageUrl(result.image);
  }

  async function handleImport(urlOverride?: string) {
    const url = urlOverride ?? importUrl;
    if (!url) return;
    setImportError(null);
    setImporting(true);
    try {
      const res = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = await res.json();
      if (!res.ok) {
        setImportError(body.error);
        return;
      }
      applyImportedFields({
        name: body.name,
        ingredients: body.ingredients,
        cookTimeMinutes: body.cookTimeMinutes,
        image: body.image,
      });
      // For a Pinterest share link, the API resolves and returns the actual
      // recipe page it points to - use that so "View Original Recipe" links
      // to the recipe, not back to the Pinterest pin.
      setSourceUrl(body.sourceUrl ?? url);
    } finally {
      setImporting(false);
    }
  }

  async function handleParseText() {
    if (!pasteText.trim()) return;
    setTextImportError(null);
    setTextImporting(true);
    try {
      const res = await fetch("/api/recipes/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });
      const body = await res.json();
      if (!res.ok) {
        setTextImportError(body.error);
        return;
      }
      applyImportedFields(body);
      setSourceUrl(null);
    } finally {
      setTextImporting(false);
    }
  }
```

Leave the rest of the file (the `useEffect` for share-target handling, `handleSubmit`, and everything from `return (` onward) untouched for now — Step 2 below replaces only the "Import from a URL" box's JSX.

- [ ] **Step 2: Replace the import box JSX with the tab switcher**

Replace this block:

```tsx
      <div className="mb-4 p-3 border rounded bg-gray-50">
        <p className="font-medium mb-1">Import from a URL</p>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded p-2"
            placeholder="https://example.com/recipe"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
          />
          <button
            type="button"
            onClick={() => handleImport()}
            disabled={importing}
            className="bg-gray-800 text-white rounded px-3 disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import"}
          </button>
        </div>
        {importError && <p className="text-red-600 text-sm mt-1">{importError}</p>}
      </div>
```

with:

```tsx
      <div className="mb-4 p-3 border rounded bg-gray-50">
        <div className="flex gap-3 mb-2 text-sm">
          {(["url", "text", "screenshot"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? "font-bold text-pink-600" : "text-gray-500"}
            >
              {tab === "url" ? "URL" : tab === "text" ? "Paste Text" : "Screenshot"}
            </button>
          ))}
        </div>

        {activeTab === "url" && (
          <div>
            <div className="flex gap-2">
              <input
                className="flex-1 border rounded p-2"
                placeholder="https://example.com/recipe"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
              />
              <button
                type="button"
                onClick={() => handleImport()}
                disabled={importing}
                className="bg-gray-800 text-white rounded px-3 disabled:opacity-50"
              >
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
            {importError && <p className="text-red-600 text-sm mt-1">{importError}</p>}
          </div>
        )}

        {activeTab === "text" && (
          <div>
            <textarea
              className="w-full border rounded p-2 mb-2"
              rows={5}
              placeholder="Paste the recipe text here"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <button
              type="button"
              onClick={handleParseText}
              disabled={textImporting || !pasteText.trim()}
              className="bg-gray-800 text-white rounded px-3 py-1 disabled:opacity-50"
            >
              {textImporting ? "Parsing..." : "Parse"}
            </button>
            {textImportError && <p className="text-red-600 text-sm mt-1">{textImportError}</p>}
          </div>
        )}
      </div>
```

(The `activeTab === "screenshot"` panel is added in Task 5 — leave it out for now.)

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors. (The `screenshot` tab button will exist with no matching content panel yet — that's fine, it just renders an empty box when selected, fixed by Task 5.)

- [ ] **Step 4: Manual verification in the browser**

With the dev server running, open `http://localhost:3002/recipes/new`. Confirm:
- The box now shows "URL / Paste Text / Screenshot" tabs, "URL" active by default, and the URL importer still works exactly as before (test with a known-good recipe URL).
- Click "Paste Text", paste a short recipe (e.g. the pancake text from Task 2's curl test), click "Parse", confirm the name/ingredients/instructions/cuisine fields populate below and the recipe saves correctly via "Save Recipe".
- Confirm switching tabs back and forth doesn't clear fields already populated in the form.

- [ ] **Step 5: Commit**

```bash
git add app/recipes/new/page.tsx
git commit -m "Add Paste Text recipe import tab"
```

---

### Task 5: Add Recipe page — Screenshot tab (upload/paste, no crop yet)

**Files:**
- Modify: `app/recipes/new/page.tsx`

**Interfaces:**
- Consumes: `POST /api/recipes/parse-image` (Task 3), `applyImportedFields` (Task 4).
- Produces: `screenshotImages: string[]` state (data URIs) and `handleParseScreenshots` — Task 6 reads `screenshotImages` after a successful parse to drive the crop step.

- [ ] **Step 1: Add screenshot state and handlers**

Add these alongside the other `useState` declarations from Task 4 (after the `pasteText`/`textImportError`/`textImporting` lines):

```tsx
  const [screenshotImages, setScreenshotImages] = useState<string[]>([]);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [screenshotImporting, setScreenshotImporting] = useState(false);
```

Add these functions after `handleParseText`:

```tsx
  const MAX_SCREENSHOT_IMAGES = 5;
  const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function addScreenshotFiles(files: File[]) {
    setScreenshotError(null);
    const accepted: string[] = [];
    for (const file of files) {
      if (screenshotImages.length + accepted.length >= MAX_SCREENSHOT_IMAGES) {
        setScreenshotError(`You can attach up to ${MAX_SCREENSHOT_IMAGES} images`);
        break;
      }
      if (!file.type.startsWith("image/")) {
        setScreenshotError("Only image files are supported");
        continue;
      }
      if (file.size > MAX_SCREENSHOT_BYTES) {
        setScreenshotError("Each image must be under 5MB");
        continue;
      }
      accepted.push(await readFileAsDataUrl(file));
    }
    if (accepted.length > 0) {
      setScreenshotImages((imgs) => [...imgs, ...accepted]);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    addScreenshotFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  }

  function handleScreenshotPaste(e: React.ClipboardEvent) {
    const files: File[] = [];
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      addScreenshotFiles(files);
    }
  }

  function removeScreenshotImage(index: number) {
    setScreenshotImages((imgs) => imgs.filter((_, i) => i !== index));
  }

  async function handleParseScreenshots() {
    if (screenshotImages.length === 0) return;
    setScreenshotError(null);
    setScreenshotImporting(true);
    try {
      const res = await fetch("/api/recipes/parse-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: screenshotImages }),
      });
      const body = await res.json();
      if (!res.ok) {
        setScreenshotError(body.error);
        return;
      }
      applyImportedFields(body);
      setSourceUrl(null);
    } finally {
      setScreenshotImporting(false);
    }
  }
```

- [ ] **Step 2: Add the Screenshot tab panel**

Add this right after the `activeTab === "text"` block from Task 4, still inside the same tab-switcher `<div>`:

```tsx
        {activeTab === "screenshot" && (
          <div onPaste={handleScreenshotPaste}>
            <label className="inline-block bg-gray-800 text-white rounded px-3 py-1 cursor-pointer mb-2">
              Choose screenshot(s)
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileInputChange}
                className="hidden"
              />
            </label>
            <p className="text-xs text-gray-500 mb-2">or paste a copied image</p>
            {screenshotImages.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {screenshotImages.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} alt="" className="w-16 h-16 object-cover rounded border" />
                    <button
                      type="button"
                      onClick={() => removeScreenshotImage(i)}
                      className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full w-5 h-5 text-xs"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={handleParseScreenshots}
              disabled={screenshotImporting || screenshotImages.length === 0}
              className="bg-gray-800 text-white rounded px-3 py-1 disabled:opacity-50"
            >
              {screenshotImporting ? "Importing..." : "Import"}
            </button>
            {screenshotError && <p className="text-red-600 text-sm mt-1">{screenshotError}</p>}
          </div>
        )}
```

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 4: Manual verification in the browser**

At `http://localhost:3002/recipes/new`, click the "Screenshot" tab:
- Use "Choose screenshot(s)" to pick a real screenshot of a recipe page (dish photo + ingredients visible). Confirm a thumbnail appears, the ✕ removes it, and re-adding works.
- Try copying an image (e.g. a screenshot on your clipboard) and pasting into the panel — confirm it adds a thumbnail the same way.
- Click "Import" and confirm the name/ingredients/instructions fields populate from the screenshot.
- Try selecting a 6th image and confirm the "up to 5 images" error appears.

- [ ] **Step 5: Commit**

```bash
git add app/recipes/new/page.tsx
git commit -m "Add Screenshot recipe import tab (upload and paste)"
```

---

### Task 6: `CropPanel` component + wiring into Add Recipe page

**Files:**
- Create: `app/recipes/new/CropPanel.tsx`
- Modify: `app/recipes/new/page.tsx`

**Interfaces:**
- Consumes: `screenshotImages`, `applyImportedFields`, `setImageUrl` (from `app/recipes/new/page.tsx`, Tasks 4/5).
- Produces: `<CropPanel images={string[]} onCropped={(dataUrl: string) => void} onSkip={() => void} />`.

- [ ] **Step 1: Implement `CropPanel`**

```tsx
"use client";

import { useRef, useState } from "react";

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropPanelProps {
  images: string[];
  onCropped: (dataUrl: string) => void;
  onSkip: () => void;
}

const HANDLE_SIZE = 16;
const MIN_BOX_SIZE = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export default function CropPanel({ images, onCropped, onSkip }: CropPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [box, setBox] = useState<CropBox | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    startBox: CropBox;
  } | null>(null);

  function initBox() {
    const img = imgRef.current;
    if (!img) return;
    const width = img.clientWidth * 0.6;
    const height = img.clientHeight * 0.6;
    setBox({
      x: (img.clientWidth - width) / 2,
      y: (img.clientHeight - height) / 2,
      width,
      height,
    });
  }

  function selectImage(index: number) {
    setSelectedIndex(index);
    setBox(null);
  }

  function handlePointerDown(e: React.PointerEvent, mode: "move" | "resize") {
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, startBox: box };
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const img = imgRef.current;
    if (!drag || !img) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (drag.mode === "move") {
      const maxX = Math.max(img.clientWidth - drag.startBox.width, 0);
      const maxY = Math.max(img.clientHeight - drag.startBox.height, 0);
      setBox({
        ...drag.startBox,
        x: clamp(drag.startBox.x + dx, 0, maxX),
        y: clamp(drag.startBox.y + dy, 0, maxY),
      });
    } else {
      const maxWidth = img.clientWidth - drag.startBox.x;
      const maxHeight = img.clientHeight - drag.startBox.y;
      setBox({
        ...drag.startBox,
        width: clamp(drag.startBox.width + dx, MIN_BOX_SIZE, maxWidth),
        height: clamp(drag.startBox.height + dy, MIN_BOX_SIZE, maxHeight),
      });
    }
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function useThisCrop() {
    const img = imgRef.current;
    if (!img || !box) return;
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(box.width * scaleX);
    canvas.height = Math.round(box.height * scaleY);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      img,
      box.x * scaleX,
      box.y * scaleY,
      box.width * scaleX,
      box.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );
    onCropped(canvas.toDataURL("image/jpeg", 0.85));
  }

  return (
    <div className="mb-4 p-3 border rounded bg-gray-50">
      <p className="font-medium mb-2">Crop the dish photo for the thumbnail</p>
      {images.length > 1 && (
        <div className="flex gap-2 mb-2">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectImage(i)}
              className={`border-2 rounded ${i === selectedIndex ? "border-pink-600" : "border-transparent"}`}
            >
              <img src={src} alt="" className="w-12 h-12 object-cover rounded" />
            </button>
          ))}
        </div>
      )}
      <div
        className="relative inline-block touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          ref={imgRef}
          src={images[selectedIndex]}
          alt="Uploaded screenshot"
          className="max-w-full max-h-96 block"
          onLoad={initBox}
        />
        {box && (
          <div
            className="absolute border-2 border-pink-600 bg-pink-600/20 cursor-move"
            style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
            onPointerDown={(e) => handlePointerDown(e, "move")}
          >
            <div
              className="absolute bg-pink-600 rounded-full cursor-nwse-resize"
              style={{
                right: -HANDLE_SIZE / 2,
                bottom: -HANDLE_SIZE / 2,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
              }}
              onPointerDown={(e) => handlePointerDown(e, "resize")}
            />
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <button type="button" onClick={useThisCrop} className="bg-pink-600 text-white rounded px-3 py-1">
          Use this crop
        </button>
        <button type="button" onClick={onSkip} className="text-gray-600 rounded px-3 py-1">
          Skip
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire `CropPanel` into the Add Recipe page**

In `app/recipes/new/page.tsx`, add the import at the top of the file:

```tsx
import CropPanel from "./CropPanel";
```

Add a new state variable alongside the screenshot state from Task 5:

```tsx
  const [cropImages, setCropImages] = useState<string[] | null>(null);
```

In `handleParseScreenshots`, after the existing `applyImportedFields(body);` and `setSourceUrl(null);` lines (still inside the `try` block, before `finally`), add:

```tsx
      setCropImages(screenshotImages);
```

Add these two handlers near the other screenshot handlers:

```tsx
  function handleCropped(dataUrl: string) {
    setImageUrl(dataUrl);
    setCropImages(null);
  }

  function handleSkipCrop() {
    setCropImages(null);
  }
```

Finally, render the panel right after the closing `</div>` of the tab-switcher box (the one containing the URL/Paste Text/Screenshot tabs), before the `<form onSubmit={handleSubmit} ...>`:

```tsx
      {cropImages && (
        <CropPanel images={cropImages} onCropped={handleCropped} onSkip={handleSkipCrop} />
      )}
```

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 4: Manual verification in the browser**

At `http://localhost:3002/recipes/new`, Screenshot tab: upload a real recipe screenshot with a visible dish photo, click Import. Confirm:
- The crop panel appears below the tab box, showing the uploaded image with a centered pink selection box.
- Dragging the box body moves it; dragging the bottom-right handle resizes it; both stay clamped within the image bounds.
- Clicking "Use this crop" closes the panel and the cropped image appears somewhere reasonable (there's no live thumbnail preview on this page today — confirm by saving the recipe and checking it shows the cropped photo, not the placeholder, on `/recipes` and the recipe's own detail page).
- Uploading 2+ images and confirming you can switch which one you're cropping from via the thumbnail strip.
- Clicking "Skip" closes the panel and the recipe saves with the placeholder image as before.

- [ ] **Step 5: Commit**

```bash
git add app/recipes/new/page.tsx app/recipes/new/CropPanel.tsx
git commit -m "Add screenshot-to-thumbnail crop step"
```

---

### Task 7: End-to-end verification and deploy to production

**Files:** none (verification and deployment only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new `recipeExtraction` tests from Task 1 and every pre-existing test (no regressions).

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: succeeds with no type or lint errors.

- [ ] **Step 3: Live re-test against the two real failures that motivated this feature**

Using the local dev server, take the two Pinterest pin URLs that failed in production earlier this session (the ones behind the "No recipe data found" and "This site blocks automatic recipe imports" errors) and, for each:
- Open the pin in a browser, copy the visible recipe text, paste it into the Paste Text tab, and confirm a usable recipe comes back.
- Take a screenshot of the same page (dish photo + ingredients) and confirm the Screenshot tab also recovers a usable recipe, and that cropping works on the real image.

Delete any test recipe rows created during this check afterward (via the app's own delete UI if it has one on the recipe detail page, or `npx wrangler d1 execute grocery-meal-planner --remote --command "DELETE FROM recipes WHERE id = '<id>'"` — match by id, not by name, per this repo's established cleanup pattern), so the wife's real recipe list doesn't accumulate test junk.

- [ ] **Step 4: Confirm no stray untracked files are being committed**

Run: `git status`
Expected: clean except for the commits already made in Tasks 1–6 (the pre-existing untracked `map layout/` directory from before this plan is unrelated and should stay untouched).

- [ ] **Step 5: Push to GitHub**

```bash
git push origin master
```

- [ ] **Step 6: Deploy straight to production via the Vercel CLI**

Per this repo's known issue (Vercel's GitHub auto-deploy has silently missed pushes before), don't rely on the push alone:

```bash
npx vercel --prod --yes
```

Expected: JSON output with `"readyState": "READY"` and `"target": "production"`.

- [ ] **Step 7: Verify the deploy actually landed on the stable production alias**

Since the new tabs live inside a `"use client"` page wrapped in `<Suspense fallback={null}>`, `curl`-ing the raw HTML won't show them (they only render after client-side hydration) — use the browser tool instead:

Navigate to `https://grocery-meal-planner-sigma.vercel.app/recipes/new` and confirm the "Paste Text" and "Screenshot" tabs are present and functional, the same way they were verified locally in Tasks 4–6.
