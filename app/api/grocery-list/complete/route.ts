import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import type { GroceryListItem } from "@/lib/types";

const KEEP_LAST = 2;

export async function POST() {
  const items = await d1Query<GroceryListItem>("SELECT * FROM grocery_list");
  if (items.length === 0) {
    return NextResponse.json({ error: "Grocery list is already empty" }, { status: 400 });
  }

  const purchaseItems = items.map((item) => ({
    name: item.item_name,
    quantity: item.quantity ?? 1,
  }));

  const [purchase] = await d1Query(
    "INSERT INTO purchases (id, items) VALUES (?, ?) RETURNING *",
    [randomUUID(), JSON.stringify(purchaseItems)]
  );

  await d1Query("DELETE FROM grocery_list");

  await d1Query(
    `DELETE FROM purchases WHERE id NOT IN (
       SELECT id FROM purchases ORDER BY completed_at DESC, id DESC LIMIT ?
     )`,
    [KEEP_LAST]
  );

  return NextResponse.json(purchase, { status: 201 });
}
