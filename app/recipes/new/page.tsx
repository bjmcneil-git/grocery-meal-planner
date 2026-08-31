"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CUISINES } from "@/lib/cuisines";

interface IngredientRow {
  ingredient_name: string;
  quantity: string;
  unit: string;
}

// Android's share sheet doesn't have a dedicated "url" field for a plain
// page share - Chrome sends the shared URL in `text` (sometimes alongside
// other words), so pull the first URL-looking substring out of whatever
// the share_target query params gave us.
function extractUrl(...candidates: (string | null)[]): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const match = candidate.match(/https?:\/\/\S+/);
    if (match) return match[0];
  }
  return null;
}

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
  const [importUrl, setImportUrl] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function updateIngredient(index: number, field: keyof IngredientRow, value: string) {
    setIngredients((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
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
      setName(body.name);
      setIngredients(
        body.ingredients.map((text: string) => ({ ingredient_name: text, quantity: "", unit: "" }))
      );
      // Cuisine is left for you to pick manually — source sites' cuisine tags
      // are often an unreliable site-wide default, not specific to the dish.
      if (body.cookTimeMinutes) setCookTimeMinutes(String(body.cookTimeMinutes));
      setImageUrl(body.image ?? null);
      setSourceUrl(url);
    } finally {
      setImporting(false);
    }
  }

  // Handles being launched as the installed app's share target (see
  // public/manifest.json) - Android puts the shared page's URL here when
  // you tap "Share" from Pinterest's in-app browser or from Chrome.
  useEffect(() => {
    const shared = extractUrl(
      searchParams.get("url"),
      searchParams.get("text"),
      searchParams.get("title")
    );
    if (shared) {
      setImportUrl(shared);
      handleImport(shared);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      name,
      instructions,
      source: sourceUrl ? "url" : "manual",
      source_url: sourceUrl,
      cuisine: cuisine || null,
      image_url: imageUrl,
      cook_time_minutes: cookTimeMinutes ? Number(cookTimeMinutes) : null,
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
      <Link href="/recipes" className="text-pink-600 text-sm mb-2 inline-block">
        &larr; Back to Recipes
      </Link>
      <h1 className="text-xl font-bold mb-4">Add Recipe</h1>
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
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="w-full border rounded p-2"
          placeholder="Recipe name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2">
          <select
            className="flex-1 border rounded p-2"
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
          >
            <option value="">Cuisine (optional)</option>
            {CUISINES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            className="w-32 border rounded p-2"
            type="number"
            min="0"
            placeholder="Cook time (min)"
            value={cookTimeMinutes}
            onChange={(e) => setCookTimeMinutes(e.target.value)}
          />
        </div>
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
            className="text-pink-600 text-sm"
            onClick={() =>
              setIngredients((rows) => [...rows, { ingredient_name: "", quantity: "", unit: "" }])
            }
          >
            + Add ingredient
          </button>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" className="w-full bg-pink-600 text-white rounded p-2">
          Save Recipe
        </button>
      </form>
    </main>
  );
}

export default function NewRecipePage() {
  return (
    <Suspense fallback={null}>
      <NewRecipePageInner />
    </Suspense>
  );
}
