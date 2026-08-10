import { NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import { normalizeItemName, matchItemsToAisles } from "@/lib/aisleMatcher";
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

  const uncachedNames = Array.from(
    new Set(
      items
        .map((i) => normalizeItemName(i.item_name))
        .filter((name) => !aisleByItemName.has(name))
    )
  );

  if (uncachedNames.length > 0) {
    const matches = await matchItemsToAisles(uncachedNames, directory);
    for (const name of uncachedNames) {
      const aisleId = matches[name];
      if (!aisleId) continue;
      const aisle = directoryById.get(aisleId);
      if (!aisle) continue;
      aisleByItemName.set(name, aisle);
      await d1Query(
        `INSERT INTO item_aisle_cache (item_name, aisle_directory_id, matched_by)
         VALUES (?, ?, 'ai')
         ON CONFLICT(item_name) DO UPDATE SET
           aisle_directory_id = excluded.aisle_directory_id,
           matched_by = 'ai',
           matched_at = datetime('now')`,
        [name, aisleId]
      );
    }
  }

  const grouped = sortAndGroupItems(items, aisleByItemName);
  return NextResponse.json(grouped);
}
