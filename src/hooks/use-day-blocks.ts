"use client";

import { useMemo } from "react";
import { useApp } from "@/store/app-store";
import { expandBlocks, markersFor } from "@/lib/series";
import { activeAt, minutesOfDay, nextAfter, toDateKey } from "@/lib/time";

/** Real blocks plus repeat occurrences between two dates (inclusive), sorted by date and start. */
export function useBlocks(from: string, to: string) {
  const blocks = useApp((s) => s.blocks);
  const series = useApp((s) => s.series);
  return useMemo(() => expandBlocks(blocks, series, from, to), [blocks, series, from, to]);
}

/** Wake-up and bedtime lines for a date. */
export function useDayMarkers(date: string) {
  const markers = useApp((s) => s.markers);
  return useMemo(() => markersFor(markers, date), [markers, date]);
}

/** Today's blocks plus the active and next block at `now`. */
export function useCurrentBlocks(now: Date) {
  const today = toDateKey(now);
  const minute = minutesOfDay(now);
  const todays = useBlocks(today, today);
  return useMemo(
    () => ({ today, minute, todays, active: activeAt(todays, minute), next: nextAfter(todays, minute) }),
    [todays, today, minute],
  );
}
