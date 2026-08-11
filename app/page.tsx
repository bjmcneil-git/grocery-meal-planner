"use client";

import { useEffect, useState } from "react";
import type { Recipe, WeeklyPlanEntry } from "@/lib/types";
import { getUpcomingDays } from "@/lib/week";

const DAYS_AHEAD = 14;

export default function HomePage() {
  const days = getUpcomingDays(DAYS_AHEAD);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plan, setPlan] = useState<WeeklyPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            return (
              <li key={date} className="flex items-center border-b py-2">
                <span className="w-16 shrink-0 text-sm font-medium">
                  {label}
                  {relative && <span className="block text-xs text-pink-600">{relative}</span>}
                </span>
                <select
                  className="flex-1 border rounded p-2 ml-2"
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
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
