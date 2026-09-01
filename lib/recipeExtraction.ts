import { CUISINES } from "./cuisines";

export interface ExtractedIngredient {
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
}

export interface ExtractedRecipe {
  name: string;
  instructions: string;
  cuisine: string | null;
  cook_time_minutes: number | null;
  ingredients: ExtractedIngredient[];
}

export type AnthropicContentBlockInput =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export function buildExtractionPrompt(): string {
  return `You are helping extract a recipe from content a user found online (either pasted page text or a screenshot). Read the content provided below/attached and extract the recipe from it.

Respond with ONLY a JSON object (no markdown fences, no other text) shaped exactly like:
{"name": string, "cuisine": one of [${CUISINES.join(", ")}] or null, "cook_time_minutes": number or null, "instructions": string (step-by-step), "ingredients": [{"ingredient_name": string, "quantity": number or null, "unit": string or null}]}

If the content does not contain a real recipe, respond with exactly: {"name": null}`;
}

export function parseExtractionResponse(rawText: string): ExtractedRecipe | null {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.name !== "string" || !obj.name.trim()) return null;
  if (typeof obj.instructions !== "string" || !obj.instructions.trim()) return null;
  if (!Array.isArray(obj.ingredients)) return null;

  const validCuisines: readonly string[] = CUISINES;

  const ingredients = obj.ingredients
    .filter((ing): ing is Record<string, unknown> => !!ing && typeof ing === "object")
    .map((ing) => ({
      ingredient_name: typeof ing.ingredient_name === "string" ? ing.ingredient_name : "",
      quantity: typeof ing.quantity === "number" ? ing.quantity : null,
      unit: typeof ing.unit === "string" ? ing.unit : null,
    }))
    .filter((ing) => ing.ingredient_name.trim() !== "");
  if (ingredients.length === 0) return null;

  return {
    name: obj.name,
    instructions: obj.instructions,
    cuisine: typeof obj.cuisine === "string" && validCuisines.includes(obj.cuisine) ? obj.cuisine : null,
    cook_time_minutes: typeof obj.cook_time_minutes === "number" ? obj.cook_time_minutes : null,
    ingredients,
  };
}

export function toImportResponse(result: ExtractedRecipe) {
  return {
    name: result.name,
    ingredients: result.ingredients.map((i) => i.ingredient_name),
    cookTimeMinutes: result.cook_time_minutes,
    cuisine: result.cuisine,
    instructions: result.instructions,
  };
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

export async function fetchRecipeExtraction(
  content: AnthropicContentBlockInput[]
): Promise<ExtractedRecipe | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const headers = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 4000,
        messages: [
          { role: "user", content: [{ type: "text", text: buildExtractionPrompt() }, ...content] },
        ],
      }),
    });

    if (!res.ok) return null;

    const json = (await res.json()) as { content?: AnthropicContentBlock[] };
    const text = (json.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n");

    return parseExtractionResponse(text);
  } catch {
    return null;
  }
}
