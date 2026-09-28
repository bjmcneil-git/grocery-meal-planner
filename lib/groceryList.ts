import { randomUUID } from "crypto";
import { d1Query } from "./d1";
import { normalizeItemName, isWholeWordSubstring, isSimplePlural } from "./aisleMatcher";
import type { GroceryListItem } from "./types";

export async function addGroceryItem(
  itemName: string,
  quantity: number | null,
  source: GroceryListItem["source"]
): Promise<GroceryListItem> {
  const [item] = await d1Query<GroceryListItem>(
    `INSERT INTO grocery_list (id, item_name, quantity, source)
     VALUES (?, ?, ?, ?)
     RETURNING *`,
    [randomUUID(), itemName, quantity, source]
  );
  return item;
}

// D1 caps bound parameters per query at 100, so large deletes go in batches.
const DELETE_BATCH_SIZE = 100;

export async function deleteGroceryItems(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
    const batch = ids.slice(i, i + DELETE_BATCH_SIZE);
    const placeholders = batch.map(() => "?").join(", ");
    await d1Query(`DELETE FROM grocery_list WHERE id IN (${placeholders})`, batch);
  }
}

export function findMatchingGroceryItems(spokenName: string, items: GroceryListItem[]): GroceryListItem[] {
  const normalized = normalizeItemName(spokenName);
  if (!normalized) return [];

  return items.filter((item) => {
    const itemNormalized = normalizeItemName(item.item_name);
    return (
      itemNormalized === normalized ||
      isSimplePlural(itemNormalized, normalized) ||
      isWholeWordSubstring(itemNormalized, normalized)
    );
  });
}
