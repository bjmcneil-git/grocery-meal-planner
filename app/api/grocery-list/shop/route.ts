import { NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import { normalizeItemName, matchByKeyword, matchItemsToAisles } from "@/lib/aisleMatcher";
import { sortAndGroupItems } from "@/lib/groceryOrder";
import type { AisleDirectoryEntry, GroceryListItem, ItemAisleCacheEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

async function cacheMatch(name: string, aisleId: string) {
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

export async function GET() {
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
    new Set(items.map((i) => normalizeItemName(i.item_name)).filter((name) => !aisleByItemName.has(name)))
  );

  // Free pass first: exact/substring match against each aisle's category words.
  const stillUncached: string[] = [];
  for (const name of uncachedNames) {
    const aisleId = matchByKeyword(name, directory);
    const aisle = aisleId ? directoryById.get(aisleId) : undefined;
    if (!aisle) {
      stillUncached.push(name);
      continue;
    }
    aisleByItemName.set(name, aisle);
    await cacheMatch(name, aisle.id);
  }

  // Paid fallback, only for names the free pass couldn't resolve.
  if (stillUncached.length > 0) {
    const aiMatches = await matchItemsToAisles(stillUncached, directory);
    for (const name of stillUncached) {
      const aisleId = aiMatches[name];
      const aisle = aisleId ? directoryById.get(aisleId) : undefined;
      if (!aisle) continue;
      aisleByItemName.set(name, aisle);
      await cacheMatch(name, aisle.id);
    }
  }

  const grouped = sortAndGroupItems(items, aisleByItemName);
  return NextResponse.json(grouped);
}
