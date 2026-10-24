"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "../components/PageHeader";
import type { AisleDirectoryEntry } from "@/lib/types";

export default function AisleOrderPage() {
  const [route, setRoute] = useState<AisleDirectoryEntry[]>([]);
  const [unordered, setUnordered] = useState<AisleDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/aisle-directory")
      .then((r) => r.json())
      .then((data: AisleDirectoryEntry[]) => {
        setRoute(data.filter((a) => a.walk_order !== null));
        setUnordered(data.filter((a) => a.walk_order === null));
        setError(null);
      })
      .catch(() => {
        setError("Failed to load aisle order. Please try again.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  function moveUp(index: number) {
    if (index === 0) return;
    setRoute((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    setRoute((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function removeFromRoute(id: string) {
    setRoute((prev) => prev.filter((a) => a.id !== id));
    setUnordered((prev) => [...prev, route.find((a) => a.id === id)!]);
  }

  function addToRoute(id: string) {
    setUnordered((prev) => prev.filter((a) => a.id !== id));
    setRoute((prev) => [...prev, unordered.find((a) => a.id === id)!]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/aisle-directory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderedIds: route.map((a) => a.id),
          unorderedIds: unordered.map((a) => a.id),
        }),
      });
      if (!res.ok) throw new Error(`Save failed with status ${res.status}`);
      const data: AisleDirectoryEntry[] = await res.json();
      setRoute(data.filter((a) => a.walk_order !== null));
      setUnordered(data.filter((a) => a.walk_order === null));
      setError(null);
    } catch {
      setError("Failed to save aisle order. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="px-4 pt-6 font-semibold text-dim">Loading...</main>;

  return (
    <main className="px-4 pt-3 pb-20">
      <PageHeader
        eyebrow={
          <Link href="/grocery-list" className="text-accent">
            &larr; Back to Shopping List
          </Link>
        }
        title="Aisle Order"
      />

      {error && <p className="text-sm font-bold text-danger mb-4">{error}</p>}

      <h2 className="text-base font-black mb-2 px-1">Your route</h2>
      <ul className="card px-4 py-0.5 divide-y-2 divide-line/70 mb-6">
        {route.map((a, i) => (
          <li key={a.id} className="flex items-center gap-2 py-2.5">
            <span className="chip rounded-lg bg-accent-soft text-accent-soft-ink shrink-0">{a.code}</span>
            <span className="flex-1 min-w-0 text-sm font-semibold leading-snug">{a.categories}</span>
            <button
              onClick={() => moveUp(i)}
              className="w-8 h-8 rounded-full bg-line text-ink font-black shrink-0"
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              onClick={() => moveDown(i)}
              className="w-8 h-8 rounded-full bg-line text-ink font-black shrink-0"
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              onClick={() => removeFromRoute(a.id)}
              className="chip py-1.5 bg-danger/10 text-danger shrink-0"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <h2 className="text-base font-black mb-2 px-1">Not on the route</h2>
      {unordered.length === 0 ? (
        <p className="card p-4 mb-6 text-sm font-semibold text-dim">Every aisle is on your route.</p>
      ) : (
        <ul className="card px-4 py-0.5 divide-y-2 divide-line/70 mb-6">
          {unordered.map((a) => (
            <li key={a.id} className="flex items-center gap-2 py-2.5">
              <span className="chip rounded-lg bg-accent-soft text-accent-soft-ink shrink-0">{a.code}</span>
              <span className="flex-1 min-w-0 text-sm font-semibold leading-snug">{a.categories}</span>
              <button
                onClick={() => addToRoute(a.id)}
                className="chip py-1.5 bg-accent text-accent-ink shrink-0"
              >
                Add to route
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full btn-main"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </main>
  );
}
