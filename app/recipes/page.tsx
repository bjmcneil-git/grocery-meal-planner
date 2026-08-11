"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Recipe } from "@/lib/types";
import { CUISINES } from "@/lib/cuisines";
import { formatCookTime } from "@/lib/formatCookTime";
import { DAYS, getWeekStart } from "@/lib/week";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<string>("All");
  const [pickingDayFor, setPickingDayFor] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<{ recipeId: string; day: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/recipes")
      .then((r) => r.json())
      .then(setRecipes);
  }, []);

  async function addToDay(recipeId: string, dayOfWeek: number) {
    setPickingDayFor(null);
    try {
      const res = await fetch("/api/weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_start_date: getWeekStart(),
          day_of_week: dayOfWeek,
          recipe_id: recipeId,
        }),
      });
      if (!res.ok) throw new Error(`Failed to add to day with status ${res.status}`);
      setError(null);
      setJustAdded({ recipeId, day: DAYS[dayOfWeek] });
      setTimeout(() => setJustAdded(null), 2000);
    } catch {
      setError("Failed to add that recipe to a day. Please try again.");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      const matchesQuery = q === "" || r.name.toLowerCase().includes(q);
      const matchesCuisine = cuisine === "All" || r.cuisine === cuisine;
      return matchesQuery && matchesCuisine;
    });
  }, [recipes, query, cuisine]);

  return (
    <main className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Recipes</h1>
        <Link href="/recipes/new" className="text-pink-600">+ Add</Link>
      </div>
      <input
        className="w-full border rounded p-2 mb-3"
        placeholder="Search recipes..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex flex-wrap gap-2 mb-4">
        {["All", ...CUISINES].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCuisine(c)}
            className={`text-xs px-3 py-1 rounded-full border ${
              cuisine === c ? "bg-pink-600 text-white border-pink-600" : "text-gray-600"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((r) => (
          <div key={r.id}>
            <div className="relative">
              <Link href={`/recipes/${r.id}`} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.image_url ?? "/recipe-placeholder.jpg"}
                  alt={r.name}
                  className="w-full aspect-[3/4] rounded object-cover"
                />
              </Link>
              {r.cook_time_minutes != null && (
                <span className="absolute top-1.5 left-1.5 bg-white/90 text-gray-800 text-xs px-2 py-0.5 rounded-full">
                  {formatCookTime(r.cook_time_minutes)}
                </span>
              )}
              <Link
                href={`/recipes/${r.id}/edit`}
                className="absolute top-1.5 right-1.5 bg-white/90 text-gray-800 text-xs px-2 py-0.5 rounded-full"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={() => setPickingDayFor((cur) => (cur === r.id ? null : r.id))}
                aria-label={`Add ${r.name} to a day`}
                className="absolute bottom-1.5 right-1.5 bg-pink-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-base leading-none"
              >
                +
              </button>
            </div>
            <Link href={`/recipes/${r.id}`} className="block">
              <p className="mt-1 text-sm font-medium leading-tight">{r.name}</p>
              {r.cuisine && <p className="text-xs text-gray-500">{r.cuisine}</p>}
            </Link>
            {pickingDayFor === r.id && (
              <select
                autoFocus
                className="mt-1 w-full border rounded text-xs p-1"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) addToDay(r.id, Number(e.target.value));
                }}
              >
                <option value="" disabled>
                  Add to day...
                </option>
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            )}
            {justAdded?.recipeId === r.id && (
              <p className="mt-1 text-xs text-green-600">Added to {justAdded.day}</p>
            )}
          </div>
        ))}
      </div>
      {recipes.length === 0 && <p className="text-gray-500">No recipes yet.</p>}
      {recipes.length > 0 && filtered.length === 0 && <p className="text-gray-500">No matches.</p>}
    </main>
  );
}
