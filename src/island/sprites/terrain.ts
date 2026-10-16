import type { Layout } from "@/lib/island-layout";
import { hash01 } from "@/lib/random";
import { PixelBuffer } from "../pixel-buffer";
import { HALF_H, HALF_W, isoX, isoY, worldMetrics } from "../iso";
import { pack, shade } from "../color";
import type { TerrainPalette } from "../palettes";

/** Fast integer hash → 0..1 (no allocations; used per pixel). */
function h2(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Depth (px) of the rock column under a tile: deep in the middle, shallow at the rim. */
export function columnDepth(layout: Layout, x: number, y: number) {
  const c = layout.center;
  const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
  // A steep cone (> 16px per tile) so every ring of the underside steps out below the one in
  // front of it — that is what makes the island read as floating.
  const lumpy = 0.85 + 0.3 * hash01(Math.floor((x - c) / 3), Math.floor((y - c) / 3), layout.seed + 17);
  const n = hash01(x - c + 911, y - c, layout.seed);
  return Math.round(24 + Math.max(0, c - d) * CONE_SLOPE * lumpy + n * 10);
}

export const CONE_SLOPE = 28;

/**
 * Rasterize the static island: textured grass, paths, trail, plaza, pond and the rocky underside.
 * Columns are painted back-to-front; each side face only draws the part not hidden by the
 * neighbouring column in front.
 */
export function renderTerrain(layout: Layout, pal: TerrainPalette): PixelBuffer {
  const { size, land, path, trail, water, seed } = layout;
  const m = worldMetrics(size);
  const buf = new PixelBuffer(m.width, m.height);
  const W = buf.width;
  const data = buf.data;
  const plaza = new Set(layout.plaza.map(([x, y]) => y * size + x));
  for (const [x, y] of layout.fountain) plaza.add(y * size + x);

  const P = (hex: string) => pack(hex);
  const grass = [P(pal.grass), P(pal.grassDark), P(pal.grassLight), P(shade(pal.grass, -0.06))];
  const pathC = [P(pal.path), P(pal.pathDark), P(shade(pal.path, 0.08))];
  const trailC = [P("#c9a57a"), P("#b38f66"), P("#d6b68c")];
  const plazaC = [P(pal.plaza), P(pal.plazaDark), P(shade(pal.plaza, 0.06))];
  const waterC = [P("#6fb8de"), P("#8fd0ee"), P("#5aa6d0"), P("#c8ecfb")];
  const sideL = {
    lip: P(pal.cliffTop),
    dirt: P(pal.dirt),
    dirtD: P(pal.dirtDark),
    rock: P(pal.rock),
    rockD: P(pal.rockDark),
    deep: P(pal.rockDeep),
    moss: P("#7cae5c"),
    root: P("#7a5038"),
  };
  const darker = (o: typeof sideL) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, darkenPacked(v, 0.84)])) as typeof sideL;
  const sideR = darker(sideL);

  const tiles: [number, number][] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (land[y * size + x]) tiles.push([x, y]);
  tiles.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[0] - b[0]);

  const depthOf = (x: number, y: number) => (x >= 0 && y >= 0 && x < size && y < size && land[y * size + x] ? columnDepth(layout, x, y) : -1);
  const set = (x: number, y: number, c: number) => {
    if (x >= 0 && y >= 0 && x < W && y < buf.height) data[y * W + x] = c;
  };

  // Pre-shaded rock ramps (lighter at the top, ambient-occluded towards the cone tip).
  const ramp = (hex: string) => Array.from({ length: 6 }, (_, k) => P(shade(hex, -k * 0.09)));
  const rampsL = { rock: ramp(pal.rock), rockD: ramp(pal.rockDark), deep: ramp(pal.rockDeep) };
  const rampsR = {
    rock: rampsL.rock.map((c) => darkenPacked(c, 0.84)),
    rockD: rampsL.rockD.map((c) => darkenPacked(c, 0.84)),
    deep: rampsL.deep.map((c) => darkenPacked(c, 0.84)),
  };

  const sideColor = (s: typeof sideL, v: number, depth: number, i: number, tx: number, ty: number) => {
    const k = h2(tx * 31 + i, ty * 17 + v, seed);
    if (v <= 3) return s.lip;
    if (v <= 5 && k < 0.5) return s.moss;
    if (v <= 16 + Math.floor(k * 3)) return k < 0.15 ? s.dirtD : s.dirt;
    const R = s === sideL ? rampsL : rampsR;
    // Absolute height below the grass drives the shading so strata line up across columns.
    const level = Math.min(5, Math.floor((v / Math.max(60, layout.center * CONE_SLOPE)) * 6));
    if (v > depth - 6 || k < 0.04) return R.deep[level];
    const band = Math.floor((v + h2(tx, ty, seed) * 9) / 9) % 3;
    return band === 1 ? R.rockD[level] : R.rock[level];
  };

  for (const [tx, ty] of tiles) {
    const sx = m.ox + isoX(tx, ty);
    const sy = m.oy + isoY(tx, ty);
    const depth = columnDepth(layout, tx, ty);
    const dFrontL = depthOf(tx, ty + 1);
    const dFrontR = depthOf(tx + 1, ty);

    // Left face (lit), only the part below the front-left neighbour's coverage.
    for (let i = 0; i < HALF_W; i++) {
      const top = sy + HALF_H + Math.floor(i / 2);
      const start = dFrontL < 0 ? 1 : Math.max(1, 2 * HALF_H - 2 * Math.floor(i / 2) + dFrontL);
      for (let v = start; v <= depth; v++) set(sx - HALF_W + i, top + v, sideColor(sideL, v, depth, i, tx, ty));
    }
    // Right face (shaded).
    for (let j = 0; j < HALF_W; j++) {
      const top = sy + 2 * HALF_H - 1 - Math.floor(j / 2);
      const start = dFrontR < 0 ? 1 : Math.max(1, 2 + 2 * Math.floor(j / 2) + dFrontR);
      for (let v = start; v <= depth; v++) set(sx + j, top + v, sideColor(sideR, v, depth, j, tx, ty));
    }
    // Jagged drips under the column bottom (most get covered by columns in front).
    for (let i = 0; i < 2 * HALF_W; i += 4) {
      const kk = h2(tx * 13 + i, ty * 7, seed + 3);
      if (kk > 0.55) continue;
      const left = i < HALF_W;
      const col = left ? sx - HALF_W + i : sx + i - HALF_W;
      const top = left ? sy + HALF_H + Math.floor(i / 2) + depth : sy + 2 * HALF_H - 1 - Math.floor((i - HALF_W) / 2) + depth;
      const len = 2 + Math.floor(kk * 8);
      const c = left ? sideL.deep : sideR.deep;
      for (let k = 1; k <= len; k++) {
        const wdt = Math.max(1, Math.round((3 * (len - k)) / len));
        for (let w = 0; w < wdt; w++) set(col + w, top + k, c);
      }
    }
    // Hanging roots on exposed edges.
    if (dFrontL < 0 || dFrontR < 0) {
      for (let r = 0; r < 3; r++) {
        if (h2(tx * 3 + r, ty, seed + 5) > 0.45) continue;
        const i = Math.floor(h2(tx, ty * 7 + r, seed) * HALF_W);
        const rx = dFrontL < 0 ? sx - HALF_W + i : sx + i;
        const ry = dFrontL < 0 ? sy + HALF_H + Math.floor(i / 2) + depth : sy + 2 * HALF_H - Math.floor(i / 2) + depth;
        const len = 6 + Math.floor(h2(tx + r, ty, seed + 9) * 16);
        for (let k = 0; k < len; k++) set(rx + (k > len / 2 ? 1 : 0), ry + k, k % 5 === 4 ? sideL.moss : sideL.root);
      }
    }

    // Top diamond.
    const idx = ty * size + tx;
    const isPlaza = plaza.has(idx);
    const isWater = water[idx] === 1;
    const isPath = !isPlaza && path[idx] === 1;
    const isTrail = !isPlaza && !isPath && trail[idx] === 1;
    const tileTone = h2(tx, ty, seed) < 0.5 ? 0 : 3;
    for (let r = 0; r < 2 * HALF_H; r++) {
      const hw = r < HALF_H ? (r + 1) * 2 : (2 * HALF_H - r) * 2;
      for (let dx = -hw; dx < hw; dx++) {
        const px = sx + dx;
        const py = sy + r;
        const k = h2(px, py, seed);
        // Tile-local coordinates (0..1) for patterns.
        const u = (dx / HALF_W + r / HALF_H) / 2;
        const w = (r / HALF_H - dx / HALF_W) / 2;
        let c: number;
        if (isWater) {
          const edge = Math.min(u, w, 1 - u, 1 - w) < 0.06 && !neighborIs(water, size, tx, ty, u, w);
          c = edge ? waterC[2] : (py + Math.floor(px / 6)) % 9 === 0 ? waterC[1] : waterC[0];
          if (k < 0.004) c = waterC[3];
        } else if (isPlaza) {
          const gu = u * 2;
          const gw = w * 2;
          const seam = Math.abs(gu - Math.round(gu)) < 0.05 || Math.abs(gw - Math.round(gw)) < 0.05;
          c = seam ? plazaC[1] : k < 0.04 ? plazaC[2] : plazaC[0];
        } else if (isPath || isTrail) {
          const C = isPath ? pathC : trailC;
          // Soft edges into grass where the neighbour isn't path.
          const edge = Math.min(u, w, 1 - u, 1 - w) < 0.1 && !neighborIs(isPath ? path : trail, size, tx, ty, u, w);
          if (edge && k < 0.55) c = grass[tileTone];
          else c = k < 0.06 ? C[1] : k > 0.97 ? C[2] : C[0];
        } else {
          c = grass[tileTone];
          if (k < 0.03) c = grass[2];
          else if (k > 0.975) c = grass[1];
          else if ((px + py * 3) % 11 === 0 && k < 0.3) c = grass[1];
        }
        set(px, py, c);
      }
    }
  }

  // Lip where grass meets an exposed cliff.
  const lipL = P(pal.cliffTop);
  const lipR = darkenPacked(lipL, 0.86);
  for (const [tx, ty] of tiles) {
    const sx = m.ox + isoX(tx, ty);
    const sy = m.oy + isoY(tx, ty);
    const openY = ty + 1 >= size || !land[(ty + 1) * size + tx];
    const openX = tx + 1 >= size || !land[ty * size + tx + 1];
    for (let i = 0; i < HALF_W; i++) {
      if (openY) set(sx - HALF_W + i, sy + HALF_H + Math.floor(i / 2), lipL);
      if (openX) set(sx + i, sy + 2 * HALF_H - 1 - Math.floor(i / 2), lipR);
    }
  }

  buf.outline(pal.outline);
  return buf;
}

/** Is the neighbouring tile in the direction of the nearest edge also in `mask`? */
function neighborIs(mask: Uint8Array, size: number, tx: number, ty: number, u: number, w: number) {
  const m = Math.min(u, w, 1 - u, 1 - w);
  let nx = tx;
  let ny = ty;
  if (m === u) nx--;
  else if (m === 1 - u) nx++;
  else if (m === w) ny--;
  else ny++;
  return nx >= 0 && ny >= 0 && nx < size && ny < size && mask[ny * size + nx] === 1;
}

function darkenPacked(c: number, f: number) {
  const r = Math.round((c & 255) * f);
  const g = Math.round(((c >>> 8) & 255) * f);
  const b = Math.round(((c >>> 16) & 255) * f);
  return ((c & 0xff000000) | (b << 16) | (g << 8) | r) >>> 0;
}
