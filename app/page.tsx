"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Recipe, WeeklyPlanEntry } from "@/lib/types";
import { getUpcomingDays } from "@/lib/week";

const DAYS_AHEAD = 14;

// Recipe names are often full titles with a subtitle tacked on (e.g. a blog
// post's SEO title) - keep only the part before the first separator so the
// card fits on one line without truncating mid-word on a phone screen.
function shortenRecipeName(name: string): string {
  const cut = name.split(/\s[–—-]\s|\s\(/)[0].trim();
  return cut || name;
}

function SwapIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path
        d="M4 7h11m0 0-3-3m3 3-3 3M16 13H5m0 0 3 3m-3-3 3-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HomePage() {
  const days = getUpcomingDays(DAYS_AHEAD);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plan, setPlan] = useState<WeeklyPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const recipeById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  useEffect(() => {
    const from = days[0].date;
    const to = days[days.length - 1].date;
    Promise.all([
      fetch("/api/recipes").then((r) => r.json()).then(setRecipes),
      fetch(`/api/weekly-plan?from=${from}&to=${to}`).then((r) => r.json()).then(setPlan),
    ]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">This Week</h1>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : recipes.length === 0 ? (
        <p className="text-gray-500">
          No saved recipes yet. Add some on the Recipes tab, then come back to plan your days.
        </p>
      ) : (
        <ul className="space-y-2">
          {days.map(({ date, label, relative }) => {
            const entry = plan.find((p) => p.plan_date === date);
            const recipe = entry?.recipe_id ? recipeById.get(entry.recipe_id) : undefined;
            const dayLabel = relative ? `${label} (${relative})` : label;
            const pickHref = `/recipes?forDate=${date}&forLabel=${encodeURIComponent(dayLabel)}`;
            return (
              <li key={date} className="border-b py-2">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm font-medium">{label}</span>
                  {relative && <span className="text-xs text-pink-600">{relative}</span>}
                </div>
                {!recipe ? (
                  <Link
                    href={pickHref}
                    className="flex items-center justify-center border border-dashed rounded-lg p-3 text-sm text-gray-500"
                  >
                    + Choose a recipe
                  </Link>
                ) : (
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/recipes/${recipe.id}`}
                      className="flex-1 flex items-center gap-3 border rounded-lg p-2 min-w-0"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={recipe.image_url ?? "/recipe-placeholder.jpg"}
                        alt={recipe.name}
                        className="w-12 h-12 rounded object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight truncate" title={recipe.name}>
                          {shortenRecipeName(recipe.name)}
                        </p>
                        <p className="text-xs text-gray-500">Dinner</p>
                      </div>
                    </Link>
                    <Link
                      href={pickHref}
                      aria-label={`Change dinner for ${label}`}
                      className="shrink-0 text-pink-600 p-1"
                    >
                      <SwapIcon />
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
