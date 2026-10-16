"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/store/app-store";
import { useNow } from "@/hooks/use-now";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useIslandWorld } from "@/hooks/use-island";
import { lightFor } from "@/lib/daycycle";
import { areaVitality } from "@/lib/feedback";
import { resolveIntent } from "@/lib/character-intent";
import { minutesOfDay, toDateKey } from "@/lib/time";
import { useUi } from "@/store/ui-store";
import type { IslandScene } from "@/island/scene";
import { CharacterController } from "@/island/character/controller";
import type { AnimName } from "@/island/sprites/character";
import { CharacterCard } from "@/components/character/character-card";
import { CharacterPreview } from "@/components/character/character-preview";
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
  const profile = useApp((s) => s.profile);
  const now = useNow(15_000);
  const reduced = usePrefersReducedMotion();
  const today = toDateKey(now);
  const minute = minutesOfDay(now);
  const hour = Math.floor(minute / 60);
  const vitality = useMemo(
    () => areaVitality(areas, activities, blocks, today, minute),
    // Vitality changes slowly; recompute when data or the hour changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [areas, activities, blocks, today, hour],
  );
  const { world, resolved } = useIslandWorld(vitality);
  const selectedId = useUi((s) => s.selectedAreaId);
  const selectArea = useUi((s) => s.selectArea);
  const openCharacter = useUi((s) => s.setCharacterCardOpen);
  const introPending = useUi((s) => s.introPending);
  const light = lightFor(theme, minute);

  // One controller for the lifetime of the view.
  const [character] = useState(() => new CharacterController(profile.appearance, profile.characterName));
  character.appearance = profile.appearance;
  character.name = profile.characterName;

  useEffect(() => character.setLayout(resolved.layout), [character, resolved.layout]);

  const intent = useMemo(
    () => resolveIntent({ override: profile.override, blocks, activities, areas, today, minute, now }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile.override, blocks, activities, areas, today, Math.floor(minute)],
  );
  useEffect(() => character.setIntent(intent), [character, intent]);

  const [intro] = useState(introPending);
  useEffect(() => {
    if (introPending) {
      useUi.getState().setIntroPending(false);
      character.land();
    }
  }, [introPending, character]);

  const [status, setStatus] = useState("");
  const [anim, setAnim] = useState<AnimName>("idle");
  const labelRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const areaName = (id: string | null) => (id ? (useApp.getState().areas.find((a) => a.id === id)?.name ?? null) : null);

  // Status text for the chip/card (bubble text is refreshed per frame below).
  useEffect(() => {
    const t = setInterval(() => {
      setStatus(character.status(minutesOfDay(new Date()), areaName));
      setAnim(character.currentAnim);
    }, 1000);
    setStatus(character.status(minutesOfDay(new Date()), areaName));
    return () => clearInterval(t);
  }, [character]);

  const onScene = (scene: IslandScene | null) => {
    if (!scene) return;
    let lastText = "";
    let frame = 0;
    scene.onFrame = () => {
      // Floating name tag over the hovered/selected area, positioned without React renders.
      const el = labelRef.current;
      if (el) {
        const id = scene.hoveredId ?? scene.selectedId;
        const pos = id ? scene.areaAnchor(id) : null;
        if (!pos) el.style.opacity = "0";
        else {
          const name = areaName(id) ?? "";
          if (el.textContent !== name) el.textContent = name;
          el.style.opacity = "1";
          el.style.transform = `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px) translate(-50%, -100%)`;
        }
      }
      const bubble = bubbleRef.current;
      if (bubble) {
        if (frame++ % 20 === 0) {
          const text = character.status(minutesOfDay(new Date()), areaName);
          if (text !== lastText) {
            bubble.textContent = text;
            lastText = text;
          }
        }
        const visible = scene.introProgress >= 1;
        const h = character.headAnchor();
        const p = scene.worldToClient(h.x, h.y);
        bubble.style.opacity = visible ? "1" : "0";
        bubble.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
      }
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
        actor={character}
        intro={intro}
        label={`${islandName}, your floating island with ${areas.length} areas. ${profile.characterName}: ${status}. Use the area list and character button to interact.`}
        onHit={(hit) => {
          if (hit?.kind === "character") openCharacter(true);
          else selectArea(hit?.kind === "area" ? hit.id : null);
        }}
        onScene={onScene}
      >
        <div
          ref={labelRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-lg bg-surface/90 px-2 py-0.5 font-pixel text-sm text-ink opacity-0 shadow-soft transition-opacity"
        />
        <div
          ref={bubbleRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 mb-1 whitespace-nowrap rounded-xl rounded-bl-sm border border-line/60 bg-surface/95 px-2.5 py-1 text-xs font-medium text-ink opacity-0 shadow-soft transition-opacity duration-500"
        />
      </IslandCanvas>

      <IslandTitle now={now} />

      {/* Desktop HUD */}
      <div className="absolute left-6 top-40 hidden flex-col gap-3 md:flex">
        <NowCard now={now} />
        <CharacterChip name={profile.characterName} status={status} onClick={() => openCharacter(true)} />
      </div>
      <div className="absolute right-6 top-24 hidden max-h-[calc(100dvh-8rem)] overflow-y-auto md:block">
        <AreaDock vertical />
      </div>
      <div className="absolute bottom-6 left-1/2 hidden w-[440px] -translate-x-1/2 md:block">
        <QuickAddTodo />
      </div>

      {/* Mobile HUD */}
      <div className="absolute inset-x-3 bottom-[5.25rem] flex flex-col gap-2 md:hidden">
        <div className="flex items-center gap-2">
          <CharacterChip name={profile.characterName} status={status} onClick={() => openCharacter(true)} compact />
          <div className="min-w-0 flex-1">
            <AreaDock />
          </div>
        </div>
        <NowCard now={now} compact />
        <QuickAddTodo />
      </div>

      <AreaSheet vitality={vitality} />
      <AddAreaDialog />
      <CharacterCard status={status} anim={anim} />
    </div>
  );
}

function CharacterChip({ name, status, onClick, compact }: { name: string; status: string; onClick(): void; compact?: boolean }) {
  const appearance = useApp((s) => s.profile.appearance);
  if (compact)
    return (
      <button
        onClick={onClick}
        aria-label={`${name}: ${status}. Open character card`}
        className="card flex shrink-0 items-center gap-2 bg-surface/85 py-1 pl-1 pr-3 backdrop-blur-md"
      >
        <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-lg bg-surface-2">
          <CharacterPreview appearance={appearance} scale={1} className="mt-2 h-[30px] w-6" />
        </span>
        <span className="text-sm font-medium">{name}</span>
      </button>
    );
  return (
    <button
      onClick={onClick}
      className="card flex items-center gap-3 bg-surface/85 py-1.5 pl-1.5 pr-4 text-left backdrop-blur-md transition hover:-translate-y-0.5 sm:w-72"
      aria-label={`${name}: ${status}. Open character card`}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2">
        <CharacterPreview appearance={appearance} scale={2} className="-mb-2 h-[60px] w-12 translate-y-1" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{name}</span>
        {!compact || status ? <span className="block truncate text-xs text-muted">{status}</span> : null}
      </span>
    </button>
  );
}
