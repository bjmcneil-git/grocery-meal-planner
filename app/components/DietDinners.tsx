"use client";

import { useEffect, useState } from "react";
import SuggestionCards from "./SuggestionCards";
import {
  DEFAULT_DIET_GOALS,
  DIET_SUGGESTION_COUNT,
  type DietGoals,
  type RecipeSuggestion,
} from "@/lib/suggestions";

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

function RefreshIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4" aria-hidden="true">
      <path
        d="M16 10a6 6 0 1 1-1.76-4.24M16 3.5V6h-2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function DietDinners() {
  const [goals, setGoals] = useState<DietGoals>(DEFAULT_DIET_GOALS);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<RecipeSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);
  // Every dish shown since the last new search, so a refresh brings new ones.
  const [shownNames, setShownNames] = useState<string[]>([]);

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

  async function fetchDinners(exclude: string[]) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, diet: goals, exclude }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get dinner ideas");
      const next: RecipeSuggestion[] = data.suggestions;
      setSuggestions(next);
      setShownNames([...exclude, ...next.map((s) => s.name)]);
      setRequestId((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get dinner ideas");
    } finally {
      setLoading(false);
    }
  }

  function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    setSuggestions([]);
    fetchDinners([]);
  }

  function handleRefresh() {
    fetchDinners(shownNames);
  }

  return (
    <section className="border border-pink-200 bg-pink-50 rounded-lg p-3 mb-6">
      <h2 className="font-bold">High-Protein, Low-Calorie Dinners</h2>
      <p className="text-xs text-gray-600 mb-3">
        {DIET_SUGGESTION_COUNT} dinner ideas that fit your diet. Calories and protein are
        estimates.
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
          {loading && suggestions.length === 0
            ? `Finding ${DIET_SUGGESTION_COUNT} dinners... (can take a minute)`
            : `Get ${DIET_SUGGESTION_COUNT} dinner ideas`}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      {suggestions.length > 0 && (
        <div className="mt-3">
          <SuggestionCards key={requestId} suggestions={suggestions} />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="w-full mt-3 px-3 py-2 rounded border border-pink-600 text-pink-600 bg-white text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <RefreshIcon />
            {loading
              ? `Finding ${DIET_SUGGESTION_COUNT} new dinners...`
              : `Show me ${DIET_SUGGESTION_COUNT} different dinners`}
          </button>
        </div>
      )}
    </section>
  );
}
