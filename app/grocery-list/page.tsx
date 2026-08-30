"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AisleDirectoryEntry, GroceryListItem } from "@/lib/types";
import type { GroupedGroceryList } from "@/lib/groceryOrder";

interface Row {
  item: GroceryListItem;
  aisleCode?: string | null;
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path
        d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m-6.5 0 .6 9.4a1.5 1.5 0 0 0 1.5 1.4h4.8a1.5 1.5 0 0 0 1.5-1.4L14.5 6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function GroceryListPage() {
  const [items, setItems] = useState<GroceryListItem[]>([]);
  const [itemName, setItemName] = useState("");
  const [loading, setLoading] = useState(true);
  const [grouped, setGrouped] = useState<GroupedGroceryList | null>(null);
  const [sorting, setSorting] = useState(false);
  const [aisleOptions, setAisleOptions] = useState<AisleDirectoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingQuantityId, setEditingQuantityId] = useState<string | null>(null);
  const [quantityDraft, setQuantityDraft] = useState("");

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

  function patchItemLocally(id: string, changes: Partial<GroceryListItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)));
    setGrouped((prev) =>
      prev
        ? {
            sorted: prev.sorted.map((g) =>
              g.item.id === id ? { ...g, item: { ...g.item, ...changes } } : g
            ),
            unmatched: prev.unmatched.map((g) =>
              g.item.id === id ? { ...g, item: { ...g.item, ...changes } } : g
            ),
          }
        : null
    );
  }

  async function togglePicked(id: string, picked: boolean) {
    patchItemLocally(id, { picked_up: picked ? 1 : 0 });
    await fetch(`/api/grocery-list/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picked_up: picked }),
    });
  }

  function startEditQuantity(id: string, current: number | null) {
    setEditingQuantityId(id);
    setQuantityDraft(current != null ? String(current) : "");
  }

  async function saveQuantity(id: string) {
    const trimmed = quantityDraft.trim();
    const quantity = trimmed === "" ? null : Number(trimmed);
    setEditingQuantityId(null);
    if (quantity !== null && Number.isNaN(quantity)) return;
    patchItemLocally(id, { quantity });
    await fetch(`/api/grocery-list/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
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

  function renderRow(row: Row, showAisleCode: boolean) {
    const { item, aisleCode } = row;
    const picked = !!item.picked_up;
    return (
      <li key={item.id} className={`flex items-center gap-3 py-2 ${picked ? "opacity-50" : ""}`}>
        <input
          type="checkbox"
          checked={picked}
          onChange={(e) => togglePicked(item.id, e.target.checked)}
          aria-label={`Mark ${item.item_name} as picked up`}
          className="w-5 h-5 shrink-0 accent-pink-600"
        />
        {showAisleCode && (
          <button
            type="button"
            onClick={() => setEditingItemId((cur) => (cur === item.id ? null : item.id))}
            className="w-10 shrink-0 text-left text-xs font-mono text-gray-500"
          >
            {aisleCode ?? "—"}
          </button>
        )}
        <span className={`flex-1 ${picked ? "line-through text-gray-400" : ""}`}>
          {item.item_name}
        </span>
        {editingQuantityId === item.id ? (
          <input
            type="number"
            autoFocus
            className="w-14 border rounded p-1 text-sm text-right"
            value={quantityDraft}
            onChange={(e) => setQuantityDraft(e.target.value)}
            onBlur={() => saveQuantity(item.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveQuantity(item.id);
              if (e.key === "Escape") setEditingQuantityId(null);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => startEditQuantity(item.id, item.quantity)}
            className="text-sm text-gray-500 min-w-[2.5rem] text-right"
          >
            {item.quantity != null ? item.quantity : "+ qty"}
          </button>
        )}
        <button
          type="button"
          onClick={() => removeItem(item.id)}
          aria-label={`Remove ${item.item_name}`}
          className="shrink-0 text-red-500"
        >
          <TrashIcon />
        </button>
      </li>
    );
  }

  function renderSections(rows: Row[], showAisleCode: boolean) {
    const toPickUp = rows.filter((r) => !r.item.picked_up);
    const pickedUp = rows.filter((r) => r.item.picked_up);
    return (
      <>
        {toPickUp.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-500 mb-1">To Pick Up</h2>
            <ul className="divide-y">{toPickUp.map((r) => renderRow(r, showAisleCode))}</ul>
          </div>
        )}
        {pickedUp.length > 0 && (
          <div className="mt-4">
            <h2 className="text-sm font-bold text-gray-500 mb-1">Picked Up</h2>
            <ul className="divide-y">{pickedUp.map((r) => renderRow(r, showAisleCode))}</ul>
          </div>
        )}
      </>
    );
  }

  return (
    <main className="p-4 bg-white text-black min-h-screen">
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

      {!loading &&
        items.length > 0 &&
        !grouped &&
        renderSections(
          items.map((item) => ({ item })),
          false
        )}

      {grouped && (
        <div>
          {renderSections(
            grouped.sorted.map(({ item, aisle }) => ({ item, aisleCode: aisle?.code })),
            true
          )}

          {editingItemId &&
            (() => {
              const match = grouped.sorted.find((g) => g.item.id === editingItemId);
              if (!match) return null;
              return (
                <div className="pl-8 pb-2">
                  <select
                    className="border rounded text-xs p-1 w-full"
                    value={match.aisle?.id ?? ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        handlePickAisle(match.item.item_name, e.target.value);
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
                </div>
              );
            })()}

          {grouped.unmatched.length > 0 && (
            <div className="mt-4">
              <h2 className="text-sm font-bold text-gray-500 mb-2">Unmatched</h2>
              <ul className="divide-y">
                {grouped.unmatched.map(({ item }) => (
                  <li key={item.id} className="flex items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!item.picked_up}
                      onChange={(e) => togglePicked(item.id, e.target.checked)}
                      aria-label={`Mark ${item.item_name} as picked up`}
                      className="w-5 h-5 shrink-0 accent-pink-600"
                    />
                    <span className={`flex-1 ${item.picked_up ? "line-through text-gray-400" : ""}`}>
                      {item.item_name}
                    </span>
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
                      className="shrink-0 text-red-500"
                    >
                      <TrashIcon />
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
