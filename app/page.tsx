"use client";

import { useEffect, useMemo, useState } from "react";
import type { Recipe, WeeklyPlanEntry } from "@/lib/types";
import { getUpcomingDays } from "@/lib/week";

const DAYS_AHEAD = 14;

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
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);

  const recipeById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  function refreshPlan() {
    const from = days[0].date;
    const to = days[days.length - 1].date;
    return fetch(`/api/weekly-plan?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then(setPlan);
  }

  useEffect(() => {
    Promise.all([fetch("/api/recipes").then((r) => r.json()).then(setRecipes), refreshPlan()]).finally(() =>
      setLoading(false)
    );
  }, []);

  async function assignRecipe(planDate: string, recipeId: string) {
    if (!recipeId) return;
    setAssigning(planDate);
    try {
      const res = await fetch("/api/weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_date: planDate, recipe_id: recipeId }),
      });
      if (!res.ok) throw new Error(`Failed to assign recipe with status ${res.status}`);
      await refreshPlan();
      setError(null);
      setEditingDate(null);
    } catch {
      setError("Failed to assign that recipe. Please try again.");
    } finally {
      setAssigning(null);
    }
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">This Week</h1>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

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
            const showSelect = !recipe || editingDate === date;
            return (
              <li key={date} className="flex items-center gap-2 border-b py-2">
                <span className="w-16 shrink-0 text-sm font-medium">
                  {label}
                  {relative && <span className="block text-xs text-pink-600">{relative}</span>}
                </span>
                <div className="flex-1 flex items-center gap-1">
                  {showSelect ? (
                    <select
                      className="flex-1 border rounded p-2"
                      value={entry?.recipe_id ?? ""}
                      disabled={assigning === date}
                      onChange={(e) => assignRecipe(date, e.target.value)}
                    >
                      <option value="">— none —</option>
                      {recipes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex-1 flex items-center gap-3 border rounded-lg p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={recipe.image_url ?? "/recipe-placeholder.jpg"}
                        alt={recipe.name}
                        className="w-12 h-12 rounded object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">{recipe.name}</p>
                        <p className="text-xs text-gray-500">Dinner</p>
                      </div>
                    </div>
                  )}
                  {!showSelect && (
                    <button
                      type="button"
                      onClick={() => setEditingDate(date)}
                      aria-label={`Change dinner for ${label}`}
                      className="shrink-0 text-pink-600 p-1"
                    >
                      <SwapIcon />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
