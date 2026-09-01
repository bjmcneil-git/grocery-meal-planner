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

  const [activeTab, setActiveTab] = useState<"url" | "text" | "screenshot">("url");

  const [importUrl, setImportUrl] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [pasteText, setPasteText] = useState("");
  const [textImportError, setTextImportError] = useState<string | null>(null);
  const [textImporting, setTextImporting] = useState(false);

  const [screenshotImages, setScreenshotImages] = useState<string[]>([]);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [screenshotImporting, setScreenshotImporting] = useState(false);

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
    for (const item of Array.from(e.clipboardData.items)) {
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
