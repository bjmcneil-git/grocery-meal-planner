"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCookTime } from "@/lib/formatCookTime";
import type { RecipeSuggestion } from "@/lib/suggestions";

export function formatNutrition(s: RecipeSuggestion): string | null {
  const parts = [
    s.calories_per_serving != null ? `~${s.calories_per_serving} cal` : null,
    s.protein_grams_per_serving != null ? `${s.protein_grams_per_serving}g protein` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return `${parts.join(" · ")} per serving`;
}

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the web";
  }
}

// Saved recipes have no nutrition columns, so the estimate rides along at the
// top of the instructions where it shows on the recipe page.
function instructionsWithNutrition(s: RecipeSuggestion): string {
  const nutrition = formatNutrition(s);
  if (!nutrition) return s.instructions;
  const serves = s.servings != null ? ` (serves ${s.servings})` : "";
  return `Estimated ${nutrition}${serves}.\n\n${s.instructions}`;
}

export default function SuggestionCards({ suggestions }: { suggestions: RecipeSuggestion[] }) {
  const [savedIds, setSavedIds] = useState<Record<number, string>>({});
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  async function handleSave(index: number) {
    const s = suggestions[index];
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: s.name,
        instructions: instructionsWithNutrition(s),
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
    <ul className="space-y-3">
      {suggestions.map((s, i) => {
        const meta = [s.cuisine, s.cook_time_minutes != null ? formatCookTime(s.cook_time_minutes) : null]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={i} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-black leading-snug">{s.name}</p>
                <p className="text-xs font-bold text-dim mt-0.5">
                  {meta && <>{meta} · </>}
                  {s.source_url ? (
                    <a href={s.source_url} target="_blank" rel="noreferrer" className="underline">
                      Recipe from {sourceHost(s.source_url)}
                    </a>
                  ) : (
                    "Recipe written by Claude"
                  )}
                </p>
              </div>
              {savedIds[i] ? (
                <Link href={`/recipes/${savedIds[i]}`} className="chip py-1 bg-second-soft text-second-soft-ink shrink-0">
                  Saved &#10003;
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSave(i)}
                  className="chip py-1.5 px-3 bg-accent text-accent-ink shrink-0"
                >
                  Save Recipe
                </button>
              )}
            </div>
            {(s.protein_grams_per_serving != null || s.calories_per_serving != null) && (
              <div className="flex flex-wrap gap-1.5 mt-2 tabular-nums">
                {s.protein_grams_per_serving != null && (
                  <span className="chip bg-second-soft text-second-soft-ink">
                    {s.protein_grams_per_serving} g protein
                  </span>
                )}
                {s.calories_per_serving != null && (
                  <span className="chip bg-third-soft text-third-ink">~{s.calories_per_serving} cal</span>
                )}
                <span className="chip bg-line text-dim">per serving</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setExpandedIndex((cur) => (cur === i ? null : i))}
              className="text-xs link mt-3"
            >
              {expandedIndex === i ? "Hide details" : "View ingredients & steps"}
            </button>
            {expandedIndex === i && (
              <div className="mt-3 text-sm">
                <p className="text-[11px] font-extrabold tracking-wider text-dim mb-1">INGREDIENTS</p>
                <ul className="list-disc list-inside mb-3 font-semibold">
                  {s.ingredients.map((ing, j) => (
                    <li key={j}>
                      {ing.ingredient_name}
                      {ing.quantity != null ? ` — ${ing.quantity}${ing.unit ? ` ${ing.unit}` : ""}` : ""}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] font-extrabold tracking-wider text-dim mb-1">INSTRUCTIONS</p>
                <p className="whitespace-pre-wrap font-medium">{s.instructions}</p>
                {s.source_url && (
                  <a href={s.source_url} target="_blank" rel="noreferrer" className="text-xs link mt-2 inline-block">
                    Source
                  </a>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
