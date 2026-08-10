import { describe, it, expect } from "vitest";
import { normalizeItemName, buildMatchPrompt, parseMatchResponse } from "@/lib/aisleMatcher";
import type { AisleDirectoryEntry } from "@/lib/types";

const directory: AisleDirectoryEntry[] = [
  { id: "aisle-a2", code: "A2-A3", categories: "Waffles, Potatoes, Ice Cream, Frozen Breakfast", walk_order: 5 },
  { id: "aisle-a37", code: "A37", categories: "Milk, Creamer, Eggs, Juice", walk_order: 20 },
];

describe("normalizeItemName", () => {
  it("trims and lowercases", () => {
    expect(normalizeItemName("  Milk  ")).toBe("milk");
  });

  it("treats different-case names as the same normalized value", () => {
    expect(normalizeItemName("EGGS")).toBe(normalizeItemName("eggs"));
  });
});

describe("buildMatchPrompt", () => {
  it("includes every item name and every directory entry", () => {
    const prompt = buildMatchPrompt(["milk", "batteries"], directory);
    expect(prompt).toContain("milk");
    expect(prompt).toContain("batteries");
    expect(prompt).toContain("aisle-a2");
    expect(prompt).toContain("A2-A3");
    expect(prompt).toContain("aisle-a37");
  });
});

describe("parseMatchResponse", () => {
  it("maps item names to aisle ids from valid JSON", () => {
    const raw = '{"milk": "aisle-a37", "batteries": null}';
    const result = parseMatchResponse(raw, ["milk", "batteries"], directory);
    expect(result).toEqual({ milk: "aisle-a37", batteries: null });
  });

  it("extracts JSON from surrounding markdown code fences", () => {
    const raw = '```json\n{"milk": "aisle-a37"}\n```';
    const result = parseMatchResponse(raw, ["milk"], directory);
    expect(result).toEqual({ milk: "aisle-a37" });
  });

  it("returns null for every item on malformed JSON instead of throwing", () => {
    const raw = "{not valid json";
    const result = parseMatchResponse(raw, ["milk", "eggs"], directory);
    expect(result).toEqual({ milk: null, eggs: null });
  });

  it("returns null for an aisle id that isn't in the directory", () => {
    const raw = '{"milk": "not-a-real-aisle-id"}';
    const result = parseMatchResponse(raw, ["milk"], directory);
    expect(result).toEqual({ milk: null });
  });

  it("returns null for an item name missing from the response", () => {
    const raw = '{"milk": "aisle-a37"}';
    const result = parseMatchResponse(raw, ["milk", "eggs"], directory);
    expect(result).toEqual({ milk: "aisle-a37", eggs: null });
  });
});
