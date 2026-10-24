"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isHorizontalDrag, neighborTab, swipeDecision, tabIndexFor } from "@/lib/tabs";

// Touches this close to the screen's side edges belong to the phone's own
// back/forward gesture.
const EDGE_GUARD = 24;
const SLIDE_MS = 200;

// Set when a swipe leaves a page, read when the next page mounts, so the new
// page slides in from the side the finger was moving toward.
let enterFrom: "left" | "right" | null = null;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Don't steal touches meant for typing, open sheets, or anything that
// scrolls sideways on its own (like the cuisine chips on Recipes).
function startsOnExcludedElement(target: EventTarget | null, root: HTMLElement): boolean {
  let el = target instanceof Element ? target : null;
  if (el?.closest("input, textarea, select, [role='dialog'], [data-no-swipe]")) return true;
  while (el && el !== root) {
    if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 1) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
    el = el.parentElement;
  }
  return false;
}

// Wraps the page content: swipe left/right to move between the main tabs.
// The page follows the finger, then slides out while the next tab slides in.
export default function SwipeTabs({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  // Prefetch neighbors so the new tab is ready when the slide finishes.
  useEffect(() => {
    const next = neighborTab(pathname, "next");
    const prev = neighborTab(pathname, "prev");
    if (next) router.prefetch(next);
    if (prev) router.prefetch(prev);
  }, [pathname, router]);

  // Slide the new page in after a swipe navigation.
  useEffect(() => {
    const el = ref.current;
    const from = enterFrom;
    enterFrom = null;
    if (!el || !from || prefersReducedMotion()) return;
    el.style.transition = "none";
    el.style.transform = `translateX(${from === "right" ? 30 : -30}%)`;
    el.style.opacity = "0.4";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = `transform ${SLIDE_MS}ms ease-out, opacity ${SLIDE_MS}ms ease-out`;
        el.style.transform = "";
        el.style.opacity = "";
      });
    });
  }, [pathname]);

  useEffect(() => {
    const el = ref.current;
    if (!el || tabIndexFor(pathname) < 0) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let tracking = false;
    let horizontal: boolean | null = null;
    let dx = 0;

    function reset(animate: boolean) {
      if (!el) return;
      el.style.transition = animate ? `transform ${SLIDE_MS}ms ease-out, opacity ${SLIDE_MS}ms ease-out` : "none";
      el.style.transform = "";
      el.style.opacity = "";
    }

    function onStart(e: TouchEvent) {
      tracking = false;
      if (e.touches.length !== 1 || !el) return;
      const t = e.touches[0];
      if (t.clientX < EDGE_GUARD || t.clientX > window.innerWidth - EDGE_GUARD) return;
      if (startsOnExcludedElement(e.target, el)) return;
      tracking = true;
      horizontal = null;
      startX = t.clientX;
      startY = t.clientY;
      startTime = performance.now();
      dx = 0;
    }

    function onMove(e: TouchEvent) {
      if (!tracking || !el) return;
      const t = e.touches[0];
      const moveX = t.clientX - startX;
      const moveY = t.clientY - startY;
      if (horizontal === null) {
        if (Math.abs(moveX) < 10 && Math.abs(moveY) < 10) return;
        horizontal = isHorizontalDrag(moveX, moveY);
        if (!horizontal) {
          tracking = false; // A scroll: leave it to the browser.
          return;
        }
        el.style.transition = "none";
      }
      e.preventDefault();
      dx = moveX;
      // Resist past the first and last tabs, like a rubber band.
      const target = neighborTab(pathname, dx < 0 ? "next" : "prev");
      const shown = target ? dx : dx * 0.25;
      el.style.transform = `translateX(${shown}px)`;
      el.style.opacity = String(1 - Math.min(Math.abs(shown) / window.innerWidth, 1) * 0.35);
    }

    function onEnd() {
      if (!tracking || !horizontal || !el) {
        tracking = false;
        return;
      }
      tracking = false;
      const decision = swipeDecision(dx, performance.now() - startTime, window.innerWidth);
      const target = decision ? neighborTab(pathname, decision) : null;
      if (!target) {
        reset(true);
        return;
      }
      const goingNext = decision === "next";
      enterFrom = goingNext ? "right" : "left";
      if (prefersReducedMotion()) {
        reset(false);
        router.push(target);
        return;
      }
      el.style.transition = `transform ${SLIDE_MS}ms ease-in, opacity ${SLIDE_MS}ms ease-in`;
      el.style.transform = `translateX(${goingNext ? -100 : 100}%)`;
      el.style.opacity = "0";
      window.setTimeout(() => router.push(target), SLIDE_MS - 40);
      // If the navigation never lands, bring the page back instead of
      // leaving it off-screen.
      const leftFrom = pathname;
      window.setTimeout(() => {
        if (el.isConnected && window.location.pathname === leftFrom) {
          enterFrom = null;
          reset(true);
        }
      }, 2500);
    }

    function onCancel() {
      if (tracking && horizontal) reset(true);
      tracking = false;
    }

    el.addEventListener("touchstart", onStart, { passive: true });
    // Not passive: once a drag is clearly sideways we stop the page from
    // also scrolling or triggering the browser's own swipe.
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onCancel);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, [pathname, router]);

  return (
    // No permanent transform or will-change here: either would make this div
    // the anchor for the fixed-position sheets inside pages.
    <div ref={ref} className="min-h-[calc(100vh-7rem)]">
      {children}
    </div>
  );
}
