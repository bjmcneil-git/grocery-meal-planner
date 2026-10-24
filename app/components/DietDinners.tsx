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
    <section className="mb-8">
      <div className="relative overflow-hidden rounded-3xl bg-hero text-white shadow-hero p-4">
        <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-white/10" aria-hidden="true" />
        <p className="relative text-[11px] font-extrabold tracking-wider opacity-85">HIGH-PROTEIN, LOW-CALORIE</p>
        <h2 className="relative text-xl font-black leading-tight mt-0.5">
          {DIET_SUGGESTION_COUNT} dinners for your diet
        </h2>
        <p className="relative text-xs font-bold opacity-90 mt-0.5">Calories and protein are estimates.</p>

        <form onSubmit={handleAsk} className="relative mt-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="rounded-2xl bg-white/15 px-3 py-2 text-[10px] font-extrabold tracking-wider">
              MAX CALORIES
              <input
                id="diet-max-calories"
                type="number"
                inputMode="numeric"
                min={100}
                max={2000}
                step={50}
                aria-label="Max calories / serving"
                className="block w-full bg-transparent text-white text-lg font-black tracking-normal outline-none p-0 border-0"
                value={goals.maxCaloriesPerServing || ""}
                onChange={(e) => updateGoal("maxCaloriesPerServing", e.target.value)}
              />
            </label>
            <label className="rounded-2xl bg-white/15 px-3 py-2 text-[10px] font-extrabold tracking-wider">
              MIN PROTEIN (G)
              <input
                id="diet-min-protein"
                type="number"
                inputMode="numeric"
                min={0}
                max={200}
                step={5}
                aria-label="Min protein (g) / serving"
                className="block w-full bg-transparent text-white text-lg font-black tracking-normal outline-none p-0 border-0"
                value={goals.minProteinGramsPerServing || ""}
                onChange={(e) => updateGoal("minProteinGramsPerServing", e.target.value)}
              />
            </label>
          </div>
          <input
            id="diet-query"
            className="w-full rounded-2xl bg-white/15 text-white placeholder:text-white/70 px-3 py-2.5 text-sm font-semibold border-0 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            placeholder="Anything you have or want? e.g. chicken"
            aria-label="Anything you have or want? (optional)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" disabled={loading} className="btn bg-card text-accent w-full">
            {loading && suggestions.length === 0
              ? `Finding ${DIET_SUGGESTION_COUNT} dinners... (can take a minute)`
              : `Get ${DIET_SUGGESTION_COUNT} dinner ideas`}
          </button>
        </form>
      </div>

      {error && <p className="text-sm font-bold text-danger mt-3">{error}</p>}

      {suggestions.length > 0 && (
        <div className="mt-3">
          <SuggestionCards key={requestId} suggestions={suggestions} />
          <button type="button" onClick={handleRefresh} disabled={loading} className="w-full mt-3 btn-soft">
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
