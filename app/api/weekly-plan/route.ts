import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import { computeMissingIngredients } from "@/lib/ingredients";
import type { Purchase, PurchaseItem, RecipeIngredient, WeeklyPlanEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

// weekly_plan still carries legacy week_start_date/day_of_week columns
// (NOT NULL, pre-dating plan_date) - derive them from plan_date so inserts
// keep satisfying that constraint without the app needing to think in
// terms of "weeks" anymore. Querying/display is plan_date-only.
function legacyWeekAnchor(planDate: string): { week_start_date: string; day_of_week: number } {
  const d = new Date(`${planDate}T00:00:00Z`);
  const day = d.getUTCDay();
  const sunday = new Date(d);
  sunday.setUTCDate(d.getUTCDate() - day);
  return { week_start_date: sunday.toISOString().slice(0, 10), day_of_week: day };
}

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }
  const entries = await d1Query<WeeklyPlanEntry>(
    "SELECT * FROM weekly_plan WHERE plan_date BETWEEN ? AND ?",
    [from, to]
  );
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const { plan_date, recipe_id } = await req.json();
  if (!plan_date || !recipe_id) {
    return NextResponse.json({ error: "plan_date and recipe_id are required" }, { status: 400 });
  }

  const { week_start_date, day_of_week } = legacyWeekAnchor(plan_date);

  const [entry] = await d1Query<WeeklyPlanEntry>(
    `INSERT INTO weekly_plan (id, week_start_date, day_of_week, recipe_id, plan_date)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(plan_date) DO UPDATE SET recipe_id = excluded.recipe_id
     RETURNING *`,
    [randomUUID(), week_start_date, day_of_week, recipe_id, plan_date]
  );

  const recipeIngredients = await d1Query<RecipeIngredient>(
    "SELECT * FROM recipe_ingredients WHERE recipe_id = ?",
    [recipe_id]
  );

  const since = new Date();
  since.setDate(since.getDate() - 14);
  const recentPurchases = await d1Query<Purchase>(
    "SELECT * FROM purchases WHERE completed_at >= ?",
    [since.toISOString().slice(0, 10)]
  );
  const allRecentItems: PurchaseItem[] = recentPurchases.flatMap((p) => JSON.parse(p.items as unknown as string));

  const missing = computeMissingIngredients(recipeIngredients, allRecentItems);
  for (const ing of missing) {
    await d1Query(
      `INSERT INTO grocery_list (id, item_name, quantity, source) VALUES (?, ?, ?, 'planned')`,
      [randomUUID(), ing.ingredient_name, ing.quantity]
    );
  }

  return NextResponse.json(entry, { status: 201 });
}
