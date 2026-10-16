/** Pure date/time helpers. Dates are local "YYYY-MM-DD" keys; times are minutes since midnight. */

export const SNAP_MINUTES = 15;
export const DAY_MINUTES = 1440;

export const snap = (minutes: number, step = SNAP_MINUTES) => Math.round(minutes / step) * step;
export const snapDown = (minutes: number, step = SNAP_MINUTES) => Math.floor(minutes / step) * step;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface Range {
  start: number;
  end: number;
}

/** Normalize a dragged range: snapped, ordered, at least one step long, inside bounds. */
export function normalizeRange(a: number, b: number, min = 0, max = DAY_MINUTES, step = SNAP_MINUTES): Range {
  let start = snap(Math.min(a, b), step);
  let end = snap(Math.max(a, b), step);
  if (end - start < step) end = start + step;
  if (end > max) {
    end = max;
    start = Math.max(min, Math.min(start, end - step));
  }
  if (start < min) {
    start = min;
    end = Math.max(end, start + step);
  }
  return { start, end };
}

/** Move a range by delta minutes, snapped, preserving its length and staying in bounds. */
export function moveRange(r: Range, delta: number, min = 0, max = DAY_MINUTES, step = SNAP_MINUTES): Range {
  const len = r.end - r.start;
  const start = clamp(snap(r.start + delta, step), min, max - len);
  return { start, end: start + len };
}

/** Drag one edge of a range to `minute`, snapped, keeping at least one step. */
export function resizeRange(
  r: Range,
  edge: "start" | "end",
  minute: number,
  min = 0,
  max = DAY_MINUTES,
  step = SNAP_MINUTES,
): Range {
  const m = snap(minute, step);
  if (edge === "start") return { start: clamp(m, min, r.end - step), end: r.end };
  return { start: r.start, end: clamp(m, r.start + step, max) };
}

export const overlaps = (a: Range, b: Range) => a.start < b.end && b.start < a.end;

export interface LayoutSlot {
  col: number;
  cols: number;
  overlapping: boolean;
}

/**
 * Side-by-side layout for overlapping blocks (classic calendar algorithm).
 * Blocks in a transitively-overlapping cluster share a column count.
 */
export function layoutDay<T extends Range & { id: string }>(items: T[]): Map<string, LayoutSlot> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id));
  const out = new Map<string, LayoutSlot>();
  let cluster: { item: T; col: number }[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const cols = colEnds.length;
    for (const { item, col } of cluster) out.set(item.id, { col, cols, overlapping: cols > 1 });
    cluster = [];
    colEnds = [];
  };

  for (const item of sorted) {
    if (item.start >= clusterEnd && cluster.length) flush();
    let col = colEnds.findIndex((end) => end <= item.start);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(item.end);
    } else colEnds[col] = item.end;
    cluster.push({ item, col });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  if (cluster.length) flush();
  return out;
}

/** First gap of `length` minutes at or after `from`, or null. */
export function findFreeSlot(items: Range[], from: number, length: number, dayEnd = DAY_MINUTES): number | null {
  const sorted = [...items].sort((a, b) => a.start - b.start);
  let t = snap(Math.max(0, from));
  for (const it of sorted) {
    if (it.end <= t) continue;
    if (it.start >= t + length) break;
    t = Math.max(t, snap(it.end));
  }
  return t + length <= dayEnd ? t : null;
}

/** The block happening at `minute`; with overlaps, the most recently started wins. */
export function activeAt<T extends Range>(items: T[], minute: number): T | null {
  let best: T | null = null;
  for (const it of items) if (it.start <= minute && minute < it.end && (!best || it.start >= best.start)) best = it;
  return best;
}

export function nextAfter<T extends Range>(items: T[], minute: number): T | null {
  let best: T | null = null;
  for (const it of items) if (it.start > minute && (!best || it.start < best.start)) best = it;
  return best;
}

/* ---------- dates ---------- */

const pad = (n: number) => String(n).padStart(2, "0");

export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;

/** Start of the week containing `key`; weekStart 0 = Sunday, 1 = Monday. */
export function startOfWeek(key: string, weekStart: 0 | 1): string {
  const d = fromDateKey(key);
  const diff = (d.getDay() - weekStart + 7) % 7;
  return addDays(key, -diff);
}

export const startOfMonth = (key: string) => `${key.slice(0, 8)}01`;

export function relativeDayLabel(key: string, today: string): string | null {
  if (key === today) return "Today";
  if (key === addDays(today, 1)) return "Tomorrow";
  if (key === addDays(today, -1)) return "Yesterday";
  return null;
}

export function formatDateLong(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function formatDateShort(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatMinutes(min: number, clock: "12h" | "24h" = "24h"): string {
  const m = Math.round(min) % DAY_MINUTES;
  const h = Math.floor(m / 60);
  const mm = pad(m % 60);
  if (clock === "24h") return `${pad(min >= DAY_MINUTES ? 24 : h)}:${mm}`;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm}${suffix}`;
}

export function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return `${r}m`;
}

export function formatRange(r: Range, clock: "12h" | "24h") {
  return `${formatMinutes(r.start, clock)} – ${formatMinutes(r.end, clock)}`;
}
