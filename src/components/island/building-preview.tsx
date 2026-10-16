"use client";

import { useEffect, useState } from "react";
import type { AreaType } from "@/data/schema";
import { renderBuilding, type Vitality } from "@/island/sprites/buildings";
import { TERRAIN } from "@/island/palettes";
import { PixelBuffer } from "@/island/pixel-buffer";
import { cn } from "@/lib/cn";

const cache = new Map<string, string>();

/** Small static render of an area's building sprite (with a grass pad), as an <img>. */
export function BuildingPreview({
  type,
  variant = 0,
  color = null,
  vitality = "neutral",
  className,
}: {
  type: AreaType;
  variant?: number;
  color?: string | null;
  vitality?: Vitality;
  className?: string;
}) {
  const key = `${type}|${variant}|${color}|${vitality}`;
  const [src, setSrc] = useState<string | null>(() => cache.get(key) ?? null);

  useEffect(() => {
    const hit = cache.get(key);
    if (hit) return setSrc(hit);
    const { base } = renderBuilding(type, variant, color, vitality, TERRAIN.base.outline);
    // Grass pad under the footprint so the preview reads as "on the island".
    const pad = new PixelBuffer(base.buffer.width, base.buffer.height);
    pad.poly(
      [
        [base.ax, base.ay - 2],
        [base.ax + 36, base.ay + 16],
        [base.ax, base.ay + 34],
        [base.ax - 36, base.ay + 16],
      ],
      TERRAIN.base.grass,
    );
    pad.outline(TERRAIN.base.cliffTop);
    const canvas = pad.toCanvas();
    canvas.getContext("2d")!.drawImage(base.canvas, 0, 0);
    // Trim empty headroom.
    const crop = document.createElement("canvas");
    crop.width = canvas.width;
    crop.height = 92;
    crop.getContext("2d")!.drawImage(canvas, 0, crop.height - canvas.height);
    const url = crop.toDataURL();
    cache.set(key, url);
    setSrc(url);
  }, [key, type, variant, color, vitality]);

  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" aria-hidden className={cn("pixelated select-none", className)} draggable={false} />
  ) : (
    <div className={cn("animate-pulse rounded-xl bg-surface-2", className)} aria-hidden />
  );
}
