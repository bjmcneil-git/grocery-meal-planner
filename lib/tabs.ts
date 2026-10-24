// The main tabs, in tab-bar order. Swiping left/right moves along this list.
export const TABS = [
  { href: "/", label: "Meal Planner" },
  { href: "/recipes", label: "Recipes" },
  { href: "/grocery-list", label: "Shopping List" },
  { href: "/suggestions", label: "Suggestions" },
  { href: "/history", label: "History" },
] as const;

export type TabHref = (typeof TABS)[number]["href"];

// Only the tab pages themselves swipe; recipe details, Add Recipe, Aisle
// order and the like don't.
export function tabIndexFor(pathname: string): number {
  return TABS.findIndex((t) => t.href === pathname);
}

export function neighborTab(pathname: string, direction: "next" | "prev"): TabHref | null {
  const i = tabIndexFor(pathname);
  if (i < 0) return null;
  const j = direction === "next" ? i + 1 : i - 1;
  return j >= 0 && j < TABS.length ? TABS[j].href : null;
}

// How far (px) a finger must travel before we decide between a horizontal
// swipe and a vertical scroll.
export const SWIPE_LOCK_DISTANCE = 10;

// A drag counts as horizontal when it's clearly more sideways than up/down.
export function isHorizontalDrag(dx: number, dy: number): boolean {
  return Math.abs(dx) > SWIPE_LOCK_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.3;
}

// After the finger lifts: change tabs if it moved far enough, or was a quick
// flick. Dragging left (negative dx) goes to the next tab.
export function swipeDecision(
  dx: number,
  elapsedMs: number,
  width: number
): "next" | "prev" | null {
  const distance = Math.abs(dx);
  const velocity = distance / Math.max(elapsedMs, 1); // px per ms
  const farEnough = distance > width * 0.28;
  const quickFlick = distance > 40 && velocity > 0.45;
  if (!farEnough && !quickFlick) return null;
  return dx < 0 ? "next" : "prev";
}
