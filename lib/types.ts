export interface Recipe {
  id: string;
  name: string;
  source: "manual" | "url";
  source_url: string | null;
  instructions: string | null;
  cuisine: string | null;
  image_url: string | null;
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
  week_start_date: string;
  day_of_week: number;
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
