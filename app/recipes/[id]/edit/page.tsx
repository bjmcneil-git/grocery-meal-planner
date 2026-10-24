"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "../../../components/PageHeader";
import type { Recipe } from "@/lib/types";
import CuisineSelect from "@/app/components/CuisineSelect";

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

  if (!loaded) return <main className="px-4 pt-6 font-semibold text-dim">Loading...</main>;

  return (
    <main className="px-4 pt-3">
      <PageHeader
        eyebrow={
          <Link href={`/recipes/${params.id}`} className="text-accent">
            &larr; Back to Recipe
          </Link>
        }
        title="Edit Recipe"
      />
      <form onSubmit={handleSubmit} className="card p-4 space-y-3">
        <input
          className="field"
          placeholder="Recipe name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <CuisineSelect value={cuisine} onChange={setCuisine} />
        {error && <p className="text-danger font-bold text-sm">{error}</p>}
        <button type="submit" className="w-full btn-main">
          Save Changes
        </button>
      </form>
    </main>
  );
}
