"use client";

import { useEffect, useState } from "react";
import type { FeedbackNote } from "@/lib/types";

const PAGE_NAMES: Record<string, string> = {
  "/": "Meal Planner",
  "/recipes": "Recipes",
  "/grocery-list": "Shopping List",
  "/suggestions": "Suggestions",
  "/history": "History",
  "/aisle-order": "Aisle Order",
};

function pageName(path: string | null): string | null {
  if (!path) return null;
  if (PAGE_NAMES[path]) return PAGE_NAMES[path];
  if (path.startsWith("/recipes")) return "Recipes";
  return path;
}

function formatNoteDate(createdAt: string): string {
  // D1 stores UTC as "YYYY-MM-DD HH:MM:SS"; show it in the viewer's local time.
  const date = new Date(createdAt.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return createdAt;
  return date.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function FeedbackPage() {
  const [notes, setNotes] = useState<FeedbackNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/feedback")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load notes with status ${r.status}`);
        return r.json();
      })
      .then(setNotes)
      .catch(() => setError("Couldn't load notes. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, page: null }),
      });
      if (!res.ok) throw new Error(`Failed to save note with status ${res.status}`);
      const note: FeedbackNote = await res.json();
      setNotes((prev) => [note, ...prev]);
      setMessage("");
      setError(null);
    } catch {
      setError("Couldn't save your note. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function removeNote(note: FeedbackNote) {
    if (!window.confirm("Mark this note as done and remove it?")) return;
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    await fetch(`/api/feedback/${note.id}`, { method: "DELETE" });
  }

  return (
    <main className="p-4 bg-white text-black min-h-screen">
      <h1 className="text-xl font-bold mb-1">Notes &amp; Requests</h1>
      <p className="text-sm text-gray-500 mb-4">
        Ideas for things to add, change, or remove in the app.
      </p>

      <form onSubmit={addNote} className="mb-4">
        <textarea
          className="w-full border rounded p-2 text-sm"
          rows={3}
          maxLength={2000}
          placeholder="Add a note..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          type="submit"
          disabled={sending || !message.trim()}
          className="w-full mt-1 px-3 py-2 rounded bg-pink-600 text-white text-sm disabled:opacity-50"
        >
          {sending ? "Saving..." : "Add note"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && notes.length === 0 && !error && (
        <p className="text-gray-500">No notes yet.</p>
      )}

      <ul className="space-y-2">
        {notes.map((note) => {
          const where = pageName(note.page);
          return (
            <li key={note.id} className="border rounded-lg p-3">
              <p className="text-sm whitespace-pre-wrap break-words">{note.message}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">
                  {formatNoteDate(note.created_at)}
                  {where && ` · from ${where}`}
                </span>
                <button
                  type="button"
                  onClick={() => removeNote(note)}
                  className="text-xs text-pink-600 underline"
                >
                  Done
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
