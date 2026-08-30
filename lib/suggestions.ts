import { CUISINES } from "./cuisines";

export interface RecipeSuggestion {
  name: string;
  cuisine: string | null;
  cook_time_minutes: number | null;
  instructions: string;
  source_url: string | null;
  ingredients: { ingredient_name: string; quantity: number | null; unit: string | null }[];
}

export interface SuggestionContext {
  savedRecipes: string[];
  recentMeals: string[];
  recentPurchases: string[];
}

export function buildSuggestionPrompt(query: string, context: SuggestionContext): string {
  const trimmed = query.trim();
  const ask = trimmed
    ? `The user has these ingredients or a craving in mind: "${trimmed}". Build 1-3 recipe ideas using that.`
    : `The user gave no specific ingredients - suggest 3 recipe ideas that fit their taste based on their history below. Favor variety over repeating what they already have saved.`;

  return `You are a home cooking assistant inside a meal-planning app. Recommend real, cookable recipes - use web search when it helps you find or verify a good one, or invent one if nothing specific is needed.

Recipes already saved: ${context.savedRecipes.length > 0 ? context.savedRecipes.join(", ") : "(none yet)"}
Meals cooked recently: ${context.recentMeals.length > 0 ? context.recentMeals.join(", ") : "(none yet)"}
Recently bought groceries: ${context.recentPurchases.length > 0 ? context.recentPurchases.join(", ") : "(none yet)"}

${ask}

Respond with ONLY a JSON array (no markdown fences, no other text) of 1-3 objects, each shaped exactly like:
{"name": string, "cuisine": one of [${CUISINES.join(", ")}] or null, "cook_time_minutes": number or null, "instructions": string (step-by-step), "source_url": string or null (a real url only if you used web search to find this exact recipe), "ingredients": [{"ingredient_name": string, "quantity": number or null, "unit": string or null}]}`;
}

export function parseSuggestionsResponse(rawText: string): RecipeSuggestion[] {
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const validCuisines: readonly string[] = CUISINES;
  const suggestions: RecipeSuggestion[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.name !== "string" || !obj.name.trim()) continue;
    if (typeof obj.instructions !== "string" || !obj.instructions.trim()) continue;
    if (!Array.isArray(obj.ingredients)) continue;

    const ingredients = obj.ingredients
      .filter((ing): ing is Record<string, unknown> => !!ing && typeof ing === "object")
      .map((ing) => ({
        ingredient_name: typeof ing.ingredient_name === "string" ? ing.ingredient_name : "",
        quantity: typeof ing.quantity === "number" ? ing.quantity : null,
        unit: typeof ing.unit === "string" ? ing.unit : null,
      }))
      .filter((ing) => ing.ingredient_name.trim() !== "");
    if (ingredients.length === 0) continue;

    suggestions.push({
      name: obj.name,
      cuisine: typeof obj.cuisine === "string" && validCuisines.includes(obj.cuisine) ? obj.cuisine : null,
      cook_time_minutes: typeof obj.cook_time_minutes === "number" ? obj.cook_time_minutes : null,
      instructions: obj.instructions,
      source_url: typeof obj.source_url === "string" ? obj.source_url : null,
      ingredients,
    });
  }

  return suggestions;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

export async function fetchRecipeSuggestions(
  query: string,
  context: SuggestionContext
): Promise<RecipeSuggestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const headers = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  };

  const messages: { role: string; content: unknown }[] = [
    { role: "user", content: buildSuggestionPrompt(query, context) },
  ];

  try {
    let contentBlocks: AnthropicContentBlock[] = [];

    // Server-side web search can pause a long turn (stop_reason "pause_turn");
    // resume by pushing the paused assistant turn back, up to a few times.
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "claude-opus-5",
          max_tokens: 16000,
          tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
          messages,
        }),
      });

      if (!res.ok) return [];

      const json = (await res.json()) as {
        content?: AnthropicContentBlock[];
        stop_reason?: string;
      };
      contentBlocks = json.content ?? [];
      messages.push({ role: "assistant", content: contentBlocks });

      if (json.stop_reason !== "pause_turn") break;
    }

    const text = contentBlocks
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n");

    return parseSuggestionsResponse(text);
  } catch {
    return [];
  }
}
