import { addDays, fromDateKey, startOfMonth, startOfWeek, toDateKey } from "./time";

/** The whole weeks (4–6) that cover the month containing `key`. */
export function monthGrid(key: string, weekStart: 0 | 1): string[] {
  const first = startOfWeek(startOfMonth(key), weekStart);
  const last = addDays(startOfMonth(addMonths(startOfMonth(key), 1)), -1);
  const days: string[] = [];
  for (let d = first; d <= last || days.length % 7; d = addDays(d, 1)) days.push(d);
  return days;
}

/** The 7 days of the week containing `key`. */
export function weekDays(key: string, weekStart: 0 | 1): string[] {
  const first = startOfWeek(key, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

/** Same day-of-month `n` months away, clamped to the target month's length (Jan 31 + 1 → Feb 28/29). */
export function addMonths(key: string, n: number): string {
  const d = fromDateKey(key);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, last));
  return toDateKey(target);
}

export const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);

/** Short weekday names in display order, e.g. ["Mon", …] for weekStart 1. */
export function weekdayLabels(weekStart: 0 | 1, style: "short" | "narrow" = "short"): string[] {
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2023, 0, 1 + ((i + weekStart) % 7)).toLocaleDateString(undefined, { weekday: style }),
  );
}

export const formatMonth = (key: string) => fromDateKey(key).toLocaleDateString(undefined, { month: "long", year: "numeric" });

/** "Oct 13 – 19, 2026" or "Sep 29 – Oct 5, 2026". */
export function formatWeekRange(days: string[]): string {
  const a = fromDateKey(days[0]);
  const b = fromDateKey(days[days.length - 1]);
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: "short" });
  const tail = a.getMonth() === b.getMonth() ? `${b.getDate()}` : `${month(b)} ${b.getDate()}`;
  return `${month(a)} ${a.getDate()} – ${tail}, ${b.getFullYear()}`;
}

export function greeting(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
