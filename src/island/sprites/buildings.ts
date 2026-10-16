import type { AreaType } from "@/data/schema";
import { PixelBuffer, toSprite, type Sprite } from "../pixel-buffer";
import { desaturate, hexToRgb, mix, shade } from "../color";
import { ICONS, type IconName } from "./icons";
import { WINDOW_GLOW } from "../palettes";

export type RoofType = "flat" | "pyramid" | "gable";
export type WindowStyle = "square" | "tall" | "wide" | "round";
export type { Vitality } from "@/lib/feedback";
import type { Vitality } from "@/lib/feedback";

/** Everything that defines how a building looks. Tweak these to restyle an area type. */
export interface BuildingStyle {
  wall: string;
  roof: string;
  trim: string;
  roofType: RoofType;
  height: number;
  windows: WindowStyle;
  icon: IconName;
  extra?: "chimney" | "awning" | "tower" | "tripod" | "crates" | "easel" | "rack";
}

/** Three style variants per area type. Variant 0 is the default. */
export const BUILDING_STYLES: Record<Exclude<AreaType, "track">, BuildingStyle[]> = {
  gym: [
    { wall: "#e8836b", roof: "#5b5470", trim: "#fff3e6", roofType: "flat", height: 22, windows: "wide", icon: "dumbbell", extra: "awning" },
    { wall: "#d9d2c5", roof: "#e8836b", trim: "#5b5470", roofType: "gable", height: 22, windows: "wide", icon: "dumbbell", extra: "rack" },
    { wall: "#7fa7c9", roof: "#3f4a6b", trim: "#f6f1e9", roofType: "flat", height: 26, windows: "square", icon: "dumbbell", extra: "awning" },
  ],
  study: [
    { wall: "#f1e4c6", roof: "#4f9cc4", trim: "#ffffff", roofType: "gable", height: 24, windows: "square", icon: "pencil", extra: "tower" },
    { wall: "#e6b7a0", roof: "#6a5a8c", trim: "#fff6ea", roofType: "pyramid", height: 26, windows: "tall", icon: "pencil" },
    { wall: "#cfe0ea", roof: "#d9774f", trim: "#ffffff", roofType: "gable", height: 22, windows: "square", icon: "pencil", extra: "tower" },
  ],
  library: [
    { wall: "#b9c7a5", roof: "#a0634a", trim: "#f7f0de", roofType: "pyramid", height: 28, windows: "tall", icon: "book" },
    { wall: "#e9dcc0", roof: "#3f6b5a", trim: "#ffffff", roofType: "gable", height: 26, windows: "tall", icon: "book" },
    { wall: "#a7a0c4", roof: "#4d3f6e", trim: "#f1ecff", roofType: "pyramid", height: 30, windows: "round", icon: "book" },
  ],
  photo: [
    { wall: "#f4d5d9", roof: "#6e5ee6", trim: "#ffffff", roofType: "flat", height: 20, windows: "round", icon: "camera", extra: "tripod" },
    { wall: "#2f2b3d", roof: "#d77fb4", trim: "#f4d5d9", roofType: "flat", height: 22, windows: "wide", icon: "camera", extra: "tripod" },
    { wall: "#fbe6c4", roof: "#4fb3b0", trim: "#ffffff", roofType: "gable", height: 20, windows: "round", icon: "camera", extra: "tripod" },
  ],
  workshop: [
    { wall: "#c4935f", roof: "#5d4a5e", trim: "#f0d9b5", roofType: "gable", height: 22, windows: "square", icon: "wrench", extra: "chimney" },
    { wall: "#8d9aa8", roof: "#c4935f", trim: "#eef2f5", roofType: "flat", height: 24, windows: "wide", icon: "wrench", extra: "crates" },
    { wall: "#9fb38a", roof: "#7a4f3a", trim: "#f4ecd8", roofType: "gable", height: 22, windows: "square", icon: "wrench", extra: "chimney" },
  ],
  hobby: [
    { wall: "#cdbdf0", roof: "#e28aa8", trim: "#ffffff", roofType: "pyramid", height: 22, windows: "round", icon: "star", extra: "easel" },
    { wall: "#ffd9a8", roof: "#5fae84", trim: "#ffffff", roofType: "gable", height: 22, windows: "square", icon: "star", extra: "easel" },
    { wall: "#a8dcd9", roof: "#e7795f", trim: "#ffffff", roofType: "pyramid", height: 24, windows: "round", icon: "star", extra: "easel" },
  ],
};

export const TRACK_COLORS = ["#e2775a", "#5b8fd6", "#5fae84"];

/** Accent color of an area (sign ink, UI chips): user color, else the style's roof. */
export function areaAccent(type: AreaType, variant: number, color: string | null): string {
  if (color) return color;
  if (type === "track") return TRACK_COLORS[variant % 3];
  return BUILDING_STYLES[type][variant % 3].roof;
}

const W = 76;
const H = 136;
const AX = 38;
const AY = H - 36;
const INSET = 3;

export interface BuildingSprites {
  base: Sprite;
  glow: Sprite;
}

/** Rasterize one building (or the track decal). Cached by the caller. */
export function renderBuilding(type: AreaType, variant: number, color: string | null, vitality: Vitality, outline: string): BuildingSprites {
  if (type === "track") return renderTrack(variant, color, vitality, outline);
  const style = { ...BUILDING_STYLES[type][variant % 3] };
  if (color) style.roof = color;

  const buf = new PixelBuffer(W, H);
  const glow = new PixelBuffer(W, H);
  const h = style.height;

  // Footprint corners (relative to the anchor), inset so walls sit inside the tiles.
  const B: P = [0, INSET];
  const R: P = [32 - INSET * 2, 16];
  const F: P = [0, 32 - INSET];
  const L: P = [-(32 - INSET * 2), 16];
  const up = (p: P, dy: number): P => [p[0], p[1] - dy];
  const at = (p: P): P => [AX + p[0], AY + p[1]];
  const poly = (pts: P[], c: string | ((x: number, y: number) => string | null)) => buf.poly(pts.map(at), c);

  const wallL = style.wall;
  const wallR = shade(style.wall, -0.18);

  // Walls with a darker foundation strip.
  poly([L, F, up(F, h), up(L, h)], (x, y) => (y >= faceBottom("left", x) - 2 ? shade(wallL, -0.22) : wallL));
  poly([F, R, up(R, h), up(F, h)], (x, y) => (y >= faceBottom("right", x) - 2 ? shade(wallR, -0.2) : wallR));
  // Corner trim.
  for (let v = 0; v < h; v++) buf.setHex(AX, AY + F[1] - v - 1, shade(style.trim, -0.05));

  // Windows.
  const glass = "#bfe3f2";
  const winRow = (face: "left" | "right", us: number[], v: number) => {
    for (const u of us) drawWindow(buf, glow, face, u, v, style.windows, style.trim, glass, vitality);
  };
  winRow("left", [4], 9);
  winRow("right", [5, 15], 9);
  if (h >= 26) winRow("right", [5, 15], 19);

  // Door on the left face, near the front corner (lines up with the entrance tile).
  drawDoor(buf, glow, style, vitality);

  // Roof.
  const roofTop = (pts: P[]) => pts.map((p) => up(p, h));
  if (style.roofType === "flat") {
    poly(roofTop([B, R, F, L]), style.roof);
    poly(roofTop([[0, INSET + 3], [R[0] - 6, 16], [0, F[1] - 3], [L[0] + 6, 16]] as P[]), shade(style.roof, -0.18));
  } else {
    const e = 4;
    const Be: P = [0, B[1] - e / 2];
    const Re: P = [R[0] + e, R[1]];
    const Fe: P = [0, F[1] + e / 2];
    const Le: P = [L[0] - e, L[1]];
    const rh = style.roofType === "pyramid" ? 18 : 16;
    const stripes = (base: string) => (_x: number, y: number) => ((y + 1) % 4 === 0 ? shade(base, -0.12) : base);
    if (style.roofType === "pyramid") {
      const A: P = [0, 16 - rh];
      poly(roofTop([Be, Le, A]), stripes(shade(style.roof, 0.12)));
      poly(roofTop([Be, Re, A]), stripes(style.roof));
      poly(roofTop([Le, Fe, A]), stripes(style.roof));
      poly(roofTop([Fe, Re, A]), stripes(shade(style.roof, -0.2)));
    } else {
      // Gable: ridge runs along +x; gable end faces the right.
      const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const M1 = up(mid(Le, Be), rh);
      const M2 = up(mid(Fe, Re), rh);
      const G = up(mid(F, R), rh);
      poly(roofTop([F, R, G]), wallR);
      drawWindow(buf, glow, "right", 11, h + 3, "square", style.trim, glass, vitality, true);
      poly(roofTop([Be, Re, M2, M1]), stripes(shade(style.roof, 0.1)));
      poly(roofTop([Le, Fe, M2, M1]), stripes(style.roof));
    }
  }

  drawExtra(buf, glow, style, h, vitality);
  drawSign(buf, style, h);

  if (vitality === "lived") drawFlowers(buf, style);
  buf.outline(outline);
  if (vitality === "dusty") dustify(buf);

  return { base: toSprite(buf, AX, AY), glow: toSprite(glow, AX, AY) };
}

type P = [number, number];

/** Bottom wall pixel row (absolute y) at absolute column x for a face. */
function faceBottom(face: "left" | "right", x: number) {
  const rx = x - AX;
  if (face === "left") return AY + 16 + Math.floor((rx + 26) / 2);
  return AY + 29 - Math.floor((rx + 1) / 2);
}

/** Paint a w×h rectangle on a wall face at distance u along it and height v above the ground. */
function faceRect(buf: PixelBuffer, face: "left" | "right", u: number, v: number, w: number, h: number, color: (c: number, r: number) => string | null) {
  const x0 = face === "left" ? AX - 26 + u : AX + u;
  for (let c = 0; c < w; c++) {
    const x = x0 + c;
    const yb = faceBottom(face, x) - 1;
    for (let r = 0; r < h; r++) {
      const col = color(c, r);
      if (col) buf.setHex(x, yb - v - r, col);
    }
  }
}

function drawWindow(
  buf: PixelBuffer,
  glow: PixelBuffer,
  face: "left" | "right",
  u: number,
  v: number,
  style: WindowStyle,
  trim: string,
  glass: string,
  vitality: Vitality,
  small = false,
) {
  const [w, h] = small ? [4, 4] : style === "tall" ? [5, 9] : style === "wide" ? [8, 5] : style === "round" ? [5, 5] : [5, 6];
  const lit = vitality === "lived" || (vitality === "neutral" && (u + v) % 3 !== 0);
  const g = vitality === "dusty" ? "#9aa0a8" : glass;
  const pick = (c: number, r: number) => {
    const edge = c === 0 || r === 0 || c === w - 1 || r === h - 1;
    if (style === "round" && (c === 0 || c === w - 1) && (r === 0 || r === h - 1)) return null;
    if (style === "tall" && r === h - 1 && (c === 0 || c === w - 1)) return null;
    if (edge) return trim;
    if (c === 1 && r === h - 2) return shade(g, 0.5);
    return g;
  };
  faceRect(buf, face, u, v, w, h, pick);
  if (lit)
    faceRect(glow, face, u, v, w, h, (c, r) => {
      const edge = c === 0 || r === 0 || c === w - 1 || r === h - 1;
      return edge ? null : WINDOW_GLOW;
    });
}

function drawDoor(buf: PixelBuffer, glow: PixelBuffer, style: BuildingStyle, vitality: Vitality) {
  const door = shade(style.wall, -0.45);
  faceRect(buf, "left", 16, 0, 7, 12, (c, r) => {
    if (r === 11 || c === 0 || c === 6) return style.trim;
    if (c === 4 && r === 5) return "#f2d27a";
    return door;
  });
  if (vitality !== "dusty") faceRect(glow, "left", 18, 1, 3, 9, () => (vitality === "lived" ? WINDOW_GLOW : null));
  // Step.
  faceRect(buf, "left", 15, -1, 9, 1, () => shade(style.trim, -0.15));
}

function drawSign(buf: PixelBuffer, style: BuildingStyle, h: number) {
  const icon = ICONS[style.icon];
  const ox = AX + 14;
  const oy = AY + 16 - h - (style.roofType === "flat" ? 9 : -1);
  const board = "#fff8ea";
  const frame = "#6b4f3f";
  if (style.roofType === "flat") {
    // Rooftop billboard on two posts.
    buf.rect(ox + 1, oy + 9, 1, 4, frame);
    buf.rect(ox + 7, oy + 9, 1, 4, frame);
  }
  buf.rect(ox - 1, oy - 1, 11, 11, frame);
  buf.rect(ox, oy, 9, 9, board);
  const ink = shade(style.roof, -0.35);
  buf.matrix(icon, { k: ink, a: style.roof, w: "#ffffff" }, ox + 1, oy + 1);
}

function drawExtra(buf: PixelBuffer, glow: PixelBuffer, style: BuildingStyle, h: number, vitality: Vitality) {
  const dark = "#4b4458";
  switch (style.extra) {
    case "chimney": {
      const x = AX - 14;
      const y = AY + 4 - h - 10;
      buf.rect(x, y, 5, 10, shade(style.wall, -0.35));
      buf.rect(x - 1, y - 1, 7, 2, shade(style.wall, -0.5));
      break;
    }
    case "tower": {
      const x = AX - 4;
      const y = AY + 16 - h - 30;
      buf.rect(x, y + 6, 8, 10, style.trim);
      buf.rect(x + 2, y + 9, 4, 4, "#f2d27a");
      buf.poly([[x - 2, y + 6], [x + 4, y - 2], [x + 10, y + 6]], style.roof);
      break;
    }
    case "awning": {
      faceRect(buf, "right", 3, 15, 22, 3, (c, r) => ((c >> 1) % 2 === 0 ? style.roof : r === 0 ? "#ffffff" : "#f6efe6"));
      break;
    }
    case "tripod": {
      const x = AX + 20;
      const y = AY + 30;
      buf.rect(x, y - 10, 5, 4, dark);
      buf.setHex(x + 2, y - 9, "#9fd3f0");
      buf.rect(x + 2, y - 6, 1, 5, dark);
      buf.setHex(x + 1, y - 2, dark);
      buf.setHex(x, y - 1, dark);
      buf.setHex(x + 3, y - 2, dark);
      buf.setHex(x + 4, y - 1, dark);
      break;
    }
    case "crates": {
      const x = AX + 18;
      const y = AY + 22;
      buf.rect(x, y, 7, 6, "#b9864f");
      buf.rect(x + 1, y + 1, 5, 1, "#8d6238");
      buf.rect(x + 3, y - 5, 6, 5, "#c99a62");
      break;
    }
    case "easel": {
      const x = AX + 20;
      const y = AY + 18;
      buf.rect(x, y, 7, 6, "#ffffff");
      buf.rect(x + 1, y + 1, 2, 2, "#e7795f");
      buf.rect(x + 3, y + 2, 3, 2, "#4f9cc4");
      buf.rect(x + 1, y + 6, 1, 6, "#8d6238");
      buf.rect(x + 5, y + 6, 1, 6, "#8d6238");
      break;
    }
    case "rack": {
      const x = AX + 18;
      const y = AY + 22;
      buf.rect(x, y, 9, 1, dark);
      buf.rect(x, y, 1, 6, dark);
      buf.rect(x + 8, y, 1, 6, dark);
      buf.rect(x + 2, y - 1, 2, 3, "#6b6478");
      buf.rect(x + 5, y - 1, 2, 3, "#6b6478");
      break;
    }
  }
  void glow;
  void vitality;
}

const FLOWER_COLORS = ["#ff8fab", "#ffd166", "#ffffff", "#b49cff"];

function drawFlowers(buf: PixelBuffer, style: BuildingStyle) {
  // Little flower bed hugging the left wall plus a potted plant by the door.
  const spots: [number, number][] = [
    [AX - 22, AY + 22],
    [AX - 17, AY + 25],
    [AX - 12, AY + 27],
    [AX + 4, AY + 31],
  ];
  spots.forEach(([x, y], i) => {
    buf.setHex(x, y + 1, "#5f9e4c");
    buf.setHex(x + 1, y + 1, "#5f9e4c");
    buf.setHex(x, y, FLOWER_COLORS[i % 4]);
    buf.setHex(x + 1, y - 1, FLOWER_COLORS[(i + 1) % 4]);
  });
  buf.rect(AX + 6, AY + 26, 3, 3, "#c0714f");
  buf.rect(AX + 5, AY + 23, 5, 3, "#6fb35a");
  void style;
}

/** Quietly neglected: desaturated, a little darker, with a cobweb and dust specks. */
function dustify(buf: PixelBuffer) {
  const grey = hexToRgb("#8f8a99");
  buf.map(([r, g, b]) => {
    const d = hexToRgb(desaturate(`#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`, 0.45));
    return [d[0] * 0.88 + grey[0] * 0.04, d[1] * 0.88 + grey[1] * 0.04, d[2] * 0.88 + grey[2] * 0.04];
  });
  const web = "#e9e6ef";
  const cx = AX - 24;
  const cy = AY - 2;
  for (let i = 0; i < 5; i++) buf.setHex(cx + i, cy + Math.floor(i / 2) - i, web);
  buf.setHex(cx + 1, cy - 2, web);
  buf.setHex(cx + 2, cy - 1, web);
  const dust = mix("#b8a99a", "#8f8a99", 0.5);
  for (const [x, y] of [
    [AX - 8, AY + 30],
    [AX + 10, AY + 29],
    [AX - 20, AY + 26],
  ])
    buf.setHex(x, y, dust);
}

function renderTrack(variant: number, color: string | null, vitality: Vitality, outline: string): BuildingSprites {
  const buf = new PixelBuffer(W, H);
  const glow = new PixelBuffer(W, H);
  const surface = color ?? TRACK_COLORS[variant % 3];
  const infield = "#a8dc8e";
  for (let y = AY - 2; y < AY + 34; y++) {
    for (let x = AX - 34; x < AX + 34; x++) {
      const px = x - AX + 0.5;
      const py = y - AY + 0.5;
      // Inverse iso projection into footprint units (0..2 on each axis).
      const u = (px / 16 + py / 8) / 2;
      const v = (py / 8 - px / 16) / 2;
      const d = Math.hypot((u - 1) / 0.9, (v - 1) / 0.9);
      if (d > 1) continue;
      let c: string;
      if (d > 0.58) {
        c = surface;
        if (Math.abs(d - 0.79) < 0.035 && Math.floor((Math.atan2(v - 1, u - 1) + 4) * 6) % 2 === 0) c = "#fff6ec";
        if (d > 0.95) c = shade(surface, -0.2);
      } else c = d > 0.53 ? "#ffffff" : infield;
      buf.setHex(x, y, c);
    }
  }
  // Start line + little flag + bench.
  for (let i = 0; i < 6; i++) buf.setHex(AX + 10 + i, AY + 22 - Math.floor(i / 2), "#ffffff");
  buf.matrix(ICONS.flag, { k: "#4b4458", a: surface }, AX + 22, AY + 6);
  buf.rect(AX - 30, AY + 10, 8, 2, "#b9864f");
  buf.rect(AX - 29, AY + 12, 1, 2, "#8d6238");
  buf.rect(AX - 24, AY + 12, 1, 2, "#8d6238");
  if (vitality === "lived") drawFlowers(buf, BUILDING_STYLES.hobby[0]);
  buf.outline(outline);
  if (vitality === "dusty") dustify(buf);
  return { base: toSprite(buf, AX, AY), glow: toSprite(glow, AX, AY) };
}

/** Track loop geometry in footprint tile units (for the jogging animation). */
export const TRACK_LOOP = { cx: 1, cy: 1, r: 0.79 * 0.9 };
