import type { AisleDirectoryEntry } from "./types";

export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase();
}

const MIN_SUBSTRING_LENGTH = 3;

function categoryTokens(categories: string): string[] {
  return categories
    .split(/[,/]/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function walkOrderRank(aisle: AisleDirectoryEntry): number {
  return aisle.walk_order === null ? Number.MAX_SAFE_INTEGER : aisle.walk_order;
}

/**
 * Zero-cost, no-API item-to-aisle matcher: looks for the item name among
 * each aisle's category words (comma/slash-separated), first for an exact
 * word match, then falling back to substring matches. Deliberately weaker
 * than an AI matcher — it can't infer e.g. "steak" -> "Meats" — but it
 * costs nothing to run on every "Let's go shopping" press.
 */
export function matchByKeyword(itemName: string, directory: AisleDirectoryEntry[]): string | null {
  const normalized = normalizeItemName(itemName);
  if (!normalized) return null;

  const exactMatches = directory.filter((aisle) => categoryTokens(aisle.categories).includes(normalized));
  if (exactMatches.length > 0) {
    return exactMatches.sort((a, b) => walkOrderRank(a) - walkOrderRank(b))[0].id;
  }

  if (normalized.length < MIN_SUBSTRING_LENGTH) return null;

  let best: { aisle: AisleDirectoryEntry; tokenLength: number } | null = null;
  for (const aisle of directory) {
    for (const token of categoryTokens(aisle.categories)) {
      if (token.length < MIN_SUBSTRING_LENGTH) continue;
      if (!normalized.includes(token) && !token.includes(normalized)) continue;
      if (
        !best ||
        token.length > best.tokenLength ||
        (token.length === best.tokenLength && walkOrderRank(aisle) < walkOrderRank(best.aisle))
      ) {
        best = { aisle, tokenLength: token.length };
      }
    }
  }

  return best?.aisle.id ?? null;
}
