import type { AisleDirectoryEntry } from "./types";

export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase();
}

export function buildMatchPrompt(itemNames: string[], directory: AisleDirectoryEntry[]): string {
  const directoryLines = directory
    .map((a) => `${a.id}: ${a.code} — ${a.categories || "(no listed categories)"}`)
    .join("\n");
  const itemLines = itemNames.map((n) => `- ${n}`).join("\n");
  return `You are matching grocery list items to store aisles for a Walmart Supercenter.

Aisles (id: code — categories):
${directoryLines}

Items to match:
${itemLines}

Respond with ONLY a JSON object mapping each item name exactly as given above to the id of its single best-matching aisle, or null if none of the aisles are a confident match. Do not include any text outside the JSON object.

Example: {"milk": "${directory[0]?.id ?? "aisle-id"}", "batteries": null}`;
}

export function parseMatchResponse(
  rawText: string,
  itemNames: string[],
  directory: AisleDirectoryEntry[]
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const name of itemNames) result[name] = null;

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return result;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return result;
  }
  if (!parsed || typeof parsed !== "object") return result;

  const validIds = new Set(directory.map((a) => a.id));
  for (const name of itemNames) {
    const value = (parsed as Record<string, unknown>)[name];
    if (typeof value === "string" && validIds.has(value)) {
      result[name] = value;
    }
  }
  return result;
}

export async function matchItemsToAisles(
  itemNames: string[],
  directory: AisleDirectoryEntry[]
): Promise<Record<string, string | null>> {
  if (itemNames.length === 0) return {};

  const emptyResult = () => {
    const empty: Record<string, string | null> = {};
    for (const name of itemNames) empty[name] = null;
    return empty;
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return emptyResult();

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: buildMatchPrompt(itemNames, directory) }],
      }),
    });

    if (!res.ok) return emptyResult();

    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = json.content?.find((c) => c.type === "text")?.text ?? "";
    return parseMatchResponse(text, itemNames, directory);
  } catch {
    return emptyResult();
  }
}
