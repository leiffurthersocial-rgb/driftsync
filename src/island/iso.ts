/** 2:1 isometric projection. A tile is 32x16 pixels; (0,0) maps to the top vertex of tile (0,0). */
export const TILE_W = 32;
export const TILE_H = 16;
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
  const pad = 24;
  const top = 76; // headroom for buildings and trees on the back row
  // The deepest rock column hangs under the center tile (~150px below the top surface).
  const bottom = Math.max(36, 150 - size * HALF_H + 16);
  return {
    width: size * TILE_W + pad * 2,
    height: size * TILE_H + top + bottom,
    /** World pixel of grid origin (top vertex of tile 0,0). */
    ox: size * HALF_W + pad,
    oy: top,
  };
}
