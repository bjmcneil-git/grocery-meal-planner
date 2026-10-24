"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Recipe, WeeklyPlanEntry } from "@/lib/types";
import { getUpcomingDays } from "@/lib/week";
import { shortenRecipeName } from "@/lib/recipeDisplay";
import { formatCookTime } from "@/lib/formatCookTime";
import PageHeader from "./components/PageHeader";

const DAYS_AHEAD = 14;

function SwapIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 7h11m0 0-3-3m3 3-3 3M16 13H5m0 0 3 3m-3-3 3-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function recipeMeta(recipe: Recipe): string {
  return [recipe.cuisine, recipe.cook_time_minutes != null ? formatCookTime(recipe.cook_time_minutes) : null]
    .filter(Boolean)
    .join(" · ");
}

export default function HomePage() {
  const days = getUpcomingDays(DAYS_AHEAD);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plan, setPlan] = useState<WeeklyPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  // Set after mount: the server doesn't know the viewer's clock.
  const [greeting, setGreeting] = useState("This Week");
  const [today, setToday] = useState("");

  const recipeById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  useEffect(() => {
    const now = new Date();
    setGreeting(greetingFor(now.getHours()));
    setToday(now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }));

    const from = days[0].date;
    const to = days[days.length - 1].date;
    Promise.all([
      fetch("/api/recipes").then((r) => r.json()).then(setRecipes),
      fetch(`/api/weekly-plan?from=${from}&to=${to}`).then((r) => r.json()).then(setPlan),
    ]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function recipeFor(date: string): Recipe | undefined {
    const entry = plan.find((p) => p.plan_date === date);
    return entry?.recipe_id ? recipeById.get(entry.recipe_id) : undefined;
  }

  function pickHrefFor(date: string, dayLabel: string): string {
    return `/recipes?forDate=${date}&forLabel=${encodeURIComponent(dayLabel)}`;
  }

  const [tonight, ...upcoming] = days;
  const tonightRecipe = recipeFor(tonight.date);
  const tonightPickHref = pickHrefFor(tonight.date, `${tonight.label} (Today)`);

  return (
    <main className="px-4 pt-3">
      <PageHeader eyebrow={today || " "} title={greeting} />

      {loading ? (
        <p className="font-semibold text-dim">Loading...</p>
      ) : recipes.length === 0 ? (
        <div className="rounded-3xl bg-hero text-white shadow-hero p-5">
          <p className="text-[11px] font-extrabold tracking-wider opacity-85">GET STARTED</p>
          <h2 className="text-xl font-black mt-0.5">Add your first recipes</h2>
          <p className="text-sm font-semibold opacity-90 mt-1">
            Save a few on the Recipes tab, then come back to plan your dinners.
          </p>
          <Link href="/recipes/new" className="btn bg-card text-accent mt-3">
            Add a recipe
          </Link>
        </div>
      ) : (
        <>
          <section className="relative overflow-hidden rounded-3xl bg-hero text-white shadow-hero p-4">
            <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-white/10" aria-hidden="true" />
            <div className="relative flex gap-3 items-center">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-extrabold tracking-wider opacity-85">TONIGHT&rsquo;S DINNER</p>
                {tonightRecipe ? (
                  <>
                    <h2 className="text-xl font-black leading-tight mt-0.5" title={tonightRecipe.name}>
                      {shortenRecipeName(tonightRecipe.name)}
                    </h2>
                    {recipeMeta(tonightRecipe) && (
                      <p className="text-xs font-bold opacity-90 mt-0.5">{recipeMeta(tonightRecipe)}</p>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-black leading-tight mt-0.5">Nothing planned yet</h2>
                    <p className="text-xs font-bold opacity-90 mt-0.5">Pick a saved recipe or get some ideas.</p>
                  </>
                )}
              </div>
              {tonightRecipe && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tonightRecipe.image_url ?? "/recipe-placeholder.jpg"}
                  alt=""
                  className="w-20 h-20 rounded-2xl object-cover shrink-0 ring-4 ring-white/20"
                />
              )}
            </div>
            <div className="relative flex gap-2 mt-3">
              {tonightRecipe ? (
                <>
                  <Link href={`/recipes/${tonightRecipe.id}`} className="btn bg-card text-accent py-2">
                    View recipe
                  </Link>
                  <Link href={tonightPickHref} className="btn bg-white/20 text-white py-2">
                    <SwapIcon className="w-4 h-4" />
                    Swap
                  </Link>
                </>
              ) : (
                <>
                  <Link href={tonightPickHref} className="btn bg-card text-accent py-2">
                    Choose dinner
                  </Link>
                  <Link href="/suggestions" className="btn bg-white/20 text-white py-2">
                    Get ideas
                  </Link>
                </>
              )}
            </div>
          </section>

          <div className="flex items-baseline justify-between mt-6 mb-2 px-1">
            <h2 className="text-base font-black">Coming up</h2>
            <span className="text-xs font-extrabold text-dim">Next {upcoming.length} days</span>
          </div>

          <ul className="space-y-3">
            {upcoming.map(({ date, label, relative }) => {
              const recipe = recipeFor(date);
              const dayLabel = relative ? `${label} (${relative})` : label;
              const pickHref = pickHrefFor(date, dayLabel);
              return (
                <li key={date}>
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className="text-xs font-extrabold text-dim">{label}</span>
                    {relative && <span className="chip bg-accent-soft text-accent-soft-ink">{relative}</span>}
                  </div>
                  {!recipe ? (
                    <Link
                      href={pickHref}
                      className="flex items-center justify-center rounded-3xl border-2 border-dashed border-line p-3.5 text-sm font-extrabold text-dim"
                    >
                      + Choose a recipe
                    </Link>
                  ) : (
                    <div className="card flex items-center gap-3 p-2.5 pr-3">
                      <Link href={`/recipes/${recipe.id}`} className="flex-1 flex items-center gap-3 min-w-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={recipe.image_url ?? "/recipe-placeholder.jpg"}
                          alt=""
                          className="w-14 h-14 rounded-2xl object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-extrabold leading-tight truncate" title={recipe.name}>
                            {shortenRecipeName(recipe.name)}
                          </p>
                          <p className="text-xs font-bold text-dim truncate">{recipeMeta(recipe) || "Dinner"}</p>
                        </div>
                      </Link>
                      <Link
                        href={pickHref}
                        aria-label={`Change dinner for ${label}`}
                        className="shrink-0 w-9 h-9 rounded-full bg-accent-soft text-accent-soft-ink flex items-center justify-center"
                      >
                        <SwapIcon className="w-4 h-4" />
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
