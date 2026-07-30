# Grocery & Meal Planner App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private Next.js web app (recipes, weekly meal planner, grocery list, purchase history, AI meal suggestions) deployed on Vercel from GitHub, backed by Supabase.

**Architecture:** Single Next.js (App Router, TypeScript) app. UI pages under `app/`, backend logic in `app/api/**/route.ts` handlers that talk to Supabase (server-side only, via service-role key) and to the Claude API. Shared pure logic (missing-ingredient calculation, recipe HTML parsing) lives in `lib/` and is unit-tested directly — no browser or database needed to test that logic. No authentication; the app is reached via a single unlisted URL.

**Tech Stack:** Next.js 14+ (App Router, TypeScript), Tailwind CSS, Supabase (Postgres) via `@supabase/supabase-js`, Vitest for unit tests, Vercel for hosting/deploy, GitHub for source control.

## Global Constraints

- Next.js is pinned to major version 14 (`create-next-app@14`) — Next 15+ changed dynamic route `params` to an async `Promise`, which would break every page/route handler in this plan that destructures `{ params }` synchronously.
- No login/auth system — single private URL (per spec's Access decision).
- All external API calls (Supabase writes, Claude, recipe-URL fetch) happen server-side in `app/api/**/route.ts` — API keys never shipped to the browser.
- Walmart "add to cart" uses a verified, unauthenticated deep link (`https://www.walmart.com/sc/cart/addToCart?items=...`) built from item IDs extracted out of pasted Walmart product URLs — confirmed working against a real account on 2026-07-29, requires no API key, no affiliate approval, and involves no external call at all (pure URL construction, opened client-side). Manual grocery-list entry always works regardless of whether an item has a linked Walmart URL.
- Testing is lightweight: automated unit tests only for the missing-ingredients calculation and the recipe URL parser; everything else is verified manually in the browser (per spec's Testing Approach).
- Mobile-first layout (primary user is on phone only).

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`, `vitest.config.ts`
- Create: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- Create: `app/components/NavBar.tsx`
- Create: `.env.local.example`
- Create: `.gitignore`
- Test: `__tests__/sanity.test.ts`

**Interfaces:**
- Produces: `app/components/NavBar.tsx` exporting default `NavBar()` — a bottom nav with links to `/`, `/grocery-list`, `/history`, `/recipes`, `/suggestions`. All later screen tasks render inside this layout.

- [ ] **Step 1: Scaffold the Next.js app**

Run:
```bash
cd "grocery-meal-planner"
npx create-next-app@14 . --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*" --use-npm --no-git
```
When prompted, accept defaults. This creates `package.json`, `tsconfig.json`, `tailwind.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`.

**Pinned to Next.js 14 deliberately:** Next.js 15+ made dynamic route `params` (in both route handlers and page components) an async `Promise` you must `await`, which would break every `{ params }: { params: { id: string } }` signature used in this plan's dynamic routes/pages (Tasks 4, 6, 7). Next 14 keeps `params` synchronous, matching the code below. Do not let `create-next-app` install a newer major version.

- [ ] **Step 2: Add Vitest for unit testing**

Run:
```bash
npm install -D vitest
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
});
```

Add to `package.json` scripts:
```json
"test": "vitest run"
```

- [ ] **Step 3: Write and run a sanity test**

Create `__tests__/sanity.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: PASS (1 test)

- [ ] **Step 4: Build the shared layout and nav**

Create `app/components/NavBar.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "This Week" },
  { href: "/grocery-list", label: "List" },
  { href: "/history", label: "History" },
  { href: "/recipes", label: "Recipes" },
  { href: "/suggestions", label: "Suggest" },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t bg-white py-2">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`text-xs px-2 py-1 ${
            pathname === link.href ? "font-bold text-blue-600" : "text-gray-500"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
```

Replace `app/layout.tsx` with:
```tsx
import "./globals.css";
import NavBar from "./components/NavBar";

export const metadata = {
  title: "Grocery & Meal Planner",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="pb-16 max-w-md mx-auto">
        {children}
        <NavBar />
      </body>
    </html>
  );
}
```

Replace `app/page.tsx` with a placeholder for now:
```tsx
export default function HomePage() {
  return <main className="p-4">This Week (coming in Task 8)</main>;
}
```

- [ ] **Step 5: Create env var template and gitignore entries**

Create `.env.local.example`:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

(No Walmart env var is needed — the "add to cart" feature in Task 9 works via URL construction only, no API key.)

Confirm `.gitignore` includes `.env*.local` and `node_modules` (create-next-app adds these by default — verify, don't duplicate if present).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js app with Tailwind, Vitest, and nav layout"
```

---

## Task 2: Supabase Schema and Client

**Files:**
- Create: `supabase/schema.sql`
- Create: `lib/types.ts`
- Create: `lib/supabase.ts`

**Interfaces:**
- Produces: `lib/types.ts` exporting `Recipe`, `RecipeIngredient`, `PurchaseItem`, `Purchase`, `WeeklyPlanEntry`, `GroceryListItem` — used by every API route task from here on.
- Produces: `lib/supabase.ts` exporting `getSupabaseClient(): SupabaseClient` — throws if env vars are missing. Used by every API route task from here on.

- [ ] **Step 1: Write the schema**

Create `supabase/schema.sql`:
```sql
create extension if not exists "pgcrypto";

create table recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text not null check (source in ('manual', 'url')),
  source_url text,
  instructions text,
  created_at timestamptz not null default now()
);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  ingredient_name text not null,
  quantity numeric,
  unit text
);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  completed_at date not null default current_date,
  items jsonb not null
);

create table weekly_plan (
  id uuid primary key default gen_random_uuid(),
  week_start_date date not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  recipe_id uuid references recipes(id) on delete set null,
  unique (week_start_date, day_of_week)
);

create table grocery_list (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  quantity numeric,
  source text not null check (source in ('planned', 'manual')),
  walmart_item_id text,
  added_at timestamptz not null default now()
);
```

- [ ] **Step 2: Ask the user to run the schema in Supabase**

This step needs the user's own Supabase account — ask them to:
1. Create a free project at supabase.com (if not already done).
2. Open the SQL editor in the Supabase dashboard, paste in the contents of `supabase/schema.sql`, and run it.
3. Copy the Project URL and the `service_role` key (Settings → API) and share them so they can go into `.env.local` (not committed to git).

Do not proceed to Step 3 until the user confirms the schema has been applied and provides the two values (or confirms they've added them directly to `.env.local` themselves).

- [ ] **Step 3: Create `.env.local` with real values**

Create `.env.local` (this file is gitignored, never committed) with the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` values from Step 2, plus a placeholder for `ANTHROPIC_API_KEY` to be filled in during Task 10.

- [ ] **Step 4: Define shared types**

Create `lib/types.ts`:
```typescript
export interface Recipe {
  id: string;
  name: string;
  source: "manual" | "url";
  source_url: string | null;
  instructions: string | null;
  created_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
}

export interface PurchaseItem {
  name: string;
  quantity: number;
}

export interface Purchase {
  id: string;
  completed_at: string;
  items: PurchaseItem[];
}

export interface WeeklyPlanEntry {
  id: string;
  week_start_date: string;
  day_of_week: number;
  recipe_id: string | null;
}

export interface GroceryListItem {
  id: string;
  item_name: string;
  quantity: number | null;
  source: "planned" | "manual";
  walmart_item_id: string | null;
  added_at: string;
}
```

- [ ] **Step 5: Create the Supabase client factory**

Run: `npm install @supabase/supabase-js`

Create `lib/supabase.ts`:
```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured");
  }
  cachedClient = createClient(url, key);
  return cachedClient;
}
```

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql lib/types.ts lib/supabase.ts .env.local.example
git commit -m "Add Supabase schema, shared types, and client factory"
```

---

## Task 3: GitHub + Vercel Deployment Pipeline

**Files:**
- Modify: none (infrastructure task)

**Interfaces:**
- Produces: a live Vercel URL that redeploys automatically on every push to `main`. Later tasks assume this pipeline exists but don't depend on any code from this task.

- [ ] **Step 1: Ask the user to confirm before creating a GitHub repo**

Ask: "Ready to create a GitHub repo for this (public or private?) and push the current code — confirm before I proceed." Creating repos and pushing code are visible, hard-to-fully-reverse actions, so get an explicit yes first.

- [ ] **Step 2: Create and push the GitHub repo**

Run (after confirmation, using the visibility the user specified):
```bash
gh repo create grocery-meal-planner --private --source=. --remote=origin
git push -u origin master
```

- [ ] **Step 3: Connect Vercel**

Ask the user to run `vercel login` themselves in a terminal (this opens a browser auth flow tied to their account) if they haven't already. Then run:
```bash
npx vercel link
```
Follow the prompts to link to the GitHub repo just created.

- [ ] **Step 4: Add environment variables to Vercel**

Run:
```bash
npx vercel env add SUPABASE_URL production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
```
Paste the same values from `.env.local` when prompted. (Repeat for `ANTHROPIC_API_KEY` once it exists, in Task 10 — no other env vars are needed.)

- [ ] **Step 5: Deploy and verify**

Run:
```bash
npx vercel --prod
```
Open the resulting URL in the browser preview tool and confirm the placeholder "This Week (coming in Task 8)" page loads without errors.

- [ ] **Step 6: Verify auto-deploy on push**

Make a trivial change (e.g., a comment) to `app/page.tsx`, commit, and push to `master`. Confirm in the Vercel dashboard (or `npx vercel ls`) that a new deployment triggers automatically.

```bash
git add -A
git commit -m "Verify Vercel auto-deploy on push"
git push
```

---

## Task 4: Recipes — Manual CRUD

**Files:**
- Create: `app/api/recipes/route.ts`
- Create: `app/api/recipes/[id]/route.ts`
- Create: `app/recipes/page.tsx`
- Create: `app/recipes/new/page.tsx`
- Create: `app/recipes/[id]/page.tsx`

**Interfaces:**
- Consumes: `getSupabaseClient()` from `lib/supabase.ts`; `Recipe`, `RecipeIngredient` from `lib/types.ts`.
- Produces: `GET /api/recipes` → `Recipe[]`; `POST /api/recipes` (body: `{name, instructions, ingredients: {ingredient_name, quantity, unit}[]}`) → created `Recipe`; `GET /api/recipes/:id` → `{recipe: Recipe, ingredients: RecipeIngredient[]}`; `PUT /api/recipes/:id`; `DELETE /api/recipes/:id`. Task 5 (URL import), Task 8 (planner), and Task 10 (suggestions) all read from `/api/recipes`.

- [ ] **Step 1: Recipes list + create API route**

Create `app/api/recipes/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, instructions, source, source_url, ingredients } = body;
  if (!name || !Array.isArray(ingredients) || ingredients.length === 0) {
    return NextResponse.json(
      { error: "name and at least one ingredient are required" },
      { status: 400 }
    );
  }
  const supabase = getSupabaseClient();
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({ name, instructions: instructions ?? null, source: source ?? "manual", source_url: source_url ?? null })
    .select()
    .single();
  if (recipeError) return NextResponse.json({ error: recipeError.message }, { status: 500 });

  const rows = ingredients.map((ing: { ingredient_name: string; quantity?: number; unit?: string }) => ({
    recipe_id: recipe.id,
    ingredient_name: ing.ingredient_name,
    quantity: ing.quantity ?? null,
    unit: ing.unit ?? null,
  }));
  const { error: ingredientsError } = await supabase.from("recipe_ingredients").insert(rows);
  if (ingredientsError) return NextResponse.json({ error: ingredientsError.message }, { status: 500 });

  return NextResponse.json(recipe, { status: 201 });
}
```

- [ ] **Step 2: Recipe detail/update/delete API route**

Create `app/api/recipes/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseClient();
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", params.id)
    .single();
  if (recipeError) return NextResponse.json({ error: recipeError.message }, { status: 404 });
  const { data: ingredients, error: ingredientsError } = await supabase
    .from("recipe_ingredients")
    .select("*")
    .eq("recipe_id", params.id);
  if (ingredientsError) return NextResponse.json({ error: ingredientsError.message }, { status: 500 });
  return NextResponse.json({ recipe, ingredients });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("recipes").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Recipes list page**

Create `app/recipes/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Recipe } from "@/lib/types";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    fetch("/api/recipes")
      .then((r) => r.json())
      .then(setRecipes);
  }, []);

  return (
    <main className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Recipes</h1>
        <Link href="/recipes/new" className="text-blue-600">+ Add</Link>
      </div>
      <ul className="space-y-2">
        {recipes.map((r) => (
          <li key={r.id}>
            <Link href={`/recipes/${r.id}`} className="block p-3 border rounded">
              {r.name}
            </Link>
          </li>
        ))}
        {recipes.length === 0 && <p className="text-gray-500">No recipes yet.</p>}
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: Add-recipe page (manual entry)**

Create `app/recipes/new/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface IngredientRow {
  ingredient_name: string;
  quantity: string;
  unit: string;
}

export default function NewRecipePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { ingredient_name: "", quantity: "", unit: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  function updateIngredient(index: number, field: keyof IngredientRow, value: string) {
    setIngredients((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      name,
      instructions,
      source: "manual",
      ingredients: ingredients
        .filter((row) => row.ingredient_name.trim() !== "")
        .map((row) => ({
          ingredient_name: row.ingredient_name,
          quantity: row.quantity ? Number(row.quantity) : null,
          unit: row.unit || null,
        })),
    };
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Could not save recipe");
      return;
    }
    router.push("/recipes");
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">Add Recipe</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="w-full border rounded p-2"
          placeholder="Recipe name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="w-full border rounded p-2"
          placeholder="Instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
        <div>
          <p className="font-medium mb-1">Ingredients</p>
          {ingredients.map((row, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                className="flex-1 border rounded p-2"
                placeholder="Ingredient"
                value={row.ingredient_name}
                onChange={(e) => updateIngredient(i, "ingredient_name", e.target.value)}
              />
              <input
                className="w-16 border rounded p-2"
                placeholder="Qty"
                value={row.quantity}
                onChange={(e) => updateIngredient(i, "quantity", e.target.value)}
              />
              <input
                className="w-16 border rounded p-2"
                placeholder="Unit"
                value={row.unit}
                onChange={(e) => updateIngredient(i, "unit", e.target.value)}
              />
            </div>
          ))}
          <button
            type="button"
            className="text-blue-600 text-sm"
            onClick={() =>
              setIngredients((rows) => [...rows, { ingredient_name: "", quantity: "", unit: "" }])
            }
          >
            + Add ingredient
          </button>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" className="w-full bg-blue-600 text-white rounded p-2">
          Save Recipe
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Recipe detail page**

Create `app/recipes/[id]/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Recipe, RecipeIngredient } from "@/lib/types";

export default function RecipeDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);

  useEffect(() => {
    fetch(`/api/recipes/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setRecipe(data.recipe);
        setIngredients(data.ingredients);
      });
  }, [params.id]);

  async function handleDelete() {
    await fetch(`/api/recipes/${params.id}`, { method: "DELETE" });
    router.push("/recipes");
  }

  if (!recipe) return <main className="p-4">Loading...</main>;

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-2">{recipe.name}</h1>
      <ul className="list-disc pl-5 mb-4">
        {ingredients.map((ing) => (
          <li key={ing.id}>
            {ing.quantity ?? ""} {ing.unit ?? ""} {ing.ingredient_name}
          </li>
        ))}
      </ul>
      {recipe.instructions && <p className="mb-4 whitespace-pre-wrap">{recipe.instructions}</p>}
      <button onClick={handleDelete} className="text-red-600 text-sm">
        Delete Recipe
      </button>
    </main>
  );
}
```

- [ ] **Step 6: Manual verification**

Run `npm run dev`, open the app in the browser preview tool, go to Recipes → Add Recipe, fill in a name and two ingredients, save, confirm it appears in the list and the detail page shows the ingredients, then delete it and confirm it's gone.

- [ ] **Step 7: Commit**

```bash
git add app/api/recipes app/recipes
git commit -m "Add recipe CRUD (manual entry, list, detail, delete)"
```

---

## Task 5: Recipe Import from URL

**Files:**
- Create: `lib/recipeParser.ts`
- Create: `app/api/recipes/import/route.ts`
- Modify: `app/recipes/new/page.tsx`
- Test: `__tests__/recipeParser.test.ts`

**Interfaces:**
- Produces: `parseRecipeFromHtml(html: string): { name: string; ingredients: string[] } | null` in `lib/recipeParser.ts`.
- Consumes (modify): the ingredient rows state shape from Task 4's `app/recipes/new/page.tsx`.

- [ ] **Step 1: Write the failing parser tests**

Create `__tests__/recipeParser.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parseRecipeFromHtml } from "@/lib/recipeParser";

describe("parseRecipeFromHtml", () => {
  it("extracts a recipe from a JSON-LD script tag", () => {
    const html = `
      <html><head>
      <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Recipe","name":"Tacos","recipeIngredient":["1 lb ground beef","8 tortillas","1 cup cheese"]}
      </script>
      </head><body></body></html>
    `;
    const result = parseRecipeFromHtml(html);
    expect(result).toEqual({
      name: "Tacos",
      ingredients: ["1 lb ground beef", "8 tortillas", "1 cup cheese"],
    });
  });

  it("finds a Recipe node nested in an @graph array", () => {
    const html = `
      <script type="application/ld+json">
      {"@graph":[{"@type":"WebPage"},{"@type":"Recipe","name":"Soup","recipeIngredient":["broth","noodles"]}]}
      </script>
    `;
    const result = parseRecipeFromHtml(html);
    expect(result).toEqual({ name: "Soup", ingredients: ["broth", "noodles"] });
  });

  it("returns null when no recipe data is present", () => {
    const html = "<html><body><p>Just a blog post, no recipe here.</p></body></html>";
    expect(parseRecipeFromHtml(html)).toBeNull();
  });

  it("returns null on malformed JSON-LD instead of throwing", () => {
    const html = `<script type="application/ld+json">{not valid json</script>`;
    expect(parseRecipeFromHtml(html)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `lib/recipeParser.ts` does not exist yet.

- [ ] **Step 3: Implement the parser**

Create `lib/recipeParser.ts`:
```typescript
export interface ParsedRecipe {
  name: string;
  ingredients: string[];
}

export function parseRecipeFromHtml(html: string): ParsedRecipe | null {
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1].trim());
      const candidates = Array.isArray(json) ? json : [json];
      for (const candidate of candidates) {
        const recipe = findRecipeNode(candidate);
        if (recipe) return recipe;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function findRecipeNode(node: unknown): ParsedRecipe | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;

  const graph = obj["@graph"];
  if (Array.isArray(graph)) {
    for (const item of graph) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
  }

  const type = obj["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.includes("Recipe")) {
    const rawIngredients = obj.recipeIngredient ?? obj.ingredients;
    const ingredients = Array.isArray(rawIngredients)
      ? rawIngredients.filter((i): i is string => typeof i === "string")
      : [];
    if (typeof obj.name === "string" && ingredients.length > 0) {
      return { name: obj.name, ingredients };
    }
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all 4 recipeParser tests, plus the earlier sanity test)

- [ ] **Step 5: Import API route**

Create `app/api/recipes/import/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { parseRecipeFromHtml } from "@/lib/recipeParser";

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    html = await res.text();
  } catch {
    return NextResponse.json({ error: "Could not fetch that URL" }, { status: 502 });
  }

  const parsed = parseRecipeFromHtml(html);
  if (!parsed) {
    return NextResponse.json(
      { error: "No recipe data found on that page — paste the ingredients manually instead" },
      { status: 422 }
    );
  }
  return NextResponse.json(parsed);
}
```

- [ ] **Step 6: Wire the import UI into the add-recipe page**

Modify `app/recipes/new/page.tsx`: add an import section above the manual form. Add these imports/state near the top of the component (alongside the existing `name`, `instructions`, `ingredients`, `error` state):
```tsx
const [importUrl, setImportUrl] = useState("");
const [importError, setImportError] = useState<string | null>(null);
```

Add this handler inside the component, above `handleSubmit`:
```tsx
async function handleImport() {
  setImportError(null);
  const res = await fetch("/api/recipes/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: importUrl }),
  });
  const body = await res.json();
  if (!res.ok) {
    setImportError(body.error);
    return;
  }
  setName(body.name);
  setIngredients(
    body.ingredients.map((text: string) => ({ ingredient_name: text, quantity: "", unit: "" }))
  );
}
```

Add this JSX block right after the `<h1>` in the returned markup, before the existing `<form>`:
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
    <button type="button" onClick={handleImport} className="bg-gray-800 text-white rounded px-3">
      Import
    </button>
  </div>
  {importError && <p className="text-red-600 text-sm mt-1">{importError}</p>}
</div>
```

- [ ] **Step 7: Manual verification**

Run `npm run dev`, open Recipes → Add Recipe, paste a URL from a real recipe blog/site into the import box, click Import, confirm the name and ingredient fields populate. Then try a non-recipe URL (e.g. a plain news article) and confirm the error message appears and the manual form below still works.

- [ ] **Step 8: Commit**

```bash
git add lib/recipeParser.ts app/api/recipes/import __tests__/recipeParser.test.ts app/recipes/new/page.tsx
git commit -m "Add recipe import from URL with JSON-LD parsing and manual fallback"
```

---

## Task 6: Grocery List

**Files:**
- Create: `lib/walmart.ts`
- Create: `app/api/grocery-list/route.ts`
- Create: `app/api/grocery-list/[id]/route.ts`
- Create: `app/api/grocery-list/complete/route.ts`
- Create: `app/grocery-list/page.tsx`
- Test: `__tests__/walmart.test.ts`

**Interfaces:**
- Consumes: `GroceryListItem`, `PurchaseItem` from `lib/types.ts`.
- Produces: `extractWalmartItemId(url: string): string | null` in `lib/walmart.ts` — pulls the numeric item ID out of a Walmart product page URL (e.g. `walmart.com/ip/.../10450115` → `"10450115"`), returns `null` for anything that isn't a recognizable Walmart product URL. Task 9 extends this same file with `buildWalmartCartUrl`.
- Produces: `GET /api/grocery-list` → `GroceryListItem[]`; `POST /api/grocery-list` (body: `{item_name, quantity, source, walmart_url?}`) → created item, with `walmart_item_id` set if `walmart_url` was a recognizable product link; `DELETE /api/grocery-list/:id`; `POST /api/grocery-list/complete` → moves all current items into a new `purchases` row and clears `grocery_list`, returns the created `Purchase`. Task 7 (History) reads from `purchases`. Task 8 (planner) writes rows into `grocery_list` with `source: "planned"`.

- [ ] **Step 1: Write the failing test for the item-ID extractor**

Create `__tests__/walmart.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { extractWalmartItemId } from "@/lib/walmart";

describe("extractWalmartItemId", () => {
  it("extracts the numeric ID from a standard product URL", () => {
    expect(
      extractWalmartItemId(
        "https://www.walmart.com/ip/Great-Value-2-Reduced-Fat-Milk-Gallon-Refrigerated/10450115"
      )
    ).toBe("10450115");
  });

  it("extracts the ID when the URL has query parameters", () => {
    expect(
      extractWalmartItemId(
        "https://www.walmart.com/ip/Great-Value-Large-White-Eggs-12-Count/145051970?athAsset=abc"
      )
    ).toBe("145051970");
  });

  it("returns null for a non-Walmart URL", () => {
    expect(extractWalmartItemId("https://www.target.com/p/milk/12345")).toBeNull();
  });

  it("returns null for a Walmart URL with no /ip/ product path", () => {
    expect(extractWalmartItemId("https://www.walmart.com/search?q=milk")).toBeNull();
  });

  it("returns null instead of throwing on a malformed string", () => {
    expect(extractWalmartItemId("not a url")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `lib/walmart.ts` does not exist yet.

- [ ] **Step 3: Implement the item-ID extractor**

Create `lib/walmart.ts`:
```typescript
export function extractWalmartItemId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!parsed.hostname.endsWith("walmart.com")) return null;
  const match = parsed.pathname.match(/\/ip\/[^/]+\/(\d+)/);
  return match ? match[1] : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all 5 walmart tests, plus everything from earlier tasks)

- [ ] **Step 5: List + add-item API route**

Create `app/api/grocery-list/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { extractWalmartItemId } from "@/lib/walmart";

export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("grocery_list")
    .select("*")
    .order("added_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { item_name, quantity, source, walmart_url } = await req.json();
  if (!item_name) {
    return NextResponse.json({ error: "item_name is required" }, { status: 400 });
  }
  const walmart_item_id = walmart_url ? extractWalmartItemId(walmart_url) : null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("grocery_list")
    .insert({ item_name, quantity: quantity ?? null, source: source ?? "manual", walmart_item_id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 6: Delete-item API route**

Create `app/api/grocery-list/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("grocery_list").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Complete-list API route**

Create `app/api/grocery-list/complete/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function POST() {
  const supabase = getSupabaseClient();
  const { data: items, error: fetchError } = await supabase.from("grocery_list").select("*");
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Grocery list is empty" }, { status: 400 });
  }

  const purchaseItems = items.map((item) => ({ name: item.item_name, quantity: item.quantity ?? 1 }));
  const { data: purchase, error: insertError } = await supabase
    .from("purchases")
    .insert({ items: purchaseItems })
    .select()
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { error: clearError } = await supabase
    .from("grocery_list")
    .delete()
    .in("id", items.map((i) => i.id));
  if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });

  return NextResponse.json(purchase, { status: 201 });
}
```

- [ ] **Step 8: Grocery list page**

Create `app/grocery-list/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import type { GroceryListItem } from "@/lib/types";

export default function GroceryListPage() {
  const [items, setItems] = useState<GroceryListItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [newItemLink, setNewItemLink] = useState("");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    fetch("/api/grocery-list")
      .then((r) => r.json())
      .then(setItems);
  }

  useEffect(refresh, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    await fetch("/api/grocery-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_name: newItem,
        source: "manual",
        walmart_url: newItemLink.trim() || undefined,
      }),
    });
    setNewItem("");
    setNewItemLink("");
    refresh();
  }

  async function handleRemove(id: string) {
    await fetch(`/api/grocery-list/${id}`, { method: "DELETE" });
    refresh();
  }

  async function handleComplete() {
    setError(null);
    const res = await fetch("/api/grocery-list/complete", { method: "POST" });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Could not complete list");
      return;
    }
    refresh();
  }

  const planned = items.filter((i) => i.source === "planned");
  const manual = items.filter((i) => i.source === "manual");

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">Grocery List</h1>

      <form onSubmit={handleAdd} className="space-y-2 mb-4">
        <input
          className="w-full border rounded p-2"
          placeholder="Add an item"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
        />
        <input
          className="w-full border rounded p-2 text-sm"
          placeholder="Walmart product link (optional)"
          value={newItemLink}
          onChange={(e) => setNewItemLink(e.target.value)}
        />
        <button type="submit" className="w-full bg-gray-800 text-white rounded p-2">Add</button>
      </form>

      {planned.length > 0 && (
        <div className="mb-4">
          <p className="font-medium mb-1">From this week's plan</p>
          <ul className="space-y-1">
            {planned.map((item) => (
              <ListRow key={item.id} item={item} onRemove={handleRemove} />
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4">
        <p className="font-medium mb-1">Extra items</p>
        <ul className="space-y-1">
          {manual.map((item) => (
            <ListRow key={item.id} item={item} onRemove={handleRemove} />
          ))}
          {manual.length === 0 && <p className="text-gray-500 text-sm">None added yet.</p>}
        </ul>
      </div>

      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <button
        onClick={handleComplete}
        className="w-full bg-blue-600 text-white rounded p-2"
        disabled={items.length === 0}
      >
        Complete List
      </button>
    </main>
  );
}

function ListRow({ item, onRemove }: { item: GroceryListItem; onRemove: (id: string) => void }) {
  return (
    <li className="flex justify-between items-center border-b py-1">
      <span>
        {item.item_name}{item.quantity ? ` (${item.quantity})` : ""}
        {item.walmart_item_id && <span className="text-xs text-green-700 ml-1">(linked)</span>}
      </span>
      <button onClick={() => onRemove(item.id)} className="text-red-600 text-sm">Remove</button>
    </li>
  );
}
```

- [ ] **Step 9: Manual verification**

Run `npm run dev`, open Grocery List, add a manual item with no link, then add another item pasting in a real Walmart product URL (e.g. `https://www.walmart.com/ip/Great-Value-2-Reduced-Fat-Milk-Gallon-Refrigerated/10450115`) and confirm it shows the "(linked)" tag. Remove one item, then click Complete List and confirm the list clears and no error shows. Confirm clicking Complete List on an empty list shows the "Grocery list is empty" error instead of crashing.

- [ ] **Step 10: Commit**

```bash
git add lib/walmart.ts __tests__/walmart.test.ts app/api/grocery-list app/grocery-list
git commit -m "Add grocery list with manual items, Walmart link capture, and complete-to-history flow"
```

---

## Task 7: Purchase History

**Files:**
- Create: `app/api/purchases/route.ts`
- Create: `app/api/purchases/[id]/route.ts`
- Create: `app/history/page.tsx`
- Create: `app/history/[id]/page.tsx`

**Interfaces:**
- Consumes: `Purchase` from `lib/types.ts`; the `purchases` table populated by Task 6's complete-list route.
- Produces: `GET /api/purchases` → `Purchase[]`; `GET /api/purchases/:id` → `Purchase`. Task 8 (missing-ingredients calc) and Task 10 (suggestions) both read from `GET /api/purchases`.

- [ ] **Step 1: Purchases list API route**

Create `app/api/purchases/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .order("completed_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Purchase detail API route**

Create `app/api/purchases/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .eq("id", params.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}
```

- [ ] **Step 3: History list page**

Create `app/history/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Purchase } from "@/lib/types";

export default function HistoryPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  useEffect(() => {
    fetch("/api/purchases")
      .then((r) => r.json())
      .then(setPurchases);
  }, []);

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">History</h1>
      <ul className="space-y-2">
        {purchases.map((p) => (
          <li key={p.id}>
            <Link href={`/history/${p.id}`} className="block p-3 border rounded">
              {p.completed_at} — {p.items.length} items
            </Link>
          </li>
        ))}
        {purchases.length === 0 && <p className="text-gray-500">No completed lists yet.</p>}
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: History detail page**

Create `app/history/[id]/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import type { Purchase } from "@/lib/types";

export default function HistoryDetailPage({ params }: { params: { id: string } }) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);

  useEffect(() => {
    fetch(`/api/purchases/${params.id}`)
      .then((r) => r.json())
      .then(setPurchase);
  }, [params.id]);

  if (!purchase) return <main className="p-4">Loading...</main>;

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-2">{purchase.completed_at}</h1>
      <ul className="list-disc pl-5">
        {purchase.items.map((item, i) => (
          <li key={i}>{item.name}{item.quantity ? ` (${item.quantity})` : ""}</li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 5: Manual verification**

Run `npm run dev`. Using the list from Task 6, add items and complete a list, then open History and confirm it appears with today's date, and that clicking into it shows the items.

- [ ] **Step 6: Commit**

```bash
git add app/api/purchases app/history
git commit -m "Add purchase history list and detail views"
```

---

## Task 8: Weekly Planner and Missing-Ingredients Logic

**Files:**
- Create: `lib/ingredients.ts`
- Create: `app/api/weekly-plan/route.ts`
- Modify: `app/page.tsx`
- Test: `__tests__/ingredients.test.ts`

**Interfaces:**
- Consumes: `RecipeIngredient`, `PurchaseItem` from `lib/types.ts`; `GET /api/recipes`, `GET /api/purchases`, `POST /api/grocery-list` from earlier tasks.
- Produces: `computeMissingIngredients(recipeIngredients: RecipeIngredient[], recentPurchases: PurchaseItem[]): RecipeIngredient[]` in `lib/ingredients.ts`. `GET /api/weekly-plan?week_start_date=YYYY-MM-DD` → `WeeklyPlanEntry[]`; `POST /api/weekly-plan` (body: `{week_start_date, day_of_week, recipe_id}`) → upserts the day's assignment and adds that recipe's missing ingredients to `grocery_list` with `source: "planned"`.

- [ ] **Step 1: Write the failing ingredients test**

Create `__tests__/ingredients.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { computeMissingIngredients } from "@/lib/ingredients";
import type { RecipeIngredient, PurchaseItem } from "@/lib/types";

function ing(name: string): RecipeIngredient {
  return { id: name, recipe_id: "r1", ingredient_name: name, quantity: 1, unit: null };
}

describe("computeMissingIngredients", () => {
  it("returns ingredients not present in recent purchases", () => {
    const recipeIngredients = [ing("chicken"), ing("rice"), ing("broccoli")];
    const recentPurchases: PurchaseItem[] = [{ name: "chicken", quantity: 1 }];
    const result = computeMissingIngredients(recipeIngredients, recentPurchases);
    expect(result.map((i) => i.ingredient_name)).toEqual(["rice", "broccoli"]);
  });

  it("matches names case-insensitively and ignores extra whitespace", () => {
    const recipeIngredients = [ing("Chicken")];
    const recentPurchases: PurchaseItem[] = [{ name: "  chicken  ", quantity: 1 }];
    expect(computeMissingIngredients(recipeIngredients, recentPurchases)).toEqual([]);
  });

  it("returns everything when there are no recent purchases", () => {
    const recipeIngredients = [ing("eggs"), ing("milk")];
    expect(computeMissingIngredients(recipeIngredients, [])).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `lib/ingredients.ts` does not exist yet.

- [ ] **Step 3: Implement the missing-ingredients logic**

Create `lib/ingredients.ts`:
```typescript
import type { RecipeIngredient, PurchaseItem } from "./types";

export function computeMissingIngredients(
  recipeIngredients: RecipeIngredient[],
  recentPurchases: PurchaseItem[]
): RecipeIngredient[] {
  const purchasedNames = new Set(recentPurchases.map((p) => p.name.trim().toLowerCase()));
  return recipeIngredients.filter(
    (ing) => !purchasedNames.has(ing.ingredient_name.trim().toLowerCase())
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all tests, including the 3 new ingredients tests)

- [ ] **Step 5: Weekly plan API route**

Create `app/api/weekly-plan/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { computeMissingIngredients } from "@/lib/ingredients";
import type { PurchaseItem } from "@/lib/types";

export async function GET(req: NextRequest) {
  const weekStartDate = req.nextUrl.searchParams.get("week_start_date");
  if (!weekStartDate) {
    return NextResponse.json({ error: "week_start_date is required" }, { status: 400 });
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("weekly_plan")
    .select("*")
    .eq("week_start_date", weekStartDate);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { week_start_date, day_of_week, recipe_id } = await req.json();
  if (!week_start_date || day_of_week === undefined || !recipe_id) {
    return NextResponse.json(
      { error: "week_start_date, day_of_week, and recipe_id are required" },
      { status: 400 }
    );
  }
  const supabase = getSupabaseClient();

  const { data: entry, error: upsertError } = await supabase
    .from("weekly_plan")
    .upsert(
      { week_start_date, day_of_week, recipe_id },
      { onConflict: "week_start_date,day_of_week" }
    )
    .select()
    .single();
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  const { data: recipeIngredients, error: ingredientsError } = await supabase
    .from("recipe_ingredients")
    .select("*")
    .eq("recipe_id", recipe_id);
  if (ingredientsError) return NextResponse.json({ error: ingredientsError.message }, { status: 500 });

  const since = new Date();
  since.setDate(since.getDate() - 14);
  const { data: recentPurchases, error: purchasesError } = await supabase
    .from("purchases")
    .select("items")
    .gte("completed_at", since.toISOString().slice(0, 10));
  if (purchasesError) return NextResponse.json({ error: purchasesError.message }, { status: 500 });

  const allRecentItems: PurchaseItem[] = (recentPurchases ?? []).flatMap((p) => p.items as PurchaseItem[]);
  const missing = computeMissingIngredients(recipeIngredients ?? [], allRecentItems);

  if (missing.length > 0) {
    const rows = missing.map((ing) => ({
      item_name: ing.ingredient_name,
      quantity: ing.quantity,
      source: "planned" as const,
    }));
    const { error: insertError } = await supabase.from("grocery_list").insert(rows);
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(entry, { status: 201 });
}
```

- [ ] **Step 6: This Week page**

Replace `app/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import type { Recipe, WeeklyPlanEntry } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day);
  return sunday.toISOString().slice(0, 10);
}

export default function HomePage() {
  const weekStartDate = getWeekStart();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plan, setPlan] = useState<WeeklyPlanEntry[]>([]);

  function refreshPlan() {
    fetch(`/api/weekly-plan?week_start_date=${weekStartDate}`)
      .then((r) => r.json())
      .then(setPlan);
  }

  useEffect(() => {
    fetch("/api/recipes").then((r) => r.json()).then(setRecipes);
    refreshPlan();
  }, []);

  async function assignRecipe(dayOfWeek: number, recipeId: string) {
    if (!recipeId) return;
    await fetch("/api/weekly-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start_date: weekStartDate, day_of_week: dayOfWeek, recipe_id: recipeId }),
    });
    refreshPlan();
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">This Week</h1>
      <ul className="space-y-2">
        {DAYS.map((label, i) => {
          const entry = plan.find((p) => p.day_of_week === i);
          const assignedRecipe = recipes.find((r) => r.id === entry?.recipe_id);
          return (
            <li key={i} className="flex justify-between items-center border-b py-2">
              <span className="w-10 font-medium">{label}</span>
              <select
                className="flex-1 border rounded p-2 ml-2"
                value={entry?.recipe_id ?? ""}
                onChange={(e) => assignRecipe(i, e.target.value)}
              >
                <option value="">— none —</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
      <p className="text-gray-500 text-sm mt-4">
        Assigning a recipe adds its missing ingredients to your grocery list.
      </p>
    </main>
  );
}
```

- [ ] **Step 7: Manual verification**

Run `npm run dev`. On This Week, assign a saved recipe (from Task 4/5) to a day, then open Grocery List and confirm the recipe's ingredients appear under "From this week's plan" (any ingredients matching a recent purchase from Task 6/7 should be excluded).

- [ ] **Step 8: Commit**

```bash
git add lib/ingredients.ts app/api/weekly-plan app/page.tsx __tests__/ingredients.test.ts
git commit -m "Add weekly planner with auto missing-ingredients to grocery list"
```

---

## Task 9: Walmart Add-to-Cart Deep Link

**Files:**
- Modify: `lib/walmart.ts`
- Modify: `app/grocery-list/page.tsx`
- Modify: `__tests__/walmart.test.ts`

**Interfaces:**
- Consumes: `extractWalmartItemId` and the `lib/walmart.ts` module from Task 6; `GroceryListItem` from `lib/types.ts`.
- Produces: `buildWalmartCartUrl(items: {walmart_item_id: string; quantity?: number | null}[]): string` in `lib/walmart.ts`, building `https://www.walmart.com/sc/cart/addToCart?items=...` — verified against a live Walmart account on 2026-07-29 (opens in the browser, adds items directly to the cart of whoever is logged into walmart.com in that browser, no API key or affiliate approval required).

- [ ] **Step 1: Write the failing test for the cart-link builder**

Add to `__tests__/walmart.test.ts` (alongside the existing `extractWalmartItemId` tests):
```typescript
import { buildWalmartCartUrl } from "@/lib/walmart";

describe("buildWalmartCartUrl", () => {
  it("builds a URL with a single item and no quantity suffix when quantity is 1", () => {
    const url = buildWalmartCartUrl([{ walmart_item_id: "10450115", quantity: 1 }]);
    expect(url).toBe("https://www.walmart.com/sc/cart/addToCart?items=10450115");
  });

  it("builds a URL with multiple items, adding a quantity suffix when quantity > 1", () => {
    const url = buildWalmartCartUrl([
      { walmart_item_id: "10450115", quantity: 2 },
      { walmart_item_id: "145051970", quantity: 1 },
    ]);
    expect(url).toBe("https://www.walmart.com/sc/cart/addToCart?items=10450115_2,145051970");
  });

  it("treats a missing quantity the same as quantity 1", () => {
    const url = buildWalmartCartUrl([{ walmart_item_id: "10450115" }]);
    expect(url).toBe("https://www.walmart.com/sc/cart/addToCart?items=10450115");
  });
});
```

(Add the `describe`/`it`/`expect` import names to the existing top-of-file `import { describe, it, expect } from "vitest";` line if not already present — don't duplicate the import statement.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `buildWalmartCartUrl` is not exported from `lib/walmart.ts` yet.

- [ ] **Step 3: Implement the cart-link builder**

Modify `lib/walmart.ts`, adding this below `extractWalmartItemId`:
```typescript
export interface CartLinkItem {
  walmart_item_id: string;
  quantity?: number | null;
}

export function buildWalmartCartUrl(items: CartLinkItem[]): string {
  const itemsParam = items
    .map((item) =>
      item.quantity && item.quantity > 1 ? `${item.walmart_item_id}_${item.quantity}` : item.walmart_item_id
    )
    .join(",");
  return `https://www.walmart.com/sc/cart/addToCart?items=${itemsParam}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all walmart tests, plus everything from earlier tasks)

- [ ] **Step 5: Add the "Send to Walmart" button**

Modify `app/grocery-list/page.tsx`: add this import at the top, alongside the existing `GroceryListItem` type import:
```tsx
import { buildWalmartCartUrl } from "@/lib/walmart";
```

Add this handler inside `GroceryListPage`, alongside `handleComplete`:
```tsx
function handleSendToWalmart() {
  const linked = items.filter((i) => i.walmart_item_id);
  if (linked.length === 0) return;
  const url = buildWalmartCartUrl(
    linked.map((i) => ({ walmart_item_id: i.walmart_item_id as string, quantity: i.quantity }))
  );
  window.open(url, "_blank");
}
```

Add this button in the returned JSX, right before the existing "Complete List" button:
```tsx
{items.some((i) => i.walmart_item_id) && (
  <button onClick={handleSendToWalmart} className="w-full bg-yellow-500 text-white rounded p-2 mb-2">
    Send {items.filter((i) => i.walmart_item_id).length} linked item(s) to Walmart Cart
  </button>
)}
```

- [ ] **Step 6: Manual verification**

Run `npm run dev`, open Grocery List, add an item pasting in a real Walmart product URL (as in Task 6 Step 9), confirm the "Send to Walmart" button appears with the right count, click it in a browser tab where you're logged into walmart.com, and confirm the item lands in your real Walmart cart (same check already confirmed manually during design). Add a second linked item and confirm the button's count updates and both items arrive in the cart together.

- [ ] **Step 7: Commit**

```bash
git add lib/walmart.ts __tests__/walmart.test.ts app/grocery-list/page.tsx
git commit -m "Add Send to Walmart cart deep link from linked grocery-list items"
```

---

## Task 10: AI Meal Suggestions

**Files:**
- Create: `lib/claude.ts`
- Create: `app/api/suggestions/route.ts`
- Create: `app/suggestions/page.tsx`

**Interfaces:**
- Consumes: `GET /api/recipes`, `GET /api/purchases`, `POST /api/weekly-plan` from earlier tasks.
- Produces: `generateMealSuggestions(recipes: {name: string}[], recentPurchaseNames: string[]): Promise<string[]>` in `lib/claude.ts`.

- [ ] **Step 1: Claude suggestions library**

Run: `npm install @anthropic-ai/sdk`

Create `lib/claude.ts`:
```typescript
import Anthropic from "@anthropic-ai/sdk";

export async function generateMealSuggestions(
  recipeNames: string[],
  recentPurchaseNames: string[]
): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `We recently bought these groceries: ${recentPurchaseNames.join(", ") || "(nothing yet)"}.
Our saved recipes are: ${recipeNames.join(", ") || "(none yet)"}.
Suggest up to 5 meal ideas we could make using what we recently bought, favoring our saved recipes when a good match exists but feel free to suggest a new simple meal idea too. Reply with just the meal names, one per line, no numbering or extra commentary.`,
      },
    ],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
```

- [ ] **Step 2: Suggestions API route**

Create `app/api/suggestions/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { generateMealSuggestions } from "@/lib/claude";
import type { PurchaseItem } from "@/lib/types";

export async function GET() {
  const supabase = getSupabaseClient();

  const { data: recipes, error: recipesError } = await supabase.from("recipes").select("name");
  if (recipesError) return NextResponse.json({ error: recipesError.message }, { status: 500 });

  const since = new Date();
  since.setDate(since.getDate() - 14);
  const { data: purchases, error: purchasesError } = await supabase
    .from("purchases")
    .select("items")
    .gte("completed_at", since.toISOString().slice(0, 10));
  if (purchasesError) return NextResponse.json({ error: purchasesError.message }, { status: 500 });

  const recentPurchaseNames = (purchases ?? [])
    .flatMap((p) => p.items as PurchaseItem[])
    .map((i) => i.name);

  if (recentPurchaseNames.length === 0) {
    return NextResponse.json(
      { error: "Complete a grocery list first so there's purchase history to suggest from" },
      { status: 422 }
    );
  }

  try {
    const suggestions = await generateMealSuggestions(
      (recipes ?? []).map((r) => r.name),
      recentPurchaseNames
    );
    return NextResponse.json(suggestions);
  } catch {
    return NextResponse.json({ error: "No suggestions available right now" }, { status: 502 });
  }
}
```

- [ ] **Step 3: Suggestions page**

Create `app/suggestions/page.tsx`:
```tsx
"use client";

import { useState } from "react";

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadSuggestions() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/suggestions");
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "No suggestions available right now");
      setSuggestions([]);
      return;
    }
    setSuggestions(body);
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">What can we make?</h1>
      <button
        onClick={loadSuggestions}
        className="w-full bg-blue-600 text-white rounded p-2 mb-4"
        disabled={loading}
      >
        {loading ? "Thinking..." : "Get Suggestions"}
      </button>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <ul className="space-y-2">
        {suggestions.map((s, i) => (
          <li key={i} className="p-3 border rounded">{s}</li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: Add ANTHROPIC_API_KEY**

Ask the user for an Anthropic API key (from console.anthropic.com) and add it to `.env.local` as `ANTHROPIC_API_KEY`, and to Vercel via `npx vercel env add ANTHROPIC_API_KEY production`.

- [ ] **Step 5: Manual verification**

Run `npm run dev`. With no purchase history, open Suggestions and confirm the "complete a grocery list first" message shows instead of erroring. Complete a grocery list (Task 6), then click Get Suggestions and confirm meal ideas appear.

- [ ] **Step 6: Commit**

```bash
git add lib/claude.ts app/api/suggestions app/suggestions
git commit -m "Add AI-generated meal suggestions from recent purchases"
```

---

## Task 11: Final Deploy Verification

**Files:** none (verification task)

- [ ] **Step 1: Push and deploy**

```bash
git push
```
Confirm on Vercel that the deployment succeeded.

- [ ] **Step 2: Full walkthrough on the live URL**

Using the browser preview tool against the live Vercel URL (not localhost), walk through: add a recipe manually, import one from a URL, assign a recipe to a day on This Week, confirm ingredients land in Grocery List, complete the list, confirm it shows in History, and get a suggestion. Fix and re-deploy anything that breaks in production but worked locally (commonly: missing env vars in Vercel — recheck Task 3 Step 4 and Task 10 Step 4).

- [ ] **Step 3: Share the URL**

Give the user the live URL to bookmark on their wife's phone.
