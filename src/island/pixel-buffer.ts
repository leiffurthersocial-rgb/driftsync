import { pack, unpack, type RGB } from "./color";

type Pt = readonly [number, number];

/**
 * A tiny software raster for pixel art. Everything is hard-edged: polygons are filled by
 * testing pixel centers, so 2:1 isometric edges come out as clean stair-steps.
 */
export class PixelBuffer {
  readonly data: Uint32Array;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint32Array(width * height);
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x: number, y: number): number {
    return this.inside(x, y) ? this.data[y * this.width + x] : 0;
  }

  set(x: number, y: number, color: number) {
    x |= 0;
    y |= 0;
    if (this.inside(x, y)) this.data[y * this.width + x] = color;
  }

  setHex(x: number, y: number, hex: string) {
    this.set(x, y, pack(hex));
  }

  rect(x: number, y: number, w: number, h: number, hex: string) {
    const c = pack(hex);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  /** Fill a polygon (any winding) by pixel-center inclusion. */
  poly(points: Pt[], hex: string | ((x: number, y: number) => string | null)) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [x, y] of points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const solid = typeof hex === "string" ? pack(hex) : 0;
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
        if (!pointInPoly(x + 0.5, y + 0.5, points)) continue;
        if (typeof hex === "string") this.set(x, y, solid);
        else {
          const c = hex(x, y);
          if (c) this.setHex(x, y, c);
        }
      }
    }
  }

  /** Paint a palette-indexed matrix ("." = transparent). */
  matrix(rows: readonly string[], palette: Record<string, string>, ox: number, oy: number, flip = false) {
    const w = rows[0]?.length ?? 0;
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[flip ? w - 1 - x : x];
        const col = palette[ch];
        if (col) this.setHex(ox + x, oy + y, col);
      }
    }
  }

  /** Draw a dark outline around opaque pixels (outside edge only). */
  outline(hex: string) {
    const c = pack(hex);
    const { width: w, height: h, data } = this;
    const src = data.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (src[y * w + x] >>> 24) continue;
        const n =
          (x > 0 && src[y * w + x - 1] >>> 24) ||
          (x < w - 1 && src[y * w + x + 1] >>> 24) ||
          (y > 0 && src[(y - 1) * w + x] >>> 24) ||
          (y < h - 1 && src[(y + 1) * w + x] >>> 24);
        if (n) data[y * w + x] = c;
      }
  }

  /** Apply a per-pixel color transform to opaque pixels. */
  map(fn: (rgb: RGB, x: number, y: number) => RGB) {
    const { width: w, data } = this;
    for (let i = 0; i < data.length; i++) {
      const c = data[i];
      const a = c >>> 24;
      if (!a) continue;
      const { r, g, b } = unpack(c);
      const [nr, ng, nb] = fn([r, g, b], i % w, (i / w) | 0);
      const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
      data[i] = ((a << 24) | (cl(nb) << 16) | (cl(ng) << 8) | cl(nr)) >>> 0;
    }
  }

  alphaAt(x: number, y: number) {
    return this.get(x | 0, y | 0) >>> 24;
  }

  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(this.width, this.height);
    new Uint32Array(img.data.buffer).set(this.data);
    ctx.putImageData(img, 0, 0);
    return canvas;
  }
}

function pointInPoly(x: number, y: number, pts: Pt[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A rasterized sprite: canvas plus the buffer for alpha hit-testing and an anchor point. */
export interface Sprite {
  canvas: HTMLCanvasElement;
  buffer: PixelBuffer;
  /** Pixel in the sprite that sits on the world anchor (e.g. a tile's top vertex). */
  ax: number;
  ay: number;
}

export function toSprite(buffer: PixelBuffer, ax: number, ay: number): Sprite {
  return { canvas: buffer.toCanvas(), buffer, ax, ay };
}
