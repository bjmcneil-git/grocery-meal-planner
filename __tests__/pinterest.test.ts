import { describe, it, expect } from "vitest";
import { isPinterestShareLink, extractPinterestDestination } from "@/lib/pinterest";

describe("isPinterestShareLink", () => {
  it("recognizes pin.it short links", () => {
    expect(isPinterestShareLink("https://pin.it/5DHwKLI0d")).toBe(true);
  });

  it("recognizes pinterest.com pin pages", () => {
    expect(isPinterestShareLink("https://www.pinterest.com/pin/840413980508505658/")).toBe(true);
  });

  it("returns false for a regular recipe site", () => {
    expect(isPinterestShareLink("https://stroller-envy.com/easy-ground-beef-recipes/")).toBe(false);
  });

  it("returns false for an unparseable url", () => {
    expect(isPinterestShareLink("not a url")).toBe(false);
  });
});

describe("extractPinterestDestination", () => {
  it("pulls the outbound recipe link out of a pin page's embedded data", () => {
    const html = `<script>{"resource_response":{"data":{"link":"","id":"1"}}},{"link":"https:\\/\\/stroller-envy.com\\/easy-ground-beef-recipes\\/"}</script>`;
    expect(extractPinterestDestination(html)).toBe(
      "https://stroller-envy.com/easy-ground-beef-recipes/"
    );
  });

  it("skips empty link fields", () => {
    const html = `{"link":""}{"link":""}{"link":"https://example.com/recipe"}`;
    expect(extractPinterestDestination(html)).toBe("https://example.com/recipe");
  });

  it("skips a link field that just points back to pinterest", () => {
    const html = `{"link":"https://www.pinterest.com/pin/123/"}{"link":"https://example.com/recipe"}`;
    expect(extractPinterestDestination(html)).toBe("https://example.com/recipe");
  });

  it("returns null when no link field is present", () => {
    expect(extractPinterestDestination("<html><body>nothing here</body></html>")).toBeNull();
  });
});
