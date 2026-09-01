import { describe, it, expect } from "vitest";
import { buildExtractionPrompt, parseExtractionResponse, toImportResponse } from "@/lib/recipeExtraction";

describe("buildExtractionPrompt", () => {
  it("describes the required JSON shape", () => {
    const prompt = buildExtractionPrompt();
    expect(prompt).toContain("ingredient_name");
    expect(prompt).toContain("instructions");
  });
});

describe("parseExtractionResponse", () => {
  it("parses a valid recipe object", () => {
    const raw = JSON.stringify({
      name: "Lemon Chicken",
      cuisine: "Mediterranean",
      cook_time_minutes: 30,
      instructions: "Season and roast.",
      ingredients: [{ ingredient_name: "chicken", quantity: 2, unit: "lb" }],
    });
    expect(parseExtractionResponse(raw)).toEqual({
      name: "Lemon Chicken",
      cuisine: "Mediterranean",
      cook_time_minutes: 30,
      instructions: "Season and roast.",
      ingredients: [{ ingredient_name: "chicken", quantity: 2, unit: "lb" }],
    });
  });

  it("extracts a JSON object embedded in surrounding prose", () => {
    const raw = `Sure, here it is:\n${JSON.stringify({
      name: "Soup",
      instructions: "Simmer.",
      ingredients: [{ ingredient_name: "broth" }],
    })}\nEnjoy!`;
    const result = parseExtractionResponse(raw);
    expect(result?.name).toBe("Soup");
    expect(result?.ingredients).toEqual([{ ingredient_name: "broth", quantity: null, unit: null }]);
  });

  it("returns null for malformed JSON", () => {
    expect(parseExtractionResponse("{not valid json")).toBeNull();
  });

  it("returns null when name is missing", () => {
    const raw = JSON.stringify({ instructions: "Do it.", ingredients: [{ ingredient_name: "a" }] });
    expect(parseExtractionResponse(raw)).toBeNull();
  });

  it("returns null when instructions is missing", () => {
    const raw = JSON.stringify({ name: "X", ingredients: [{ ingredient_name: "a" }] });
    expect(parseExtractionResponse(raw)).toBeNull();
  });

  it("returns null when ingredients is empty", () => {
    const raw = JSON.stringify({ name: "X", instructions: "Do it.", ingredients: [] });
    expect(parseExtractionResponse(raw)).toBeNull();
  });

  it("drops an ingredient with no name and keeps valid ones", () => {
    const raw = JSON.stringify({
      name: "X",
      instructions: "Do it.",
      ingredients: [{ quantity: 1 }, { ingredient_name: "salt" }],
    });
    expect(parseExtractionResponse(raw)?.ingredients).toEqual([
      { ingredient_name: "salt", quantity: null, unit: null },
    ]);
  });

  it("drops an invalid cuisine rather than keeping it", () => {
    const raw = JSON.stringify({
      name: "X",
      cuisine: "Not A Real Cuisine",
      instructions: "Do it.",
      ingredients: [{ ingredient_name: "a" }],
    });
    expect(parseExtractionResponse(raw)?.cuisine).toBeNull();
  });

  it("returns null for unparseable text", () => {
    expect(parseExtractionResponse("not json at all")).toBeNull();
  });
});

describe("toImportResponse", () => {
  it("maps an ExtractedRecipe to the frontend import response shape", () => {
    const response = toImportResponse({
      name: "Lemon Chicken",
      instructions: "Season and roast.",
      cuisine: "Mediterranean",
      cook_time_minutes: 30,
      ingredients: [{ ingredient_name: "chicken", quantity: 2, unit: "lb" }],
    });
    expect(response).toEqual({
      name: "Lemon Chicken",
      ingredients: ["chicken"],
      cookTimeMinutes: 30,
      cuisine: "Mediterranean",
      instructions: "Season and roast.",
    });
  });
});
