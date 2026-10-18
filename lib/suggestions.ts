import { CUISINES } from "./cuisines";

export interface RecipeSuggestion {
  name: string;
  cuisine: string | null;
  cook_time_minutes: number | null;
  instructions: string;
  source_url: string | null;
  ingredients: { ingredient_name: string; quantity: number | null; unit: string | null }[];
  servings: number | null;
  calories_per_serving: number | null;
  protein_grams_per_serving: number | null;
}

export interface DietGoals {
  maxCaloriesPerServing: number;
  minProteinGramsPerServing: number;
}

export const DEFAULT_DIET_GOALS: DietGoals = {
  maxCaloriesPerServing: 500,
  minProteinGramsPerServing: 35,
};

export const DIET_SUGGESTION_COUNT = 10;
const MAX_EXCLUDED = 60;

// Accepts untrusted input and returns a bounded list of dish names to avoid.
export function parseExcludedNames(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((name): name is string => typeof name === "string")
    .map((name) => name.trim().slice(0, 120))
    .filter((name) => name !== "")
    .slice(0, MAX_EXCLUDED);
}

// Accepts untrusted input (e.g. a request body) and returns sane goals, or
// null when no diet was requested.
export function parseDietGoals(input: unknown): DietGoals | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const calories = Number(obj.maxCaloriesPerServing);
  const protein = Number(obj.minProteinGramsPerServing);
  return {
    maxCaloriesPerServing:
      Number.isFinite(calories) && calories >= 100 && calories <= 2000
        ? Math.round(calories)
        : DEFAULT_DIET_GOALS.maxCaloriesPerServing,
    minProteinGramsPerServing:
      Number.isFinite(protein) && protein >= 0 && protein <= 200
        ? Math.round(protein)
        : DEFAULT_DIET_GOALS.minProteinGramsPerServing,
  };
}

export interface SuggestionContext {
  savedRecipes: string[];
  recentMeals: string[];
  recentPurchases: string[];
}

export function buildSuggestionPrompt(
  query: string,
  context: SuggestionContext,
  diet: DietGoals | null = null,
  exclude: string[] = []
): string {
  const trimmed = query.trim();
  const ask = diet
    ? trimmed
      ? `Suggest ${DIET_SUGGESTION_COUNT} different dinner ideas that work with: "${trimmed}".`
      : `Suggest ${DIET_SUGGESTION_COUNT} varied dinner ideas that fit their taste based on their history below. Favor variety over repeating what they already have saved.`
    : trimmed
      ? `The user has these ingredients or a craving in mind: "${trimmed}". Build 1-3 recipe ideas using that.`
      : `The user gave no specific ingredients - suggest 3 recipe ideas that fit their taste based on their history below. Favor variety over repeating what they already have saved.`;
  const dietRule = diet
    ? `

The user is on a high-protein, low-calorie diet. Every recipe must be a filling dinner with at most ${diet.maxCaloriesPerServing} calories and at least ${diet.minProteinGramsPerServing} g of protein per serving. Build it around lean protein and vegetables, and keep the ingredient quantities consistent with those numbers. Estimate calories and protein per serving honestly from the ingredient list; if a recipe can't meet both limits, replace it with one that can. Mix up the proteins and cuisines, and keep each recipe's instructions to a few short steps.`
    : "";
  const excluded = exclude.slice(0, MAX_EXCLUDED);
  const excludeRule =
    excluded.length > 0
      ? `

The user already saw these and wants different dishes, so don't suggest any of them or close variations: ${excluded.join(", ")}`
      : "";
  const count = diet ? `exactly ${DIET_SUGGESTION_COUNT}` : "1-3";

  return `You are a home cooking assistant inside a meal-planning app. Recommend real, cookable recipes - use web search when it helps you find or verify a good one, or invent one if nothing specific is needed.

Recipes already saved: ${context.savedRecipes.length > 0 ? context.savedRecipes.join(", ") : "(none yet)"}
Meals cooked recently: ${context.recentMeals.length > 0 ? context.recentMeals.join(", ") : "(none yet)"}
Recently bought groceries: ${context.recentPurchases.length > 0 ? context.recentPurchases.join(", ") : "(none yet)"}

${ask}${dietRule}${excludeRule}

Respond with ONLY a JSON array (no markdown fences, no other text) of ${count} objects, each shaped exactly like:
{"name": string, "cuisine": one of [${CUISINES.join(", ")}] or null, "cook_time_minutes": number or null, "instructions": string (step-by-step), "source_url": string or null (a real url only if you used web search to find this exact recipe), "ingredients": [{"ingredient_name": string, "quantity": number or null, "unit": string or null}], "servings": number or null, "calories_per_serving": number or null (your estimate), "protein_grams_per_serving": number or null (your estimate)}`;
}

function positiveNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
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
      servings: positiveNumberOrNull(obj.servings),
      calories_per_serving: positiveNumberOrNull(obj.calories_per_serving),
      protein_grams_per_serving: positiveNumberOrNull(obj.protein_grams_per_serving),
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
  context: SuggestionContext,
  diet: DietGoals | null = null,
  exclude: string[] = []
): Promise<RecipeSuggestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const headers = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  };

  const messages: { role: string; content: unknown }[] = [
    { role: "user", content: buildSuggestionPrompt(query, context, diet, exclude) },
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
          max_tokens: 32000,
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
