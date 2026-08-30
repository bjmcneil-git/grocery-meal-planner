import { NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import type { PurchaseItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const KEEP_LAST = 2;

export async function GET() {
  const rows = await d1Query<{ id: string; completed_at: string; items: string }>(
    "SELECT * FROM purchases ORDER BY completed_at DESC, id DESC LIMIT ?",
    [KEEP_LAST]
  );
  const purchases = rows.map((row) => ({
    id: row.id,
    completed_at: row.completed_at,
    items: JSON.parse(row.items) as PurchaseItem[],
  }));
  return NextResponse.json(purchases);
}
