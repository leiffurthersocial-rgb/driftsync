/**
 * Island layout: land shape, size tiers, smart area placement and path generation.
 * Pure and deterministic; area positions are stored relative to the island center so
 * they stay put when the island grows.
 */
import { findPathTo, reachable, type Grid, type Point } from "./pathfinding";
import { hash01 } from "./random";

/** Island edge length in tiles per tier. Always even so the center is a tile corner. */
export const TIER_SIZES = [12, 14, 16, 18, 20, 22] as const;
export const MAX_TIER = TIER_SIZES.length - 1;
export const MAX_AREAS = 12;
/** All areas use a 2x2 footprint. */
export const FOOTPRINT = 2;
/** Minimum empty tiles between footprints. */
export const GAP = 1;

export interface AreaPos {
  id: string;
  x: number;
  y: number;
}

export interface PlacedArea extends AreaPos {
  /** Grid coordinates of the footprint's back corner tile. */
  gx: number;
  gy: number;
  entrance: Point;
}

export interface Layout {
  size: number;
  center: number;
  seed: number;
  land: Uint8Array;
  /** Tiles covered by building footprints. */
  blocked: Uint8Array;
  path: Uint8Array;
  plaza: Point[];
  areas: PlacedArea[];
}

export function tierForCount(count: number): number {
  if (count <= 2) return 0;
  return Math.min(MAX_TIER, Math.ceil((count - 2) / 2));
}

export const sizeForTier = (tier: number) => TIER_SIZES[Math.max(0, Math.min(MAX_TIER, tier))];

/** Round island with a gently noisy rim. Noise uses center-relative coords so it is tier-stable. */
export function isLand(size: number, seed: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= size || y >= size) return false;
  const c = size / 2;
  const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
  const r = c - 0.35;
  return d + hash01(x - c, y - c, seed) * 0.9 < r;
}

export function plazaTiles(size: number): Point[] {
  const c = size / 2;
  return [
    [c - 1, c - 1],
    [c, c - 1],
    [c - 1, c],
    [c, c],
  ];
}

export const entranceOf = (gx: number, gy: number): Point => [gx + FOOTPRINT - 1, gy + FOOTPRINT];

function landMask(size: number, seed: number) {
  const land = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) land[y * size + x] = isLand(size, seed, x, y) ? 1 : 0;
  return land;
}

function toPlaced(size: number, a: AreaPos): PlacedArea {
  const c = size / 2;
  const gx = c + a.x;
  const gy = c + a.y;
  return { ...a, gx, gy, entrance: entranceOf(gx, gy) };
}

function blockedMask(size: number, areas: PlacedArea[]) {
  const m = new Uint8Array(size * size);
  for (const a of areas)
    for (let dy = 0; dy < FOOTPRINT; dy++)
      for (let dx = 0; dx < FOOTPRINT; dx++) {
        const x = a.gx + dx;
        const y = a.gy + dy;
        if (x >= 0 && y >= 0 && x < size && y < size) m[y * size + x] = 1;
      }
  return m;
}

function walkGrid(size: number, land: Uint8Array, blocked: Uint8Array, cost?: Grid["cost"]): Grid {
  return {
    width: size,
    height: size,
    walkable: (x, y) => land[y * size + x] === 1 && blocked[y * size + x] === 0,
    cost,
  };
}

/** Are all areas on land, non-overlapping, spaced, and reachable from the plaza? */
export function isValidLayout(size: number, seed: number, positions: AreaPos[]): boolean {
  const land = landMask(size, seed);
  const placed = positions.map((p) => toPlaced(size, p));
  const plaza = plazaTiles(size);
  for (let i = 0; i < placed.length; i++) {
    const a = placed[i];
    if (!footprintOnLand(size, land, a.gx, a.gy)) return false;
    if (rectsTooClose(a.gx, a.gy, FOOTPRINT, FOOTPRINT, plaza[0][0], plaza[0][1], 2, 2, GAP)) return false;
    for (let j = i + 1; j < placed.length; j++) {
      const b = placed[j];
      if (rectsTooClose(a.gx, a.gy, FOOTPRINT, FOOTPRINT, b.gx, b.gy, FOOTPRINT, FOOTPRINT, GAP)) return false;
    }
  }
  const blocked = blockedMask(size, placed);
  const seen = reachable(walkGrid(size, land, blocked), plaza[0]);
  return placed.every((a) => {
    const [ex, ey] = a.entrance;
    return land[ey * size + ex] === 1 && blocked[ey * size + ex] === 0 && seen[ey * size + ex] === 1;
  });
}

function footprintOnLand(size: number, land: Uint8Array, gx: number, gy: number) {
  // Footprint plus a one-tile apron must be land so buildings never hang off the cliff.
  for (let y = gy - 1; y <= gy + FOOTPRINT; y++)
    for (let x = gx - 1; x <= gx + FOOTPRINT; x++) {
      if (x < 0 || y < 0 || x >= size || y >= size || !land[y * size + x]) return false;
    }
  return true;
}

function rectsTooClose(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  gap: number,
) {
  return ax < bx + bw + gap && bx < ax + aw + gap && ay < by + bh + gap && by < ay + ah + gap;
}

/**
 * Build the full layout: land, footprints, plaza, and a connected path network.
 * Paths grow as a tree from the plaza: each entrance (nearest first) is routed to the
 * existing network, with a discount on existing path tiles so routes merge naturally.
 */
export function buildLayout(size: number, seed: number, positions: AreaPos[]): Layout {
  const land = landMask(size, seed);
  const placed = positions.map((p) => toPlaced(size, p));
  const blocked = blockedMask(size, placed);
  const plaza = plazaTiles(size);
  const path = new Uint8Array(size * size);
  for (const [x, y] of plaza) path[y * size + x] = 1;

  const nearBuilding = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < size && ny < size && blocked[ny * size + nx]) return true;
      }
    return false;
  };
  const grid = walkGrid(size, land, blocked, (x, y) =>
    path[y * size + x] ? 0.35 : 1 + (nearBuilding(x, y) ? 0.5 : 0),
  );

  const c = size / 2;
  const order = [...placed].sort(
    (a, b) =>
      Math.abs(a.entrance[0] - c) + Math.abs(a.entrance[1] - c) - (Math.abs(b.entrance[0] - c) + Math.abs(b.entrance[1] - c)) ||
      a.id.localeCompare(b.id),
  );
  for (const a of order) {
    const route = findPathTo(grid, a.entrance, (x, y) => path[y * size + x] === 1);
    if (route) for (const [x, y] of route) path[y * size + x] = 1;
  }
  return { size, center: c, seed, land, blocked, path, plaza, areas: placed };
}

export interface PlaceOptions {
  /** Non-zero adds seeded jitter so a reroll lands somewhere different. */
  jitter?: number;
  /** Avoid this position (relative) — used by reroll. */
  avoid?: { x: number; y: number };
}

/**
 * Find the best spot for a new 2x2 area. Returns a center-relative position, or null if full.
 * Hard rules: on land with an apron, spaced from other areas and the plaza, everything reachable.
 * Soft score: near center, near existing paths, not crowded, away from the rim.
 */
export function placeArea(size: number, seed: number, existing: AreaPos[], opts: PlaceOptions = {}) {
  const layout = buildLayout(size, seed, existing);
  const { land, path, center: c } = layout;
  const plaza = plazaTiles(size);
  let best: { x: number; y: number; score: number } | null = null;

  for (let gy = 1; gy < size - FOOTPRINT; gy++) {
    for (let gx = 1; gx < size - FOOTPRINT; gx++) {
      const rx = gx - c;
      const ry = gy - c;
      if (opts.avoid && Math.abs(opts.avoid.x - rx) + Math.abs(opts.avoid.y - ry) < 2) continue;
      if (!footprintOnLand(size, land, gx, gy)) continue;
      if (rectsTooClose(gx, gy, FOOTPRINT, FOOTPRINT, plaza[0][0], plaza[0][1], 2, 2, GAP)) continue;
      let clash = false;
      let crowd = 0;
      for (const a of layout.areas) {
        if (rectsTooClose(gx, gy, FOOTPRINT, FOOTPRINT, a.gx, a.gy, FOOTPRINT, FOOTPRINT, GAP)) {
          clash = true;
          break;
        }
        if (rectsTooClose(gx, gy, FOOTPRINT, FOOTPRINT, a.gx, a.gy, FOOTPRINT, FOOTPRINT, GAP + 1)) crowd++;
      }
      if (clash) continue;

      const [ex, ey] = entranceOf(gx, gy);
      let covered = 0;
      for (let dy = 0; dy < FOOTPRINT; dy++)
        for (let dx = 0; dx < FOOTPRINT; dx++) covered += path[(gy + dy) * size + gx + dx];

      let pathDist = Infinity;
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          if (path[y * size + x]) pathDist = Math.min(pathDist, Math.abs(x - ex) + Math.abs(y - ey));

      let rim = 0;
      for (let y = gy - 2; y <= gy + FOOTPRINT + 1; y++)
        for (let x = gx - 2; x <= gx + FOOTPRINT + 1; x++) if (!isLand(size, seed, x, y)) rim++;

      const centerDist = Math.hypot(gx + 1 - c, gy + 1 - c);
      const jitter = opts.jitter ? hash01(gx * 31 + opts.jitter, gy * 17, seed) * 2.5 : 0;
      const score = centerDist + pathDist * 0.45 + crowd * 1.5 + rim * 0.25 + covered * 1.2 + jitter;
      if (best && score >= best.score) continue;

      // Reachability is the expensive check, so only run it for improving candidates.
      if (!isValidLayout(size, seed, [...existing, { id: "__new__", x: rx, y: ry }])) continue;
      best = { x: rx, y: ry, score };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

/**
 * Place a new area, growing the island if needed. Returns the new tier and position,
 * or null when the island is at capacity.
 */
export function placeWithGrowth(minTier: number, seed: number, existing: AreaPos[], opts: PlaceOptions = {}) {
  if (existing.length >= MAX_AREAS) return null;
  const start = Math.max(minTier, tierForCount(existing.length + 1));
  for (let tier = start; tier <= MAX_TIER; tier++) {
    const size = sizeForTier(tier);
    if (!isValidLayout(size, seed, existing)) continue;
    const pos = placeArea(size, seed, existing, opts);
    if (pos) return { tier, ...pos };
  }
  return null;
}

/** Smallest tier ≥ the count-based tier that still fits every area (used after removals). */
export function fitTier(seed: number, positions: AreaPos[], currentTier: number): number {
  for (let tier = tierForCount(positions.length); tier <= currentTier; tier++) {
    if (isValidLayout(sizeForTier(tier), seed, positions)) return tier;
  }
  return currentTier;
}
