"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NOTE_ADDED_EVENT } from "./NotesSection";

function MessageIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-6 h-6" aria-hidden="true">
      <path
        d="M4.5 3.5h11A1.5 1.5 0 0 1 17 5v7.5a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3h-1A1.5 1.5 0 0 1 3 12.5V5a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M6.5 7.5h7M6.5 10.5h4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    setError(null);
    setSent(false);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, page: pathname }),
      });
      if (!res.ok) throw new Error(`Failed to save note with status ${res.status}`);
      setMessage("");
      setError(null);
      setSent(true);
      window.dispatchEvent(new Event(NOTE_ADDED_EVENT));
    } catch {
      setError("Couldn't save your note. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto px-4 flex justify-end pointer-events-none z-30">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Leave a note about the app"
          className="pointer-events-auto w-12 h-12 rounded-full bg-pink-600 text-white shadow-lg flex items-center justify-center"
        >
          <MessageIcon />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center"
          onClick={close}
        >
          <div
            role="dialog"
            aria-label="Leave a note"
            className="w-full max-w-md bg-white text-black rounded-t-2xl p-4 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold">Leave a note</h2>
              <button type="button" onClick={close} className="text-sm text-gray-500">
                Close
              </button>
            </div>

            {sent ? (
              <div className="text-center py-4">
                <p className="text-pink-700 mb-3">Thanks! Your note was saved.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="flex-1 px-3 py-2 rounded border text-sm"
                  >
                    Add another
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="flex-1 px-3 py-2 rounded bg-pink-600 text-white text-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={send}>
                <p className="text-sm text-gray-500 mb-2">
                  Something you&rsquo;d like added, changed, or removed in the app?
                </p>
                <textarea
                  ref={textareaRef}
                  className="w-full border rounded p-2 text-sm"
                  rows={4}
                  maxLength={2000}
                  placeholder="e.g. It would be nice if..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
                <button
                  type="submit"
                  disabled={sending || !message.trim()}
                  className="w-full mt-2 px-3 py-2 rounded bg-pink-600 text-white text-sm disabled:opacity-50"
                >
                  {sending ? "Saving..." : "Send note"}
                </button>
              </form>
            )}

            <Link
              href="/suggestions#notes"
              onClick={close}
              className="block text-center text-xs text-pink-600 underline mt-3"
            >
              See all notes
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
