"use client";

import { useEffect, useState } from "react";
import type { Recipe, WeeklyPlanEntry } from "@/lib/types";
import { DAYS, getWeekStart } from "@/lib/week";

export default function HomePage() {
  const weekStartDate = getWeekStart();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plan, setPlan] = useState<WeeklyPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refreshPlan() {
    return fetch(`/api/weekly-plan?week_start_date=${weekStartDate}`)
      .then((r) => r.json())
      .then(setPlan);
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/recipes").then((r) => r.json()).then(setRecipes),
      refreshPlan(),
    ]).finally(() => setLoading(false));
  }, []);

  async function assignRecipe(dayOfWeek: number, recipeId: string) {
    if (!recipeId) return;
    setAssigning(dayOfWeek);
    try {
      const res = await fetch("/api/weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_start_date: weekStartDate,
          day_of_week: dayOfWeek,
          recipe_id: recipeId,
        }),
      });
      if (!res.ok) throw new Error(`Failed to assign recipe with status ${res.status}`);
      await refreshPlan();
      setError(null);
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
          No saved recipes yet. Add some on the Recipes tab, then come back to plan your week.
        </p>
      ) : (
        <ul className="space-y-2">
          {DAYS.map((label, i) => {
            const entry = plan.find((p) => p.day_of_week === i);
            return (
              <li key={i} className="flex justify-between items-center border-b py-2">
                <span className="w-10 font-medium">{label}</span>
                <select
                  className="flex-1 border rounded p-2 ml-2"
                  value={entry?.recipe_id ?? ""}
                  disabled={assigning === i}
                  onChange={(e) => assignRecipe(i, e.target.value)}
                >
                  <option value="">— none —</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-gray-500 text-sm mt-4">
        Assigning a recipe adds its missing ingredients to your grocery list.
      </p>
    </main>
  );
}
