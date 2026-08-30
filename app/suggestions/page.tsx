"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCookTime } from "@/lib/formatCookTime";
import type { RecipeSuggestion } from "@/lib/suggestions";

export default function SuggestionsPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<RecipeSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Record<number, string>>({});
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setSavedIds({});
    setExpandedIndex(null);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get suggestions");
      setSuggestions(data.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get suggestions");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(index: number) {
    const s = suggestions[index];
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: s.name,
        instructions: s.instructions,
        source: s.source_url ? "url" : "manual",
        source_url: s.source_url,
        cuisine: s.cuisine,
        image_url: null,
        cook_time_minutes: s.cook_time_minutes,
        ingredients: s.ingredients,
      }),
    });
    if (!res.ok) return;
    const recipe = await res.json();
    setSavedIds((prev) => ({ ...prev, [index]: recipe.id }));
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">Suggest</h1>

      <form onSubmit={handleAsk} className="flex gap-2 mb-4">
        <input
          className="flex-1 border rounded p-2"
          placeholder="What would you like?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-2 rounded bg-pink-600 text-white text-sm disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {!loading && suggestions.length === 0 && !error && (
        <p className="text-gray-500 text-sm">
          Type a few ingredients you have on hand, or leave it blank and ask for ideas based on
          what you&rsquo;ve cooked before.
        </p>
      )}

      <ul className="space-y-3">
        {suggestions.map((s, i) => (
          <li key={i} className="border rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-gray-500">
                  {[s.cuisine, s.cook_time_minutes != null ? formatCookTime(s.cook_time_minutes) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {savedIds[i] ? (
                <Link href={`/recipes/${savedIds[i]}`} className="text-xs text-green-600 shrink-0">
                  Saved &#10003;
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSave(i)}
                  className="text-xs px-2 py-1 rounded bg-pink-600 text-white shrink-0"
                >
                  Save Recipe
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setExpandedIndex((cur) => (cur === i ? null : i))}
              className="text-xs text-pink-600 underline mt-2"
            >
              {expandedIndex === i ? "Hide details" : "View ingredients & steps"}
            </button>
            {expandedIndex === i && (
              <div className="mt-2 text-sm">
                <p className="font-medium text-xs text-gray-500 mb-1">Ingredients</p>
                <ul className="list-disc list-inside mb-2">
                  {s.ingredients.map((ing, j) => (
                    <li key={j}>
                      {ing.ingredient_name}
                      {ing.quantity != null ? ` — ${ing.quantity}${ing.unit ? ` ${ing.unit}` : ""}` : ""}
                    </li>
                  ))}
                </ul>
                <p className="font-medium text-xs text-gray-500 mb-1">Instructions</p>
                <p className="whitespace-pre-wrap text-gray-700">{s.instructions}</p>
                {s.source_url && (
                  <a
                    href={s.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-pink-600 underline mt-2 inline-block"
                  >
                    Source
                  </a>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
