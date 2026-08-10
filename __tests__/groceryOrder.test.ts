import { describe, it, expect } from "vitest";
import { sortAndGroupItems } from "@/lib/groceryOrder";
import type { AisleDirectoryEntry, GroceryListItem } from "@/lib/types";

function item(id: string, name: string): GroceryListItem {
  return { id, item_name: name, quantity: null, source: "manual", walmart_item_id: null, added_at: "2026-08-09" };
}

function aisle(id: string, walk_order: number | null): AisleDirectoryEntry {
  return { id, code: `code-${id}`, categories: "", walk_order };
}

describe("sortAndGroupItems", () => {
  it("orders matched items ascending by the matched aisle's walk_order", () => {
    const items = [item("1", "Seafood item"), item("2", "Deli item")];
    const seafood = aisle("a41", 25);
    const deli = aisle("deli", 1);
    const aisleByItemName = new Map([
      ["seafood item", seafood],
      ["deli item", deli],
    ]);

    const result = sortAndGroupItems(items, aisleByItemName);

    expect(result.sorted.map((s) => s.item.id)).toEqual(["2", "1"]);
    expect(result.unmatched).toEqual([]);
  });

  it("groups an item matched to a null-walk_order aisle into unmatched", () => {
    const items = [item("1", "Auto item")];
    const auto = aisle("auto", null);
    const aisleByItemName = new Map([["auto item", auto]]);

    const result = sortAndGroupItems(items, aisleByItemName);

    expect(result.sorted).toEqual([]);
    expect(result.unmatched).toEqual([{ item: items[0], aisle: auto }]);
  });

  it("groups an item with no cache entry into unmatched with a null aisle", () => {
    const items = [item("1", "Mystery item")];
    const result = sortAndGroupItems(items, new Map());

    expect(result.sorted).toEqual([]);
    expect(result.unmatched).toEqual([{ item: items[0], aisle: null }]);
  });

  it("normalizes item name casing/whitespace when looking up the cache", () => {
    const items = [item("1", "  Milk  ")];
    const milkAisle = aisle("a37", 20);
    const aisleByItemName = new Map([["milk", milkAisle]]);

    const result = sortAndGroupItems(items, aisleByItemName);

    expect(result.sorted).toEqual([{ item: items[0], aisle: milkAisle }]);
  });
});
