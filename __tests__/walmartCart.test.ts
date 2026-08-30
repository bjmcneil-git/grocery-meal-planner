import { describe, it, expect } from "vitest";
import { buildWalmartSearchUrl } from "@/lib/walmartCart";

describe("buildWalmartSearchUrl", () => {
  it("builds a walmart.com search url for the given query", () => {
    expect(buildWalmartSearchUrl("milk")).toBe("https://www.walmart.com/search?q=milk");
  });

  it("url-encodes spaces and special characters", () => {
    expect(buildWalmartSearchUrl("extra-virgin olive oil")).toBe(
      "https://www.walmart.com/search?q=extra-virgin%20olive%20oil"
    );
  });
});
