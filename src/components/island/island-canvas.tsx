"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IslandScene, type Actor, type Hit, type SceneWorld } from "@/island/scene";
import { cn } from "@/lib/cn";

interface Props {
  world: SceneWorld;
  night: number;
  golden: number;
  reducedMotion: boolean;
  selectedId?: string | null;
  actor?: Actor | null;
  intro?: boolean;
  interactive?: boolean;
  onHit?(hit: Hit): void;
  onScene?(scene: IslandScene | null): void;
  className?: string;
  label: string;
  children?: ReactNode;
}

/** Hosts an IslandScene on a canvas and wires pointer input, resizing and lifecycle. */
export function IslandCanvas({
  world,
  night,
  golden,
  reducedMotion,
  selectedId = null,
  actor = null,
  intro = false,
  interactive = true,
  onHit,
  onScene,
  className,
  label,
  children,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<IslandScene | null>(null);
  const [hoverPointer, setHoverPointer] = useState(false);
  const onHitRef = useRef(onHit);
  onHitRef.current = onHit;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const scene = new IslandScene(canvas);
    sceneRef.current = scene;
    onScene?.(scene);
    const ro = new ResizeObserver(() => scene.resize());
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      scene.destroy();
      sceneRef.current = null;
      onScene?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const s = sceneRef.current!;
    s.setWorld(world);
    s.start();
  }, [world]);

  useEffect(() => {
    const s = sceneRef.current!;
    s.night = night;
    s.golden = golden;
    s.reducedMotion = reducedMotion;
    s.selectedId = selectedId;
    s.actor = actor;
  }, [night, golden, reducedMotion, selectedId, actor]);

  useEffect(() => {
    if (intro) sceneRef.current?.playIntro();
  }, [intro]);

  const local = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <div className={cn("relative", className)}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className={cn("pixelated block h-full w-full touch-manipulation", hoverPointer && "cursor-pointer")}
        onPointerMove={(e) => {
          if (!interactive || e.pointerType !== "mouse") return;
          const s = sceneRef.current;
          if (!s) return;
          const hit = s.hitTest(...local(e));
          s.hoveredId = hit?.kind === "area" ? hit.id : null;
          setHoverPointer(!!hit);
        }}
        onPointerLeave={() => {
          if (sceneRef.current) sceneRef.current.hoveredId = null;
          setHoverPointer(false);
        }}
        onClick={(e) => {
          if (!interactive) return;
          const s = sceneRef.current;
          if (!s) return;
          const r = canvasRef.current!.getBoundingClientRect();
          onHitRef.current?.(s.hitTest(e.clientX - r.left, e.clientY - r.top));
        }}
      />
      {children}
    </div>
  );
}
