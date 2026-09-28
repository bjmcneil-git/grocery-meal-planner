import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { addGroceryItem, deleteGroceryItems, findMatchingGroceryItems } from "@/lib/groceryList";
import type { GroceryListItem } from "@/lib/types";

describe("findMatchingGroceryItems", () => {
  const items: GroceryListItem[] = [
    { id: "1", item_name: "Milk", quantity: 1, source: "manual", walmart_item_id: null, added_at: "", picked_up: 0 },
    { id: "2", item_name: "3 cloves garlic (minced)", quantity: null, source: "manual", walmart_item_id: null, added_at: "", picked_up: 0 },
    { id: "3", item_name: "Popcorn", quantity: 1, source: "manual", walmart_item_id: null, added_at: "", picked_up: 0 },
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

  it("does not match a shorter unrelated item whose name is a whole word inside the spoken phrase", () => {
    const itemsWithOverlap: GroceryListItem[] = [
      { id: "1", item_name: "Milk", quantity: 1, source: "manual", walmart_item_id: null, added_at: "", picked_up: 0 },
      { id: "2", item_name: "Chocolate milk", quantity: 1, source: "manual", walmart_item_id: null, added_at: "", picked_up: 0 },
    ];
    expect(findMatchingGroceryItems("chocolate milk", itemsWithOverlap).map((i) => i.id)).toEqual(["2"]);
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
      picked_up: 0,
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

describe("deleteGroceryItems", () => {
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

  function mockFetch() {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, errors: [], result: [{ results: [] }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it("deletes all the given ids in one query", async () => {
    const fetchMock = mockFetch();

    await deleteGroceryItems(["a", "b", "c"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.sql).toBe("DELETE FROM grocery_list WHERE id IN (?, ?, ?)");
    expect(body.params).toEqual(["a", "b", "c"]);
  });

  it("splits more than 100 ids into batches", async () => {
    const fetchMock = mockFetch();
    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);

    await deleteGroceryItems(ids);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const batches = fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body).params);
    expect(batches.map((b: string[]) => b.length)).toEqual([100, 100, 50]);
    expect(batches.flat()).toEqual(ids);
  });

  it("does nothing for an empty list", async () => {
    const fetchMock = mockFetch();

    await deleteGroceryItems([]);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
