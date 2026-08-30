import { describe, it, expect } from "vitest";
import { shortenRecipeName } from "@/lib/recipeDisplay";

describe("shortenRecipeName", () => {
  it("cuts off a subtitle after an en dash", () => {
    expect(shortenRecipeName("Thai Larb Recipe (Larb Gai) – Authentic, Easy & Flavorful")).toBe(
      "Thai Larb Recipe"
    );
  });

  it("cuts off a trailing parenthetical", () => {
    expect(shortenRecipeName("Grilled Pork Chops (Easy Weeknight Dinner)")).toBe("Grilled Pork Chops");
  });

  it("leaves a short name without a separator unchanged", () => {
    expect(shortenRecipeName("Grilled Steak Fajitas")).toBe("Grilled Steak Fajitas");
  });
});
