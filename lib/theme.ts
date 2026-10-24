// Color sets for the app. The values themselves live in app/globals.css as
// CSS variables keyed by data-palette on <html>; this list drives the App
// colors sheet and the browser's theme color. Saved per device.

export interface Palette {
  key: string;
  name: string;
  description: string;
  // Hex colors for the picker's swatch and the phone's status bar.
  swatch: { bg: string; accent: string; second: string; third: string; grad1: string; grad2: string };
}

export const PALETTES: Palette[] = [
  {
    key: "ocean",
    name: "Ocean",
    description: "Navy and aqua. Calm and clean.",
    swatch: { bg: "#eef4f7", accent: "#123a63", second: "#19b3b1", third: "#9a5b00", grad1: "#123a63", grad2: "#1f7aa0" },
  },
  {
    key: "forest",
    name: "Forest",
    description: "Deep green and honey. Warm and earthy.",
    swatch: { bg: "#f1f4ef", accent: "#2e6b4f", second: "#d9962c", third: "#35597f", grad1: "#24563f", grad2: "#4d9269" },
  },
  {
    key: "plum",
    name: "Plum",
    description: "Plum and gold. Rich and cozy.",
    swatch: { bg: "#f6f3f7", accent: "#6e2a63", second: "#c99a3b", third: "#2f6178", grad1: "#5a2152", grad2: "#a2467f" },
  },
  {
    key: "blush",
    name: "Blush",
    description: "Raspberry and peach. The pink, grown up.",
    swatch: { bg: "#fbf2f4", accent: "#b4305f", second: "#e8875b", third: "#345d86", grad1: "#a8275a", grad2: "#e0709b" },
  },
];

export const DEFAULT_PALETTE = "ocean";
export const PALETTE_STORAGE_KEY = "app-palette";

function findPalette(key: string | null | undefined): Palette {
  return PALETTES.find((p) => p.key === key) ?? PALETTES[0];
}

export function getSavedPalette(): string {
  try {
    return findPalette(window.localStorage.getItem(PALETTE_STORAGE_KEY)).key;
  } catch {
    return DEFAULT_PALETTE;
  }
}

export function applyPalette(key: string) {
  const palette = findPalette(key);
  document.documentElement.dataset.palette = palette.key;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", palette.swatch.grad1);
}

export function savePalette(key: string) {
  applyPalette(key);
  try {
    window.localStorage.setItem(PALETTE_STORAGE_KEY, findPalette(key).key);
  } catch {
    // Storage can be unavailable (private mode); the choice just won't stick.
  }
}

// Runs inline in <head> before the first paint so the page never flashes the
// default colors. Kept dependency-free since it's serialized into the HTML.
export const PALETTE_BOOT_SCRIPT = `(function(){var keys=${JSON.stringify(
  PALETTES.map((p) => p.key)
)};var colors=${JSON.stringify(
  Object.fromEntries(PALETTES.map((p) => [p.key, p.swatch.grad1]))
)};var k="${DEFAULT_PALETTE}";try{var s=localStorage.getItem("${PALETTE_STORAGE_KEY}");if(keys.indexOf(s)>=0)k=s}catch(e){}document.documentElement.dataset.palette=k;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",colors[k]);})();`;
