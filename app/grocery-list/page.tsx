"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import type { AisleDirectoryEntry, GroceryListItem } from "@/lib/types";
import type { GroupedGroceryList } from "@/lib/groceryOrder";

export default function GroceryListPage() {
  const [items, setItems] = useState<GroceryListItem[]>([]);
  const [itemName, setItemName] = useState("");
  const [loading, setLoading] = useState(true);
  const [grouped, setGrouped] = useState<GroupedGroceryList | null>(null);
  const [sorting, setSorting] = useState(false);
  const [aisleOptions, setAisleOptions] = useState<AisleDirectoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/grocery-list")
      .then((r) => r.json())
      .then((data) => {
        setItems(data);
        setLoading(false);
      });
  }, []);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const name = itemName.trim();
    if (!name) return;
    const res = await fetch("/api/grocery-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_name: name }),
    });
    const item = await res.json();
    setItems((prev) => [item, ...prev]);
    setGrouped(null);
    setItemName("");
  }

  async function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setGrouped((prev) =>
      prev
        ? {
            sorted: prev.sorted.filter((g) => g.item.id !== id),
            unmatched: prev.unmatched.filter((g) => g.item.id !== id),
          }
        : null
    );
    await fetch(`/api/grocery-list/${id}`, { method: "DELETE" });
  }

  async function handleShop() {
    setSorting(true);
    try {
      const res = await fetch("/api/grocery-list/shop");
      if (!res.ok) throw new Error(`Failed to sort list with status ${res.status}`);
      const data: GroupedGroceryList = await res.json();
      setGrouped(data);
      if (aisleOptions.length === 0) {
        const dirRes = await fetch("/api/aisle-directory");
        if (!dirRes.ok) {
          throw new Error(`Failed to load aisle directory with status ${dirRes.status}`);
        }
        setAisleOptions(await dirRes.json());
      }
      setError(null);
    } catch {
      setError("Failed to sort your list. Please try again.");
    } finally {
      setSorting(false);
    }
  }

  async function handlePickAisle(name: string, aisleDirectoryId: string) {
    setSorting(true);
    try {
      const res = await fetch("/api/item-aisle-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_name: name, aisle_directory_id: aisleDirectoryId }),
      });
      if (!res.ok) throw new Error(`Failed to save aisle pick with status ${res.status}`);
      await handleShop();
    } catch {
      setError("Failed to save the aisle pick. Please try again.");
    } finally {
      setSorting(false);
    }
  }

  return (
    <main className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Grocery List</h1>
        <Link href="/aisle-order" className="text-xs text-pink-600 underline">
          Edit aisle order
        </Link>
      </div>
      <form onSubmit={addItem} className="flex gap-2 mb-4">
        <input
          className="flex-1 border rounded p-2"
          placeholder="Add an item..."
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
        />
        <button type="submit" className="px-3 py-2 rounded bg-pink-600 text-white text-sm">
          Add
        </button>
      </form>

      {!loading && items.length > 0 && (
        <button
          onClick={handleShop}
          disabled={sorting}
          className="w-full px-3 py-2 rounded bg-pink-600 text-white text-sm mb-4 disabled:opacity-50"
        >
          {sorting ? "Sorting..." : "Let's go shopping"}
        </button>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && items.length === 0 && (
        <p className="text-gray-500">Your list is empty. Add something above.</p>
      )}

      {!loading && items.length > 0 && !grouped && (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2">
              <span className="flex-1">{item.item_name}</span>
              {item.quantity != null && (
                <span className="text-sm text-gray-500">{item.quantity}</span>
              )}
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                aria-label={`Remove ${item.item_name}`}
                className="w-6 h-6 shrink-0 rounded-full border border-gray-300 text-gray-500 flex items-center justify-center text-sm leading-none"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {grouped && (
        <div>
          <ul className="divide-y">
            {grouped.sorted.map(({ item, aisle }) => (
              <Fragment key={item.id}>
                <li className="flex items-center gap-3 py-2">
                  <button
                    type="button"
                    onClick={() => setEditingItemId((cur) => (cur === item.id ? null : item.id))}
                    className="w-12 shrink-0 text-left text-xs font-mono text-gray-500"
                  >
                    {aisle?.code ?? "—"}
                  </button>
                  <span className="flex-1">{item.item_name}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label={`Remove ${item.item_name}`}
                    className="w-6 h-6 shrink-0 rounded-full border border-gray-300 text-gray-500 flex items-center justify-center text-sm leading-none"
                  >
                    ×
                  </button>
                </li>
                {editingItemId === item.id && (
                  <li className="pb-2 pl-[3.25rem]">
                    <select
                      className="border rounded text-xs p-1 w-full"
                      value={aisle?.id ?? ""}
                      onChange={(e) => {
                        if (e.target.value) {
                          handlePickAisle(item.item_name, e.target.value);
                          setEditingItemId(null);
                        }
                      }}
                    >
                      {aisleOptions.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.categories}
                        </option>
                      ))}
                    </select>
                  </li>
                )}
              </Fragment>
            ))}
          </ul>

          {grouped.unmatched.length > 0 && (
            <div className="mt-4">
              <h2 className="text-sm font-bold text-gray-500 mb-2">Unmatched</h2>
              <ul className="divide-y">
                {grouped.unmatched.map(({ item }) => (
                  <li key={item.id} className="flex items-center gap-3 py-2">
                    <span className="flex-1">{item.item_name}</span>
                    <select
                      className="border rounded text-xs p-1"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) handlePickAisle(item.item_name, e.target.value);
                      }}
                    >
                      <option value="" disabled>
                        Pick aisle...
                      </option>
                      {aisleOptions.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.categories}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remove ${item.item_name}`}
                      className="w-6 h-6 shrink-0 rounded-full border border-gray-300 text-gray-500 flex items-center justify-center text-sm leading-none"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
