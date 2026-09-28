import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import type { GroceryListItem } from "@/lib/types";

const KEEP_LAST = 2;

// "Finish shopping": saves the checked-off items to purchase history and
// removes them from the list. Items that weren't checked off stay on the list.
export async function POST() {
  const items = await d1Query<GroceryListItem>("SELECT * FROM grocery_list WHERE picked_up = 1");
  if (items.length === 0) {
    return NextResponse.json({ error: "No checked-off items to finish" }, { status: 400 });
  }

  const purchaseItems = items.map((item) => ({
    name: item.item_name,
    quantity: item.quantity ?? 1,
  }));

  const [purchase] = await d1Query(
    "INSERT INTO purchases (id, items) VALUES (?, ?) RETURNING *",
    [randomUUID(), JSON.stringify(purchaseItems)]
  );

  await d1Query("DELETE FROM grocery_list WHERE picked_up = 1");

  await d1Query(
    `DELETE FROM purchases WHERE id NOT IN (
       SELECT id FROM purchases ORDER BY completed_at DESC, id DESC LIMIT ?
     )`,
    [KEEP_LAST]
  );

  return NextResponse.json(purchase, { status: 201 });
}
