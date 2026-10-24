"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AisleDirectoryEntry, GroceryListItem } from "@/lib/types";
import type { GroupedGroceryList } from "@/lib/groceryOrder";
import { buildWalmartSearchUrl } from "@/lib/walmartCart";
import PageHeader from "../components/PageHeader";

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

// Drawn over the custom round checkbox; shown only when it's checked.
function CheckMark() {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      className="pointer-events-none absolute inset-0 m-auto w-3 h-3 text-white hidden peer-checked:block"
      aria-hidden="true"
    >
      <path d="M2.5 6.2 5 8.5l4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
        className="w-full mt-2 btn-danger"
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
          className={`-mx-2 px-2 flex items-center gap-3 py-3 cursor-pointer rounded-2xl ${
            selected ? "bg-danger/10" : ""
          }`}
        >
          <span className="relative w-6 h-6 shrink-0">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => toggleSelected(item.id)}
              aria-label={`Select ${item.item_name}`}
              className="peer appearance-none w-6 h-6 rounded-lg border-2 border-line bg-card checked:bg-danger checked:border-danger cursor-pointer"
            />
            <CheckMark />
          </span>
          <span className={`flex-1 font-bold ${picked ? "line-through text-dim" : ""}`}>
            {item.item_name}
          </span>
          {item.quantity != null && (
            <span className="text-sm font-extrabold text-dim min-w-[2.5rem] text-right">
              ×{item.quantity}
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
      <li key={item.id} className={picked ? "opacity-60" : ""}>
        <div className="flex items-center gap-2.5 py-3">
          <span className="relative w-6 h-6 shrink-0">
            <input
              type="checkbox"
              checked={picked}
              onChange={(e) => togglePicked(item.id, e.target.checked)}
              aria-label={`Mark ${item.item_name} as picked up`}
              className="peer appearance-none w-6 h-6 rounded-full border-2 border-line bg-card checked:bg-second checked:border-second cursor-pointer"
            />
            <CheckMark />
          </span>
          <span className={`flex-1 min-w-0 font-bold leading-snug ${picked ? "line-through text-dim" : ""}`}>
            {item.item_name}
          </span>
          {showAisleCode && !unmatched && (
            <button
              type="button"
              onClick={() => setEditingItemId((cur) => (cur === item.id ? null : item.id))}
              aria-label={`Change aisle for ${item.item_name}`}
              className="chip shrink-0 rounded-lg bg-accent-soft text-accent-soft-ink"
            >
              {aisleCode ?? "—"}
            </button>
          )}
          {unmatched && (
            <select
              className="rounded-lg border-2 text-xs font-bold p-1 max-w-[6.5rem]"
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
              className="w-14 rounded-lg border-2 p-1 text-sm font-bold text-right"
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
              className="text-sm font-extrabold text-dim min-w-[2.5rem] text-right"
            >
              {item.quantity != null ? `×${item.quantity}` : "+ qty"}
            </button>
          )}
          <button
            type="button"
            onClick={() => buyOnWalmart(item.item_name)}
            aria-label={`Buy ${item.item_name} on Walmart`}
            className="shrink-0 text-accent p-0.5"
          >
            <CartIcon />
          </button>
          <button
            type="button"
            onClick={() => confirmRemove(item)}
            aria-label={`Remove ${item.item_name}`}
            className="shrink-0 text-danger/80 p-0.5"
          >
            <TrashIcon />
          </button>
        </div>
        {editingAisle && grouped && (
          <div className="pl-9 pb-3">
            <select
              className="field text-xs py-1.5"
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

  function renderSectionTitle(title: string, count: number) {
    return (
      <div className="flex items-baseline justify-between mt-5 mb-2 px-1">
        <h2 className="text-base font-black">{title}</h2>
        <span className="text-xs font-extrabold text-dim">{count}</span>
      </div>
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
          <>
            {renderSectionTitle("To pick up", toPickUp.length)}
            <ul className="card px-4 py-0.5 divide-y-2 divide-line/70">
              {toPickUp.map((r) => renderRow(r, showAisleCode))}
            </ul>
          </>
        )}
        {unmatchedToPickUp.length > 0 && (
          <>
            {renderSectionTitle("No aisle yet", unmatchedToPickUp.length)}
            <ul className="card px-4 py-0.5 divide-y-2 divide-line/70">
              {unmatchedToPickUp.map((r) => renderRow(r, showAisleCode, true))}
            </ul>
          </>
        )}
        {pickedTotal > 0 && (
          <>
            {renderSectionTitle("Picked up", pickedTotal)}
            <ul className="card px-4 py-0.5 divide-y-2 divide-line/70">
              {pickedSorted.map((r) => renderRow(r, showAisleCode))}
              {pickedUnmatched.map((r) => renderRow(r, showAisleCode, true))}
            </ul>
            {!selecting && !allPickedUp && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleFinishShopping}
                  disabled={finishing || deleting}
                  className="w-full btn-main"
                >
                  {finishing ? "Finishing..." : `Finish shopping (${pluralItems(pickedTotal)})`}
                </button>
                {renderDeleteCheckedButton(pickedTotal)}
              </div>
            )}
          </>
        )}
      </>
    );
  }

  function renderProgress() {
    const total = items.length;
    const pct = total === 0 ? 0 : Math.round((pickedCount / total) * 100);
    return (
      <div className="card p-4 flex items-center gap-4 mb-1">
        <svg width="68" height="68" viewBox="0 0 100 100" className="shrink-0" aria-hidden="true">
          <circle cx="50" cy="50" r="40" fill="none" strokeWidth="12" className="stroke-line" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${Math.max(pct, 0.1)} 100`}
            transform="rotate(-90 50 50)"
            className="stroke-second transition-[stroke-dasharray] duration-500"
          />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-extrabold tracking-wider text-dim">PICKED UP</p>
          <p className="text-xl font-black leading-tight tabular-nums">
            {pickedCount} of {total}
          </p>
          <button
            onClick={handleShop}
            disabled={sorting}
            className="btn-main mt-2 py-2 px-3.5 text-[13px]"
          >
            {sorting ? "Sorting..." : grouped ? "Re-sort by aisle" : "Let's go shopping"}
          </button>
        </div>
      </div>
    );
  }

  const remaining = items.length - pickedCount;

  return (
    <main className="px-4 pt-3">
      <PageHeader
        eyebrow={
          loading ? "\u00a0" : items.length === 0 ? "Nothing to get" : `${pluralItems(remaining)} to get`
        }
        title="Shopping List"
      >
        {!loading && items.length > 0 && !selecting && (
          <button type="button" onClick={enterSelectMode} className="chip py-1.5 px-3 bg-card text-accent shadow-soft">
            Select
          </button>
        )}
      </PageHeader>

      {selecting ? (
        <div className="sticky top-2 z-10 card flex items-center gap-2 p-2 pl-4 mb-3">
          <button type="button" onClick={exitSelectMode} className="text-sm font-bold text-dim">
            Cancel
          </button>
          <span className="flex-1 text-center text-sm font-black">{selectedIds.size} selected</span>
          <button type="button" onClick={toggleSelectAll} className="text-sm font-bold text-accent">
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <button
            type="button"
            onClick={deleteSelected}
            disabled={selectedIds.size === 0 || deleting}
            aria-label={`Delete ${pluralItems(selectedIds.size)}`}
            className="btn bg-danger text-white py-2 px-3 disabled:opacity-40"
          >
            <TrashIcon />
            Delete
          </button>
        </div>
      ) : (
        <form onSubmit={addItem} className="flex gap-2 mb-4">
          <input
            className="field flex-1 shadow-soft border-transparent"
            placeholder="Add an item..."
            aria-label="Add an item"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
          />
          <button type="submit" aria-label="Add" className="btn-main w-12 px-0 text-2xl leading-none">
            +
          </button>
        </form>
      )}

      {!loading && !selecting && allPickedUp && (
        <div className="relative overflow-hidden rounded-3xl bg-hero text-white shadow-hero p-4 mb-1">
          <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-white/10" aria-hidden="true" />
          <p className="relative text-[11px] font-extrabold tracking-wider opacity-85">ALL DONE</p>
          <p className="relative text-xl font-black">Everything&rsquo;s picked up!</p>
          <button
            onClick={handleFinishShopping}
            disabled={finishing || deleting}
            className="relative w-full mt-3 btn bg-card text-accent"
          >
            {finishing ? "Finishing..." : "Finish shopping"}
          </button>
          <button
            type="button"
            onClick={deleteChecked}
            disabled={finishing || deleting}
            className="relative w-full mt-2 btn bg-white/15 text-white"
          >
            <TrashIcon />
            {deleting ? "Deleting..." : `Delete ${pluralItems(pickedCount)} checked off`}
          </button>
        </div>
      )}

      {!loading && !selecting && items.length > 0 && !allPickedUp && renderProgress()}

      {error && <p className="text-sm font-bold text-danger my-3">{error}</p>}

      {loading && <p className="font-semibold text-dim">Loading...</p>}
      {!loading && items.length === 0 && (
        <div className="card p-6 text-center">
          <p className="text-lg font-black">Your list is empty</p>
          <p className="text-sm font-semibold text-dim mt-1">Add something above to get started.</p>
        </div>
      )}

      {!loading && items.length > 0 && renderList()}

      <p className="text-center mt-6">
        <Link href="/aisle-order" className="text-xs link">
          Edit aisle order
        </Link>
      </p>
    </main>
  );
}
