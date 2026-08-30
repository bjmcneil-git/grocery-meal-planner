import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import { fetchRecipeSuggestions } from "@/lib/suggestions";
import type { Recipe, WeeklyPlanEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { query } = await req.json();

  const recipes = await d1Query<Recipe>("SELECT * FROM recipes ORDER BY created_at DESC LIMIT 30");
  const recentPlan = await d1Query<WeeklyPlanEntry>(
    "SELECT * FROM weekly_plan WHERE plan_date >= date('now', '-30 days') ORDER BY plan_date DESC"
  );
  const purchaseRows = await d1Query<{ items: string }>(
    "SELECT items FROM purchases ORDER BY completed_at DESC LIMIT 2"
  );

  const recipeNameById = new Map(recipes.map((r) => [r.id, r.name]));
  const recentMeals = Array.from(
    new Set(
      recentPlan
        .map((p) => (p.recipe_id ? recipeNameById.get(p.recipe_id) : undefined))
        .filter((name): name is string => !!name)
    )
  );
  const recentPurchases = Array.from(
    new Set(
      purchaseRows.flatMap((row) => {
        try {
          const items = JSON.parse(row.items) as { name: string }[];
          return items.map((i) => i.name);
        } catch {
          return [];
        }
      })
    )
  );

  const suggestions = await fetchRecipeSuggestions(typeof query === "string" ? query : "", {
    savedRecipes: recipes.map((r) => r.name),
    recentMeals,
    recentPurchases,
  });

  if (suggestions.length === 0) {
    return NextResponse.json(
      { error: "Couldn't come up with suggestions right now. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ suggestions });
}
