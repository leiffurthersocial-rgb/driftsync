import { hash01 } from "@/lib/random";
import type { Layout } from "@/lib/island-layout";
import { PixelBuffer } from "../pixel-buffer";
import { HALF_H, HALF_W, isoX, isoY, worldMetrics } from "../iso";
import { shade } from "../color";
import type { TerrainPalette } from "../palettes";

/** Depth (px) of the rock column under a tile: deep in the middle, shallow at the rim. */
function columnDepth(layout: Layout, x: number, y: number) {
  const c = layout.center;
  const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
  const r = c;
  const t = Math.max(0, 1 - d / r);
  const n = hash01(x - c + 911, y - c, layout.seed);
  return Math.round(12 + Math.pow(t, 0.8) * 108 + n * 10);
}

/**
 * Rasterize the static island: grass tops, paths, plaza and the floating rock underside.
 * Columns are painted back-to-front so the deep center column shows as a rocky cone below.
 */
export function renderTerrain(layout: Layout, pal: TerrainPalette): PixelBuffer {
  const { size, land, path, seed } = layout;
  const m = worldMetrics(size);
  const buf = new PixelBuffer(m.width, m.height);
  const plaza = new Set(layout.plaza.map(([x, y]) => y * size + x));

  const tiles: [number, number][] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (land[y * size + x]) tiles.push([x, y]);
  tiles.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[0] - b[0]);

  for (const [tx, ty] of tiles) {
    const sx = m.ox + isoX(tx, ty);
    const sy = m.oy + isoY(tx, ty);
    const depth = columnDepth(layout, tx, ty);
    const idx = ty * size + tx;
    const isPath = path[idx] === 1 && !plaza.has(idx);
    const isPlaza = plaza.has(idx);

    // Side faces (left = lit, right = shaded).
    for (let i = 0; i < HALF_W; i++) {
      const leftTop = sy + HALF_H + Math.floor(i / 2);
      const rightTop = sy + 2 * HALF_H - 1 - Math.floor(i / 2);
      for (let v = 1; v <= depth; v++) {
        buf.setHex(sx - HALF_W + i, leftTop + v, sideColor(pal, v, depth, i, tx, ty, seed, false));
        buf.setHex(sx + i, rightTop + v, sideColor(pal, v, depth, i, tx, ty, seed, true));
      }
    }

    // Top diamond.
    const n = hash01(tx * 7 - 3, ty * 13 + 1, seed);
    const base = isPlaza ? pal.plaza : isPath ? pal.path : n < 0.5 ? pal.grass : pal.grassDark;
    for (let r = 0; r < 2 * HALF_H; r++) {
      const hw = r < HALF_H ? (r + 1) * 2 : (2 * HALF_H - r) * 2;
      for (let dx = -hw; dx < hw; dx++) {
        const px = sx + dx;
        const py = sy + r;
        let col = base;
        const k = hash01(px, py, seed);
        if (isPlaza) {
          // Stone slabs: a diagonal grid inside the tile.
          const u = (dx / HALF_W + r / HALF_H) * 2;
          const w = (r / HALF_H - dx / HALF_W) * 2;
          if (Math.abs(u - Math.round(u)) < 0.09 || Math.abs(w - Math.round(w)) < 0.09) col = pal.plazaDark;
        } else if (isPath) {
          if (k < 0.07) col = pal.pathDark;
        } else if (k < 0.035) col = pal.grassLight;
        else if (k > 0.975) col = pal.grassDark;
        buf.setHex(px, py, col);
      }
    }
  }

  // A darker lip where grass meets the cliff on exposed edges.
  for (const [tx, ty] of tiles) {
    const sx = m.ox + isoX(tx, ty);
    const sy = m.oy + isoY(tx, ty);
    const openY = ty + 1 >= size || !land[(ty + 1) * size + tx];
    const openX = tx + 1 >= size || !land[ty * size + tx + 1];
    for (let i = 0; i < HALF_W; i++) {
      if (openY) buf.setHex(sx - HALF_W + i, sy + HALF_H + Math.floor(i / 2) + 1, pal.cliffTop);
      if (openX) buf.setHex(sx + i, sy + 2 * HALF_H - Math.floor(i / 2), shade(pal.cliffTop, -0.12));
    }
  }

  buf.outline(pal.outline);
  return buf;
}

function sideColor(
  pal: TerrainPalette,
  v: number,
  depth: number,
  i: number,
  tx: number,
  ty: number,
  seed: number,
  right: boolean,
) {
  const k = hash01(tx * 31 + i, ty * 17 + v, seed);
  let c: string;
  if (v <= 2) c = pal.cliffTop;
  else if (v <= 9 + Math.floor(k * 2)) c = k < 0.15 ? pal.dirtDark : pal.dirt;
  else {
    const band = Math.floor((v + hash01(tx, ty, seed) * 6) / 7) % 3;
    c = band === 0 ? pal.rock : band === 1 ? pal.rockDark : pal.rock;
    if (v > depth - 8) c = pal.rockDeep;
    if (k < 0.06) c = pal.rockDeep;
  }
  return right ? shade(c, -0.16) : c;
}
