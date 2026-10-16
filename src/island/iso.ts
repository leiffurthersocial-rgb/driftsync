/** 2:1 isometric projection. A tile is 64x32 pixels; (0,0) maps to the top vertex of tile (0,0). */
export const TILE_W = 64;
export const TILE_H = 32;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;

export const isoX = (x: number, y: number) => (x - y) * HALF_W;
export const isoY = (x: number, y: number) => (x + y) * HALF_H;

/** Inverse projection: world pixel → fractional tile coords. */
export function screenToTile(sx: number, sy: number) {
  const a = sx / HALF_W;
  const b = sy / HALF_H;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** World canvas metrics for an island of `size` tiles. */
export function worldMetrics(size: number) {
  const pad = 48;
  const top = 200; // headroom for tall buildings and trees on the back row
  // Floating rock underside: the cone tip hangs ~CONE_SLOPE px per tile of radius below center.
  const bottom = Math.max(140, Math.round((size / 2) * 28 * 1.15 + 130 - size * HALF_H));
  return {
    width: size * TILE_W + pad * 2,
    height: size * TILE_H + top + bottom,
    /** World pixel of grid origin (top vertex of tile 0,0). */
    ox: size * HALF_W + pad,
    oy: top,
  };
}

/** Painter's-order key for an area whose back corner tile is (gx, gy). Shared with actors. */
export const areaDepth = (gx: number, gy: number, footprint = 3) => gx + gy + 2 * footprint - 1.75;
