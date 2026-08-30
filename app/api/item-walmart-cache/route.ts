import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import { normalizeItemName } from "@/lib/aisleMatcher";
import { parseWalmartItemId } from "@/lib/walmartCart";
import type { ItemWalmartCacheEntry } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { item_name, walmart_item_id } = await req.json();
  if (!item_name || !walmart_item_id) {
    return NextResponse.json(
      { error: "item_name and walmart_item_id are required" },
      { status: 400 }
    );
  }

  const parsedId = parseWalmartItemId(String(walmart_item_id));
  if (!parsedId) {
    return NextResponse.json(
      { error: "Could not find a Walmart item number in that link" },
      { status: 400 }
    );
  }

  const normalized = normalizeItemName(item_name);
  const [entry] = await d1Query<ItemWalmartCacheEntry>(
    `INSERT INTO item_walmart_cache (item_name, walmart_item_id)
     VALUES (?, ?)
     ON CONFLICT(item_name) DO UPDATE SET
       walmart_item_id = excluded.walmart_item_id,
       cached_at = datetime('now')
     RETURNING *`,
    [normalized, parsedId]
  );

  return NextResponse.json(entry);
}
