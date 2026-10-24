import { describe, it, expect } from "vitest";
import { isHorizontalDrag, neighborTab, swipeDecision, tabIndexFor } from "@/lib/tabs";

describe("neighborTab", () => {
  it("moves along the tab bar order", () => {
    expect(neighborTab("/", "next")).toBe("/recipes");
    expect(neighborTab("/grocery-list", "next")).toBe("/suggestions");
    expect(neighborTab("/grocery-list", "prev")).toBe("/recipes");
  });

  it("stops at the first and last tabs", () => {
    expect(neighborTab("/", "prev")).toBeNull();
    expect(neighborTab("/history", "next")).toBeNull();
  });

  it("doesn't swipe from pages that aren't tabs", () => {
    expect(tabIndexFor("/recipes/abc")).toBe(-1);
    expect(neighborTab("/recipes/abc", "next")).toBeNull();
    expect(neighborTab("/aisle-order", "prev")).toBeNull();
  });
});

describe("isHorizontalDrag", () => {
  it("is false until the finger has moved a little", () => {
    expect(isHorizontalDrag(6, 0)).toBe(false);
  });

  it("is true for a mostly sideways drag", () => {
    expect(isHorizontalDrag(-40, 10)).toBe(true);
  });

  it("is false for a mostly vertical drag (scrolling)", () => {
    expect(isHorizontalDrag(20, 30)).toBe(false);
  });
});

describe("swipeDecision", () => {
  const width = 390;

  it("goes to the next tab after a long drag left", () => {
    expect(swipeDecision(-150, 600, width)).toBe("next");
  });

  it("goes to the previous tab after a long drag right", () => {
    expect(swipeDecision(150, 600, width)).toBe("prev");
  });

  it("accepts a short, quick flick", () => {
    expect(swipeDecision(-60, 80, width)).toBe("next");
  });

  it("snaps back after a short, slow drag", () => {
    expect(swipeDecision(-60, 600, width)).toBeNull();
  });
});
