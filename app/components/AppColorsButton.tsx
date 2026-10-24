"use client";

import { useEffect, useState } from "react";
import { PALETTES, getSavedPalette, savePalette } from "@/lib/theme";

function PaletteIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path
        d="M10 3a7 7 0 1 0 0 14c1 0 1.5-.6 1.5-1.4 0-1-.9-1.3-.9-2.2 0-.8.7-1.4 1.5-1.4H14a3 3 0 0 0 3-3C17 5.6 13.9 3 10 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.5" cy="9" r="0.9" fill="currentColor" />
      <circle cx="9" cy="6.3" r="0.9" fill="currentColor" />
      <circle cx="12.6" cy="6.6" r="0.9" fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3" aria-hidden="true">
      <path d="M2.5 6.2 5 8.5l4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// The round palette button in every page header, and the sheet it opens.
export default function AppColorsButton() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    if (open) setCurrent(getSavedPalette());
  }, [open]);

  function choose(key: string) {
    savePalette(key);
    setCurrent(key);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Change app colors"
        className="w-10 h-10 shrink-0 rounded-full bg-accent-soft text-accent-soft-ink flex items-center justify-center"
      >
        <PaletteIcon />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-label="App colors"
            className="w-full max-w-md bg-app rounded-t-[28px] px-4 pt-5 pb-8 flex flex-col gap-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">App colors</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-sm font-bold text-dim">
                Done
              </button>
            </div>
            <p className="-mt-1 mb-1 text-sm font-semibold text-dim">
              Changes the colors only. Saved on this phone.
            </p>
            {PALETTES.map((p) => {
              const selected = p.key === current;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => choose(p.key)}
                  aria-pressed={selected}
                  className={`grid grid-cols-[60px_1fr_24px] items-center gap-3 rounded-2xl bg-card p-2.5 pr-3 text-left border-2 ${
                    selected ? "border-accent" : "border-transparent"
                  }`}
                >
                  <span
                    className="w-[60px] h-11 rounded-xl overflow-hidden grid grid-rows-[14px_1fr] ring-1 ring-black/5"
                    aria-hidden="true"
                  >
                    <span style={{ background: `linear-gradient(90deg, ${p.swatch.grad1}, ${p.swatch.grad2})` }} />
                    <span className="flex items-end gap-[3px] p-1" style={{ background: p.swatch.bg }}>
                      {[p.swatch.accent, p.swatch.second, p.swatch.third].map((c, i) => (
                        <span key={c} className="flex-1 rounded-[3px]" style={{ background: c, height: `${40 + i * 20}%` }} />
                      ))}
                    </span>
                  </span>
                  <span>
                    <span className="block text-base font-black">{p.name}</span>
                    <span className="block text-xs font-semibold text-dim">{p.description}</span>
                  </span>
                  <span
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      selected ? "bg-accent border-accent text-accent-ink" : "border-line"
                    }`}
                  >
                    {selected && <CheckIcon />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
