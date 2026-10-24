"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Purchase, Recipe, WeeklyPlanEntry } from "@/lib/types";
import { getPastDays } from "@/lib/week";
import { shortenRecipeName } from "@/lib/recipeDisplay";
import PageHeader from "../components/PageHeader";

const DAYS_BACK = 14;

function formatHistoryDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  return `${weekday} ${m}/${d}`;
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 text-sm font-extrabold px-3 py-2 rounded-full transition-colors ${
        active ? "bg-accent text-accent-ink shadow-lift" : "text-dim"
      }`}
    >
      {children}
    </button>
  );
}

export default function HistoryPage() {
  const [tab, setTab] = useState<"meals" | "lists">("meals");
  const days = useMemo(() => getPastDays(DAYS_BACK), []);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plan, setPlan] = useState<WeeklyPlanEntry[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(true);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const recipeById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  useEffect(() => {
    const from = days[days.length - 1].date;
    const to = days[0].date;
    Promise.all([
      fetch("/api/recipes").then((r) => r.json()).then(setRecipes),
      fetch(`/api/weekly-plan?from=${from}&to=${to}`).then((r) => r.json()).then(setPlan),
    ]).finally(() => setLoadingMeals(false));
  }, [days]);

  useEffect(() => {
    fetch("/api/purchases")
      .then((r) => r.json())
      .then(setPurchases)
      .finally(() => setLoadingLists(false));
  }, []);

  const plannedDays = days.filter((d) => {
    const entry = plan.find((p) => p.plan_date === d.date);
    return entry?.recipe_id && recipeById.has(entry.recipe_id);
  });

  return (
    <main className="px-4 pt-3">
      <PageHeader eyebrow="The past two weeks" title="History" />

      <div className="flex gap-1 mb-4 p-1 rounded-full bg-card shadow-soft">
        <TabButton active={tab === "meals"} onClick={() => setTab("meals")}>
          Meals
        </TabButton>
        <TabButton active={tab === "lists"} onClick={() => setTab("lists")}>
          Lists
        </TabButton>
      </div>

      {tab === "meals" &&
        (loadingMeals ? (
          <p className="font-semibold text-dim">Loading...</p>
        ) : plannedDays.length === 0 ? (
          <p className="card p-5 text-center font-bold text-dim">No meals planned in the past two weeks.</p>
        ) : (
          <ul className="space-y-3">
            {plannedDays.map(({ date, label, relative }) => {
              const entry = plan.find((p) => p.plan_date === date);
              const recipe = recipeById.get(entry!.recipe_id!)!;
              return (
                <li key={date}>
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className="text-xs font-extrabold text-dim">{label}</span>
                    {relative && <span className="chip bg-accent-soft text-accent-soft-ink">{relative}</span>}
                  </div>
                  <Link
                    href={`/recipes/${recipe.id}`}
                    className="card flex items-center gap-3 p-2.5 min-w-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={recipe.image_url ?? "/recipe-placeholder.jpg"}
                      alt={recipe.name}
                      className="w-14 h-14 rounded-2xl object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-extrabold leading-tight truncate" title={recipe.name}>
                        {shortenRecipeName(recipe.name)}
                      </p>
                      <p className="text-xs font-bold text-dim">Dinner</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}

      {tab === "lists" &&
        (loadingLists ? (
          <p className="font-semibold text-dim">Loading...</p>
        ) : purchases.length === 0 ? (
          <p className="card p-5 text-center font-bold text-dim">No completed lists yet.</p>
        ) : (
          <ul className="space-y-2">
            {purchases.map((p) => (
              <li key={p.id} className="card p-4">
                <button
                  type="button"
                  onClick={() => setExpandedId((cur) => (cur === p.id ? null : p.id))}
                  className="w-full flex items-center justify-between text-left"
                >
                  <span className="text-[15px] font-extrabold">{formatHistoryDate(p.completed_at)}</span>
                  <span className="chip bg-second-soft text-second-soft-ink">{p.items.length} items</span>
                </button>
                {expandedId === p.id && (
                  <ul className="mt-3 text-sm font-semibold space-y-1.5">
                    {p.items.map((it, idx) => (
                      <li key={idx}>
                        {it.name}
                        {it.quantity > 1 ? ` × ${it.quantity}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}
