import { describe, it, expect } from "vitest";
import { normalizeItemName, matchByKeyword } from "@/lib/aisleMatcher";
import type { AisleDirectoryEntry } from "@/lib/types";

describe("normalizeItemName", () => {
  it("trims and lowercases", () => {
    expect(normalizeItemName("  Milk  ")).toBe("milk");
  });

  it("treats different-case names as the same normalized value", () => {
    expect(normalizeItemName("EGGS")).toBe(normalizeItemName("eggs"));
  });
});

describe("matchByKeyword", () => {
  const directory: AisleDirectoryEntry[] = [
    { id: "a37", code: "A37", categories: "Milk, Creamer, Eggs, Juice", walk_order: 20 },
    { id: "ab1", code: "AB1", categories: "Bread/Bakery", walk_order: 3 },
    { id: "ac3", code: "AC3", categories: "Meats", walk_order: 22 },
    { id: "ac1", code: "AC1", categories: "Meats", walk_order: 24 },
    { id: "hardlines", code: "H1", categories: "Electronics", walk_order: null },
  ];

  it("matches on an exact category token, case/whitespace-insensitive", () => {
    expect(matchByKeyword("  MILK  ", directory)).toBe("a37");
  });

  it("matches a category split out of a slash-separated field", () => {
    expect(matchByKeyword("bread", directory)).toBe("ab1");
  });

  it("matches when the item name contains a category word as a substring", () => {
    expect(matchByKeyword("chocolate milk", directory)).toBe("a37");
  });

  it("matches when a category word contains the item name as a substring", () => {
    expect(matchByKeyword("egg", directory)).toBe("a37");
  });

  it("returns null when nothing resembles the item name", () => {
    expect(matchByKeyword("gift wrap", directory)).toBeNull();
  });

  it("breaks ties between equally-good matches by preferring the lower walk_order", () => {
    expect(matchByKeyword("meats", directory)).toBe("ac3");
  });

  it("does not substring-match on very short item names", () => {
    expect(matchByKeyword("a", directory)).toBeNull();
  });
});
