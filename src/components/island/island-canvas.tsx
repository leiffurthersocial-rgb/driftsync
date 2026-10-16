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
  /** Allow panning/zooming with pointer, wheel and pinch. */
  camera?: boolean;
  onHit?(hit: Hit): void;
  onScene?(scene: IslandScene | null): void;
  className?: string;
  label: string;
  children?: ReactNode;
}

const DRAG_THRESHOLD = 6;

/** Hosts an IslandScene on a canvas and wires pointer input, camera, resizing and lifecycle. */
export function IslandCanvas({
  world,
  night,
  golden,
  reducedMotion,
  selectedId = null,
  actor = null,
  intro = false,
  interactive = true,
  camera = true,
  onHit,
  onScene,
  className,
  label,
  children,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<IslandScene | null>(null);
  const [cursor, setCursor] = useState<"default" | "pointer" | "grab" | "grabbing">("grab");
  const onHitRef = useRef(onHit);
  onHitRef.current = onHit;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; startX: number; startY: number; pinch?: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const scene = new IslandScene(canvas);
    sceneRef.current = scene;
    onScene?.(scene);
    const ro = new ResizeObserver(() => scene.resize());
    ro.observe(canvas);
    const onWheel = (e: WheelEvent) => {
      if (!camera) return;
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
      scene.zoomAt(factor, e.clientX - r.left, e.clientY - r.top);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      ro.disconnect();
      canvas.removeEventListener("wheel", onWheel);
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
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div className={cn("relative", className)}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className="pixelated block h-full w-full"
        style={{ touchAction: camera ? "none" : "auto", cursor: camera || interactive ? cursor : "default" }}
        onPointerDown={(e) => {
          const p = local(e);
          pointers.current.set(e.pointerId, p);
          if (camera) canvasRef.current!.setPointerCapture(e.pointerId);
          if (pointers.current.size === 1) gesture.current = { moved: false, startX: p.x, startY: p.y };
          else if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            gesture.current = { moved: true, startX: p.x, startY: p.y, pinch: Math.hypot(a.x - b.x, a.y - b.y) };
          }
        }}
        onPointerMove={(e) => {
          const s = sceneRef.current;
          if (!s) return;
          const p = local(e);
          const prev = pointers.current.get(e.pointerId);
          if (prev && camera) {
            pointers.current.set(e.pointerId, p);
            const g = gesture.current;
            if (pointers.current.size >= 2 && g?.pinch) {
              const [a, b] = [...pointers.current.values()];
              const d = Math.hypot(a.x - b.x, a.y - b.y);
              s.zoomAt(d / g.pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
              g.pinch = d;
              s.panBy((p.x - prev.x) / 2, (p.y - prev.y) / 2);
              return;
            }
            if (g && !g.moved && Math.hypot(p.x - g.startX, p.y - g.startY) > DRAG_THRESHOLD) g.moved = true;
            if (g?.moved) {
              s.panBy(p.x - prev.x, p.y - prev.y);
              setCursor("grabbing");
            }
            return;
          }
          if (!interactive || e.pointerType !== "mouse") return;
          const hit = s.hitTest(p.x, p.y);
          s.hoveredId = hit?.kind === "area" ? hit.id : null;
          setCursor(hit ? "pointer" : camera ? "grab" : "default");
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          pointers.current.delete(e.pointerId);
          if (pointers.current.size === 0) {
            gesture.current = null;
            setCursor("grab");
            if (interactive && g && !g.moved) {
              const s = sceneRef.current;
              const p = local(e);
              if (s) onHitRef.current?.(s.hitTest(p.x, p.y));
            }
          }
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          gesture.current = null;
        }}
        onPointerLeave={() => {
          if (sceneRef.current) sceneRef.current.hoveredId = null;
        }}
      />
      {children}
    </div>
  );
}
