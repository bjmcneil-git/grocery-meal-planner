import { normalizeItemName } from "./aisleMatcher";
import type { AisleDirectoryEntry, GroceryListItem } from "./types";

export interface SortedGroceryItem {
  item: GroceryListItem;
  aisle: AisleDirectoryEntry | null;
}

export interface GroupedGroceryList {
  sorted: SortedGroceryItem[];
  unmatched: SortedGroceryItem[];
}

export function sortAndGroupItems(
  items: GroceryListItem[],
  aisleByItemName: Map<string, AisleDirectoryEntry>
): GroupedGroceryList {
  const sorted: SortedGroceryItem[] = [];
  const unmatched: SortedGroceryItem[] = [];

  for (const item of items) {
    const aisle = aisleByItemName.get(normalizeItemName(item.item_name)) ?? null;
    if (aisle && aisle.walk_order !== null) {
      sorted.push({ item, aisle });
    } else {
      unmatched.push({ item, aisle });
    }
  }

  sorted.sort((a, b) => (a.aisle!.walk_order as number) - (b.aisle!.walk_order as number));

  return { sorted, unmatched };
}
