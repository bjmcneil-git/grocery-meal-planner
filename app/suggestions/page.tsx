"use client";

import { useState } from "react";
import type { RecipeSuggestion } from "@/lib/suggestions";
import DietDinners from "@/app/components/DietDinners";
import NotesSection from "@/app/components/NotesSection";
import SuggestionCards from "@/app/components/SuggestionCards";

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
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">Suggest</h1>

      <DietDinners />

      <h2 className="font-bold mb-2">Any Recipe Ideas</h2>
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

      <SuggestionCards key={requestId} suggestions={suggestions} />

      <div className="mt-8 pt-4 border-t-2 border-gray-100">
        <NotesSection />
      </div>
    </main>
  );
}
