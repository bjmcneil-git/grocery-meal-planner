"use client";

import { useEffect, useState } from "react";
import type { AisleDirectoryEntry } from "@/lib/types";

export default function AisleOrderPage() {
  const [route, setRoute] = useState<AisleDirectoryEntry[]>([]);
  const [unordered, setUnordered] = useState<AisleDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/aisle-directory")
      .then((r) => r.json())
      .then((data: AisleDirectoryEntry[]) => {
        setRoute(data.filter((a) => a.walk_order !== null));
        setUnordered(data.filter((a) => a.walk_order === null));
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
    const res = await fetch("/api/aisle-directory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderedIds: route.map((a) => a.id),
        unorderedIds: unordered.map((a) => a.id),
      }),
    });
    const data: AisleDirectoryEntry[] = await res.json();
    setRoute(data.filter((a) => a.walk_order !== null));
    setUnordered(data.filter((a) => a.walk_order === null));
    setSaving(false);
  }

  if (loading) return <main className="p-4">Loading...</main>;

  return (
    <main className="p-4 pb-20">
      <h1 className="text-xl font-bold mb-4">Edit Aisle Order</h1>

      <h2 className="text-sm font-bold text-gray-500 mb-2">Route</h2>
      <ul className="divide-y mb-6">
        {route.map((a, i) => (
          <li key={a.id} className="flex items-center gap-2 py-2">
            <span className="flex-1 text-sm">
              {a.code} — {a.categories}
            </span>
            <button
              onClick={() => moveUp(i)}
              className="px-2 py-1 text-xs border rounded"
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              onClick={() => moveDown(i)}
              className="px-2 py-1 text-xs border rounded"
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              onClick={() => removeFromRoute(a.id)}
              className="px-2 py-1 text-xs border rounded text-red-600"
            >
              Remove from route
            </button>
          </li>
        ))}
      </ul>

      <h2 className="text-sm font-bold text-gray-500 mb-2">Unordered</h2>
      <ul className="divide-y mb-6">
        {unordered.map((a) => (
          <li key={a.id} className="flex items-center gap-2 py-2">
            <span className="flex-1 text-sm">
              {a.code} — {a.categories}
            </span>
            <button
              onClick={() => addToRoute(a.id)}
              className="px-2 py-1 text-xs border rounded"
            >
              Add to route
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-3 py-2 rounded bg-pink-600 text-white text-sm disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </main>
  );
}
