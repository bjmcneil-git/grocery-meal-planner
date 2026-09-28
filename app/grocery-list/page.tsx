"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AisleDirectoryEntry, GroceryListItem } from "@/lib/types";
import type { GroupedGroceryList } from "@/lib/groceryOrder";
import { buildWalmartSearchUrl } from "@/lib/walmartCart";

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

function CartIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path
        d="M2 3h2l1.6 9.6a1.5 1.5 0 0 0 1.48 1.25h6.3a1.5 1.5 0 0 0 1.48-1.25L16.5 6H5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="17" r="1.1" fill="currentColor" />
      <circle cx="14" cy="17" r="1.1" fill="currentColor" />
    </svg>
  );
}

function pluralItems(n: number): string {
  return `${n} item${n === 1 ? "" : "s"}`;
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
  const [finishing, setFinishing] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const pickedCount = items.filter((i) => i.picked_up).length;
  const allPickedUp = items.length > 0 && pickedCount === items.length;
  const allSelected = items.length > 0 && selectedIds.size === items.length;

  function loadItems() {
    return fetch("/api/grocery-list")
      .then((r) => r.json())
      .then((data) => {
        setItems(data);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (items.length === 0) exitSelectMode();
  }, [items.length]);

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

  function removeItemsLocally(ids: Set<string>) {
    setItems((prev) => prev.filter((i) => !ids.has(i.id)));
    setGrouped((prev) =>
      prev
        ? {
            sorted: prev.sorted.filter((g) => !ids.has(g.item.id)),
            unmatched: prev.unmatched.filter((g) => !ids.has(g.item.id)),
          }
        : null
    );
  }

  async function removeItem(id: string) {
    removeItemsLocally(new Set([id]));
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

  async function handleFinishShopping() {
    if (pickedCount === 0) return;
    const message =
      `Finish shopping? This removes the ${pluralItems(pickedCount)} you checked off ` +
      `and saves them to History.`;
    if (!window.confirm(message)) return;
    setFinishing(true);
    try {
      const res = await fetch("/api/grocery-list/complete", { method: "POST" });
      if (!res.ok) throw new Error(`Failed to finish shopping with status ${res.status}`);
      removeItemsLocally(new Set(items.filter((i) => i.picked_up).map((i) => i.id)));
      setError(null);
    } catch {
      setError("Failed to finish shopping. Please try again.");
    } finally {
      setFinishing(false);
    }
  }

  function enterSelectMode() {
    setSelecting(true);
    setSelectedIds(new Set());
    setEditingItemId(null);
    setEditingQuantityId(null);
  }

  function exitSelectMode() {
    setSelecting(false);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  }

  function deleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${pluralItems(ids.length)} from your list?`)) return;
    exitSelectMode();
    return deleteItems(ids);
  }

  function deleteChecked() {
    const ids = items.filter((i) => i.picked_up).map((i) => i.id);
    if (ids.length === 0) return;
    const message =
      `Delete the ${pluralItems(ids.length)} you checked off? ` +
      `They won't be saved to History.`;
    if (!window.confirm(message)) return;
    return deleteItems(ids);
  }

  async function deleteItems(ids: string[]) {
    setDeleting(true);
    removeItemsLocally(new Set(ids));
    try {
      const res = await fetch("/api/grocery-list", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error(`Failed to delete items with status ${res.status}`);
      setError(null);
    } catch {
      setError("Failed to delete those items. Please try again.");
      setGrouped(null);
      await loadItems();
    } finally {
      setDeleting(false);
    }
  }

  function buyOnWalmart(itemName: string) {
    window.open(buildWalmartSearchUrl(itemName), "_blank");
  }

  function confirmRemove(item: GroceryListItem) {
    if (window.confirm(`Remove "${item.item_name}" from your list?`)) {
      removeItem(item.id);
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

  function renderAisleOptions() {
    return aisleOptions.map((a) => (
      <option key={a.id} value={a.id}>
        {a.code} — {a.categories}
      </option>
    ));
  }

  function renderDeleteCheckedButton(count: number) {
    return (
      <button
        type="button"
        onClick={deleteChecked}
        disabled={finishing || deleting}
        className="w-full mt-2 px-3 py-2 rounded border border-red-500 text-red-500 text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        <TrashIcon />
        {deleting ? "Deleting..." : `Delete ${pluralItems(count)} checked off`}
      </button>
    );
  }

  function renderSelectableRow(row: Row) {
    const { item } = row;
    const selected = selectedIds.has(item.id);
    const picked = !!item.picked_up;
    return (
      <li key={item.id}>
        <label
          className={`flex items-center gap-3 py-2 cursor-pointer ${selected ? "bg-pink-50" : ""}`}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => toggleSelected(item.id)}
            aria-label={`Select ${item.item_name}`}
            className="w-5 h-5 shrink-0 accent-red-500"
          />
          <span className={`flex-1 ${picked ? "line-through text-gray-400" : ""}`}>
            {item.item_name}
          </span>
          {item.quantity != null && (
            <span className="text-sm text-gray-500 min-w-[2.5rem] text-right">
              {item.quantity}
            </span>
          )}
        </label>
      </li>
    );
  }

  function renderRow(row: Row, showAisleCode: boolean, unmatched = false) {
    if (selecting) return renderSelectableRow(row);
    const { item, aisleCode } = row;
    const picked = !!item.picked_up;
    const editingAisle = showAisleCode && !unmatched && editingItemId === item.id;
    return (
      <li key={item.id} className={picked ? "opacity-50" : ""}>
        <div className="flex items-center gap-3 py-2">
          <input
            type="checkbox"
            checked={picked}
            onChange={(e) => togglePicked(item.id, e.target.checked)}
            aria-label={`Mark ${item.item_name} as picked up`}
            className="w-5 h-5 shrink-0 accent-pink-600"
          />
          {showAisleCode && !unmatched && (
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
          {unmatched && (
            <select
              className="border rounded text-xs p-1 max-w-[7rem]"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) handlePickAisle(item.item_name, e.target.value);
              }}
            >
              <option value="" disabled>
                Pick aisle...
              </option>
              {renderAisleOptions()}
            </select>
          )}
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
            onClick={() => buyOnWalmart(item.item_name)}
            aria-label={`Buy ${item.item_name} on Walmart`}
            className="shrink-0 text-pink-600"
          >
            <CartIcon />
          </button>
          <button
            type="button"
            onClick={() => confirmRemove(item)}
            aria-label={`Remove ${item.item_name}`}
            className="shrink-0 text-red-500 ml-2"
          >
            <TrashIcon />
          </button>
        </div>
        {editingAisle && grouped && (
          <div className="pl-8 pb-2">
            <select
              className="border rounded text-xs p-1 w-full"
              value={grouped.sorted.find((g) => g.item.id === item.id)?.aisle?.id ?? ""}
              onChange={(e) => {
                if (e.target.value) {
                  handlePickAisle(item.item_name, e.target.value);
                  setEditingItemId(null);
                }
              }}
            >
              {renderAisleOptions()}
            </select>
          </div>
        )}
      </li>
    );
  }

  function renderList() {
    const sortedRows: Row[] = grouped
      ? grouped.sorted.map(({ item, aisle }) => ({ item, aisleCode: aisle?.code }))
      : items.map((item) => ({ item }));
    const unmatchedRows: Row[] = grouped ? grouped.unmatched.map(({ item }) => ({ item })) : [];
    const showAisleCode = !!grouped;

    const toPickUp = sortedRows.filter((r) => !r.item.picked_up);
    const unmatchedToPickUp = unmatchedRows.filter((r) => !r.item.picked_up);
    const pickedSorted = sortedRows.filter((r) => r.item.picked_up);
    const pickedUnmatched = unmatchedRows.filter((r) => r.item.picked_up);
    const pickedTotal = pickedSorted.length + pickedUnmatched.length;

    return (
      <>
        {toPickUp.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-500 mb-1">To Pick Up</h2>
            <ul className="divide-y">{toPickUp.map((r) => renderRow(r, showAisleCode))}</ul>
          </div>
        )}
        {unmatchedToPickUp.length > 0 && (
          <div className="mt-4">
            <h2 className="text-sm font-bold text-gray-500 mb-1">Unmatched</h2>
            <ul className="divide-y">
              {unmatchedToPickUp.map((r) => renderRow(r, showAisleCode, true))}
            </ul>
          </div>
        )}
        {pickedTotal > 0 && (
          <div className="mt-6 pt-2 border-t-2 border-gray-100">
            <h2 className="text-sm font-bold text-gray-400 mb-1">
              Picked Up ({pickedTotal})
            </h2>
            <ul className="divide-y">
              {pickedSorted.map((r) => renderRow(r, showAisleCode))}
              {pickedUnmatched.map((r) => renderRow(r, showAisleCode, true))}
            </ul>
            {!selecting && !allPickedUp && (
              <>
                <button
                  type="button"
                  onClick={handleFinishShopping}
                  disabled={finishing || deleting}
                  className="w-full mt-3 px-3 py-2 rounded border border-pink-600 text-pink-600 text-sm disabled:opacity-50"
                >
                  {finishing
                    ? "Finishing..."
                    : `Finish shopping — remove ${pluralItems(pickedTotal)} checked off`}
                </button>
                {renderDeleteCheckedButton(pickedTotal)}
              </>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <main className="p-4 bg-white text-black min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Grocery List</h1>
        <div className="flex items-center gap-3">
          <Link href="/aisle-order" className="text-xs text-pink-600 underline">
            Edit aisle order
          </Link>
          {!loading && items.length > 0 && !selecting && (
            <button
              type="button"
              onClick={enterSelectMode}
              className="text-xs px-2 py-1 rounded border border-pink-600 text-pink-600"
            >
              Select
            </button>
          )}
        </div>
      </div>

      {selecting ? (
        <div className="sticky top-0 z-10 bg-white flex items-center gap-2 py-2 mb-2 border-b">
          <button type="button" onClick={exitSelectMode} className="text-sm text-gray-600">
            Cancel
          </button>
          <span className="flex-1 text-center text-sm font-bold">
            {selectedIds.size} selected
          </span>
          <button type="button" onClick={toggleSelectAll} className="text-sm text-pink-600">
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <button
            type="button"
            onClick={deleteSelected}
            disabled={selectedIds.size === 0 || deleting}
            aria-label={`Delete ${pluralItems(selectedIds.size)}`}
            className="ml-1 px-2 py-1.5 rounded bg-red-500 text-white text-sm flex items-center gap-1 disabled:opacity-40"
          >
            <TrashIcon />
            Delete
          </button>
        </div>
      ) : (
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
      )}

      {!loading && !selecting && allPickedUp && (
        <div className="border border-pink-200 bg-pink-50 rounded-lg p-3 mb-4">
          <p className="text-sm text-pink-700 mb-2">Everything&rsquo;s picked up!</p>
          <button
            onClick={handleFinishShopping}
            disabled={finishing || deleting}
            className="w-full px-3 py-2 rounded bg-pink-600 text-white text-sm disabled:opacity-50"
          >
            {finishing ? "Finishing..." : "Finish shopping"}
          </button>
          {renderDeleteCheckedButton(pickedCount)}
        </div>
      )}

      {!loading && !selecting && items.length > 0 && !allPickedUp && (
        <button
          onClick={handleShop}
          disabled={sorting}
          className="w-full px-3 py-2 rounded bg-pink-600 text-white text-sm mb-2 disabled:opacity-50"
        >
          {sorting ? "Sorting..." : "Let's go shopping"}
        </button>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && items.length === 0 && (
        <p className="text-gray-500">Your list is empty. Add something above.</p>
      )}

      {!loading && items.length > 0 && renderList()}
    </main>
  );
}
