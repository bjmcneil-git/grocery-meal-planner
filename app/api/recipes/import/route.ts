import { NextRequest, NextResponse } from "next/server";
import { parseRecipeFromHtml } from "@/lib/recipeParser";

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    html = await res.text();
  } catch {
    return NextResponse.json({ error: "Could not fetch that URL" }, { status: 502 });
  }

  const parsed = parseRecipeFromHtml(html);
  if (!parsed) {
    return NextResponse.json(
      { error: "No recipe data found on that page — paste the ingredients manually instead" },
      { status: 422 }
    );
  }
  return NextResponse.json(parsed);
}
