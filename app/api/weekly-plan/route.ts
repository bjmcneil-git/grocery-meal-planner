import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import { computeMissingIngredients } from "@/lib/ingredients";
import type { Purchase, PurchaseItem, RecipeIngredient, WeeklyPlanEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const weekStartDate = req.nextUrl.searchParams.get("week_start_date");
  if (!weekStartDate) {
    return NextResponse.json({ error: "week_start_date is required" }, { status: 400 });
  }
  const entries = await d1Query<WeeklyPlanEntry>(
    "SELECT * FROM weekly_plan WHERE week_start_date = ?",
    [weekStartDate]
  );
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const { week_start_date, day_of_week, recipe_id } = await req.json();
  if (!week_start_date || day_of_week === undefined || !recipe_id) {
    return NextResponse.json(
      { error: "week_start_date, day_of_week, and recipe_id are required" },
      { status: 400 }
    );
  }

  const [entry] = await d1Query<WeeklyPlanEntry>(
    `INSERT INTO weekly_plan (id, week_start_date, day_of_week, recipe_id)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(week_start_date, day_of_week) DO UPDATE SET recipe_id = excluded.recipe_id
     RETURNING *`,
    [randomUUID(), week_start_date, day_of_week, recipe_id]
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
