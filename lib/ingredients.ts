import type { RecipeIngredient, PurchaseItem } from "./types";

// Common pantry basics almost everyone already has - never worth putting on
// a shopping list just because a recipe happens to call for them.
const PANTRY_STAPLES = [
  "water",
  "salt",
  "black pepper",
  "pepper",
  "olive oil",
  "vegetable oil",
  "canola oil",
  "cooking oil",
  "oil",
  "sugar",
  "ice",
  "cooking spray",
  "nonstick spray",
];

function isWholeWordMatch(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`).test(haystack);
}

function isPantryStaple(ingredientName: string): boolean {
  const normalized = ingredientName.trim().toLowerCase();
  return PANTRY_STAPLES.some((staple) => isWholeWordMatch(normalized, staple));
}

export function computeMissingIngredients(
  recipeIngredients: RecipeIngredient[],
  recentPurchases: PurchaseItem[]
): RecipeIngredient[] {
  const purchasedNames = new Set(recentPurchases.map((p) => p.name.trim().toLowerCase()));
  return recipeIngredients.filter(
    (ing) =>
      !purchasedNames.has(ing.ingredient_name.trim().toLowerCase()) &&
      !isPantryStaple(ing.ingredient_name)
  );
}
