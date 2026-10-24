"use client";

import { useState } from "react";
import type { RecipeSuggestion } from "@/lib/suggestions";
import DietDinners from "@/app/components/DietDinners";
import NotesSection from "@/app/components/NotesSection";
import SuggestionCards from "@/app/components/SuggestionCards";
import PageHeader from "@/app/components/PageHeader";

export default function SuggestionsPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<RecipeSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuggestions([]);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get suggestions");
      setSuggestions(data.suggestions);
      setRequestId((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get suggestions");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="px-4 pt-3">
      <PageHeader eyebrow="Dinner ideas" title="Suggestions" />

      <DietDinners />

      <h2 className="text-base font-black mb-2 px-1">Any recipe ideas</h2>
      <form onSubmit={handleAsk} className="flex gap-2 mb-4">
        <input
          className="field flex-1 shadow-soft border-transparent"
          placeholder="What would you like?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-main"
        >
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>

      {error && <p className="text-sm font-bold text-danger mb-4">{error}</p>}

      {!loading && suggestions.length === 0 && !error && (
        <p className="text-sm font-semibold text-dim px-1 mb-2">
          Type a few ingredients you have on hand, or leave it blank and ask for ideas based on
          what you&rsquo;ve cooked before.
        </p>
      )}

      <SuggestionCards key={requestId} suggestions={suggestions} />

      <div className="mt-10">
        <NotesSection />
      </div>
    </main>
  );
}
