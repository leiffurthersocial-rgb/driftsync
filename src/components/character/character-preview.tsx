"use client";

import { useEffect, useRef } from "react";
import type { Appearance } from "@/data/schema";
import { characterSprite, frameAt, H, W, type AnimName, type Outfit } from "@/island/sprites/character";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";

/** Animated character sprite on its own little canvas (pixel-perfect integer scale). */
export function CharacterPreview({
  appearance,
  anim = "idle",
  outfit = "casual",
  scale = 4,
  className,
  label,
}: {
  appearance: Appearance;
  anim?: AnimName;
  outfit?: Outfit;
  scale?: number;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  const appRef = useRef(appearance);
  appRef.current = appearance;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const start = performance.now();
    const draw = (t: number) => {
      const pose = frameAt(anim, reduced ? 0 : (t - start) / 1000);
      const s = characterSprite(appRef.current, pose, false, outfit);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(s.canvas, 0, 0, s.canvas.width * scale, s.canvas.height * scale);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [anim, scale, reduced, outfit]);

  return (
    <canvas
      ref={ref}
      width={W * scale}
      height={H * scale}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("pixelated", className)}
    />
  );
}
