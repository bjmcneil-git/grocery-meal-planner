import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { addGroceryItem, findMatchingGroceryItems } from "@/lib/groceryList";
import type { GroceryListItem } from "@/lib/types";

describe("findMatchingGroceryItems", () => {
  const items: GroceryListItem[] = [
    { id: "1", item_name: "Milk", quantity: 1, source: "manual", walmart_item_id: null, added_at: "" },
    { id: "2", item_name: "3 cloves garlic (minced)", quantity: null, source: "manual", walmart_item_id: null, added_at: "" },
    { id: "3", item_name: "Popcorn", quantity: 1, source: "manual", walmart_item_id: null, added_at: "" },
  ];

  it("matches case-insensitively on an exact name", () => {
    expect(findMatchingGroceryItems("milk", items).map((i) => i.id)).toEqual(["1"]);
  });

  it("matches a whole-word substring within a longer item name", () => {
    expect(findMatchingGroceryItems("garlic", items).map((i) => i.id)).toEqual(["2"]);
  });

  it("does not match a short name embedded in a longer unrelated word", () => {
    expect(findMatchingGroceryItems("pop", items).map((i) => i.id)).toEqual([]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(findMatchingGroceryItems("bananas", items)).toEqual([]);
  });

  it("returns an empty array for an empty spoken name", () => {
    expect(findMatchingGroceryItems("", items)).toEqual([]);
  });
});

describe("addGroceryItem", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc";
    process.env.CLOUDFLARE_D1_DATABASE_ID = "db";
    process.env.CLOUDFLARE_API_TOKEN = "token";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it("inserts an item with the given name, quantity, and source", async () => {
    const fakeItem: GroceryListItem = {
      id: "abc",
      item_name: "milk",
      quantity: 2,
      source: "voice",
      walmart_item_id: null,
      added_at: "2026-08-24T00:00:00.000Z",
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, errors: [], result: [{ results: [fakeItem] }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await addGroceryItem("milk", 2, "voice");

    expect(result).toEqual(fakeItem);
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.sql).toContain("INSERT INTO grocery_list");
    expect(body.params).toEqual([expect.any(String), "milk", 2, "voice"]);
  });
});
