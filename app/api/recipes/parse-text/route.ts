import { NextRequest, NextResponse } from "next/server";
import { fetchRecipeExtraction, toImportResponse } from "@/lib/recipeExtraction";

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > 100000) {
    return NextResponse.json(
      { error: "That text is too long — try pasting a shorter excerpt" },
      { status: 400 }
    );
  }

  const result = await fetchRecipeExtraction([{ type: "text", text }]);
  if (!result) {
    return NextResponse.json(
      { error: "Could not find a recipe in that text — paste the ingredients manually instead" },
      { status: 422 }
    );
  }

  return NextResponse.json(toImportResponse(result));
}
