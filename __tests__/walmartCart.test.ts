import { describe, it, expect } from "vitest";
import { parseWalmartItemId, buildWalmartCartUrl } from "@/lib/walmartCart";

describe("parseWalmartItemId", () => {
  it("accepts a bare numeric item id", () => {
    expect(parseWalmartItemId("363472942")).toBe("363472942");
  });

  it("extracts the id from a standard product URL", () => {
    expect(parseWalmartItemId("https://www.walmart.com/ip/Great-Value-Milk/14803962651")).toBe(
      "14803962651"
    );
  });

  it("extracts the id from a product URL with a query string", () => {
    expect(
      parseWalmartItemId("https://www.walmart.com/ip/Great-Value-Milk/14803962651?athAsset=x")
    ).toBe("14803962651");
  });

  it("falls back to the longest run of digits when the URL shape is unrecognized", () => {
    expect(parseWalmartItemId("walmart.com/some/weird/path/14803962651")).toBe("14803962651");
  });

  it("returns null when no id can be found", () => {
    expect(parseWalmartItemId("not a walmart link")).toBeNull();
  });
});

describe("buildWalmartCartUrl", () => {
  it("builds a single-item cart url", () => {
    expect(buildWalmartCartUrl([{ walmartItemId: "363472942", quantity: 1 }])).toBe(
      "https://affil.walmart.com/cart/addToCart?items=363472942_1"
    );
  });

  it("joins multiple items with commas", () => {
    expect(
      buildWalmartCartUrl([
        { walmartItemId: "363472942", quantity: 2 },
        { walmartItemId: "14803962651", quantity: 1 },
      ])
    ).toBe("https://affil.walmart.com/cart/addToCart?items=363472942_2,14803962651_1");
  });

  it("clamps a missing or fractional quantity to a whole number of at least 1", () => {
    expect(buildWalmartCartUrl([{ walmartItemId: "1", quantity: 0 }])).toBe(
      "https://affil.walmart.com/cart/addToCart?items=1_1"
    );
    expect(buildWalmartCartUrl([{ walmartItemId: "1", quantity: 2.6 }])).toBe(
      "https://affil.walmart.com/cart/addToCart?items=1_3"
    );
  });
});
