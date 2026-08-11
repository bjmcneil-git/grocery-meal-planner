export interface Recipe {
  id: string;
  name: string;
  source: "manual" | "url";
  source_url: string | null;
  instructions: string | null;
  cuisine: string | null;
  image_url: string | null;
  cook_time_minutes: number | null;
  created_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
}

export interface PurchaseItem {
  name: string;
  quantity: number;
}

export interface Purchase {
  id: string;
  completed_at: string;
  items: PurchaseItem[];
}

export interface WeeklyPlanEntry {
  id: string;
  plan_date: string;
  recipe_id: string | null;
}

export interface GroceryListItem {
  id: string;
  item_name: string;
  quantity: number | null;
  source: "planned" | "manual";
  walmart_item_id: string | null;
  added_at: string;
}

export interface AisleDirectoryEntry {
  id: string;
  code: string;
  categories: string;
  walk_order: number | null;
}

export interface ItemAisleCacheEntry {
  item_name: string;
  aisle_directory_id: string;
  matched_by: "ai" | "manual";
  matched_at: string;
}
