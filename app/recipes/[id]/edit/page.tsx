"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Recipe } from "@/lib/types";
import { CUISINES } from "@/lib/cuisines";

export default function EditRecipePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/recipes/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        const recipe: Recipe = data.recipe;
        setName(recipe.name);
        setCuisine(recipe.cuisine ?? "");
        setLoaded(true);
      });
  }, [params.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/recipes/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, cuisine: cuisine || null }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Could not save changes");
      return;
    }
    router.push(`/recipes/${params.id}`);
  }

  if (!loaded) return <main className="p-4">Loading...</main>;

  return (
    <main className="p-4">
      <Link href={`/recipes/${params.id}`} className="text-pink-600 text-sm mb-2 inline-block">
        &larr; Back to Recipe
      </Link>
      <h1 className="text-xl font-bold mb-4">Edit Recipe</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="w-full border rounded p-2"
          placeholder="Recipe name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="w-full border rounded p-2"
          value={cuisine}
          onChange={(e) => setCuisine(e.target.value)}
        >
          <option value="">Cuisine (optional)</option>
          {CUISINES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" className="w-full bg-pink-600 text-white rounded p-2">
          Save Changes
        </button>
      </form>
    </main>
  );
}
