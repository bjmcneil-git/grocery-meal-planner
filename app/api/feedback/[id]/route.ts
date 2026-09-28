import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import { ensureFeedbackTable } from "@/lib/feedback";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await ensureFeedbackTable();
  await d1Query("DELETE FROM feedback WHERE id = ?", [params.id]);
  return NextResponse.json({ ok: true });
}
