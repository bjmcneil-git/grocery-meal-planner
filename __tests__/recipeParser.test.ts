import { describe, it, expect } from "vitest";
import { parseRecipeFromHtml } from "@/lib/recipeParser";

describe("parseRecipeFromHtml", () => {
  it("extracts a recipe from a JSON-LD script tag", () => {
    const html = `
      <html><head>
      <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Recipe","name":"Tacos","recipeIngredient":["1 lb ground beef","8 tortillas","1 cup cheese"]}
      </script>
      </head><body></body></html>
    `;
    const result = parseRecipeFromHtml(html);
    expect(result).toEqual({
      name: "Tacos",
      ingredients: ["1 lb ground beef", "8 tortillas", "1 cup cheese"],
    });
  });

  it("finds a Recipe node nested in an @graph array", () => {
    const html = `
      <script type="application/ld+json">
      {"@graph":[{"@type":"WebPage"},{"@type":"Recipe","name":"Soup","recipeIngredient":["broth","noodles"]}]}
      </script>
    `;
    const result = parseRecipeFromHtml(html);
    expect(result).toEqual({ name: "Soup", ingredients: ["broth", "noodles"] });
  });

  it("returns null when no recipe data is present", () => {
    const html = "<html><body><p>Just a blog post, no recipe here.</p></body></html>";
    expect(parseRecipeFromHtml(html)).toBeNull();
  });

  it("returns null on malformed JSON-LD instead of throwing", () => {
    const html = `<script type="application/ld+json">{not valid json</script>`;
    expect(parseRecipeFromHtml(html)).toBeNull();
  });

  it("extracts a string image and string recipeCuisine", () => {
    const html = `
      <script type="application/ld+json">
      {"@type":"Recipe","name":"Pad Thai","recipeIngredient":["noodles","peanuts"],"recipeCuisine":"Thai","image":"https://example.com/pad-thai.jpg"}
      </script>
    `;
    const result = parseRecipeFromHtml(html);
    expect(result).toEqual({
      name: "Pad Thai",
      ingredients: ["noodles", "peanuts"],
      cuisine: "Thai",
      image: "https://example.com/pad-thai.jpg",
    });
  });

  it("matches a script tag with an unquoted type attribute (e.g. Yoast SEO output)", () => {
    const html = `
      <script type=application/ld+json class=yoast-schema-graph>
      {"@type":"Recipe","name":"Guacamole","recipeIngredient":["avocado","lime","salt"]}
      </script>
    `;
    const result = parseRecipeFromHtml(html);
    expect(result).toEqual({ name: "Guacamole", ingredients: ["avocado", "lime", "salt"] });
  });

  it("extracts an ImageObject-style image and array-form recipeCuisine", () => {
    const html = `
      <script type="application/ld+json">
      {"@type":"Recipe","name":"Moussaka","recipeIngredient":["eggplant","lamb"],"recipeCuisine":["Greek"],"image":{"@type":"ImageObject","url":"https://example.com/moussaka.jpg"}}
      </script>
    `;
    const result = parseRecipeFromHtml(html);
    expect(result).toEqual({
      name: "Moussaka",
      ingredients: ["eggplant", "lamb"],
      cuisine: "Greek",
      image: "https://example.com/moussaka.jpg",
    });
  });
});
