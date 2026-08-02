"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface IngredientRow {
  ingredient_name: string;
  quantity: string;
  unit: string;
}

export default function NewRecipePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { ingredient_name: "", quantity: "", unit: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  function updateIngredient(index: number, field: keyof IngredientRow, value: string) {
    setIngredients((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      name,
      instructions,
      source: "manual",
      ingredients: ingredients
        .filter((row) => row.ingredient_name.trim() !== "")
        .map((row) => ({
          ingredient_name: row.ingredient_name,
          quantity: row.quantity ? Number(row.quantity) : null,
          unit: row.unit || null,
        })),
    };
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Could not save recipe");
      return;
    }
    router.push("/recipes");
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">Add Recipe</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="w-full border rounded p-2"
          placeholder="Recipe name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="w-full border rounded p-2"
          placeholder="Instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
        <div>
          <p className="font-medium mb-1">Ingredients</p>
          {ingredients.map((row, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                className="flex-1 border rounded p-2"
                placeholder="Ingredient"
                value={row.ingredient_name}
                onChange={(e) => updateIngredient(i, "ingredient_name", e.target.value)}
              />
              <input
                className="w-16 border rounded p-2"
                placeholder="Qty"
                value={row.quantity}
                onChange={(e) => updateIngredient(i, "quantity", e.target.value)}
              />
              <input
                className="w-16 border rounded p-2"
                placeholder="Unit"
                value={row.unit}
                onChange={(e) => updateIngredient(i, "unit", e.target.value)}
              />
            </div>
          ))}
          <button
            type="button"
            className="text-blue-600 text-sm"
            onClick={() =>
              setIngredients((rows) => [...rows, { ingredient_name: "", quantity: "", unit: "" }])
            }
          >
            + Add ingredient
          </button>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" className="w-full bg-blue-600 text-white rounded p-2">
          Save Recipe
        </button>
      </form>
    </main>
  );
}
