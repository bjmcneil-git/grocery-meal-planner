import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getPastDays } from "@/lib/week";

describe("getPastDays", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 29)); // Sat 2026-08-29, local time
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the given number of days, newest first, excluding today", () => {
    const days = getPastDays(3);
    expect(days.map((d) => d.date)).toEqual(["2026-08-28", "2026-08-27", "2026-08-26"]);
  });

  it("labels only the most recent day as Yesterday", () => {
    const days = getPastDays(3);
    expect(days.map((d) => d.relative)).toEqual(["Yesterday", null, null]);
  });

  it("formats the label as weekday and month/day", () => {
    const [yesterday] = getPastDays(1);
    expect(yesterday.label).toBe("Fri 8/28");
  });
});
