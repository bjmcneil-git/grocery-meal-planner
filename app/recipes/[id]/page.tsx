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

  if (!recipe) return <main className="p-4">Loading...</main>;

  return (
    <main className="p-4">
      <Link href="/recipes" className="text-blue-600 text-sm mb-2 inline-block">
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
      <ul className="list-disc pl-5 mb-4 mt-2">
        {ingredients.map((ing) => (
          <li key={ing.id}>
            {ing.quantity ?? ""} {ing.unit ?? ""} {ing.ingredient_name}
          </li>
        ))}
      </ul>
      {recipe.instructions && <p className="mb-4 whitespace-pre-wrap">{recipe.instructions}</p>}
      <button onClick={handleDelete} className="text-red-600 text-sm">
        Delete Recipe
      </button>
    </main>
  );
}
