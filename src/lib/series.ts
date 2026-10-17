import type { Block, Marker, MarkerKind, Series } from "@/data/schema";
import { occursOn, occurrencesBetween } from "./recurrence";

/** Occurrences that haven't been saved yet get a synthetic id: `rpt:<seriesId>:<date>`. */
const PREFIX = "rpt:";
export const virtualId = (seriesId: string, date: string) => `${PREFIX}${seriesId}:${date}`;
export function parseVirtualId(id: string): { seriesId: string; date: string } | null {
  if (!id.startsWith(PREFIX)) return null;
  const rest = id.slice(PREFIX.length);
  const i = rest.lastIndexOf(":");
  return i > 0 ? { seriesId: rest.slice(0, i), date: rest.slice(i + 1) } : null;
}
export const isVirtual = (id: string) => id.startsWith(PREFIX);

/** The unsaved occurrence of `s` on `date`, shaped like a Block. */
export function occurrence(s: Series, date: string): Block {
  return {
    id: virtualId(s.id, date),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    deletedAt: null,
    date,
    start: s.start,
    end: s.end,
    title: s.title,
    activityId: s.activityId,
    color: s.color,
    notes: s.notes,
    todoId: null,
    goalId: s.goalId,
    done: false,
    seriesId: s.id,
    seriesDate: date,
  };
}

/** Is the series' occurrence on `date` still unsaved and not deleted? */
const savedKey = (seriesId: string, date: string) => `${seriesId}|${date}`;
function savedOccurrences(blocks: Block[]) {
  const set = new Set<string>();
  for (const b of blocks) if (b.seriesId && b.seriesDate) set.add(savedKey(b.seriesId, b.seriesDate));
  return set;
}

/**
 * Real blocks between `from` and `to` (inclusive) plus the generated occurrences of every
 * repeating series. Occurrences that were saved (edited/ticked) or deleted are not generated.
 */
export function expandBlocks(blocks: Block[], series: Series[], from: string, to: string): Block[] {
  const out = blocks.filter((b) => b.date >= from && b.date <= to);
  const saved = savedOccurrences(blocks);
  for (const s of series) {
    const skip = new Set(s.skip);
    for (const d of occurrencesBetween(s.repeat, s.from, from, to))
      if (!skip.has(d) && !saved.has(savedKey(s.id, d))) out.push(occurrence(s, d));
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start || a.end - b.end);
}

/** Find a block by id, including unsaved occurrences. */
export function findBlock(id: string, blocks: Block[], series: Series[]): Block | null {
  const v = parseVirtualId(id);
  if (!v) return blocks.find((b) => b.id === id) ?? null;
  const s = series.find((x) => x.id === v.seriesId);
  return s && occursOn(s.repeat, s.from, v.date) ? occurrence(s, v.date) : null;
}

/* ---------- wake / bedtime lines ---------- */

export interface DayMarker {
  kind: MarkerKind;
  time: number;
  markerId: string;
  repeating: boolean;
}

const markerOccurs = (m: Marker, date: string) =>
  !m.skip.includes(date) && (m.repeat ? occursOn(m.repeat, m.date, date) : m.date === date);

/**
 * The wake and bedtime lines for a date. A one-day line beats a repeating one; among repeating
 * lines the most recently created wins (so "weekends 9:00" added after "every day 7:00" takes over
 * on weekends).
 */
export function markersFor(markers: Marker[], date: string): DayMarker[] {
  const out: DayMarker[] = [];
  for (const kind of ["wake", "sleep"] as const) {
    const hits = markers.filter((m) => m.kind === kind && markerOccurs(m, date));
    if (!hits.length) continue;
    hits.sort((a, b) => Number(!a.repeat) - Number(!b.repeat) || a.createdAt.localeCompare(b.createdAt));
    const m = hits[hits.length - 1];
    out.push({ kind, time: m.time, markerId: m.id, repeating: !!m.repeat });
  }
  return out;
}
