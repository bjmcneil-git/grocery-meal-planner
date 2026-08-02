"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Recipe, RecipeIngredient } from "@/lib/types";

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
      <h1 className="text-xl font-bold mb-2">{recipe.name}</h1>
      <ul className="list-disc pl-5 mb-4">
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
