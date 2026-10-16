"use client";

import { useMemo } from "react";
import { useApp } from "@/store/app-store";
import { resolveIsland } from "@/island/world";
import type { SceneWorld } from "@/island/scene";
import type { Vitality } from "@/island/sprites/buildings";

/** Memoized island layout + scene description from the store. */
export function useIslandWorld(vitality?: Record<string, Vitality>) {
  const island = useApp((s) => s.island);
  const areas = useApp((s) => s.areas);
  const theme = useApp((s) => s.settings.theme);

  const resolved = useMemo(() => resolveIsland(island, areas), [island, areas]);
  const world = useMemo<SceneWorld>(
    () => ({
      layout: resolved.layout,
      palette: theme === "retro" ? "retro" : "base",
      areas: areas.map((a) => ({
        id: a.id,
        type: a.type,
        name: a.name,
        color: a.color,
        variant: a.variant,
        vitality: vitality?.[a.id] ?? "neutral",
      })),
    }),
    [resolved, areas, theme, vitality],
  );
  return { world, resolved };
}
