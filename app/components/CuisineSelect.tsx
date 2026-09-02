"use client";

import { useEffect, useState } from "react";

const ADD_NEW = "__add_new__";

interface CuisineSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function CuisineSelect({
  value,
  onChange,
  className = "w-full border rounded p-2",
}: CuisineSelectProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [newCuisine, setNewCuisine] = useState("");

  useEffect(() => {
    fetch("/api/cuisines")
      .then((r) => r.json())
      .then(setOptions);
  }, []);

  // Guard against the current value not being in the fetched list yet
  // (still loading, or a stale/unusual saved value) - never silently
  // drop the recipe's actual cuisine from the dropdown.
  const displayOptions = value && !options.includes(value) ? [...options, value].sort((a, b) => a.localeCompare(b)) : options;

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === ADD_NEW) {
      setNewCuisine("");
      setAdding(true);
      return;
    }
    onChange(e.target.value);
  }

  function confirmNewCuisine() {
    const trimmed = newCuisine.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    const existing = options.find((c) => c.toLowerCase() === trimmed.toLowerCase());
    const finalValue = existing ?? trimmed;
    if (!existing) {
      setOptions((opts) => [...opts, finalValue].sort((a, b) => a.localeCompare(b)));
    }
    onChange(finalValue);
    setAdding(false);
  }

  if (adding) {
    return (
      <div className="flex-1 flex gap-2">
        <input
          autoFocus
          className={className}
          placeholder="New cuisine name"
          value={newCuisine}
          onChange={(e) => setNewCuisine(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmNewCuisine();
            }
          }}
        />
        <button type="button" onClick={confirmNewCuisine} className="bg-pink-600 text-white rounded px-3">
          Add
        </button>
        <button
          type="button"
          onClick={() => setAdding(false)}
          aria-label="Cancel adding a cuisine"
          className="text-gray-500 px-2"
        >
          &times;
        </button>
      </div>
    );
  }

  return (
    <select className={className} value={value} onChange={handleSelectChange}>
      <option value="">Cuisine (optional)</option>
      {displayOptions.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      <option value={ADD_NEW}>+ Add</option>
    </select>
  );
}
