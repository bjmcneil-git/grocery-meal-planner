import { describe, it, expect } from "vitest";
import {
  buildSuggestionPrompt,
  parseSuggestionsResponse,
  parseDietGoals,
  DEFAULT_DIET_GOALS,
  parseExcludedNames,
} from "@/lib/suggestions";

describe("buildSuggestionPrompt", () => {
  const context = {
    savedRecipes: ["Grilled Steak Fajitas"],
    recentMeals: ["Baked Chicken Spaghetti"],
    recentPurchases: ["milk", "eggs"],
  };

  it("asks for ingredient-based ideas when a query is given", () => {
    const prompt = buildSuggestionPrompt("chicken, spinach, feta", context);
    expect(prompt).toContain("chicken, spinach, feta");
    expect(prompt).toContain("Build 1-3 recipe ideas using that");
  });

  it("asks for history-based ideas when the query is blank", () => {
    const prompt = buildSuggestionPrompt("   ", context);
    expect(prompt).toContain("no specific ingredients");
  });

  it("includes the user's saved recipes, recent meals, and purchases", () => {
    const prompt = buildSuggestionPrompt("", context);
    expect(prompt).toContain("Grilled Steak Fajitas");
    expect(prompt).toContain("Baked Chicken Spaghetti");
    expect(prompt).toContain("milk, eggs");
  });
});

describe("parseSuggestionsResponse", () => {
  it("parses a valid JSON array of suggestions", () => {
    const raw = JSON.stringify([
      {
        name: "Lemon Chicken",
        cuisine: "Mediterranean",
        cook_time_minutes: 30,
        instructions: "Season and roast.",
        source_url: "https://example.com/lemon-chicken",
        ingredients: [{ ingredient_name: "chicken", quantity: 2, unit: "lb" }],
      },
    ]);
    expect(parseSuggestionsResponse(raw)).toEqual([
      {
        name: "Lemon Chicken",
        cuisine: "Mediterranean",
        cook_time_minutes: 30,
        instructions: "Season and roast.",
        source_url: "https://example.com/lemon-chicken",
        ingredients: [{ ingredient_name: "chicken", quantity: 2, unit: "lb" }],
        servings: null,
        calories_per_serving: null,
        protein_grams_per_serving: null,
      },
    ]);
  });

  it("extracts a JSON array embedded in surrounding prose", () => {
    const raw = `Here are some ideas:\n${JSON.stringify([
      { name: "Soup", instructions: "Simmer.", ingredients: [{ ingredient_name: "broth" }] },
    ])}\nEnjoy!`;
    expect(parseSuggestionsResponse(raw)).toHaveLength(1);
  });

  it("drops an invalid cuisine rather than keeping it", () => {
    const raw = JSON.stringify([
      { name: "X", cuisine: "Not A Real Cuisine", instructions: "Do it.", ingredients: [{ ingredient_name: "a" }] },
    ]);
    expect(parseSuggestionsResponse(raw)[0].cuisine).toBeNull();
  });

  it("skips a suggestion missing required fields", () => {
    const raw = JSON.stringify([{ cuisine: "Italian" }]);
    expect(parseSuggestionsResponse(raw)).toEqual([]);
  });

  it("skips a suggestion with no valid ingredients", () => {
    const raw = JSON.stringify([{ name: "X", instructions: "Do it.", ingredients: [] }]);
    expect(parseSuggestionsResponse(raw)).toEqual([]);
  });

  it("returns an empty array for unparseable text", () => {
    expect(parseSuggestionsResponse("not json at all")).toEqual([]);
  });
});

describe("diet suggestions", () => {
  const context = { savedRecipes: [], recentMeals: [], recentPurchases: [] };

  it("adds the calorie and protein limits to the prompt when a diet is given", () => {
    const prompt = buildSuggestionPrompt("chicken", context, {
      maxCaloriesPerServing: 450,
      minProteinGramsPerServing: 40,
    });
    expect(prompt).toContain("high-protein, low-calorie");
    expect(prompt).toContain("at most 450 calories");
    expect(prompt).toContain("at least 40 g of protein");
    expect(prompt).toContain("dinner ideas");
  });

  it("leaves the diet rule out when no diet is given", () => {
    expect(buildSuggestionPrompt("chicken", context)).not.toContain("low-calorie diet");
  });

  it("parses per-serving nutrition and nulls out bad values", () => {
    const raw = JSON.stringify([
      {
        name: "Turkey Taco Bowl",
        cuisine: null,
        cook_time_minutes: 25,
        instructions: "Brown turkey, build bowls.",
        source_url: null,
        ingredients: [{ ingredient_name: "ground turkey", quantity: 1, unit: "lb" }],
        servings: 4,
        calories_per_serving: 432.6,
        protein_grams_per_serving: "lots",
      },
    ]);
    const [s] = parseSuggestionsResponse(raw);
    expect(s.servings).toBe(4);
    expect(s.calories_per_serving).toBe(433);
    expect(s.protein_grams_per_serving).toBeNull();
  });
});

describe("parseDietGoals", () => {
  it("returns null when no diet was requested", () => {
    expect(parseDietGoals(undefined)).toBeNull();
  });

  it("keeps sane values and rounds them", () => {
    expect(parseDietGoals({ maxCaloriesPerServing: "450.4", minProteinGramsPerServing: 40 })).toEqual({
      maxCaloriesPerServing: 450,
      minProteinGramsPerServing: 40,
    });
  });

  it("falls back to defaults for out-of-range or junk values", () => {
    expect(parseDietGoals({ maxCaloriesPerServing: 5, minProteinGramsPerServing: "abc" })).toEqual(
      DEFAULT_DIET_GOALS
    );
  });
});

describe("refreshing diet suggestions", () => {
  const context = { savedRecipes: [], recentMeals: [], recentPurchases: [] };
  const diet = { maxCaloriesPerServing: 500, minProteinGramsPerServing: 35 };

  it("asks for exactly 10 dinners in diet mode", () => {
    const prompt = buildSuggestionPrompt("", context, diet);
    expect(prompt).toContain("Suggest 10 varied dinner ideas");
    expect(prompt).toContain("of exactly 10 objects");
  });

  it("keeps the 1-3 count for regular suggestions", () => {
    expect(buildSuggestionPrompt("", context)).toContain("of 1-3 objects");
  });

  it("tells the model which dishes were already shown", () => {
    const prompt = buildSuggestionPrompt("", context, diet, ["Turkey Taco Bowls", "Shrimp Stir Fry"]);
    expect(prompt).toContain("don't suggest any of them");
    expect(prompt).toContain("Turkey Taco Bowls, Shrimp Stir Fry");
  });

  it("omits the exclusion line when nothing was shown yet", () => {
    expect(buildSuggestionPrompt("", context, diet)).not.toContain("already saw these");
  });
});

describe("parseExcludedNames", () => {
  it("keeps trimmed non-empty strings and drops junk", () => {
    expect(parseExcludedNames(["  Tacos ", "", 5, null, "Chili"])).toEqual(["Tacos", "Chili"]);
  });

  it("caps the list length and name length", () => {
    const names = Array.from({ length: 80 }, (_, i) => `Dish ${i} ${"x".repeat(200)}`);
    const result = parseExcludedNames(names);
    expect(result).toHaveLength(60);
    expect(result[0].length).toBe(120);
  });

  it("returns an empty list for a non-array", () => {
    expect(parseExcludedNames("Tacos")).toEqual([]);
  });
});
