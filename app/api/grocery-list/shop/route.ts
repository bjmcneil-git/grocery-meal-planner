import { NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import { normalizeItemName } from "@/lib/aisleMatcher";
import { sortAndGroupItems } from "@/lib/groceryOrder";
import type { AisleDirectoryEntry, GroceryListItem, ItemAisleCacheEntry } from "@/lib/types";

export async function POST() {
  const items = await d1Query<GroceryListItem>("SELECT * FROM grocery_list");
  const directory = await d1Query<AisleDirectoryEntry>("SELECT * FROM aisle_directory");
  const cacheRows = await d1Query<ItemAisleCacheEntry>("SELECT * FROM item_aisle_cache");

  const directoryById = new Map(directory.map((a) => [a.id, a]));
  const aisleByItemName = new Map<string, AisleDirectoryEntry>();
  for (const row of cacheRows) {
    const aisle = directoryById.get(row.aisle_directory_id);
    if (aisle) aisleByItemName.set(row.item_name, aisle);
  }

  const grouped = sortAndGroupItems(items, aisleByItemName);
  return NextResponse.json(grouped);
}
