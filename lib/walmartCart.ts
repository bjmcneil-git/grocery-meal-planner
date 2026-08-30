// Walmart product URLs look like https://www.walmart.com/ip/<slug>/<itemId>,
// but people paste all sorts of variants (with query strings, mobile share
// links, or just the bare numeric ID). Try the standard /ip/ path first,
// then fall back to the longest run of digits as a last resort.
export function parseWalmartItemId(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;

  const ipMatch = trimmed.match(/\/ip\/[^/]*\/(\d+)/);
  if (ipMatch) return ipMatch[1];

  const digitsMatch = trimmed.match(/(\d{5,})/);
  return digitsMatch ? digitsMatch[1] : null;
}

export function buildWalmartCartUrl(items: { walmartItemId: string; quantity: number }[]): string {
  const pairs = items.map((i) => `${i.walmartItemId}_${Math.max(1, Math.round(i.quantity))}`);
  return `https://affil.walmart.com/cart/addToCart?items=${pairs.join(",")}`;
}
