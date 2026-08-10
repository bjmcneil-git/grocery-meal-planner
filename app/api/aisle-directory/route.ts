import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import type { AisleDirectoryEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

async function listDirectory(): Promise<AisleDirectoryEntry[]> {
  return d1Query<AisleDirectoryEntry>(
    "SELECT * FROM aisle_directory ORDER BY walk_order IS NULL, walk_order ASC, code ASC"
  );
}

export async function GET() {
  const rows = await listDirectory();
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const { orderedIds, unorderedIds } = await req.json();
  if (!Array.isArray(orderedIds) || !Array.isArray(unorderedIds)) {
    return NextResponse.json(
      { error: "orderedIds and unorderedIds must be arrays" },
      { status: 400 }
    );
  }

  for (let i = 0; i < orderedIds.length; i++) {
    await d1Query("UPDATE aisle_directory SET walk_order = ? WHERE id = ?", [i + 1, orderedIds[i]]);
  }
  for (const id of unorderedIds) {
    await d1Query("UPDATE aisle_directory SET walk_order = NULL WHERE id = ?", [id]);
  }

  const rows = await listDirectory();
  return NextResponse.json(rows);
}
