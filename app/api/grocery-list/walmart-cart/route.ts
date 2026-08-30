import { NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import { normalizeItemName } from "@/lib/aisleMatcher";
import type { GroceryListItem, ItemWalmartCacheEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await d1Query<GroceryListItem>("SELECT * FROM grocery_list");
  const cacheRows = await d1Query<ItemWalmartCacheEntry>("SELECT * FROM item_walmart_cache");
  const idByName = new Map(cacheRows.map((r) => [r.item_name, r.walmart_item_id]));

  const resolved: { id: string; item_name: string; quantity: number; walmart_item_id: string }[] = [];
  const unresolved: { id: string; item_name: string }[] = [];

  for (const item of items) {
    const walmartItemId = idByName.get(normalizeItemName(item.item_name));
    if (walmartItemId) {
      resolved.push({
        id: item.id,
        item_name: item.item_name,
        quantity: item.quantity ?? 1,
        walmart_item_id: walmartItemId,
      });
    } else {
      unresolved.push({ id: item.id, item_name: item.item_name });
    }
  }

  return NextResponse.json({ resolved, unresolved });
}
