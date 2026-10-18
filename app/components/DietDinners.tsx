"use client";

import { useEffect, useState } from "react";
import SuggestionCards from "./SuggestionCards";
import { DEFAULT_DIET_GOALS, type DietGoals, type RecipeSuggestion } from "@/lib/suggestions";

const GOALS_KEY = "diet-dinner-goals";

function loadSavedGoals(): DietGoals {
  try {
    const raw = window.localStorage.getItem(GOALS_KEY);
    if (raw) return { ...DEFAULT_DIET_GOALS, ...JSON.parse(raw) };
  } catch {
    // Storage can be unavailable (private mode); fall back to defaults.
  }
  return DEFAULT_DIET_GOALS;
}

export default function DietDinners() {
  const [goals, setGoals] = useState<DietGoals>(DEFAULT_DIET_GOALS);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<RecipeSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    setGoals(loadSavedGoals());
  }, []);

  function updateGoal(key: keyof DietGoals, value: string) {
    const next = { ...goals, [key]: Number(value) };
    setGoals(next);
    try {
      window.localStorage.setItem(GOALS_KEY, JSON.stringify(next));
    } catch {
      // Not remembering the goals is fine.
    }
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuggestions([]);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, diet: goals }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get dinner ideas");
      setSuggestions(data.suggestions);
      setRequestId((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get dinner ideas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border border-pink-200 bg-pink-50 rounded-lg p-3 mb-6">
      <h2 className="font-bold">High-Protein, Low-Calorie Dinners</h2>
      <p className="text-xs text-gray-600 mb-3">
        Dinner ideas that fit your diet. Calories and protein are estimates.
      </p>

      <form onSubmit={handleAsk}>
        <div className="flex gap-2 mb-2">
          <label className="flex-1 text-xs text-gray-600">
            Max calories / serving
            <input
              type="number"
              inputMode="numeric"
              min={100}
              max={2000}
              step={50}
              className="w-full border rounded p-2 text-sm text-black bg-white mt-0.5"
              value={goals.maxCaloriesPerServing || ""}
              onChange={(e) => updateGoal("maxCaloriesPerServing", e.target.value)}
            />
          </label>
          <label className="flex-1 text-xs text-gray-600">
            Min protein (g) / serving
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={200}
              step={5}
              className="w-full border rounded p-2 text-sm text-black bg-white mt-0.5"
              value={goals.minProteinGramsPerServing || ""}
              onChange={(e) => updateGoal("minProteinGramsPerServing", e.target.value)}
            />
          </label>
        </div>
        <input
          className="w-full border rounded p-2 text-sm bg-white mb-2"
          placeholder="Anything you have or want? (optional) e.g. chicken, Mexican"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full px-3 py-2 rounded bg-pink-600 text-white text-sm disabled:opacity-50"
        >
          {loading ? "Finding dinners..." : "Get dinner ideas"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      {suggestions.length > 0 && (
        <div className="mt-3">
          <SuggestionCards key={requestId} suggestions={suggestions} />
        </div>
      )}
    </section>
  );
}
