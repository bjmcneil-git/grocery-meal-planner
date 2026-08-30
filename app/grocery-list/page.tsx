"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AisleDirectoryEntry, GroceryListItem } from "@/lib/types";
import type { GroupedGroceryList } from "@/lib/groceryOrder";
import { buildWalmartCartUrl } from "@/lib/walmartCart";

interface WalmartResolvedItem {
  id: string;
  item_name: string;
  quantity: number;
  walmart_item_id: string;
}

interface WalmartUnresolvedItem {
  id: string;
  item_name: string;
}

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
  const [completing, setCompleting] = useState(false);
  const [walmartLoading, setWalmartLoading] = useState(false);
  const [walmartResolved, setWalmartResolved] = useState<WalmartResolvedItem[]>([]);
  const [walmartUnresolved, setWalmartUnresolved] = useState<WalmartUnresolvedItem[] | null>(null);
  const [walmartDrafts, setWalmartDrafts] = useState<Record<string, string>>({});

  const allPickedUp = items.length > 0 && items.every((i) => i.picked_up);

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

  async function handleCompleteList() {
    setCompleting(true);
    try {
      const res = await fetch("/api/grocery-list/complete", { method: "POST" });
      if (!res.ok) throw new Error(`Failed to complete list with status ${res.status}`);
      setItems([]);
      setGrouped(null);
      setError(null);
    } catch {
      setError("Failed to complete the list. Please try again.");
    } finally {
      setCompleting(false);
    }
  }

  function openWalmartCart(resolved: WalmartResolvedItem[]) {
    if (resolved.length === 0) return;
    const url = buildWalmartCartUrl(
      resolved.map((r) => ({ walmartItemId: r.walmart_item_id, quantity: r.quantity }))
    );
    window.open(url, "_blank");
  }

  async function handleSendToWalmart() {
    setWalmartLoading(true);
    try {
      const res = await fetch("/api/grocery-list/walmart-cart");
      if (!res.ok) throw new Error(`Failed to check Walmart links with status ${res.status}`);
      const data: { resolved: WalmartResolvedItem[]; unresolved: WalmartUnresolvedItem[] } =
        await res.json();
      setWalmartResolved(data.resolved);
      if (data.unresolved.length === 0) {
        openWalmartCart(data.resolved);
        setWalmartUnresolved(null);
      } else {
        setWalmartUnresolved(data.unresolved);
        setWalmartDrafts({});
      }
      setError(null);
    } catch {
      setError("Failed to check Walmart links. Please try again.");
    } finally {
      setWalmartLoading(false);
    }
  }

  async function handleConfirmWalmartLinks() {
    if (!walmartUnresolved) return;
    setWalmartLoading(true);
    try {
      const newlyResolved: WalmartResolvedItem[] = [];
      for (const item of walmartUnresolved) {
        const draft = walmartDrafts[item.id]?.trim();
        if (!draft) continue;
        const res = await fetch("/api/item-walmart-cache", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_name: item.item_name, walmart_item_id: draft }),
        });
        if (!res.ok) continue;
        const entry: { walmart_item_id: string } = await res.json();
        const source = items.find((i) => i.id === item.id);
        newlyResolved.push({
          id: item.id,
          item_name: item.item_name,
          quantity: source?.quantity ?? 1,
          walmart_item_id: entry.walmart_item_id,
        });
      }
      openWalmartCart([...walmartResolved, ...newlyResolved]);
      setWalmartUnresolved(null);
      setError(null);
    } catch {
      setError("Failed to save Walmart links. Please try again.");
    } finally {
      setWalmartLoading(false);
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

      {!loading && allPickedUp && (
        <div className="border border-pink-200 bg-pink-50 rounded-lg p-3 mb-4">
          <p className="text-sm text-pink-700 mb-2">Everything&rsquo;s picked up!</p>
          <button
            onClick={handleCompleteList}
            disabled={completing}
            className="w-full px-3 py-2 rounded bg-pink-600 text-white text-sm disabled:opacity-50"
          >
            {completing ? "Completing..." : "Complete List"}
          </button>
        </div>
      )}

      {!loading && items.length > 0 && !allPickedUp && (
        <button
          onClick={handleShop}
          disabled={sorting}
          className="w-full px-3 py-2 rounded bg-pink-600 text-white text-sm mb-2 disabled:opacity-50"
        >
          {sorting ? "Sorting..." : "Let's go shopping"}
        </button>
      )}

      {!loading && items.length > 0 && (
        <button
          onClick={handleSendToWalmart}
          disabled={walmartLoading}
          className="w-full px-3 py-2 rounded border border-pink-600 text-pink-600 text-sm mb-4 disabled:opacity-50"
        >
          {walmartLoading ? "Checking..." : "Send to Walmart Cart"}
        </button>
      )}

      {walmartUnresolved && (
        <div className="border border-pink-200 bg-pink-50 rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-pink-700 mb-2">
            Paste a Walmart product link (or item #) for each item to include it:
          </p>
          <ul className="space-y-2 mb-3">
            {walmartUnresolved.map((item) => (
              <li key={item.id}>
                <label className="text-xs text-gray-600">{item.item_name}</label>
                <input
                  className="w-full border rounded p-1.5 text-sm"
                  placeholder="walmart.com/ip/... or item #"
                  value={walmartDrafts[item.id] ?? ""}
                  onChange={(e) =>
                    setWalmartDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                />
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmWalmartLinks}
              disabled={walmartLoading}
              className="flex-1 px-3 py-2 rounded bg-pink-600 text-white text-sm disabled:opacity-50"
            >
              {walmartLoading ? "Opening..." : "Add to Cart"}
            </button>
            <button
              type="button"
              onClick={() => setWalmartUnresolved(null)}
              className="px-3 py-2 rounded border text-sm text-gray-600"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Skipped items won&rsquo;t be added, but you can search for them on Walmart yourself.
          </p>
        </div>
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
