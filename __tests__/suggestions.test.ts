import { describe, it, expect } from "vitest";
import { buildSuggestionPrompt, parseSuggestionsResponse } from "@/lib/suggestions";

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
