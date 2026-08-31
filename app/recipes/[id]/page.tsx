"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Recipe, RecipeIngredient } from "@/lib/types";
import { formatCookTime } from "@/lib/formatCookTime";

export default function RecipeDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    fetch(`/api/recipes/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setRecipe(data.recipe);
        setIngredients(data.ingredients);
      });
  }, [params.id]);

  async function handleDelete() {
    await fetch(`/api/recipes/${params.id}`, { method: "DELETE" });
    router.push("/recipes");
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddSelected() {
    const toAdd = ingredients.filter((ing) => selectedIds.has(ing.id));
    if (toAdd.length === 0) return;
    setAdding(true);
    await Promise.all(
      toAdd.map((ing) =>
        fetch("/api/grocery-list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_name: ing.ingredient_name, quantity: ing.quantity }),
        })
      )
    );
    setAdding(false);
    setSelectedIds(new Set());
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  }

  if (!recipe) return <main className="p-4">Loading...</main>;

  return (
    <main className="p-4">
      <Link href="/recipes" className="text-pink-600 text-sm mb-2 inline-block">
        &larr; Back to Recipes
      </Link>
      {recipe.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.image_url}
          alt={recipe.name}
          className="w-full h-48 rounded object-cover mb-3"
        />
      )}
      <h1 className="text-xl font-bold">{recipe.name}</h1>
      {(recipe.cuisine || recipe.cook_time_minutes != null) && (
        <p className="text-sm text-gray-500 mb-2">
          {[recipe.cuisine, recipe.cook_time_minutes != null ? formatCookTime(recipe.cook_time_minutes) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <ul className="mb-2 mt-2 space-y-1">
        {ingredients.map((ing) => (
          <li key={ing.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedIds.has(ing.id)}
              onChange={() => toggleSelected(ing.id)}
              aria-label={`Select ${ing.ingredient_name}`}
              className="w-4 h-4 shrink-0 accent-pink-600"
            />
            <span>
              {ing.quantity ?? ""} {ing.unit ?? ""} {ing.ingredient_name}
            </span>
          </li>
        ))}
      </ul>
      {ingredients.length > 0 && (
        <div className="mb-4">
          <button
            type="button"
            onClick={handleAddSelected}
            disabled={selectedIds.size === 0 || adding}
            className="px-3 py-2 rounded bg-pink-600 text-white text-sm disabled:opacity-40"
          >
            {adding
              ? "Adding..."
              : `Add${selectedIds.size > 0 ? ` ${selectedIds.size}` : ""} to List`}
          </button>
          {justAdded && <span className="ml-3 text-sm text-green-600">Added!</span>}
        </div>
      )}
      {recipe.instructions && <p className="mb-4 whitespace-pre-wrap">{recipe.instructions}</p>}
      {recipe.source_url && (
        <a
          href={recipe.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-4 text-pink-600 text-sm"
        >
          View Original Recipe
        </a>
      )}
      <div className="flex gap-4">
        <Link href={`/recipes/${recipe.id}/edit`} className="text-pink-600 text-sm">
          Edit Recipe
        </Link>
        <button onClick={handleDelete} className="text-red-600 text-sm">
          Delete Recipe
        </button>
      </div>
    </main>
  );
}
