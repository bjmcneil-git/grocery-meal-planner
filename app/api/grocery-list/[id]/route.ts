import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await d1Query("DELETE FROM grocery_list WHERE id = ?", [params.id]);
  return NextResponse.json({ ok: true });
}
