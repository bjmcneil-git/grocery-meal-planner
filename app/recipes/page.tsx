"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Recipe } from "@/lib/types";
import { CUISINES } from "@/lib/cuisines";
import { formatCookTime } from "@/lib/formatCookTime";
import { getUpcomingDays } from "@/lib/week";

const DAYS_AHEAD = 14;

function PinterestIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" aria-hidden="true">
      <path d="M12 0a12 12 0 0 0-4.37 23.17c-.06-.93-.11-2.36.02-3.38.12-.92.79-5.87.79-5.87s-.2-.4-.2-1c0-.93.54-1.63 1.21-1.63.57 0 .85.43.85.94 0 .57-.37 1.43-.55 2.23-.16.67.34 1.21 1 1.21 1.2 0 2.12-1.26 2.12-3.09 0-1.61-1.16-2.74-2.82-2.74-1.92 0-3.05 1.44-3.05 2.93 0 .58.22 1.2.5 1.54a.2.2 0 0 1 .05.19c-.05.22-.17.68-.2.78-.03.13-.1.16-.24.1-.9-.42-1.46-1.73-1.46-2.79 0-2.27 1.65-4.36 4.76-4.36 2.5 0 4.44 1.78 4.44 4.16 0 2.48-1.57 4.48-3.74 4.48-.73 0-1.42-.38-1.65-.83l-.45 1.72c-.16.63-.6 1.41-.9 1.89A12 12 0 1 0 12 0z" />
    </svg>
  );
}

function RecipesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forDate = searchParams.get("forDate");
  const forLabel = searchParams.get("forLabel") ?? forDate;
  const isPicking = !!forDate;

  const days = getUpcomingDays(DAYS_AHEAD);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<string>("All");
  const [pickingDayFor, setPickingDayFor] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<{ recipeId: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/recipes")
      .then((r) => r.json())
      .then(setRecipes);
  }, []);

  async function addToDay(recipeId: string, planDate: string, label: string) {
    setPickingDayFor(null);
    try {
      const res = await fetch("/api/weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_date: planDate, recipe_id: recipeId }),
      });
      if (!res.ok) throw new Error(`Failed to add to day with status ${res.status}`);
      setError(null);
      setJustAdded({ recipeId, label });
      setTimeout(() => setJustAdded(null), 2000);
    } catch {
      setError("Failed to add that recipe to a day. Please try again.");
    }
  }

  async function pickForDay(recipeId: string) {
    if (!forDate) return;
    await addToDay(recipeId, forDate, forLabel ?? forDate);
    router.push("/");
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
        <div className="flex items-center gap-3">
          <a
            href="https://www.pinterest.com/search/pins/?q=recipes"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Search Pinterest for recipes"
            className="text-[#E60023]"
          >
            <PinterestIcon />
          </a>
          <Link href="/recipes/new" className="text-pink-600">+ Add</Link>
        </div>
      </div>

      {isPicking && (
        <div className="mb-4 flex items-center justify-between gap-2 bg-pink-50 border border-pink-200 rounded-lg p-3">
          <p className="text-sm font-medium text-pink-700">Choosing dinner for {forLabel}</p>
          <Link href="/" className="text-xs text-pink-600 underline shrink-0">
            Cancel
          </Link>
        </div>
      )}

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
              {isPicking ? (
                <button type="button" onClick={() => pickForDay(r.id)} className="block w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.image_url ?? "/recipe-placeholder.jpg"}
                    alt={r.name}
                    className="w-full aspect-[3/4] rounded object-cover"
                  />
                </button>
              ) : (
                <Link href={`/recipes/${r.id}`} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.image_url ?? "/recipe-placeholder.jpg"}
                    alt={r.name}
                    className="w-full aspect-[3/4] rounded object-cover"
                  />
                </Link>
              )}
              {r.cook_time_minutes != null && (
                <span className="absolute top-1.5 left-1.5 bg-white/90 text-gray-800 text-xs px-2 py-0.5 rounded-full">
                  {formatCookTime(r.cook_time_minutes)}
                </span>
              )}
              {!isPicking && (
                <>
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
                </>
              )}
            </div>
            {isPicking ? (
              <button type="button" onClick={() => pickForDay(r.id)} className="block text-left w-full">
                <p className="mt-1 text-sm font-medium leading-tight">{r.name}</p>
                {r.cuisine && <p className="text-xs text-gray-500">{r.cuisine}</p>}
              </button>
            ) : (
              <Link href={`/recipes/${r.id}`} className="block">
                <p className="mt-1 text-sm font-medium leading-tight">{r.name}</p>
                {r.cuisine && <p className="text-xs text-gray-500">{r.cuisine}</p>}
              </Link>
            )}
            {!isPicking && pickingDayFor === r.id && (
              <select
                autoFocus
                className="mt-1 w-full border rounded text-xs p-1"
                defaultValue=""
                onChange={(e) => {
                  const day = days.find((d) => d.date === e.target.value);
                  if (day) addToDay(r.id, day.date, day.relative ?? day.label);
                }}
              >
                <option value="" disabled>
                  Add to day...
                </option>
                {days.map((d) => (
                  <option key={d.date} value={d.date}>
                    {d.label}
                    {d.relative ? ` (${d.relative})` : ""}
                  </option>
                ))}
              </select>
            )}
            {!isPicking && justAdded?.recipeId === r.id && (
              <p className="mt-1 text-xs text-green-600">Added to {justAdded.label}</p>
            )}
          </div>
        ))}
      </div>
      {recipes.length === 0 && <p className="text-gray-500">No recipes yet.</p>}
      {recipes.length > 0 && filtered.length === 0 && <p className="text-gray-500">No matches.</p>}
    </main>
  );
}

export default function RecipesPage() {
  return (
    <Suspense fallback={null}>
      <RecipesPageInner />
    </Suspense>
  );
}
