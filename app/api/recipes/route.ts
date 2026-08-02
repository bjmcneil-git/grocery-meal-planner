import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import type { Recipe } from "@/lib/types";

export async function GET() {
  const recipes = await d1Query<Recipe>(
    "SELECT * FROM recipes ORDER BY created_at DESC"
  );
  return NextResponse.json(recipes);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, instructions, source, source_url, cuisine, image_url, ingredients } = body;
  if (!name || !Array.isArray(ingredients) || ingredients.length === 0) {
    return NextResponse.json(
      { error: "name and at least one ingredient are required" },
      { status: 400 }
    );
  }

  const id = randomUUID();
  const [recipe] = await d1Query<Recipe>(
    `INSERT INTO recipes (id, name, source, source_url, instructions, cuisine, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
    [id, name, source ?? "manual", source_url ?? null, instructions ?? null, cuisine ?? null, image_url ?? null]
  );

  for (const ing of ingredients as { ingredient_name: string; quantity?: number; unit?: string }[]) {
    await d1Query(
      "INSERT INTO recipe_ingredients (id, recipe_id, ingredient_name, quantity, unit) VALUES (?, ?, ?, ?, ?)",
      [randomUUID(), id, ing.ingredient_name, ing.quantity ?? null, ing.unit ?? null]
    );
  }

  return NextResponse.json(recipe, { status: 201 });
}
