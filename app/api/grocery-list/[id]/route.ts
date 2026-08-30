import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import type { GroceryListItem } from "@/lib/types";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await d1Query("DELETE FROM grocery_list WHERE id = ?", [params.id]);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { picked_up, quantity } = await req.json();

  if (picked_up !== undefined) {
    const [item] = await d1Query<GroceryListItem>(
      "UPDATE grocery_list SET picked_up = ? WHERE id = ? RETURNING *",
      [picked_up ? 1 : 0, params.id]
    );
    return NextResponse.json(item);
  }

  if (quantity !== undefined) {
    const [item] = await d1Query<GroceryListItem>(
      "UPDATE grocery_list SET quantity = ? WHERE id = ? RETURNING *",
      [quantity, params.id]
    );
    return NextResponse.json(item);
  }

  return NextResponse.json({ error: "picked_up or quantity is required" }, { status: 400 });
}
