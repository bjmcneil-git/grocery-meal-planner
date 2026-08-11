import type { RecipeIngredient, PurchaseItem } from "./types";

export function computeMissingIngredients(
  recipeIngredients: RecipeIngredient[],
  recentPurchases: PurchaseItem[]
): RecipeIngredient[] {
  const purchasedNames = new Set(recentPurchases.map((p) => p.name.trim().toLowerCase()));
  return recipeIngredients.filter(
    (ing) => !purchasedNames.has(ing.ingredient_name.trim().toLowerCase())
  );
}
