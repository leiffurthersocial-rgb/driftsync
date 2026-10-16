/**
 * Building kit: isometric drawing helpers in footprint space.
 *
 * Coordinates: (u, v) are tile units inside a FOOTPRINT×FOOTPRINT area (0..3), z is height in px.
 * `u` runs down-right, `v` runs down-left. The sprite anchor is the footprint's back corner.
 */
import { FOOTPRINT } from "@/lib/island-layout";
import { PixelBuffer } from "../pixel-buffer";
import { shade } from "../color";
import { HALF_H, HALF_W } from "../iso";
import { WINDOW_GLOW } from "../palettes";

export const SW = 220;
export const SH = 320;
export const SAX = 110;
export const SAY = 210;

export type Fill = string | ((a: number, z: number, x: number, y: number) => string | null);

export class Kit {
  readonly base = new PixelBuffer(SW, SH);
  readonly glow = new PixelBuffer(SW, SH);
  constructor(readonly lit: boolean) {}

  /** Footprint point → sprite pixel. */
  p(u: number, v: number, z = 0): [number, number] {
    return [SAX + (u - v) * HALF_W, SAY + (u + v) * HALF_H - z];
  }

  /** Paint the ground (z=0) over a footprint rect with a per-tile function. */
  ground(u0: number, v0: number, u1: number, v1: number, fill: (u: number, v: number, x: number, y: number) => string | null) {
    const pts = [this.p(u0, v0), this.p(u1, v0), this.p(u1, v1), this.p(u0, v1)];
    this.base.poly(pts, (x, y) => {
      const a = (x + 0.5 - SAX) / HALF_W;
      const b = (y + 0.5 - SAY) / HALF_H;
      return fill((a + b) / 2, (b - a) / 2, x, y);
    });
  }

  /** Face facing +v (visible on the left), spanning u0..u1 at v, z0..z1. */
  faceL(v: number, u0: number, u1: number, z0: number, z1: number, fill: Fill, buf = this.base) {
    const pts = [this.p(u0, v, z0), this.p(u1, v, z0), this.p(u1, v, z1), this.p(u0, v, z1)];
    buf.poly(pts, typeof fill === "string" ? fill : (x, y) => {
      const u = (x + 0.5 - SAX) / HALF_W + v;
      const z = SAY + (u + v) * HALF_H - (y + 0.5);
      return fill(u, z, x, y);
    });
  }

  /** Face facing +u (visible on the right), spanning v0..v1 at u, z0..z1. */
  faceR(u: number, v0: number, v1: number, z0: number, z1: number, fill: Fill, buf = this.base) {
    const pts = [this.p(u, v0, z0), this.p(u, v1, z0), this.p(u, v1, z1), this.p(u, v0, z1)];
    buf.poly(pts, typeof fill === "string" ? fill : (x, y) => {
      const vv = u - (x + 0.5 - SAX) / HALF_W;
      const z = SAY + (u + vv) * HALF_H - (y + 0.5);
      return fill(vv, z, x, y);
    });
  }

  /** Horizontal quad at height z. */
  top(u0: number, v0: number, u1: number, v1: number, z: number, fill: string | ((x: number, y: number) => string | null)) {
    this.base.poly([this.p(u0, v0, z), this.p(u1, v0, z), this.p(u1, v1, z), this.p(u0, v1, z)], fill);
  }

  /** A solid box with textured walls. */
  box(u0: number, v0: number, u1: number, v1: number, h: number, o: { wall: Fill; wallR?: Fill; top?: string | null; z0?: number }) {
    const z0 = o.z0 ?? 0;
    this.faceL(v1, u0, u1, z0, z0 + h, o.wall);
    this.faceR(u1, v0, v1, z0, z0 + h, o.wallR ?? darken(o.wall, -0.17));
    if (o.top !== null) this.top(u0, v0, u1, v1, z0 + h, o.top ?? (typeof o.wall === "string" ? shade(o.wall, 0.12) : "#d8d0c4"));
  }

  line(a: [number, number, number], b: [number, number, number], color: string, width = 1, buf = this.base) {
    const [x0, y0] = this.p(a[0], a[1], a[2]);
    const [x1, y1] = this.p(b[0], b[1], b[2]);
    buf.line(x0, y0, x1, y1, color, width);
  }

  /** Vertical post from the ground to height h. */
  post(u: number, v: number, h: number, color: string, width = 2) {
    this.line([u, v, 0], [u, v, h], color, width);
  }

  /** Window on the left (+v) face with frame, glass, mullion and optional glow. */
  windowL(v: number, u: number, w: number, z: number, h: number, o: WinOpts = {}) {
    this.window("L", v, u, w, z, h, o);
  }
  windowR(u: number, v: number, w: number, z: number, h: number, o: WinOpts = {}) {
    this.window("R", u, v, w, z, h, o);
  }

  private window(side: "L" | "R", plane: number, a: number, w: number, z: number, h: number, o: WinOpts) {
    const frame = o.frame ?? "#fff8ee";
    const glass = o.glass ?? "#a9d6ee";
    const face = side === "L" ? this.faceL.bind(this) : this.faceR.bind(this);
    const fw = 2 / HALF_W; // frame thickness in tile units
    face(plane, a, a + w, z - 2, z + h + 2, frame);
    if (o.arch) face(plane, a + w * 0.15, a + w * 0.85, z + h, z + h + 6, frame);
    face(plane, a + fw, a + w - fw, z, z + h, (aa, zz) => {
      const rel = (aa - a) / w;
      if (o.mullion !== false && Math.abs(rel - 0.5) < 0.04) return frame;
      if (o.mullion !== false && Math.abs(zz - (z + h * 0.55)) < 1) return frame;
      if (o.curtain && rel < 0.22) return o.curtain;
      return zz > z + h - 3 && rel < 0.45 ? shade(glass, 0.35) : glass;
    });
    // Sill.
    face(plane, a - fw, a + w + fw, z - 4, z - 2, shade(frame, -0.18));
    if (this.lit && o.glow !== false) face(plane, a + fw, a + w - fw, z, z + h, (aa) => (Math.abs((aa - a) / w - 0.5) < 0.04 ? null : WINDOW_GLOW), this.glow);
  }

  /** Door on the left (+v) face. */
  doorL(v: number, u: number, w: number, h: number, o: { color?: string; frame?: string; glass?: boolean; double?: boolean; arch?: boolean } = {}) {
    const frame = o.frame ?? "#f4ead8";
    const col = o.color ?? "#7a4f3a";
    const fw = 2 / HALF_W;
    this.faceL(v, u - fw, u + w + fw, 0, h + 2, frame);
    if (o.arch) this.faceL(v, u + w * 0.2, u + w * 0.8, h + 2, h + 6, frame);
    this.faceL(v, u, u + w, 0, h, (a, z) => {
      const rel = (a - u) / w;
      if (o.double && Math.abs(rel - 0.5) < 0.05) return shade(col, -0.3);
      if (o.glass && z > h * 0.45 && z < h - 3 && Math.abs(rel - (o.double ? 0.25 : 0.5)) < 0.18) return "#a9d6ee";
      if (o.glass && o.double && z > h * 0.45 && z < h - 3 && Math.abs(rel - 0.75) < 0.18) return "#a9d6ee";
      return z < 3 ? shade(col, -0.2) : col;
    });
    // Knob.
    const [kx, ky] = this.p(u + w * (o.double ? 0.42 : 0.78), v, h * 0.45);
    this.base.setHex(Math.round(kx), Math.round(ky), "#f2d27a");
    if (this.lit) this.faceL(v, u + w * 0.3, u + w * 0.7, h * 0.45, h - 3, WINDOW_GLOW, this.glow);
    // Step / mat.
    this.ground(u - 0.08, v, u + w + 0.08, v + 0.18, () => shade(frame, -0.25));
  }

  /** Hip roof (pyramid when square) over a rect, eaves overhang `e` tiles. */
  hipRoof(u0: number, v0: number, u1: number, v1: number, z: number, rise: number, color: string, e = 0.12) {
    u0 -= e;
    v0 -= e;
    u1 += e;
    v1 += e;
    const du = u1 - u0;
    const dv = v1 - v0;
    const inset = Math.min(du, dv) / 2;
    const r0: [number, number, number] = [u0 + inset, v0 + inset, z + rise];
    const r1: [number, number, number] = [u1 - inset, v1 - inset, z + rise];
    const c = (u: number, v: number): [number, number, number] => [u, v, z];
    const tri = (pts: [number, number, number][], col: string) =>
      this.base.poly(pts.map((p) => this.p(...p)), (_x, y) => (y % 4 === 0 ? shade(col, -0.12) : col));
    // Back faces first.
    tri([c(u0, v0), c(u1, v0), r1, r0], shade(color, 0.08));
    tri([c(u0, v0), c(u0, v1), r1, r0], shade(color, 0.14));
    tri([c(u0, v1), c(u1, v1), r1, r0], color);
    tri([c(u1, v0), c(u1, v1), r1, r0], shade(color, -0.18));
    this.line(r0, r1, shade(color, -0.3), 2);
  }

  /** Gable roof with the ridge along u (gable end visible on the right face). */
  gableU(u0: number, v0: number, u1: number, v1: number, z: number, rise: number, color: string, gableWall: Fill, e = 0.14) {
    const vm = (v0 + v1) / 2;
    // Gable end wall (triangle) on the right.
    this.base.poly([this.p(u1, v0, z), this.p(u1, v1, z), this.p(u1, vm, z + rise)], typeof gableWall === "string" ? gableWall : shade("#d8d0c4", -0.1));
    const s = (pts: [number, number, number][], col: string) => this.base.poly(pts.map((p) => this.p(...p)), (_x, y) => (y % 4 === 0 ? shade(col, -0.12) : col));
    s([[u0 - e, v0 - e, z], [u1 + e, v0 - e, z], [u1 + e, vm, z + rise], [u0 - e, vm, z + rise]], shade(color, 0.1));
    s([[u0 - e, vm, z + rise], [u1 + e, vm, z + rise], [u1 + e, v1 + e, z - 2], [u0 - e, v1 + e, z - 2]], color);
    this.line([u0 - e, vm, z + rise], [u1 + e, vm, z + rise], shade(color, -0.32), 2);
  }

  /** Gable roof with the ridge along v (gable end visible on the left face). */
  gableV(u0: number, v0: number, u1: number, v1: number, z: number, rise: number, color: string, gableWall: string, e = 0.14) {
    const um = (u0 + u1) / 2;
    this.base.poly([this.p(u0, v1, z), this.p(u1, v1, z), this.p(um, v1, z + rise)], gableWall);
    const s = (pts: [number, number, number][], col: string) => this.base.poly(pts.map((p) => this.p(...p)), (_x, y) => (y % 4 === 0 ? shade(col, -0.12) : col));
    s([[u0 - e, v0 - e, z], [u0 - e, v1 + e, z], [um, v1 + e, z + rise], [um, v0 - e, z + rise]], shade(color, 0.12));
    s([[um, v0 - e, z + rise], [um, v1 + e, z + rise], [u1 + e, v1 + e, z - 2], [u1 + e, v0 - e, z - 2]], shade(color, -0.12));
    this.line([um, v0 - e, z + rise], [um, v1 + e, z + rise], shade(color, -0.32), 2);
  }

  /** Flat roof with a parapet. */
  flatRoof(u0: number, v0: number, u1: number, v1: number, z: number, color: string) {
    this.top(u0, v0, u1, v1, z, shade(color, 0.12));
    this.top(u0 + 0.08, v0 + 0.08, u1 - 0.08, v1 - 0.08, z, shade(color, -0.12));
  }

  /** Dome centered over (u, v) at height z. */
  dome(u: number, v: number, z: number, r: number, color: string) {
    const [cx, cy] = this.p(u, v, z);
    const rx = r * HALF_W * 1.4;
    const ry = rx * 0.75;
    this.base.ellipse(cx, cy, rx, ry, (x, y, nx, ny) => {
      if (ny > 0.35) return null;
      if (nx < -0.45 && ny < -0.2) return shade(color, 0.25);
      if (nx > 0.4) return shade(color, -0.2);
      return (Math.round(x - cx + 100) % 6 === 0 ? shade(color, -0.1) : color);
    });
    this.base.rect(Math.round(cx) - 1, Math.round(cy - ry) - 6, 2, 6, "#e9c95b");
  }

  /** Sign board standing on the ground or mounted (screen-aligned) with an icon matrix. */
  sign(x: number, y: number, icon: readonly string[], ink: string, accent: string, board = "#fff8ea") {
    const w = icon[0].length * 2 + 4;
    const h = icon.length * 2 + 4;
    this.base.rect(x - 1, y - 1, w + 2, h + 2, "#5a4334");
    this.base.rect(x, y, w, h, board);
    for (let r = 0; r < icon.length; r++)
      for (let c = 0; c < icon[r].length; c++) {
        const ch = icon[r][c];
        const col = ch === "k" ? ink : ch === "a" ? accent : ch === "w" ? "#ffffff" : null;
        if (col) this.base.rect(x + 2 + c * 2, y + 2 + r * 2, 2, 2, col);
      }
  }

  /** Small potted plant / shrub at a ground point. */
  shrub(u: number, v: number, size = 1, color = "#6fb35a", z = 0) {
    const [x, y] = this.p(u, v, z);
    this.base.ellipse(x, y - 4 * size, 5 * size, 4 * size, (_px, _py, nx, ny) => (nx + ny > 0.6 ? shade(color, -0.2) : ny < -0.4 ? shade(color, 0.2) : color));
  }

  pot(u: number, v: number, flower: string) {
    const [x, y] = this.p(u, v);
    this.base.rect(x - 3, y - 5, 6, 5, "#c0714f");
    this.base.rect(x - 3, y - 5, 6, 1, "#d98a68");
    this.base.ellipse(x, y - 8, 4, 3.5, "#6fb35a");
    this.base.rect(x - 1, y - 11, 2, 2, flower);
  }

  /** Bench along u at (u, v). */
  bench(u: number, v: number, len = 0.6, wood = "#c99a62") {
    this.line([u, v, 8], [u + len, v, 8], wood, 3);
    this.line([u, v - 0.1, 13], [u + len, v - 0.1, 13], shade(wood, -0.15), 2);
    for (const du of [0.05, len - 0.05]) this.line([u + du, v, 0], [u + du, v, 8], "#4b4458", 2);
  }

  lamp(u: number, v: number, h = 30) {
    this.post(u, v, h, "#4b4458", 2);
    const [x, y] = this.p(u, v, h);
    this.base.rect(x - 3, y - 5, 6, 6, "#4b4458");
    this.base.rect(x - 2, y - 4, 4, 4, "#ffe7a3");
    if (this.lit) this.glow.rect(x - 2, y - 4, 4, 4, WINDOW_GLOW);
  }

  fence(a: [number, number], b: [number, number], color = "#e8dcc4") {
    const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.3));
    for (let i = 0; i <= n; i++) {
      const u = a[0] + ((b[0] - a[0]) * i) / n;
      const v = a[1] + ((b[1] - a[1]) * i) / n;
      this.post(u, v, 10, color, 2);
    }
    this.line([a[0], a[1], 8], [b[0], b[1], 8], shade(color, -0.12), 1);
    this.line([a[0], a[1], 4], [b[0], b[1], 4], shade(color, -0.12), 1);
  }

  /** Small tree inside a design. */
  tree(u: number, v: number, color = "#77bb63", h = 26) {
    this.post(u, v, h * 0.45, "#8d6238", 3);
    const [x, y] = this.p(u, v, h * 0.55);
    this.base.ellipse(x, y - h * 0.25, h * 0.42, h * 0.38, (_px, _py, nx, ny) => (nx + ny > 0.55 ? shade(color, -0.22) : nx + ny < -0.7 ? shade(color, 0.2) : color));
  }
}

export interface WinOpts {
  frame?: string;
  glass?: string;
  mullion?: boolean;
  arch?: boolean;
  curtain?: string;
  glow?: boolean;
}

function darken(fill: Fill, amt: number): Fill {
  if (typeof fill === "string") return shade(fill, amt);
  return (a, z, x, y) => {
    const c = fill(a, z, x, y);
    return c ? shade(c, amt) : c;
  };
}

/* ---------- textures (face-local functions) ---------- */

export const brick = (base: string) => (a: number, z: number) => {
  const row = Math.floor(z / 4);
  const off = row % 2 ? 0.07 : 0;
  const col = Math.floor((a + off) / 0.14);
  if (Math.floor(z) % 4 === 0) return shade(base, 0.2);
  if (Math.abs((a + off) / 0.14 - Math.round((a + off) / 0.14)) < 0.06) return shade(base, 0.2);
  return (row * 7 + col * 3) % 5 === 0 ? shade(base, -0.06) : base;
};

export const planks = (base: string) => (_a: number, z: number) => (Math.floor(z) % 5 === 0 ? shade(base, -0.18) : Math.floor(z) % 5 === 1 ? shade(base, 0.08) : base);

export const vplanks = (base: string) => (a: number) => (Math.abs(a / 0.12 - Math.round(a / 0.12)) < 0.07 ? shade(base, -0.2) : base);

export const stone = (base: string) => (a: number, z: number) => {
  const row = Math.floor(z / 7);
  const off = row % 2 ? 0.11 : 0;
  if (Math.floor(z) % 7 === 0) return shade(base, -0.15);
  if (Math.abs((a + off) / 0.22 - Math.round((a + off) / 0.22)) < 0.04) return shade(base, -0.15);
  return base;
};

export const siding = (base: string) => (_a: number, z: number) => (Math.floor(z) % 3 === 0 ? shade(base, -0.1) : base);

export const glassWall = (frame: string) => (a: number, z: number) => {
  if (Math.floor(z) % 16 < 2) return frame;
  if (Math.abs(a / 0.25 - Math.round(a / 0.25)) < 0.05) return frame;
  return z % 16 > 12 && a % 0.25 < 0.1 ? "#d6eef8" : "#8ec5e0";
};

export const FP = FOOTPRINT;
