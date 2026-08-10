import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { vi } from "vitest";
import { normalizeItemName, buildMatchPrompt, parseMatchResponse, matchItemsToAisles } from "@/lib/aisleMatcher";
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

describe("matchItemsToAisles", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("returns an empty object immediately for an empty item list", async () => {
    const result = await matchItemsToAisles([], directory);
    expect(result).toEqual({});
  });

  it("calls the Anthropic Messages API with the expected shape and parses the reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: '{"milk": "aisle-a37"}' }],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await matchItemsToAisles(["milk"], directory);

    expect(result).toEqual({ milk: "aisle-a37" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(options.method).toBe("POST");
    expect(options.headers["x-api-key"]).toBe("test-key");
    expect(options.headers["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(options.body);
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body.messages[0].content).toContain("milk");
  });

  it("returns null for every item when the API call fails, instead of throwing", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    const result = await matchItemsToAisles(["milk", "eggs"], directory);
    expect(result).toEqual({ milk: null, eggs: null });
  });

  it("returns null for every item when the network call throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const result = await matchItemsToAisles(["milk"], directory);
    expect(result).toEqual({ milk: null });
  });
});
