"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Recipe, RecipeIngredient } from "@/lib/types";
import { formatCookTime } from "@/lib/formatCookTime";
import PageHeader from "../../components/PageHeader";

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

  if (!recipe) return <main className="px-4 pt-6 font-semibold text-dim">Loading...</main>;

  const meta = [recipe.cuisine, recipe.cook_time_minutes != null ? formatCookTime(recipe.cook_time_minutes) : null].filter(
    Boolean
  ) as string[];

  return (
    <main className="px-4 pt-3">
      <PageHeader
        eyebrow={
          <Link href="/recipes" className="text-accent">
            &larr; Back to Recipes
          </Link>
        }
        title={recipe.name}
      />

      {recipe.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.image_url}
          alt={recipe.name}
          className="w-full h-52 rounded-3xl object-cover shadow-soft mb-3"
        />
      )}
      {meta.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {recipe.cuisine && <span className="chip bg-accent-soft text-accent-soft-ink">{recipe.cuisine}</span>}
          {recipe.cook_time_minutes != null && (
            <span className="chip bg-third-soft text-third-ink">{formatCookTime(recipe.cook_time_minutes)}</span>
          )}
        </div>
      )}

      {ingredients.length > 0 && (
        <section className="card p-4 mb-3">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-base font-black">Ingredients</h2>
            <span className="text-xs font-extrabold text-dim">Tap to pick for your list</span>
          </div>
          <ul className="divide-y-2 divide-line/70">
            {ingredients.map((ing) => (
              <li key={ing.id}>
                <label className="flex items-center gap-3 py-2.5 cursor-pointer">
                  <span className="relative w-6 h-6 shrink-0">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(ing.id)}
                      onChange={() => toggleSelected(ing.id)}
                      aria-label={`Select ${ing.ingredient_name}`}
                      className="peer appearance-none w-6 h-6 rounded-lg border-2 border-line bg-card checked:bg-accent checked:border-accent cursor-pointer"
                    />
                    <svg
                      viewBox="0 0 12 12"
                      fill="none"
                      className="pointer-events-none absolute inset-0 m-auto w-3 h-3 text-accent-ink hidden peer-checked:block"
                      aria-hidden="true"
                    >
                      <path d="M2.5 6.2 5 8.5l4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="font-semibold">
                    {(ing.quantity != null || ing.unit) && (
                      <span className="font-extrabold text-accent">
                        {ing.quantity ?? ""} {ing.unit ?? ""}{" "}
                      </span>
                    )}
                    {ing.ingredient_name}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={handleAddSelected}
              disabled={selectedIds.size === 0 || adding}
              className="btn-main flex-1 disabled:opacity-40"
            >
              {adding ? "Adding..." : `Add${selectedIds.size > 0 ? ` ${selectedIds.size}` : ""} to List`}
            </button>
            {justAdded && <span className="chip bg-second-soft text-second-soft-ink">Added!</span>}
          </div>
        </section>
      )}

      {recipe.instructions && (
        <section className="card p-4 mb-3">
          <h2 className="text-base font-black mb-1">Instructions</h2>
          <p className="whitespace-pre-wrap font-medium leading-relaxed">{recipe.instructions}</p>
        </section>
      )}
      {recipe.source_url && (
        <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="block mb-4 text-sm link px-1">
          View Original Recipe
        </a>
      )}
      <div className="grid grid-cols-2 gap-2 mt-4">
        <Link href={`/recipes/${recipe.id}/edit`} className="btn-soft">
          Edit Recipe
        </Link>
        <button onClick={handleDelete} className="btn-danger">
          Delete Recipe
        </button>
      </div>
    </main>
  );
}
