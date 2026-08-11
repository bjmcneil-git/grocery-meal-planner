export interface UpcomingDay {
  date: string; // YYYY-MM-DD, local
  label: string; // e.g. "Mon 8/10"
  relative: "Today" | "Tomorrow" | null;
}

export function getUpcomingDays(count: number): UpcomingDay[] {
  const now = new Date();
  const days: UpcomingDay[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
    const label = `${weekday} ${d.getMonth() + 1}/${d.getDate()}`;
    const relative = i === 0 ? "Today" : i === 1 ? "Tomorrow" : null;
    days.push({ date, label, relative });
  }
  return days;
}
