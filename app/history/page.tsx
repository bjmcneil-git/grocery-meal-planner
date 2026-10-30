"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { GroceryListItem, Purchase, PurchaseItem, Recipe, WeeklyPlanEntry } from "@/lib/types";
import { getPastDays } from "@/lib/week";
import { shortenRecipeName } from "@/lib/recipeDisplay";
import { normalizeItemName } from "@/lib/aisleMatcher";
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
  // Names already on the current shopping list, so past items can show
  // "On list" instead of offering to add them again.
  const [onList, setOnList] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState<string | null>(null);

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
    Promise.all([
      fetch("/api/purchases")
        .then((r) => r.json())
        .then((data: Purchase[]) => {
          setPurchases(data);
          // Open the newest list so reordering is one tap away.
          if (data.length > 0) setExpandedId(data[0].id);
        }),
      fetch("/api/grocery-list")
        .then((r) => r.json())
        .then((items: GroceryListItem[]) => setOnList(new Set(items.map((i) => normalizeItemName(i.item_name)))))
        .catch(() => {}),
    ]).finally(() => setLoadingLists(false));
  }, []);

  function isOnList(item: PurchaseItem): boolean {
    return onList.has(normalizeItemName(item.name));
  }

  // Puts past items back on the shopping list. A quantity of 1 was stored
  // for items that had none, so only real quantities are sent back.
  async function addToList(items: PurchaseItem[]) {
    const toAdd = items.filter((it) => !isOnList(it) && !adding.has(normalizeItemName(it.name)));
    if (toAdd.length === 0) return;
    const keys = toAdd.map((it) => normalizeItemName(it.name));
    setAdding((prev) => new Set([...Array.from(prev), ...keys]));
    setAddError(null);
    const results = await Promise.all(
      toAdd.map((it) =>
        fetch("/api/grocery-list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_name: it.name, quantity: it.quantity > 1 ? it.quantity : null }),
        })
          .then((res) => res.ok)
          .catch(() => false)
      )
    );
    const added = keys.filter((_, i) => results[i]);
    setOnList((prev) => new Set([...Array.from(prev), ...added]));
    setAdding((prev) => new Set(Array.from(prev).filter((k) => !keys.includes(k))));
    if (added.length < keys.length) setAddError("Some items couldn't be added. Please try again.");
  }

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
            {addError && <p className="text-sm font-bold text-danger px-1">{addError}</p>}
            {purchases.map((p) => (
              <li key={p.id} className="card p-4">
                <button
                  type="button"
                  onClick={() => setExpandedId((cur) => (cur === p.id ? null : p.id))}
                  className="w-full flex items-center justify-between text-left"
                >
                  <span className="text-[15px] font-extrabold">{formatHistoryDate(p.completed_at)}</span>
                  <span className="chip bg-second-soft text-second-soft-ink">
                    {p.items.length} item{p.items.length === 1 ? "" : "s"}
                  </span>
                </button>
                {expandedId === p.id && (
                  <>
                    <ul className="mt-2 divide-y-2 divide-line/70">
                      {p.items.map((it, idx) => {
                        const key = normalizeItemName(it.name);
                        return (
                          <li key={idx} className="flex items-center gap-2 py-2.5">
                            <span className="flex-1 min-w-0 text-sm font-bold leading-snug">
                              {it.name}
                              {it.quantity > 1 && <span className="text-dim"> ×{it.quantity}</span>}
                            </span>
                            {isOnList(it) ? (
                              <span className="chip bg-second-soft text-second-soft-ink shrink-0">On list &#10003;</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addToList([it])}
                                disabled={adding.has(key)}
                                aria-label={`Add ${it.name} to your list`}
                                className="chip py-1.5 px-3 bg-accent text-accent-ink shrink-0 disabled:opacity-50"
                              >
                                {adding.has(key) ? "Adding..." : "+ Add"}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {(() => {
                      const remaining = p.items.filter((it) => !isOnList(it));
                      const busy = remaining.some((it) => adding.has(normalizeItemName(it.name)));
                      return (
                        <button
                          type="button"
                          onClick={() => addToList(remaining)}
                          disabled={remaining.length === 0 || busy}
                          className="w-full mt-2 btn-soft disabled:opacity-60"
                        >
                          {remaining.length === 0
                            ? "All on your list"
                            : busy
                              ? "Adding..."
                              : `Add all to list (${remaining.length})`}
                        </button>
                      );
                    })()}
                  </>
                )}
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}
