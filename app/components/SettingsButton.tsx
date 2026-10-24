"use client";

import { useEffect, useState } from "react";
import { PALETTES, getSavedPalette, savePalette } from "@/lib/theme";
import { PATCH_NOTES, LATEST_UPDATE, UPDATES_SEEN_KEY, formatUpdateDate } from "@/lib/patchNotes";

const UPDATES_SHOWN_AT_FIRST = 2;

function CogIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path
        d="M8.6 2.8h2.8l.4 1.9c.5.2 1 .5 1.4.8l1.8-.6 1.4 2.4-1.4 1.3a5.6 5.6 0 0 1 0 1.6l1.4 1.3-1.4 2.4-1.8-.6c-.4.3-.9.6-1.4.8l-.4 1.9H8.6l-.4-1.9a5.6 5.6 0 0 1-1.4-.8l-1.8.6-1.4-2.4L5 10.8a5.6 5.6 0 0 1 0-1.6L3.6 7.9 5 5.5l1.8.6c.4-.3.9-.6 1.4-.8l.4-2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.5" />
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

function readSeenUpdate(): string | null {
  try {
    return window.localStorage.getItem(UPDATES_SEEN_KEY);
  } catch {
    return LATEST_UPDATE; // Can't remember what was seen, so don't nag.
  }
}

function markUpdatesSeen() {
  try {
    window.localStorage.setItem(UPDATES_SEEN_KEY, LATEST_UPDATE);
  } catch {
    // Not remembering is fine.
  }
}

// The cog in every page header: opens Settings with App colors and Updates
// (patch notes). Shows a dot until this phone has seen the newest update.
export default function SettingsButton() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [hasNewUpdate, setHasNewUpdate] = useState(false);
  const [showAllUpdates, setShowAllUpdates] = useState(false);

  useEffect(() => {
    setHasNewUpdate(readSeenUpdate() !== LATEST_UPDATE);
  }, []);

  useEffect(() => {
    if (!open) return;
    setCurrent(getSavedPalette());
    markUpdatesSeen();
    setHasNewUpdate(false);
  }, [open]);

  function close() {
    setOpen(false);
    setShowAllUpdates(false);
  }

  function choose(key: string) {
    savePalette(key);
    setCurrent(key);
  }

  const updates = showAllUpdates ? PATCH_NOTES : PATCH_NOTES.slice(0, UPDATES_SHOWN_AT_FIRST);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={hasNewUpdate ? "Settings (new update)" : "Settings"}
        className="relative w-9 h-9 shrink-0 rounded-full bg-accent-soft text-accent-soft-ink flex items-center justify-center"
      >
        <CogIcon />
        {hasNewUpdate && (
          <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-second ring-2 ring-app" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center" onClick={close}>
          <div
            role="dialog"
            aria-label="Settings"
            className="w-full max-w-md max-h-[88vh] overflow-y-auto overscroll-contain bg-app rounded-t-[28px] px-4 pt-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-black">Settings</h2>
              <button type="button" onClick={close} className="text-sm font-bold text-dim">
                Done
              </button>
            </div>

            <section aria-labelledby="settings-colors">
              <h3 id="settings-colors" className="text-base font-black px-1">
                App colors
              </h3>
              <p className="text-xs font-semibold text-dim mb-2 px-1">Changes the colors only. Saved on this phone.</p>
              <div className="grid grid-cols-2 gap-2">
                {PALETTES.map((p) => {
                  const selected = p.key === current;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => choose(p.key)}
                      aria-pressed={selected}
                      title={p.description}
                      className={`relative flex flex-col gap-2 rounded-2xl bg-card p-2.5 text-left border-2 ${
                        selected ? "border-accent" : "border-transparent"
                      }`}
                    >
                      <span
                        className="w-full h-12 rounded-xl overflow-hidden grid grid-rows-[16px_1fr] ring-1 ring-black/5"
                        aria-hidden="true"
                      >
                        <span style={{ background: `linear-gradient(90deg, ${p.swatch.grad1}, ${p.swatch.grad2})` }} />
                        <span className="flex items-end gap-[3px] p-1" style={{ background: p.swatch.bg }}>
                          {[p.swatch.accent, p.swatch.second, p.swatch.third].map((c, i) => (
                            <span key={c} className="flex-1 rounded-[3px]" style={{ background: c, height: `${40 + i * 20}%` }} />
                          ))}
                        </span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[15px] font-black">{p.name}</span>
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selected ? "bg-accent border-accent text-accent-ink" : "border-line"
                          }`}
                        >
                          {selected && <CheckIcon />}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="settings-updates" className="mt-6">
              <h3 id="settings-updates" className="text-base font-black px-1 mb-2">
                Updates
              </h3>
              <ol className="flex flex-col gap-2">
                {updates.map((u, i) => (
                  <li key={u.date} className="card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[15px] font-black leading-snug">{u.title}</p>
                      {i === 0 ? (
                        <span className="chip bg-second-soft text-second-soft-ink shrink-0">Latest</span>
                      ) : null}
                    </div>
                    <p className="text-xs font-bold text-dim">{formatUpdateDate(u.date)}</p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {u.changes.map((c) => (
                        <li key={c} className="flex gap-2 text-sm font-semibold leading-snug">
                          <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-hidden="true" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
              {PATCH_NOTES.length > UPDATES_SHOWN_AT_FIRST && (
                <button
                  type="button"
                  onClick={() => setShowAllUpdates((v) => !v)}
                  className="w-full mt-2 btn-soft"
                >
                  {showAllUpdates ? "Show fewer updates" : `Show all ${PATCH_NOTES.length} updates`}
                </button>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
