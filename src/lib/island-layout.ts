/**
 * Island layout: organic land shape, size tiers, a fountain plaza, a pond, a coastal jogging
 * trail, smart area placement and path generation.
 *
 * Pure and deterministic. Area positions are stored relative to the island center so they
 * stay put when the island grows.
 */
import { findPathTo, reachable, type Grid, type Point } from "./pathfinding";
import { hash01 } from "./random";

/** Island edge length in tiles per tier. Always even so the center is a tile corner. */
export const TIER_SIZES = [24, 28, 32, 36, 40, 44] as const;
export const MAX_TIER = TIER_SIZES.length - 1;
export const MAX_AREAS = 12;
/** All areas use a 3x3 footprint. */
export const FOOTPRINT = 3;
/** Minimum empty tiles between footprints. */
export const GAP = 1;
/** Plaza is 4x4 tiles around the center with a 2x2 fountain in the middle. */
export const PLAZA = 4;
/** How far in from the coast the jogging trail runs (tiles). */
const TRAIL_INSET = 2.6;

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
  /** Footpaths (includes the plaza ring). */
  path: Uint8Array;
  /** Coastal jogging trail tiles. */
  trail: Uint8Array;
  water: Uint8Array;
  /** Fountain tiles (center of the plaza). */
  fountain: Point[];
  plaza: Point[];
  /** Closed loop around the island in fractional tile coords (for jogging). */
  trailLoop: { x: number; y: number }[];
  /** Distance (tiles) from each tile to the coast; 0 for water/void. */
  coast: Uint8Array;
  areas: PlacedArea[];
}

export function tierForCount(count: number): number {
  if (count <= 3) return 0;
  return Math.min(MAX_TIER, Math.ceil((count - 3) / 2));
}

export const sizeForTier = (tier: number) => TIER_SIZES[Math.max(0, Math.min(MAX_TIER, tier))];

/* ---------------- shape ---------------- */

function phases(seed: number) {
  return [hash01(seed, 1, 7) * Math.PI * 2, hash01(seed, 2, 7) * Math.PI * 2, hash01(seed, 3, 7) * Math.PI * 2];
}

/** Coast radius (tiles) at angle `a` for an island of `size`. Lobed, organic, tier-stable. */
export function coastRadius(size: number, seed: number, a: number) {
  const [p1, p2, p3] = phases(seed);
  const R = size / 2 - 0.6;
  return R * (1 + 0.1 * Math.sin(3 * a + p1) + 0.06 * Math.sin(5 * a + p2) + 0.03 * Math.sin(8 * a + p3) - 0.09);
}

export function isLand(size: number, seed: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= size || y >= size) return false;
  const c = size / 2;
  const dx = x + 0.5 - c;
  const dy = y + 0.5 - c;
  const d = Math.hypot(dx, dy);
  const r = coastRadius(size, seed, Math.atan2(dy, dx));
  return d + hash01(x - c, y - c, seed) * 0.7 < r;
}

export function plazaTiles(size: number): Point[] {
  const c = size / 2;
  const out: Point[] = [];
  for (let y = c - PLAZA / 2; y < c + PLAZA / 2; y++)
    for (let x = c - PLAZA / 2; x < c + PLAZA / 2; x++) if (!(x >= c - 1 && x <= c && y >= c - 1 && y <= c)) out.push([x, y]);
  return out;
}

export function fountainTiles(size: number): Point[] {
  const c = size / 2;
  return [
    [c - 1, c - 1],
    [c, c - 1],
    [c - 1, c],
    [c, c],
  ];
}

/** Pond center relative to the island center (fixed per seed so it never moves as the island grows). */
export function pondCenter(seed: number) {
  const a = hash01(seed, 99, 3) * Math.PI * 2;
  return { x: Math.cos(a) * 6.5, y: Math.sin(a) * 6.5 };
}

function waterMask(size: number, seed: number, land: Uint8Array) {
  const c = size / 2;
  const p = pondCenter(seed);
  const m = new Uint8Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - (c + p.x)) / 2.3;
      const dy = (y + 0.5 - (c + p.y)) / 1.7;
      if (dx * dx + dy * dy <= 1 && land[y * size + x]) m[y * size + x] = 1;
    }
  return m;
}

export const entranceOf = (gx: number, gy: number): Point => [gx + FOOTPRINT - 1, gy + FOOTPRINT];

function landMask(size: number, seed: number) {
  const land = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) land[y * size + x] = isLand(size, seed, x, y) ? 1 : 0;
  return land;
}

/** BFS distance (in tiles, 4-neighbour) from each land tile to the nearest non-land tile. */
function coastDistance(size: number, land: Uint8Array) {
  const d = new Uint8Array(size * size);
  const q: number[] = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (!land[i]) continue;
      const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1 || !land[i - 1] || !land[i + 1] || !land[i - size] || !land[i + size];
      if (edge) {
        d[i] = 1;
        q.push(i);
      }
    }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const x = i % size;
    for (const j of [i - 1, i + 1, i - size, i + size]) {
      if (j < 0 || j >= size * size || !land[j] || d[j]) continue;
      if ((j === i - 1 && x === 0) || (j === i + 1 && x === size - 1)) continue;
      d[j] = d[i] + 1;
      q.push(j);
    }
  }
  return d;
}

/** Smooth closed loop that follows the coast `TRAIL_INSET` tiles inland. */
export function trailLoopFor(size: number, seed: number) {
  const c = size / 2;
  const N = Math.max(72, size * 4);
  const radii: number[] = [];
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2;
    let t = 0;
    while (t < size && isLand(size, seed, Math.floor(c + Math.cos(a) * t), Math.floor(c + Math.sin(a) * t))) t += 0.25;
    radii.push(t);
  }
  const loop: { x: number; y: number }[] = [];
  for (let k = 0; k < N; k++) {
    let sum = 0;
    for (let o = -3; o <= 3; o++) sum += radii[(k + o + N) % N];
    const r = sum / 7 - TRAIL_INSET;
    const a = (k / N) * Math.PI * 2;
    loop.push({ x: c + Math.cos(a) * r, y: c + Math.sin(a) * r });
  }
  return loop;
}

function trailMask(size: number, land: Uint8Array, loop: { x: number; y: number }[]) {
  const m = new Uint8Array(size * size);
  for (let k = 0; k < loop.length; k++) {
    const a = loop[k];
    const b = loop[(k + 1) % loop.length];
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 5);
    for (let s = 0; s <= steps; s++) {
      const x = Math.floor(a.x + ((b.x - a.x) * s) / steps);
      const y = Math.floor(a.y + ((b.y - a.y) * s) / steps);
      if (x >= 0 && y >= 0 && x < size && y < size && land[y * size + x]) m[y * size + x] = 1;
    }
  }
  // Fill diagonal-only steps so the trail is 4-connected and walkable.
  for (let y = 1; y < size - 1; y++)
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      if (!m[i]) continue;
      if (m[i + size + 1] && !m[i + 1] && !m[i + size]) m[land[i + 1] ? i + 1 : i + size] = 1;
      if (m[i + size - 1] && !m[i - 1] && !m[i + size]) m[land[i - 1] ? i - 1 : i + size] = 1;
    }
  return m;
}

interface Base {
  land: Uint8Array;
  water: Uint8Array;
  trail: Uint8Array;
  coast: Uint8Array;
  loop: { x: number; y: number }[];
}

const baseCache = new Map<string, Base>();
function base(size: number, seed: number): Base {
  const key = `${size}|${seed}`;
  let b = baseCache.get(key);
  if (!b) {
    const land = landMask(size, seed);
    const water = waterMask(size, seed, land);
    const loop = trailLoopFor(size, seed);
    const trail = trailMask(size, land, loop);
    for (let i = 0; i < trail.length; i++) if (water[i]) trail[i] = 0;
    b = { land, water, trail, coast: coastDistance(size, land), loop };
    if (baseCache.size > 24) baseCache.clear();
    baseCache.set(key, b);
  }
  return b;
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

function fountainMask(size: number) {
  const m = new Uint8Array(size * size);
  for (const [x, y] of fountainTiles(size)) m[y * size + x] = 1;
  return m;
}

function walkGrid(size: number, b: Base, blocked: Uint8Array, fountain: Uint8Array, cost?: Grid["cost"]): Grid {
  return {
    width: size,
    height: size,
    walkable: (x, y) => {
      const i = y * size + x;
      return b.land[i] === 1 && blocked[i] === 0 && b.water[i] === 0 && fountain[i] === 0;
    },
    cost,
  };
}

function rectsTooClose(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number, gap: number) {
  return ax < bx + bw + gap && bx < ax + aw + gap && ay < by + bh + gap && by < ay + ah + gap;
}

/** Footprint + one-tile apron on land, clear of water, the trail and the plaza. */
function footprintOk(size: number, b: Base, gx: number, gy: number) {
  for (let y = gy - 1; y <= gy + FOOTPRINT; y++)
    for (let x = gx - 1; x <= gx + FOOTPRINT; x++) {
      if (x < 0 || y < 0 || x >= size || y >= size) return false;
      const i = y * size + x;
      if (!b.land[i] || b.water[i]) return false;
      const inside = x >= gx && x < gx + FOOTPRINT && y >= gy && y < gy + FOOTPRINT;
      if (inside && b.trail[i]) return false;
    }
  const c = size / 2;
  if (rectsTooClose(gx, gy, FOOTPRINT, FOOTPRINT, c - PLAZA / 2, c - PLAZA / 2, PLAZA, PLAZA, GAP)) return false;
  return true;
}

/** Are all areas on land, non-overlapping, spaced, and reachable from the plaza? */
export function isValidLayout(size: number, seed: number, positions: AreaPos[]): boolean {
  const b = base(size, seed);
  const placed = positions.map((p) => toPlaced(size, p));
  for (let i = 0; i < placed.length; i++) {
    const a = placed[i];
    if (!footprintOk(size, b, a.gx, a.gy)) return false;
    for (let j = i + 1; j < placed.length; j++) {
      const o = placed[j];
      if (rectsTooClose(a.gx, a.gy, FOOTPRINT, FOOTPRINT, o.gx, o.gy, FOOTPRINT, FOOTPRINT, GAP)) return false;
    }
  }
  const blocked = blockedMask(size, placed);
  const fountain = fountainMask(size);
  const start = plazaTiles(size)[0];
  const seen = reachable(walkGrid(size, b, blocked, fountain), start);
  return placed.every((a) => {
    const [ex, ey] = a.entrance;
    const i = ey * size + ex;
    return b.land[i] === 1 && blocked[i] === 0 && b.water[i] === 0 && seen[i] === 1;
  });
}

/**
 * Build the full layout. Paths grow as a tree from the plaza: each entrance (nearest first)
 * is routed to the existing network, with a discount on existing path/trail tiles so routes
 * merge. The trail is then joined to the network with one short connector.
 */
export function buildLayout(size: number, seed: number, positions: AreaPos[]): Layout {
  const b = base(size, seed);
  const placed = positions.map((p) => toPlaced(size, p));
  const blocked = blockedMask(size, placed);
  const fountain = fountainMask(size);
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
  const grid = walkGrid(size, b, blocked, fountain, (x, y) => {
    const i = y * size + x;
    return path[i] ? 0.3 : b.trail[i] ? 0.6 : 1 + (nearBuilding(x, y) ? 0.6 : 0) + (b.coast[i] <= 1 ? 2 : 0);
  });

  const c = size / 2;
  const manhattan = (p: Point) => Math.abs(p[0] - c) + Math.abs(p[1] - c);
  const order = [...placed].sort((a, o) => manhattan(a.entrance) - manhattan(o.entrance) || a.id.localeCompare(o.id));
  for (const a of order) {
    const route = findPathTo(grid, a.entrance, (x, y) => path[y * size + x] === 1);
    if (route) for (const [x, y] of route) if (!b.trail[y * size + x]) path[y * size + x] = 1;
  }

  // Connect the trail to the path network from the closest trail tile.
  let best: Point | null = null;
  let bestD = Infinity;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (b.trail[y * size + x] && !blocked[y * size + x]) {
        const d = Math.abs(x + 0.5 - c) + Math.abs(y + 0.5 - c);
        if (d < bestD) {
          bestD = d;
          best = [x, y];
        }
      }
  if (best) {
    const route = findPathTo(grid, best, (x, y) => path[y * size + x] === 1);
    if (route) for (const [x, y] of route) if (!b.trail[y * size + x]) path[y * size + x] = 1;
  }

  return {
    size,
    center: c,
    seed,
    land: b.land,
    blocked,
    path,
    trail: b.trail,
    water: b.water,
    fountain: fountainTiles(size),
    plaza,
    trailLoop: b.loop,
    coast: b.coast,
    areas: placed,
  };
}

export interface PlaceOptions {
  /** Non-zero adds seeded jitter so a reroll lands somewhere different. */
  jitter?: number;
  /** Avoid this position (relative) — used by reroll. */
  avoid?: { x: number; y: number };
}

/**
 * Find the best spot for a new area. Returns a center-relative position, or null if full.
 * Hard rules: on land with an apron, off the trail and pond, spaced from other areas and the
 * plaza, everything reachable. Soft score: near center, near paths, not crowded, off the rim.
 */
export function placeArea(size: number, seed: number, existing: AreaPos[], opts: PlaceOptions = {}) {
  const b = base(size, seed);
  const layout = buildLayout(size, seed, existing);
  const { path, center: c } = layout;

  // Distance-to-path field (multi-source BFS) so scoring is O(1) per candidate.
  const dist = new Uint16Array(size * size).fill(65535);
  const q: number[] = [];
  for (let i = 0; i < path.length; i++)
    if (path[i]) {
      dist[i] = 0;
      q.push(i);
    }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const x = i % size;
    for (const j of [x > 0 ? i - 1 : -1, x < size - 1 ? i + 1 : -1, i - size, i + size]) {
      if (j < 0 || j >= size * size || dist[j] !== 65535) continue;
      dist[j] = dist[i] + 1;
      q.push(j);
    }
  }

  let best: { x: number; y: number; score: number } | null = null;
  for (let gy = 1; gy < size - FOOTPRINT; gy++) {
    for (let gx = 1; gx < size - FOOTPRINT; gx++) {
      const rx = gx - c;
      const ry = gy - c;
      if (opts.avoid && Math.abs(opts.avoid.x - rx) + Math.abs(opts.avoid.y - ry) < 2) continue;
      if (!footprintOk(size, b, gx, gy)) continue;
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
      const ei = ey * size + ex;
      if (!b.land[ei] || b.water[ei]) continue;
      let covered = 0;
      for (let dy = 0; dy < FOOTPRINT; dy++) for (let dx = 0; dx < FOOTPRINT; dx++) covered += path[(gy + dy) * size + gx + dx];
      let rim = 0;
      for (let y = gy - 1; y <= gy + FOOTPRINT; y++) for (let x = gx - 1; x <= gx + FOOTPRINT; x++) if (b.coast[y * size + x] <= 3) rim++;

      const centerDist = Math.hypot(gx + FOOTPRINT / 2 - c, gy + FOOTPRINT / 2 - c);
      const jitter = opts.jitter ? hash01(gx * 31 + opts.jitter, gy * 17, seed) * 4 : 0;
      const score = centerDist + Math.min(dist[ei], 20) * 0.45 + crowd * 1.5 + rim * 0.3 + covered * 1.4 + jitter;
      if (best && score >= best.score) continue;
      if (!isValidLayout(size, seed, [...existing, { id: "__new__", x: rx, y: ry }])) continue;
      best = { x: rx, y: ry, score };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

/** Place a new area, growing the island if needed. Null when the island is at capacity. */
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
