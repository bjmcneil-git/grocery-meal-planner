"use client";

import { useEffect, useState } from "react";
import type { FeedbackNote } from "@/lib/types";

// Fired by FeedbackButton after a note is saved, so an open list refreshes.
export const NOTE_ADDED_EVENT = "feedback:note-added";

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

export default function NotesSection() {
  const [notes, setNotes] = useState<FeedbackNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadNotes() {
    return fetch("/api/feedback")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load notes with status ${r.status}`);
        return r.json();
      })
      .then((data: FeedbackNote[]) => {
        setNotes(data);
        setError(null);
      })
      .catch(() => setError("Couldn't load notes. Please try again."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadNotes();
    const onAdded = () => loadNotes();
    window.addEventListener(NOTE_ADDED_EVENT, onAdded);
    return () => window.removeEventListener(NOTE_ADDED_EVENT, onAdded);
  }, []);

  async function removeNote(note: FeedbackNote) {
    if (!window.confirm("Mark this note as done and remove it?")) return;
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    await fetch(`/api/feedback/${note.id}`, { method: "DELETE" });
  }

  return (
    <section id="notes" className="scroll-mt-4">
      <h2 className="text-base font-black mb-0.5 px-1">
        Notes{!loading && notes.length > 0 ? ` (${notes.length})` : ""}
      </h2>
      <p className="text-sm font-semibold text-dim mb-3 px-1">
        Requests left with the message button at the top of each page for things to add, change,
        or remove in the app.
      </p>

      {error && <p className="text-sm font-bold text-danger mb-2">{error}</p>}
      {loading && <p className="text-sm font-semibold text-dim px-1">Loading...</p>}
      {!loading && notes.length === 0 && !error && (
        <p className="card p-4 text-sm font-semibold text-dim">No notes yet.</p>
      )}

      <ul className="space-y-2">
        {notes.map((note) => {
          const where = pageName(note.page);
          return (
            <li key={note.id} className="card p-4">
              <p className="text-[15px] font-semibold whitespace-pre-wrap break-words">{note.message}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-bold text-dim">
                  {formatNoteDate(note.created_at)}
                  {where && ` · from ${where}`}
                </span>
                <button
                  type="button"
                  onClick={() => removeNote(note)}
                  className="chip py-1 bg-accent-soft text-accent-soft-ink"
                >
                  Done
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
