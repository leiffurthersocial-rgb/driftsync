import { FOOTPRINT, type Layout } from "@/lib/island-layout";
import { hash01 } from "@/lib/random";
import type { PropName } from "./sprites/props";

export interface Decoration {
  /** Fractional tile coordinates of the ground point. */
  x: number;
  y: number;
  prop: PropName;
  variant: number;
}

/** Smooth value noise in [0,1) for clustering forests and meadows. */
function noise(x: number, y: number, seed: number, scale: number) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const sx = fx - x0;
  const sy = fy - y0;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash01(x0, y0, seed);
  const b = hash01(x0 + 1, y0, seed);
  const c = hash01(x0, y0 + 1, seed);
  const d = hash01(x0 + 1, y0 + 1, seed);
  return a + (b - a) * s(sx) + (c - a) * s(sy) + (a - b - c + d) * s(sx) * s(sy);
}

/** Deterministic scatter of trees, meadows, rocks, lamps and benches on free land. */
export function decorate(layout: Layout): Decoration[] {
  const { size, land, path, trail, water, blocked, seed, center: c } = layout;
  const out: Decoration[] = [];
  const at = (x: number, y: number) => y * size + x;
  const entrances = new Set(layout.areas.map((a) => at(a.entrance[0], a.entrance[1])));
  const fountain = new Set(layout.fountain.map(([x, y]) => at(x, y)));

  const nearArea = (x: number, y: number, r: number) =>
    layout.areas.some((a) => x >= a.gx - r && x <= a.gx + FOOTPRINT - 1 + r && y >= a.gy - r && y <= a.gy + FOOTPRINT - 1 + r);
  // Tiles in front of a building (towards the viewer) would hide it, so keep tall props off them.
  const inFront = (x: number, y: number) =>
    layout.areas.some((a) => x >= a.gx && x <= a.gx + FOOTPRINT + 2 && y >= a.gy && y <= a.gy + FOOTPRINT + 2);
  const nearMask = (mask: Uint8Array, x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < size && ny < size && mask[at(nx, ny)]) return true;
      }
    return false;
  };
  const nearPlaza = (x: number, y: number) => Math.abs(x + 0.5 - c) < 3.5 && Math.abs(y + 0.5 - c) < 3.5;

  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = at(x, y);
      if (!land[i] || blocked[i] || entrances.has(i) || fountain.has(i)) continue;
      const k = hash01(x - c + 401, y - c + 77, seed);
      const k2 = hash01(x - c, y - c, seed + 5);
      const v = Math.floor(k2 * 1000);
      const jx = (hash01(x, y, seed + 21) - 0.5) * 0.5;
      const jy = (hash01(x, y, seed + 22) - 0.5) * 0.5;
      const cx = x + 0.5 + jx;
      const cy = y + 0.5 + jy;

      if (water[i]) {
        if (k < 0.3) out.push({ x: cx, y: cy, prop: "lily", variant: v });
        continue;
      }
      if (path[i] || trail[i]) continue;

      const forest = noise(x - c, y - c, seed + 3, 5.5);
      const meadow = noise(x - c, y - c, seed + 8, 4);
      const coast = layout.coast[i];
      const clearOfStuff = !nearArea(x, y, 1) && !inFront(x, y) && !nearPlaza(x, y) && !nearMask(path, x, y, 0) && !nearMask(trail, x, y, 0);

      if (nearMask(water, x, y, 1) && k < 0.35) {
        out.push({ x: cx, y: cy, prop: "reeds", variant: v });
        continue;
      }
      if (clearOfStuff && forest > 0.58 && k < 0.75) {
        const kind: PropName = forest > 0.72 ? (k2 < 0.6 ? "pine" : "oak") : k2 < 0.18 ? "blossom" : k2 < 0.38 ? "birch" : k2 < 0.7 ? "oak" : "pine";
        out.push({ x: cx, y: cy, prop: kind, variant: v });
        if (k < 0.18) out.push({ x: cx + 0.3, y: cy + 0.2, prop: "mushroom", variant: v + 1 });
        continue;
      }
      if (clearOfStuff && k < 0.04) {
        out.push({ x: cx, y: cy, prop: k2 < 0.5 ? "oak" : "blossom", variant: v });
        continue;
      }
      if (!nearArea(x, y, 0) && meadow > 0.62 && k < 0.6) {
        out.push({ x: cx, y: cy, prop: "flowers", variant: v });
        continue;
      }
      if (!nearArea(x, y, 0) && k < 0.12) {
        out.push({ x: cx, y: cy, prop: k2 < 0.6 ? "tallGrass" : "bush", variant: v });
        continue;
      }
      if (coast <= 2 && k < 0.2) out.push({ x: cx, y: cy, prop: k2 < 0.3 ? "boulder" : "rock", variant: v });
      else if (!nearArea(x, y, 0) && k > 0.985) out.push({ x: cx, y: cy, prop: "stump", variant: v });
    }

  // Lamps along paths and the trail (spaced out), on grass next to the walkway.
  const lamps: [number, number][] = [];
  for (let y = 1; y < size - 1; y++)
    for (let x = 1; x < size - 1; x++) {
      const i = at(x, y);
      if (!land[i] || path[i] || trail[i] || water[i] || blocked[i] || entrances.has(i) || fountain.has(i)) continue;
      if (!(path[i - 1] || path[i + 1] || path[i - size] || path[i + size] || trail[i + 1] || trail[i + size])) continue;
      if (nearArea(x, y, 0)) continue;
      if (lamps.some(([lx, ly]) => Math.abs(lx - x) + Math.abs(ly - y) < 10)) continue;
      if (hash01(x, y, seed + 13) < 0.65) continue;
      lamps.push([x, y]);
    }
  for (const [x, y] of lamps) {
    const i = out.findIndex((d) => Math.floor(d.x) === x && Math.floor(d.y) === y);
    if (i !== -1) out.splice(i, 1);
    out.push({ x: x + 0.5, y: y + 0.5, prop: "lamp", variant: 0 });
  }

  // Benches and lamps around the plaza; the fountain in the middle.
  const p0 = c - 2;
  for (const [x, y] of [
    [p0 - 1, c - 1],
    [c + 2, c],
  ]) {
    const i = at(x, y);
    if (land[i] && !path[i] && !blocked[i] && !water[i]) out.push({ x: x + 0.5, y: y + 0.5, prop: "bench", variant: 0 });
  }
  out.push({ x: c, y: c, prop: "fountain", variant: 0 });
  return out;
}

/** Positions for small floating rocks drifting around the island (tile coords, outside land). */
export function floatingRocks(layout: Layout): { x: number; y: number; variant: number; phase: number }[] {
  const { size, seed, center: c } = layout;
  const out = [];
  for (let i = 0; i < 6; i++) {
    const a = hash01(seed, i, 41) * Math.PI * 2;
    const d = c + 2.5 + hash01(seed, i, 42) * 4;
    out.push({ x: c + Math.cos(a) * d, y: c + Math.sin(a) * d, variant: i, phase: hash01(seed, i, 43) * Math.PI * 2 });
  }
  void size;
  return out;
}
