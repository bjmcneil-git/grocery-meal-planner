import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import { normalizeItemName } from "@/lib/aisleMatcher";
import type { ItemAisleCacheEntry } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { item_name, aisle_directory_id } = await req.json();
  if (!item_name || !aisle_directory_id) {
    return NextResponse.json(
      { error: "item_name and aisle_directory_id are required" },
      { status: 400 }
    );
  }

  const normalized = normalizeItemName(item_name);
  const [entry] = await d1Query<ItemAisleCacheEntry>(
    `INSERT INTO item_aisle_cache (item_name, aisle_directory_id, matched_by)
     VALUES (?, ?, 'manual')
     ON CONFLICT(item_name) DO UPDATE SET
       aisle_directory_id = excluded.aisle_directory_id,
       matched_by = 'manual',
       matched_at = datetime('now')
     RETURNING *`,
    [normalized, aisle_directory_id]
  );

  return NextResponse.json(entry);
}
