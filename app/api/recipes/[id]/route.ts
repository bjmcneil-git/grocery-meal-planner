import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import type { Recipe, RecipeIngredient } from "@/lib/types";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const [recipe] = await d1Query<Recipe>("SELECT * FROM recipes WHERE id = ?", [params.id]);
  if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  const ingredients = await d1Query<RecipeIngredient>(
    "SELECT * FROM recipe_ingredients WHERE recipe_id = ?",
    [params.id]
  );
  return NextResponse.json({ recipe, ingredients });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { name, cuisine } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const [recipe] = await d1Query<Recipe>(
    "UPDATE recipes SET name = ?, cuisine = ? WHERE id = ? RETURNING *",
    [name, cuisine ?? null, params.id]
  );
  if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  return NextResponse.json(recipe);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await d1Query("DELETE FROM recipe_ingredients WHERE recipe_id = ?", [params.id]);
  await d1Query("DELETE FROM recipes WHERE id = ?", [params.id]);
  return NextResponse.json({ ok: true });
}
