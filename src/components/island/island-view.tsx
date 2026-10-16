"use client";

import { useMemo, useRef, useState } from "react";
import { useApp } from "@/store/app-store";
import { useNow } from "@/hooks/use-now";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useIslandWorld } from "@/hooks/use-island";
import { lightFor } from "@/lib/daycycle";
import { areaVitality } from "@/lib/feedback";
import { minutesOfDay, toDateKey } from "@/lib/time";
import { useUi } from "@/store/ui-store";
import type { IslandScene } from "@/island/scene";
import { IslandCanvas } from "./island-canvas";
import { AreaDock, IslandTitle, NowCard, QuickAddTodo } from "./hud";
import { AreaSheet } from "./area-sheet";
import { AddAreaDialog } from "./add-area-dialog";

export function IslandView() {
  const theme = useApp((s) => s.settings.theme);
  const islandName = useApp((s) => s.island.name);
  const areas = useApp((s) => s.areas);
  const activities = useApp((s) => s.activities);
  const blocks = useApp((s) => s.blocks);
  const now = useNow(30_000);
  const reduced = usePrefersReducedMotion();
  const today = toDateKey(now);
  const minute = Math.floor(minutesOfDay(now));
  const vitality = useMemo(
    () => areaVitality(areas, activities, blocks, today, minute),
    // Vitality changes slowly; recompute when data or the hour changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [areas, activities, blocks, today, Math.floor(minute / 60)],
  );
  const { world } = useIslandWorld(vitality);
  const selectedId = useUi((s) => s.selectedAreaId);
  const selectArea = useUi((s) => s.selectArea);
  const light = lightFor(theme, minutesOfDay(now));
  const sceneRef = useRef<IslandScene | null>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [, setSceneReady] = useState(false);

  const onScene = (scene: IslandScene | null) => {
    sceneRef.current = scene;
    setSceneReady(!!scene);
    if (!scene) return;
    scene.onFrame = () => {
      // Floating name tag over the hovered/selected area, positioned without React renders.
      const el = labelRef.current;
      if (!el) return;
      const id = scene.hoveredId ?? scene.selectedId;
      const pos = id ? scene.areaAnchor(id) : null;
      if (!pos) {
        el.style.opacity = "0";
        return;
      }
      const name = useApp.getState().areas.find((a) => a.id === id)?.name ?? "";
      if (el.textContent !== name) el.textContent = name;
      el.style.opacity = "1";
      el.style.transform = `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px) translate(-50%, -100%)`;
    };
  };

  return (
    <div className="fixed inset-0 overflow-hidden">
      <IslandCanvas
        className="h-full w-full"
        world={world}
        night={light.night}
        golden={light.golden}
        reducedMotion={reduced}
        selectedId={selectedId}
        label={`${islandName}, your floating island with ${areas.length} areas. Use the area list to select one.`}
        onHit={(hit) => selectArea(hit?.kind === "area" ? hit.id : null)}
        onScene={onScene}
      >
        <div
          ref={labelRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-lg bg-surface/90 px-2 py-0.5 font-pixel text-sm text-ink opacity-0 shadow-soft transition-opacity"
        />
      </IslandCanvas>

      <IslandTitle now={now} />

      {/* Desktop HUD */}
      <div className="absolute left-6 top-40 hidden md:block">
        <NowCard now={now} />
      </div>
      <div className="absolute right-6 top-24 hidden max-h-[calc(100dvh-8rem)] overflow-y-auto md:block">
        <AreaDock vertical />
      </div>
      <div className="absolute bottom-6 left-1/2 hidden w-[440px] -translate-x-1/2 md:block">
        <QuickAddTodo />
      </div>

      {/* Mobile HUD */}
      <div className="absolute inset-x-3 bottom-[5.25rem] flex flex-col gap-2 md:hidden">
        <AreaDock />
        <NowCard now={now} />
        <QuickAddTodo />
      </div>

      <AreaSheet vitality={vitality} />
      <AddAreaDialog />
    </div>
  );
}
