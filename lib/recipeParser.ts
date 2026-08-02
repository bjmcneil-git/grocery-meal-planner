export interface ParsedRecipe {
  name: string;
  ingredients: string[];
  cuisine?: string;
  image?: string;
  cookTimeMinutes?: number;
}

export function parseRecipeFromHtml(html: string): ParsedRecipe | null {
  const scriptRegex = /<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      // Some sites (commonly WordPress recipe plugins) emit literal control
      // characters (raw newlines/tabs) inside JSON string values, which is
      // invalid per strict JSON and makes JSON.parse throw. Stripping them
      // fixes parsing without affecting the short fields we read.
      const sanitized = stripControlCharacters(match[1].trim());
      const json = JSON.parse(sanitized);
      const candidates = Array.isArray(json) ? json : [json];
      for (const candidate of candidates) {
        const recipe = findRecipeNode(candidate);
        if (recipe) return recipe;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function stripControlCharacters(text: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += text.charCodeAt(i) >= 32 ? text[i] : " ";
  }
  return result;
}

function findRecipeNode(node: unknown): ParsedRecipe | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;

  const graph = obj["@graph"];
  if (Array.isArray(graph)) {
    for (const item of graph) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
  }

  const type = obj["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.includes("Recipe")) {
    const rawIngredients = obj.recipeIngredient ?? obj.ingredients;
    const ingredients = Array.isArray(rawIngredients)
      ? rawIngredients.filter((i): i is string => typeof i === "string")
      : [];
    if (typeof obj.name === "string" && ingredients.length > 0) {
      const result: ParsedRecipe = { name: obj.name, ingredients };
      const cuisine = extractCuisine(obj.recipeCuisine);
      if (cuisine) result.cuisine = cuisine;
      const image = extractImageUrl(obj.image);
      if (image) result.image = image;
      const cookTimeMinutes = parseIsoDurationToMinutes(obj.totalTime);
      if (cookTimeMinutes !== undefined) result.cookTimeMinutes = cookTimeMinutes;
      return result;
    }
  }
  return null;
}

function extractCuisine(raw: unknown): string | undefined {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
  return undefined;
}

function parseIsoDurationToMinutes(raw: unknown): number | undefined {
  if (typeof raw !== "string") return undefined;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(raw.trim());
  if (!match) return undefined;
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  if (hours === 0 && minutes === 0) return undefined;
  return hours * 60 + minutes;
}

function extractImageUrl(raw: unknown): string | undefined {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return extractImageUrl(raw[0]);
  if (raw && typeof raw === "object" && typeof (raw as { url?: unknown }).url === "string") {
    return (raw as { url: string }).url;
  }
  return undefined;
}
