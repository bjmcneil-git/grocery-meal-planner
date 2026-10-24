"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Recipe } from "@/lib/types";
import { formatCookTime } from "@/lib/formatCookTime";
import { getUpcomingDays } from "@/lib/week";
import PageHeader from "../components/PageHeader";

const DAYS_AHEAD = 14;
const PINTEREST_SEARCH_URL = "https://www.pinterest.com/search/pins/?q=recipes";
const GOOGLE_SEARCH_URL = "https://www.google.com/search?q=recipes";

function PinterestIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M12 0a12 12 0 0 0-4.37 23.17c-.06-.93-.11-2.36.02-3.38.12-.92.79-5.87.79-5.87s-.2-.4-.2-1c0-.93.54-1.63 1.21-1.63.57 0 .85.43.85.94 0 .57-.37 1.43-.55 2.23-.16.67.34 1.21 1 1.21 1.2 0 2.12-1.26 2.12-3.09 0-1.61-1.16-2.74-2.82-2.74-1.92 0-3.05 1.44-3.05 2.93 0 .58.22 1.2.5 1.54a.2.2 0 0 1 .05.19c-.05.22-.17.68-.2.78-.03.13-.1.16-.24.1-.9-.42-1.46-1.73-1.46-2.79 0-2.27 1.65-4.36 4.76-4.36 2.5 0 4.44 1.78 4.44 4.16 0 2.48-1.57 4.48-3.74 4.48-.73 0-1.42-.38-1.65-.83l-.45 1.72c-.16.63-.6 1.41-.9 1.89A12 12 0 1 0 12 0z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24 c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
      />
      <path
        fill="#FF3D00"
        d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039 l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36 c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
      />
      <path
        fill="#1976D2"
        d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571 c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
      />
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
  const [cuisineOptions, setCuisineOptions] = useState<string[]>([]);
  const [pickingDayFor, setPickingDayFor] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<{ recipeId: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/recipes")
      .then((r) => r.json())
      .then(setRecipes);
    fetch("/api/cuisines")
      .then((r) => r.json())
      .then(setCuisineOptions);
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
    <main className="px-4 pt-3">
      <PageHeader eyebrow={recipes.length > 0 ? `${recipes.length} saved` : "\u00a0"} title="Recipes">
        <a
          href={GOOGLE_SEARCH_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Search Google for recipes"
          className="w-10 h-10 rounded-full bg-card shadow-soft flex items-center justify-center"
        >
          <GoogleIcon />
        </a>
        <a
          href={PINTEREST_SEARCH_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Search Pinterest for recipes"
          className="w-10 h-10 rounded-full bg-card shadow-soft flex items-center justify-center text-[#E60023]"
        >
          <PinterestIcon />
        </a>
        <Link
          href="/recipes/new"
          aria-label="Add a recipe"
          className="w-10 h-10 rounded-full bg-accent text-accent-ink shadow-lift flex items-center justify-center text-2xl font-bold leading-none"
        >
          +
        </Link>
      </PageHeader>

      {isPicking && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl bg-accent-soft p-3 pl-4">
          <p className="text-sm font-extrabold text-accent-soft-ink">Choosing dinner for {forLabel}</p>
          <Link href="/" className="chip py-1 bg-card text-accent shrink-0">
            Cancel
          </Link>
        </div>
      )}

      <input
        className="field shadow-soft border-transparent mb-3"
        placeholder="Search recipes..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex gap-2 mb-4 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none]">
        {["All", ...cuisineOptions].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCuisine(c)}
            className={`chip py-1.5 px-3.5 text-[13px] shrink-0 ${
              cuisine === c ? "bg-accent text-accent-ink" : "bg-card text-dim shadow-soft"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      {error && <p className="text-sm font-bold text-danger mb-3">{error}</p>}
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        {filtered.map((r) => (
          <div key={r.id}>
            <div className="relative">
              {isPicking ? (
                <button type="button" onClick={() => pickForDay(r.id)} className="block w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.image_url ?? "/recipe-placeholder.jpg"}
                    alt={r.name}
                    className="w-full aspect-[3/4] rounded-3xl object-cover shadow-soft"
                  />
                </button>
              ) : (
                <Link href={`/recipes/${r.id}`} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.image_url ?? "/recipe-placeholder.jpg"}
                    alt={r.name}
                    className="w-full aspect-[3/4] rounded-3xl object-cover shadow-soft"
                  />
                </Link>
              )}
              {r.cook_time_minutes != null && (
                <span className="absolute top-2 left-2 chip bg-card/90 text-ink">
                  {formatCookTime(r.cook_time_minutes)}
                </span>
              )}
              {!isPicking && (
                <>
                  <Link
                    href={`/recipes/${r.id}/edit`}
                    className="absolute top-2 right-2 chip bg-card/90 text-ink"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPickingDayFor((cur) => (cur === r.id ? null : r.id))}
                    aria-label={`Add ${r.name} to a day`}
                    className="absolute bottom-2 right-2 bg-accent text-accent-ink w-8 h-8 rounded-full flex items-center justify-center text-xl font-bold leading-none shadow-lift"
                  >
                    +
                  </button>
                </>
              )}
            </div>
            {isPicking ? (
              <button type="button" onClick={() => pickForDay(r.id)} className="block text-left w-full">
                <p className="mt-2 text-sm font-extrabold leading-tight px-0.5">{r.name}</p>
                {r.cuisine && <p className="text-xs font-bold text-dim px-0.5">{r.cuisine}</p>}
              </button>
            ) : (
              <Link href={`/recipes/${r.id}`} className="block">
                <p className="mt-2 text-sm font-extrabold leading-tight px-0.5">{r.name}</p>
                {r.cuisine && <p className="text-xs font-bold text-dim px-0.5">{r.cuisine}</p>}
              </Link>
            )}
            {!isPicking && pickingDayFor === r.id && (
              <select
                autoFocus
                className="field mt-1.5 text-xs py-1.5"
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
              <p className="mt-1 chip bg-second-soft text-second-soft-ink">Added to {justAdded.label}</p>
            )}
          </div>
        ))}
      </div>
      {recipes.length === 0 && <p className="card p-5 text-center font-bold text-dim">No recipes yet.</p>}
      {recipes.length > 0 && filtered.length === 0 && <p className="card p-5 text-center font-bold text-dim">No matches.</p>}
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
