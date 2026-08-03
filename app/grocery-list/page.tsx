"use client";

import { useEffect, useState } from "react";
import type { GroceryListItem } from "@/lib/types";

export default function GroceryListPage() {
  const [items, setItems] = useState<GroceryListItem[]>([]);
  const [itemName, setItemName] = useState("");
  const [loading, setLoading] = useState(true);

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
    setItemName("");
  }

  async function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/grocery-list/${id}`, { method: "DELETE" });
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">Grocery List</h1>
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

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && items.length === 0 && (
        <p className="text-gray-500">Your list is empty. Add something above.</p>
      )}
      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              className="h-5 w-5 accent-pink-600"
              onChange={() => removeItem(item.id)}
            />
            <span className="flex-1">{item.item_name}</span>
            {item.quantity != null && (
              <span className="text-sm text-gray-500">{item.quantity}</span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
