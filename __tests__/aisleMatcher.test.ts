import { describe, it, expect } from "vitest";
import { normalizeItemName } from "@/lib/aisleMatcher";

describe("normalizeItemName", () => {
  it("trims and lowercases", () => {
    expect(normalizeItemName("  Milk  ")).toBe("milk");
  });

  it("treats different-case names as the same normalized value", () => {
    expect(normalizeItemName("EGGS")).toBe(normalizeItemName("eggs"));
  });
});
