import { NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import { CUISINES } from "@/lib/cuisines";

// The selectable cuisine list is the base seed list (minus "Other", which
// the UI replaces with a "+ Add" flow) plus whatever custom cuisine names
// users have actually saved on a recipe - so a newly-added one becomes a
// real option for everyone as soon as one recipe uses it.
export async function GET() {
  const rows = await d1Query<{ cuisine: string }>(
    "SELECT DISTINCT cuisine FROM recipes WHERE cuisine IS NOT NULL AND cuisine != '' ORDER BY cuisine"
  );
  const seed = CUISINES.filter((c) => c !== "Other");
  const merged = Array.from(new Set([...seed, ...rows.map((r) => r.cuisine)])).sort((a, b) =>
    a.localeCompare(b)
  );
  return NextResponse.json(merged);
}
