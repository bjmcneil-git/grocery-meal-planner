"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Recipe } from "@/lib/types";
import { CUISINES } from "@/lib/cuisines";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<string>("All");

  useEffect(() => {
    fetch("/api/recipes")
      .then((r) => r.json())
      .then(setRecipes);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      const matchesQuery = q === "" || r.name.toLowerCase().includes(q);
      const matchesCuisine = cuisine === "All" || r.cuisine === cuisine;
      return matchesQuery && matchesCuisine;
    });
  }, [recipes, query, cuisine]);

  return (
    <main className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Recipes</h1>
        <Link href="/recipes/new" className="text-blue-600">+ Add</Link>
      </div>
      <input
        className="w-full border rounded p-2 mb-3"
        placeholder="Search recipes..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex flex-wrap gap-2 mb-4">
        {["All", ...CUISINES].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCuisine(c)}
            className={`text-xs px-3 py-1 rounded-full border ${
              cuisine === c ? "bg-blue-600 text-white border-blue-600" : "text-gray-600"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((r) => (
          <Link key={r.id} href={`/recipes/${r.id}`} className="block">
            {r.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.image_url}
                alt={r.name}
                className="w-full aspect-[3/4] rounded object-cover"
              />
            ) : (
              <div className="w-full aspect-[3/4] rounded bg-gray-100" />
            )}
            <p className="mt-1 text-sm font-medium leading-tight">{r.name}</p>
            {r.cuisine && <p className="text-xs text-gray-500">{r.cuisine}</p>}
          </Link>
        ))}
      </div>
      {recipes.length === 0 && <p className="text-gray-500">No recipes yet.</p>}
      {recipes.length > 0 && filtered.length === 0 && <p className="text-gray-500">No matches.</p>}
    </main>
  );
}
