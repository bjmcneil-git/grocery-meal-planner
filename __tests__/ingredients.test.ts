import { describe, it, expect } from "vitest";
import { computeMissingIngredients } from "@/lib/ingredients";
import type { RecipeIngredient, PurchaseItem } from "@/lib/types";

function ing(name: string): RecipeIngredient {
  return { id: name, recipe_id: "r1", ingredient_name: name, quantity: 1, unit: null };
}

describe("computeMissingIngredients", () => {
  it("returns ingredients not present in recent purchases", () => {
    const recipeIngredients = [ing("chicken"), ing("rice"), ing("broccoli")];
    const recentPurchases: PurchaseItem[] = [{ name: "chicken", quantity: 1 }];
    const result = computeMissingIngredients(recipeIngredients, recentPurchases);
    expect(result.map((i) => i.ingredient_name)).toEqual(["rice", "broccoli"]);
  });

  it("matches names case-insensitively and ignores extra whitespace", () => {
    const recipeIngredients = [ing("Chicken")];
    const recentPurchases: PurchaseItem[] = [{ name: "  chicken  ", quantity: 1 }];
    expect(computeMissingIngredients(recipeIngredients, recentPurchases)).toEqual([]);
  });

  it("returns everything when there are no recent purchases", () => {
    const recipeIngredients = [ing("eggs"), ing("milk")];
    expect(computeMissingIngredients(recipeIngredients, [])).toHaveLength(2);
  });

  it("excludes common pantry staples like water, salt, and oil even with no purchase history", () => {
    const recipeIngredients = [
      ing("2 cups water"),
      ing("Salt and pepper to taste"),
      ing("2 Tablespoons olive oil"),
      ing("chicken breast"),
    ];
    const result = computeMissingIngredients(recipeIngredients, []);
    expect(result.map((i) => i.ingredient_name)).toEqual(["chicken breast"]);
  });

  it("does not exclude an ingredient that merely contains a staple word as a substring", () => {
    const recipeIngredients = [ing("boiled eggs"), ing("saltine crackers")];
    const result = computeMissingIngredients(recipeIngredients, []);
    expect(result.map((i) => i.ingredient_name)).toEqual(["boiled eggs", "saltine crackers"]);
  });
});
