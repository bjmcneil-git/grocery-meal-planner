import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import { ensureFeedbackTable } from "@/lib/feedback";
import type { FeedbackNote } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 2000;

export async function GET() {
  await ensureFeedbackTable();
  const notes = await d1Query<FeedbackNote>(
    "SELECT * FROM feedback ORDER BY created_at DESC, id DESC"
  );
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  const { message, page } = await req.json();
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  await ensureFeedbackTable();
  const [note] = await d1Query<FeedbackNote>(
    "INSERT INTO feedback (id, message, page) VALUES (?, ?, ?) RETURNING *",
    [randomUUID(), text, typeof page === "string" ? page : null]
  );
  return NextResponse.json(note, { status: 201 });
}
