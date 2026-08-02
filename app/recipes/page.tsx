"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Recipe } from "@/lib/types";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    fetch("/api/recipes")
      .then((r) => r.json())
      .then(setRecipes);
  }, []);

  return (
    <main className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Recipes</h1>
        <Link href="/recipes/new" className="text-blue-600">+ Add</Link>
      </div>
      <ul className="space-y-2">
        {recipes.map((r) => (
          <li key={r.id}>
            <Link href={`/recipes/${r.id}`} className="block p-3 border rounded">
              {r.name}
            </Link>
          </li>
        ))}
        {recipes.length === 0 && <p className="text-gray-500">No recipes yet.</p>}
      </ul>
    </main>
  );
}
