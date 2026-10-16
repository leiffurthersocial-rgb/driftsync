"use client";

import { useMemo } from "react";
import { useApp } from "@/store/app-store";
import { activeAt, minutesOfDay, nextAfter, toDateKey } from "@/lib/time";

/** Today's blocks plus the active and next block at `now`. */
export function useCurrentBlocks(now: Date) {
  const blocks = useApp((s) => s.blocks);
  const today = toDateKey(now);
  const minute = minutesOfDay(now);
  return useMemo(() => {
    const todays = blocks.filter((b) => b.date === today).sort((a, b) => a.start - b.start);
    return { today, minute, todays, active: activeAt(todays, minute), next: nextAfter(todays, minute) };
  }, [blocks, today, minute]);
}
