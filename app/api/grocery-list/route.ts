import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import { addGroceryItem } from "@/lib/groceryList";
import type { GroceryListItem } from "@/lib/types";

export async function GET() {
  const items = await d1Query<GroceryListItem>(
    "SELECT * FROM grocery_list ORDER BY added_at DESC"
  );
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { item_name, quantity } = await req.json();
  if (!item_name) {
    return NextResponse.json({ error: "item_name is required" }, { status: 400 });
  }

  const item = await addGroceryItem(item_name, quantity ?? null, "manual");
  return NextResponse.json(item, { status: 201 });
}
