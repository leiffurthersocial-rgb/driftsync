"use client";

import { useEffect, useState } from "react";
import type { AreaType } from "@/data/schema";
import { renderBuilding, type Vitality } from "@/island/sprites/buildings";
import { TERRAIN } from "@/island/palettes";
import { PixelBuffer } from "@/island/pixel-buffer";
import { cn } from "@/lib/cn";

const cache = new Map<string, string>();

/** Static render of an area design on a grass pad, cropped to its content, as an <img>. */
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
    const pad = new PixelBuffer(base.buffer.width, base.buffer.height);
    const { ax, ay } = base;
    pad.poly(
      [
        [ax, ay - 6],
        [ax + 104, ay + 46],
        [ax, ay + 98],
        [ax - 104, ay + 46],
      ],
      (x, y) => ((Math.floor((x - ax) / 16 + (y - ay) / 8) + Math.floor((y - ay) / 8 - (x - ax) / 16)) % 2 ? TERRAIN.base.grass : TERRAIN.base.grassDark),
    );
    pad.outline(TERRAIN.base.cliffTop);
    pad.stamp(base.buffer, 0, 0);
    // Crop to the opaque bounding box.
    let top = pad.height;
    let bottom = 0;
    for (let y = 0; y < pad.height; y++)
      for (let x = 0; x < pad.width; x++)
        if (pad.alphaAt(x, y)) {
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
    const full = pad.toCanvas();
    const crop = document.createElement("canvas");
    crop.width = full.width;
    crop.height = bottom - top + 2;
    crop.getContext("2d")!.drawImage(full, 0, -top + 1);
    const url = crop.toDataURL();
    cache.set(key, url);
    setSrc(url);
  }, [key, type, variant, color, vitality]);

  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" aria-hidden className={cn("pixelated select-none object-contain", className)} draggable={false} />
  ) : (
    <div className={cn("animate-pulse rounded-xl bg-surface-2", className)} aria-hidden />
  );
}
