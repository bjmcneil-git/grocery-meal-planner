import { NextRequest, NextResponse } from "next/server";
import {
  fetchRecipeExtraction,
  toImportResponse,
  type AnthropicContentBlockInput,
} from "@/lib/recipeExtraction";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DATA_URL_REGEX = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/;

export async function POST(req: NextRequest) {
  const { images } = await req.json();
  if (!Array.isArray(images) || images.length === 0) {
    return NextResponse.json({ error: "Missing images" }, { status: 400 });
  }
  if (images.length > MAX_IMAGES) {
    return NextResponse.json({ error: `You can attach up to ${MAX_IMAGES} images` }, { status: 400 });
  }

  const content: AnthropicContentBlockInput[] = [];
  for (const image of images) {
    if (typeof image !== "string") {
      return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
    }
    const match = DATA_URL_REGEX.exec(image);
    if (!match) {
      return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
    }
    const [, mediaType, base64Data] = match;
    if (base64Data.length * 0.75 > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Each image must be under 5MB" }, { status: 400 });
    }
    content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } });
  }

  const result = await fetchRecipeExtraction(content);
  if (!result) {
    return NextResponse.json(
      { error: "Could not find a recipe in those images — paste the ingredients manually instead" },
      { status: 422 }
    );
  }

  return NextResponse.json(toImportResponse(result));
}
