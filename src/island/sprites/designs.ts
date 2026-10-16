/**
 * Area designs: three distinct looks per area type. Each design draws itself with the Kit and
 * declares where the character performs ("spots", in footprint tile units) and optional loops
 * (for running). Add a design by appending to DESIGNS[type] — variant index = array index.
 */
import type { AreaType } from "@/data/schema";
import { shade } from "../color";
import { HALF_H, HALF_W } from "../iso";
import { BAR_HEIGHT, PARALLEL_HEIGHT } from "./character";
import { ICONS } from "./icons";
import { brick, glassWall, Kit, planks, siding, stone, vplanks } from "./kit";

export interface DesignContext {
  accent: string;
}

export interface Design {
  id: string;
  name: string;
  blurb: string;
  outdoor: boolean;
  /** Named performance spots in footprint units (relative to the area's back corner tile). */
  spots: Record<string, [number, number]>;
  /** Closed running loop in footprint units, if this design has one. */
  loop?: [number, number][];
  /** Default accent used when the user hasn't picked a color. */
  accent: string;
  draw(k: Kit, c: DesignContext): void;
}

const ellipseLoop = (cu: number, cv: number, ru: number, rv: number, n = 28): [number, number][] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cu + Math.cos(a) * ru, cv + Math.sin(a) * rv];
  });

/* ============================== GYM ============================== */

const indoorGym: Design = {
  id: "gym-indoor",
  name: "Indoor gym",
  blurb: "Brick gym with big windows",
  outdoor: false,
  spots: {},
  accent: "#e7795f",
  draw(k, { accent }) {
    k.ground(0.1, 0.1, 2.9, 2.9, (u, v) => ((Math.floor(u * 4) + Math.floor(v * 4)) % 2 ? "#cfc6b8" : "#d8d0c4"));
    k.box(0.3, 0.3, 2.7, 2.6, 62, { wall: brick("#c8664f"), top: null });
    k.flatRoof(0.3, 0.3, 2.7, 2.6, 62, "#5b5470");
    // Storefront windows with equipment silhouettes inside.
    k.windowL(2.6, 0.45, 0.75, 16, 30, { glass: "#5d6f8a", mullion: true });
    k.windowR(2.7, 0.5, 0.8, 18, 26, { glass: "#5d6f8a" });
    k.windowR(2.7, 1.5, 0.8, 18, 26, { glass: "#5d6f8a" });
    k.doorL(2.6, 1.9, 0.5, 34, { color: "#3b3346", glass: true, double: true });
    // Striped awning over the windows.
    k.faceL(2.75, 0.4, 1.3, 46, 52, (a) => (Math.floor(a / 0.09) % 2 ? accent : "#fff8ee"));
    // Rooftop billboard.
    const [sx, sy] = k.p(1.6, 1.4, 62);
    k.base.rect(sx - 10, sy - 6, 2, 8, "#4b4458");
    k.base.rect(sx + 10, sy - 6, 2, 8, "#4b4458");
    k.sign(sx - 18, sy - 30, ICONS.dumbbell, shade(accent, -0.4), accent);
    // Kettlebells and a rack by the door.
    for (const [u, col] of [
      [2.35, "#3b3346"],
      [2.5, accent],
    ] as const) {
      const [x, y] = k.p(u, 2.85);
      k.base.ellipse(x, y - 3, 3, 3, col);
      k.base.rect(x - 1, y - 8, 3, 2, col);
    }
  },
};

const calisthenicsPark: Design = {
  id: "gym-calisthenics",
  name: "Calisthenics park",
  blurb: "Open-air bars, rings and a soft mat",
  outdoor: true,
  spots: { bar: [1.1, 2.2], dip: [2.3, 1.2] },
  accent: "#4fb3b0",
  draw(k, { accent }) {
    // Rubber floor with a border.
    k.ground(0.15, 0.15, 2.85, 2.85, (u, v) => {
      const edge = u < 0.25 || v < 0.25 || u > 2.75 || v > 2.75;
      if (edge) return "#8a8399";
      return (Math.floor(u * 6) + Math.floor(v * 6)) % 2 ? shade(accent, -0.25) : shade(accent, -0.18);
    });
    const metal = "#5b5568";
    // Monkey bars along the back.
    for (const u of [0.45, 2.45]) {
      k.post(u, 0.45, 46, metal, 3);
      k.post(u, 0.85, 46, metal, 3);
    }
    k.line([0.45, 0.45, 46], [2.45, 0.45, 46], metal, 2);
    k.line([0.45, 0.85, 46], [2.45, 0.85, 46], metal, 2);
    for (let i = 0; i <= 8; i++) k.line([0.45 + i * 0.25, 0.45, 46], [0.45 + i * 0.25, 0.85, 46], "#9a93a8", 1);
    // Gymnastic rings.
    k.post(0.4, 1.4, 48, metal, 3);
    k.post(0.4, 2.0, 48, metal, 3);
    k.line([0.4, 1.4, 48], [0.4, 2.0, 48], metal, 2);
    for (const v of [1.6, 1.8]) {
      k.line([0.4, v, 48], [0.4, v, 30], "#d9d2c4", 1);
      const [x, y] = k.p(0.4, v, 27);
      k.base.ellipse(x, y, 2.5, 3, (px, py, nx, ny) => (nx * nx + ny * ny > 0.3 ? "#e9c95b" : null));
    }
    // Parallel bars (screen-aligned around the dip spot so they line up with the character).
    const [dx, dy] = k.p(2.3, 1.2);
    for (const ox of [-9, 9]) {
      k.base.rect(dx + ox - 1, dy - PARALLEL_HEIGHT, 2, PARALLEL_HEIGHT, metal);
      k.base.rect(dx + ox - 1, dy - PARALLEL_HEIGHT - 10, 2, 12, metal);
      k.base.line(dx + ox, dy - PARALLEL_HEIGHT - 10, dx + ox + 6, dy - PARALLEL_HEIGHT - 6, metal, 2);
    }
    // Pull-up frame around the bar spot.
    const [bx, by] = k.p(1.1, 2.2);
    k.base.rect(bx - 19, by - BAR_HEIGHT, 3, BAR_HEIGHT, metal);
    k.base.rect(bx + 17, by - BAR_HEIGHT, 3, BAR_HEIGHT, metal);
    k.base.rect(bx - 19, by - BAR_HEIGHT - 1, 39, 3, "#8f88a0");
    // Bench and water bottle.
    k.bench(2.0, 2.6, 0.6, "#8a8399");
    const [wx, wy] = k.p(2.75, 2.75);
    k.base.rect(wx - 1, wy - 7, 3, 7, accent);
  },
};

const yogaDeck: Design = {
  id: "gym-yoga",
  name: "Yoga deck",
  blurb: "Wooden deck with mats and a pavilion",
  outdoor: true,
  spots: { mat: [1.7, 2.1] },
  accent: "#a888de",
  draw(k, { accent }) {
    // Raised deck.
    k.box(0.2, 0.2, 2.8, 2.8, 4, { wall: "#a97c4a", top: null });
    k.top(0.2, 0.2, 2.8, 2.8, 4, "#c99a62");
    k.ground(0.2, 0.2, 2.8, 2.8, () => null);
    for (let i = 1; i < 10; i++) k.line([0.2 + i * 0.26, 0.2, 4], [0.2 + i * 0.26, 2.8, 4], "#b3854f", 1);
    // Pavilion at the back.
    const wood = "#8d6238";
    for (const [u, v] of [
      [0.35, 0.35],
      [1.55, 0.35],
      [0.35, 1.25],
      [1.55, 1.25],
    ])
      k.line([u, v, 4], [u, v, 42], wood, 3);
    k.hipRoof(0.35, 0.35, 1.55, 1.25, 42, 18, "#5fae84");
    // Mats.
    for (const [u, v, col] of [
      [0.6, 1.6, shade(accent, 0.2)],
      [1.4, 2.0, accent],
      [2.2, 1.2, "#e7a0b8"],
    ] as const)
      k.top(u - 0.3, v - 0.12, u + 0.3, v + 0.12, 5, col);
    // Plants and a wind chime.
    k.pot(2.6, 0.4, "#ff8fab");
    k.pot(0.4, 2.6, "#ffd166");
    k.pot(2.65, 2.65, "#ffffff");
    k.line([1.0, 0.8, 42], [1.0, 0.8, 30], "#c4bcd4", 1);
  },
};

/* ============================== STUDY ============================== */

const schoolhouse: Design = {
  id: "study-schoolhouse",
  name: "Schoolhouse",
  blurb: "Classic school with a bell tower",
  outdoor: false,
  spots: {},
  accent: "#4f9cc4",
  draw(k, { accent }) {
    k.ground(0.1, 0.1, 2.9, 2.9, (u, v) => (u > 2.0 && v > 2.4 ? "#d8c7a4" : null));
    k.box(0.35, 0.4, 2.7, 2.5, 48, { wall: siding("#f1e4c6"), top: null });
    k.gableU(0.35, 0.4, 2.7, 2.5, 48, 30, accent, "#e6d6b2");
    // Windows along the long side.
    for (const u of [0.5, 1.05, 1.6]) k.windowL(2.5, u, 0.35, 18, 18);
    k.windowR(2.7, 0.75, 0.5, 18, 18);
    k.windowR(2.7, 1.5, 0.5, 18, 18);
    k.doorL(2.5, 2.1, 0.42, 32, { color: "#a0634a", arch: true });
    // Bell tower.
    const [tx, ty] = k.p(1.5, 1.45, 76);
    k.base.rect(tx - 7, ty - 18, 14, 18, "#fff8ee");
    k.base.rect(tx - 4, ty - 15, 8, 9, "#5a4334");
    k.base.ellipse(tx, ty - 9, 3, 3, "#e9c95b");
    k.base.poly([[tx - 10, ty - 18], [tx, ty - 32], [tx + 10, ty - 18]], shade(accent, -0.15));
    // Clock on the gable end.
    const [cx, cy] = k.p(2.7, 1.45, 64);
    k.base.ellipse(cx, cy, 5, 5, "#fff8ee");
    k.base.line(cx, cy, cx, cy - 3, "#3b3346", 1);
    k.base.line(cx, cy, cx + 2, cy, "#3b3346", 1);
    // Chalkboard sign.
    const [bx, by] = k.p(2.85, 2.85);
    k.base.rect(bx - 8, by - 16, 14, 10, "#2f4a3a");
    k.base.rect(bx - 6, by - 13, 6, 1, "#ffffff");
    k.base.rect(bx - 6, by - 10, 9, 1, "#ffffff");
    k.base.rect(bx - 7, by - 6, 2, 6, "#8d6238");
    k.base.rect(bx + 3, by - 6, 2, 6, "#8d6238");
  },
};

const universityHall: Design = {
  id: "study-hall",
  name: "University hall",
  blurb: "Stone hall with columns and steps",
  outdoor: false,
  spots: {},
  accent: "#7c5ec4",
  draw(k, { accent }) {
    k.ground(0.1, 0.1, 2.9, 2.9, (u, v) => (v > 2.3 ? ((Math.floor(u * 5) + Math.floor(v * 5)) % 2 ? "#e3ddd3" : "#d6cfc3") : null));
    k.box(0.3, 0.3, 2.75, 2.1, 58, { wall: stone("#e6e0d4"), top: null });
    k.flatRoof(0.3, 0.3, 2.75, 2.1, 58, "#b8b0a2");
    for (const u of [0.5, 1.0, 1.5]) k.windowL(2.1, u, 0.3, 26, 22, { arch: true });
    k.windowR(2.75, 0.6, 0.5, 26, 22, { arch: true });
    k.windowR(2.75, 1.3, 0.5, 26, 22, { arch: true });
    k.doorL(2.1, 2.1, 0.45, 34, { color: "#5a4334", double: true, arch: true });
    // Steps and portico columns.
    k.box(1.8, 2.1, 2.75, 2.45, 3, { wall: "#cfc8bc", top: "#e6e0d4" });
    k.box(1.8, 2.45, 2.75, 2.7, 1.5, { wall: "#cfc8bc", top: "#ece6dc" });
    for (const u of [1.9, 2.25, 2.6]) {
      k.line([u, 2.35, 3], [u, 2.35, 50], "#fff8ee", 4);
      k.line([u + 0.03, 2.35, 3], [u + 0.03, 2.35, 50], "#d8d0c4", 1);
    }
    k.box(1.75, 2.1, 2.8, 2.45, 8, { wall: "#efe9df", top: "#f6f2ea", z0: 50 });
    // Pediment.
    const a = k.p(1.75, 2.45, 58);
    const b = k.p(2.8, 2.45, 58);
    const top = k.p(2.275, 2.45, 72);
    k.base.poly([a, b, top], "#efe9df");
    // Banner.
    k.faceR(2.75, 0.35, 0.5, 18, 48, accent);
    k.faceR(2.75, 0.35, 0.5, 18, 20, shade(accent, -0.3));
    k.lamp(1.6, 2.7, 26);
  },
};

const studyCabin: Design = {
  id: "study-cabin",
  name: "Study cabin",
  blurb: "Cozy cabin with a picnic desk outside",
  outdoor: false,
  spots: { table: [2.15, 2.35] },
  accent: "#d9774f",
  draw(k, { accent }) {
    k.ground(0.1, 0.1, 2.9, 2.9, (u, v) => (v > 1.8 && u > 1.3 ? "#cdb98f" : null));
    k.box(0.35, 0.35, 1.9, 1.75, 34, { wall: planks("#b98a5e"), top: null });
    k.gableU(0.35, 0.35, 1.9, 1.75, 34, 24, accent, "#a97c4a");
    k.windowL(1.75, 0.55, 0.4, 12, 14, { curtain: "#f4d5d9" });
    k.doorL(1.75, 1.25, 0.35, 26, { color: "#7a4f3a" });
    k.windowR(1.9, 0.7, 0.45, 12, 14, { curtain: "#f4d5d9" });
    // Chimney with stone texture.
    k.box(0.6, 0.7, 0.85, 0.95, 18, { wall: stone("#9a92a8"), z0: 46 });
    // Lantern, tree and woodpile.
    k.lamp(1.2, 2.7, 22);
    k.tree(2.6, 0.5, "#6fb26a", 34);
    for (let i = 0; i < 3; i++) {
      const [x, y] = k.p(2.2 + i * 0.12, 0.95);
      k.base.ellipse(x, y - 4, 4, 3, "#a97c4a");
      k.base.ellipse(x - 3, y - 4, 1.5, 2.5, "#e0c08a");
    }
  },
};

/* ============================== LIBRARY ============================== */

const grandLibrary: Design = {
  id: "library-grand",
  name: "Grand library",
  blurb: "Domed library with tall arched windows",
  outdoor: false,
  spots: {},
  accent: "#4fa38e",
  draw(k, { accent }) {
    k.ground(0.1, 0.1, 2.9, 2.9, (u, v) => (v > 2.55 ? "#e3ddd3" : null));
    k.box(0.3, 0.3, 2.7, 2.55, 54, { wall: stone("#ddd3bf"), top: null });
    k.flatRoof(0.3, 0.3, 2.7, 2.55, 54, "#c9bfa9");
    k.box(0.8, 0.8, 2.2, 2.05, 12, { wall: stone("#e6dcc8"), z0: 54 });
    k.dome(1.5, 1.42, 66, 0.72, accent);
    for (const u of [0.45, 0.95, 1.45]) k.windowL(2.55, u, 0.3, 14, 30, { arch: true, curtain: "#b84a4a" });
    for (const v of [0.55, 1.15, 1.75]) k.windowR(2.7, v, 0.3, 14, 30, { arch: true, curtain: "#b84a4a" });
    k.doorL(2.55, 1.98, 0.5, 34, { color: "#6b3f2a", double: true, arch: true });
    k.sign(...k.p(2.24, 2.62, 48), ICONS.book, "#3b3346", accent);
    k.lamp(1.85, 2.85, 26);
    k.lamp(2.7, 2.85, 26);
  },
};

const bookCafe: Design = {
  id: "library-cafe",
  name: "Book café",
  blurb: "Cottage bookshop with tables outside",
  outdoor: false,
  spots: { table: [2.05, 2.45] },
  accent: "#e28aa8",
  draw(k, { accent }) {
    k.ground(0.1, 0.1, 2.9, 2.9, (u, v) => (v > 1.9 ? ((Math.floor(u * 5) + Math.floor(v * 5)) % 2 ? "#e9d8b6" : "#dcc7a0") : null));
    k.box(0.35, 0.35, 2.6, 1.85, 44, { wall: siding("#f6e2c6"), top: null });
    k.hipRoof(0.35, 0.35, 2.6, 1.85, 44, 22, "#8a5a6a");
    k.windowL(1.85, 0.5, 0.75, 10, 22, { mullion: true, curtain: "#ffd9a8" });
    k.doorL(1.85, 1.6, 0.4, 30, { color: accent, glass: true });
    k.windowR(2.6, 0.6, 0.8, 10, 22);
    // Striped awning.
    k.faceL(1.98, 0.45, 2.15, 32, 38, (a) => (Math.floor(a / 0.12) % 2 ? accent : "#fff8ee"));
    // Outdoor book cart.
    const [cx, cy] = k.p(0.75, 2.4);
    k.base.rect(cx - 12, cy - 18, 24, 16, "#8d6238");
    for (let r = 0; r < 3; r++)
      for (let i = 0; i < 9; i++) k.base.rect(cx - 10 + i * 2.4, cy - 16 + r * 5, 2, 4, ["#e7795f", "#4f9cc4", "#e9c95b", "#5fae84", "#a888de"][(i + r) % 5]);
    k.base.rect(cx - 12, cy - 2, 24, 2, "#5a4334");
    // Table with umbrella.
    const [tx, ty] = k.p(2.45, 2.35);
    k.base.line(tx, ty, tx, ty - 34, "#4b4458", 2);
    k.base.ellipse(tx, ty - 34, 16, 6, (x, y, nx) => (Math.floor((nx + 1) * 4) % 2 ? accent : "#fff8ee"));
    k.base.ellipse(tx, ty - 12, 9, 3.5, "#f4ead8");
  },
};

const readingGarden: Design = {
  id: "library-garden",
  name: "Reading garden",
  blurb: "Pergola, benches and an outdoor shelf",
  outdoor: true,
  spots: { bench: [1.55, 2.2] },
  accent: "#6fb35a",
  draw(k, { accent }) {
    k.ground(0.1, 0.1, 2.9, 2.9, (u, v) => (Math.abs(u - v) < 0.35 || (v > 1.9 && v < 2.5) ? "#e9d8b6" : null));
    // Hedge border at the back.
    for (let u = 0.3; u <= 2.7; u += 0.3) k.shrub(u, 0.3, 1.3, "#5f9e52");
    for (let v = 0.6; v <= 1.8; v += 0.3) k.shrub(0.3, v, 1.3, "#5f9e52");
    // Pergola.
    const wood = "#f1e4c6";
    for (const [u, v] of [
      [0.8, 0.9],
      [2.4, 0.9],
      [0.8, 1.9],
      [2.4, 1.9],
    ])
      k.line([u, v, 0], [u, v, 40], wood, 3);
    for (let i = 0; i <= 6; i++) k.line([0.7 + i * 0.29, 0.85, 40], [0.7 + i * 0.29, 1.95, 40], shade(wood, -0.12), 2);
    k.line([0.7, 0.9, 40], [2.5, 0.9, 40], wood, 2);
    k.line([0.7, 1.9, 40], [2.5, 1.9, 40], wood, 2);
    // Vines with flowers.
    for (let i = 0; i < 18; i++) {
      const [x, y] = k.p(0.8 + (i % 6) * 0.3, 0.9 + Math.floor(i / 6) * 0.5, 41);
      k.base.ellipse(x, y, 3, 2, i % 3 ? accent : "#ff8fab");
    }
    // Bookshelf cabinet.
    const [sx, sy] = k.p(2.55, 1.35);
    k.base.rect(sx - 10, sy - 28, 20, 28, "#8d6238");
    for (let r = 0; r < 4; r++)
      for (let i = 0; i < 7; i++) k.base.rect(sx - 8 + i * 2.4, sy - 26 + r * 6.5, 2, 5, ["#e7795f", "#4f9cc4", "#e9c95b", "#5fae84", "#a888de"][(i * 2 + r) % 5]);
    k.bench(1.25, 2.3, 0.65);
    k.lamp(2.7, 2.7, 24);
    k.pot(0.5, 2.6, "#ffd166");
  },
};

/* ============================== PHOTO ============================== */

const photoStudio: Design = {
  id: "photo-studio",
  name: "Photo studio",
  blurb: "Modern studio with a glass skylight",
  outdoor: false,
  spots: {},
  accent: "#6e5ee6",
  draw(k, { accent }) {
    k.box(0.35, 0.35, 2.65, 2.55, 44, { wall: "#f4f0f6", wallR: "#dcd6e2", top: null });
    k.flatRoof(0.35, 0.35, 2.65, 2.55, 44, accent);
    // Skylight.
    k.top(0.9, 0.9, 2.1, 2.0, 46, (x, y) => ((x + y) % 7 === 0 ? "#e6f4fb" : "#9fd3f0"));
    k.line([0.9, 0.9, 46], [2.1, 0.9, 46], "#4b4458", 1);
    k.windowL(2.55, 0.55, 1.0, 8, 26, { glass: "#5d6f8a" });
    k.doorL(2.55, 1.85, 0.42, 30, { color: "#3b3346", glass: true });
    // Round porthole windows.
    for (const v of [0.8, 1.6]) {
      const [x, y] = k.p(2.65, v, 24);
      k.base.ellipse(x, y, 6, 7, "#fff8ee");
      k.base.ellipse(x, y, 4, 5, "#5d6f8a");
      if (k.lit) k.glow.ellipse(x, y, 4, 5, "#ffd27a");
    }
    // Rooftop camera sign.
    const [sx, sy] = k.p(1.0, 2.0, 44);
    k.sign(sx - 6, sy - 24, ICONS.camera, "#2b2233", accent);
    // Softbox light by the door.
    const [lx, ly] = k.p(2.85, 2.25);
    k.base.line(lx, ly, lx, ly - 24, "#4b4458", 1);
    k.base.rect(lx - 6, ly - 34, 12, 10, "#ffffff");
    k.base.rect(lx - 6, ly - 34, 12, 2, "#c4bcd4");
  },
};

const darkroom: Design = {
  id: "photo-darkroom",
  name: "Darkroom shack",
  blurb: "Little shed with a red lamp and prints drying",
  outdoor: false,
  spots: {},
  accent: "#d84a4a",
  draw(k, { accent }) {
    k.ground(0.1, 0.1, 2.9, 2.9, (u, v) => (u > 1.4 && v > 1.4 ? "#c9b48c" : null));
    k.box(0.4, 0.4, 1.9, 1.85, 38, { wall: vplanks("#4a4458"), top: null });
    k.gableV(0.4, 0.4, 1.9, 1.85, 38, 20, "#2f2a3a", "#3e384c");
    k.doorL(1.85, 0.95, 0.4, 28, { color: "#2a2433" });
    // Red safelight window.
    k.faceR(1.9, 0.75, 1.2, 18, 28, "#7a1f2a");
    if (k.lit || true) k.faceR(1.9, 0.8, 1.15, 19, 27, accent, k.glow);
    // Washing line with prints.
    k.post(1.5, 2.4, 30, "#8d6238", 2);
    k.post(2.7, 1.2, 30, "#8d6238", 2);
    k.line([1.5, 2.4, 30], [2.7, 1.2, 30], "#c4bcd4", 1);
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const [x, y] = k.p(1.5 + 1.2 * t, 2.4 - 1.2 * t, 29);
      k.base.rect(x - 3, y, 6, 7, "#fff8ee");
      k.base.rect(x - 2, y + 1, 4, 4, ["#8fb8d8", "#e7a0b8", "#a8dc8e", "#ffd9a8"][i % 4]);
    }
    k.tree(2.5, 2.6, "#6fb26a", 30);
  },
};

const lookout: Design = {
  id: "photo-lookout",
  name: "Scenic lookout",
  blurb: "Viewing deck with a telescope and tripod",
  outdoor: true,
  spots: { tripod: [1.4, 2.0] },
  accent: "#eea54b",
  draw(k, { accent }) {
    // Raised deck with railing.
    k.box(0.4, 0.4, 2.6, 2.6, 8, { wall: "#8d6238", top: null });
    k.top(0.4, 0.4, 2.6, 2.6, 8, "#c99a62");
    for (let i = 1; i < 8; i++) k.line([0.4, 0.4 + i * 0.275, 8], [2.6, 0.4 + i * 0.275, 8], "#b3854f", 1);
    const rail = "#e8dcc4";
    const railLine = (a: [number, number], b: [number, number]) => {
      const n = 6;
      for (let i = 0; i <= n; i++) k.line([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, 8], [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, 20], rail, 1);
      k.line([a[0], a[1], 20], [b[0], b[1], 20], rail, 2);
    };
    railLine([0.4, 0.4], [2.6, 0.4]);
    railLine([0.4, 0.4], [0.4, 2.6]);
    // Telescope.
    const [tx, ty] = k.p(0.9, 0.9, 8);
    k.base.line(tx, ty, tx - 4, ty - 16, "#4b4458", 1);
    k.base.line(tx, ty, tx + 4, ty - 16, "#4b4458", 1);
    k.base.line(tx - 6, ty - 16, tx + 8, ty - 22, accent, 4);
    // Steps at the front.
    k.box(2.0, 2.6, 2.6, 2.85, 4, { wall: "#8d6238", top: "#c99a62" });
    k.pot(2.4, 0.7, "#ff8fab");
    k.pot(0.7, 2.4, "#ffd166");
    // Flag pennants.
    k.post(2.5, 0.5, 44, "#4b4458", 2);
    const [fx, fy] = k.p(2.5, 0.5, 44);
    k.base.poly([[fx, fy], [fx + 14, fy + 4], [fx, fy + 8]], accent);
  },
};

/* ============================== TRACK ============================== */

const oval: Design = {
  id: "track-oval",
  name: "Running track",
  blurb: "An oval track for laps",
  outdoor: true,
  spots: {},
  loop: ellipseLoop(1.5, 1.5, 1.08, 1.08),
  accent: "#e2775a",
  draw(k, { accent }) {
    k.ground(0.05, 0.05, 2.95, 2.95, (u, v) => {
      const d = Math.hypot((u - 1.5) / 1.38, (v - 1.5) / 1.38);
      if (d > 1) return null;
      if (d > 0.62) {
        const lane = Math.abs(d - 0.78) < 0.02 || Math.abs(d - 0.92) < 0.02;
        if (lane && Math.floor((Math.atan2(v - 1.5, u - 1.5) + 4) * 8) % 2 === 0) return "#fff6ec";
        return d > 0.97 ? shade(accent, -0.2) : accent;
      }
      if (d > 0.59) return "#ffffff";
      return Math.floor((u + v) * 3) % 2 ? "#9fd68a" : "#a9dc94";
    });
    // Start line and finish flag.
    k.line([2.4, 1.5, 0.5], [2.85, 1.5, 0.5], "#ffffff", 2);
    k.post(2.9, 1.3, 30, "#4b4458", 2);
    const [fx, fy] = k.p(2.9, 1.3, 30);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) k.base.rect(fx + c * 3, fy + r * 3, 3, 3, (r + c) % 2 ? "#2b2233" : "#ffffff");
    k.bench(0.15, 0.35, 0.6);
  },
};

const sportsField: Design = {
  id: "track-field",
  name: "Sports field",
  blurb: "Grass pitch with goals and a jogging edge",
  outdoor: true,
  spots: {},
  loop: [
    [0.3, 0.3],
    [2.7, 0.3],
    [2.7, 2.7],
    [0.3, 2.7],
  ],
  accent: "#5fae84",
  draw(k) {
    k.ground(0.12, 0.12, 2.88, 2.88, (u, v) => {
      if (u < 0.45 || v < 0.45 || u > 2.55 || v > 2.55) return "#c9a77a";
      const line = Math.abs(u - 0.5) < 0.03 || Math.abs(v - 0.5) < 0.03 || Math.abs(u - 2.5) < 0.03 || Math.abs(v - 2.5) < 0.03 || Math.abs(u - 1.5) < 0.025;
      if (line || Math.abs(Math.hypot(u - 1.5, v - 1.5) - 0.38) < 0.03) return "#ffffff";
      return Math.floor(u * 4) % 2 ? "#8fd07a" : "#82c56d";
    });
    // Goals at each end.
    for (const u of [0.55, 2.45]) {
      k.post(u, 1.25, 16, "#ffffff", 2);
      k.post(u, 1.75, 16, "#ffffff", 2);
      k.line([u, 1.25, 16], [u, 1.75, 16], "#ffffff", 2);
      for (let i = 1; i < 5; i++) k.line([u, 1.25 + i * 0.1, 16], [u + (u < 1 ? -0.15 : 0.15), 1.25 + i * 0.1, 2], "#dcd6e2", 1);
    }
    const [bx, by] = k.p(1.5, 1.5);
    k.base.ellipse(bx + 6, by - 3, 3, 3, (x, y) => ((x + y) % 3 ? "#ffffff" : "#2b2233"));
  },
};

const trailhead: Design = {
  id: "track-trailhead",
  name: "Trailhead",
  blurb: "Start of the island loop trail",
  outdoor: true,
  spots: {},
  accent: "#c98a6a",
  draw(k, { accent }) {
    k.ground(0.2, 0.2, 2.8, 2.8, (u, v) => (Math.hypot(u - 1.5, v - 1.5) < 1.2 ? ((u * 7 + v * 13) % 1 < 0.08 ? "#b8a27c" : "#d4bf96") : null));
    // Signpost with arrows.
    k.post(1.3, 1.3, 46, "#8d6238", 3);
    const [sx, sy] = k.p(1.3, 1.3, 44);
    k.base.poly([[sx - 2, sy], [sx + 20, sy], [sx + 25, sy + 4], [sx + 20, sy + 8], [sx - 2, sy + 8]], "#e8dcc4");
    k.base.poly([[sx + 2, sy + 12], [sx - 20, sy + 12], [sx - 25, sy + 16], [sx - 20, sy + 20], [sx + 2, sy + 20]], accent);
    k.base.rect(sx + 3, sy + 3, 12, 2, "#5a4334");
    // Water fountain and bench.
    const [wx, wy] = k.p(2.2, 1.0);
    k.base.rect(wx - 4, wy - 18, 8, 18, "#9a93a8");
    k.base.rect(wx - 6, wy - 20, 12, 3, "#c4bcd4");
    k.base.setHex(wx, wy - 22, "#9fd3f0");
    k.bench(0.6, 2.2, 0.7);
    k.tree(2.5, 2.4, "#6fb26a", 34);
    k.tree(0.5, 0.6, "#4d8a52", 30);
  },
};

/* ============================== WORKSHOP ============================== */

const barn: Design = {
  id: "work-barn",
  name: "Workshop barn",
  blurb: "Red barn with an anvil and woodpile",
  outdoor: false,
  spots: {},
  accent: "#c8503f",
  draw(k, { accent }) {
    k.ground(0.1, 0.1, 2.9, 2.9, (u, v) => (v > 2.3 ? "#cdb98f" : null));
    k.box(0.35, 0.35, 2.55, 2.3, 46, { wall: vplanks(accent), top: null });
    k.gableV(0.35, 0.35, 2.55, 2.3, 46, 30, "#4b4458", accent);
    // Big double doors with X braces on the gable end.
    k.faceL(2.3, 1.05, 1.85, 0, 34, "#f4ead8");
    k.faceL(2.3, 1.1, 1.8, 0, 32, shade(accent, -0.2));
    k.line([1.1, 2.3, 0], [1.45, 2.3, 32], "#f4ead8", 2);
    k.line([1.45, 2.3, 0], [1.1, 2.3, 32], "#f4ead8", 2);
    k.line([1.45, 2.3, 0], [1.8, 2.3, 32], "#f4ead8", 2);
    k.line([1.8, 2.3, 0], [1.45, 2.3, 32], "#f4ead8", 2);
    k.windowL(2.3, 1.3, 0.3, 44, 12);
    k.windowR(2.55, 0.8, 0.5, 16, 14);
    // Anvil, crate and woodpile.
    const [ax, ay] = k.p(2.75, 1.2);
    k.base.poly([[ax - 9, ay - 12], [ax + 9, ay - 12], [ax + 6, ay - 8], [ax - 6, ay - 8]], "#5b5568");
    k.base.rect(ax - 3, ay - 8, 6, 6, "#4b4458");
    k.base.rect(ax - 7, ay - 2, 14, 2, "#5b5568");
    k.box(0.4, 2.45, 0.75, 2.8, 10, { wall: planks("#c99a62") });
    for (let i = 0; i < 4; i++) {
      const [x, y] = k.p(2.65, 2.0 + i * 0.12);
      k.base.ellipse(x, y - 4, 4, 3, "#a97c4a");
      k.base.ellipse(x + 3, y - 4, 1.5, 2.5, "#e0c08a");
    }
    // Weather vane.
    const [vx, vy] = k.p(1.45, 1.32, 76);
    k.base.line(vx, vy, vx, vy - 10, "#4b4458", 1);
    k.base.poly([[vx - 6, vy - 10], [vx + 6, vy - 12], [vx + 6, vy - 8]], "#4b4458");
  },
};

const office: Design = {
  id: "work-office",
  name: "Office",
  blurb: "Two-storey glass office with a roof garden",
  outdoor: false,
  spots: { bench: [2.2, 2.75] },
  accent: "#4f9cc4",
  draw(k, { accent }) {
    k.ground(0.1, 0.1, 2.9, 2.9, (u, v) => (v > 2.5 ? "#d6d0c6" : null));
    k.box(0.35, 0.35, 2.6, 2.45, 96, { wall: glassWall("#e6e2ea"), wallR: glassWall("#cfc9d6"), top: null });
    k.flatRoof(0.35, 0.35, 2.6, 2.45, 96, "#8f8a99");
    // Floor bands.
    for (const z of [48]) {
      k.faceL(2.45, 0.35, 2.6, z - 3, z, "#e6e2ea");
      k.faceR(2.6, 0.35, 2.45, z - 3, z, "#cfc9d6");
    }
    if (k.lit) {
      k.faceL(2.45, 0.6, 1.4, 52, 90, (a, z) => (Math.floor(z) % 16 < 3 ? null : "#ffd27a"), k.glow);
      k.faceR(2.6, 1.2, 2.2, 6, 44, (a, z) => (Math.floor(z) % 16 < 3 ? null : "#ffd27a"), k.glow);
    }
    k.doorL(2.45, 1.85, 0.5, 30, { color: "#3b3346", glass: true, double: true });
    // Rooftop garden and AC unit.
    for (const [u, v] of [
      [0.7, 0.7],
      [1.1, 0.6],
      [0.6, 1.2],
    ])
      k.shrub(u, v, 1.1, "#6fb35a", 96);
    k.box(1.7, 1.4, 2.2, 1.9, 10, { wall: "#c4bcd4", z0: 96 });
    // Company sign.
    k.faceL(2.47, 0.5, 1.5, 100, 108, accent);
    k.bench(1.9, 2.75, 0.6, "#8f8a99");
    k.pot(0.5, 2.7, "#6fb35a");
  },
};

const coworking: Design = {
  id: "work-cafe",
  name: "Co-working café",
  blurb: "Bright café with laptops and umbrellas",
  outdoor: false,
  spots: { table: [2.2, 2.35] },
  accent: "#eea54b",
  draw(k, { accent }) {
    k.ground(0.1, 0.1, 2.9, 2.9, (u, v) => (v > 1.85 ? ((Math.floor(u * 6) + Math.floor(v * 6)) % 2 ? "#ebe3d6" : "#ddd3c3") : null));
    k.box(0.35, 0.35, 2.6, 1.8, 46, { wall: brick("#e8d5bd"), top: null });
    k.flatRoof(0.35, 0.35, 2.6, 1.8, 46, "#5b5470");
    k.windowL(1.8, 0.5, 1.1, 8, 26, { glass: "#a9d6ee" });
    k.doorL(1.8, 1.75, 0.45, 30, { color: "#2f4a3a", glass: true });
    k.windowR(2.6, 0.55, 1.0, 8, 26);
    k.faceL(1.93, 0.45, 2.3, 34, 40, (a) => (Math.floor(a / 0.12) % 2 ? accent : "#fff8ee"));
    // Neon coffee sign.
    k.sign(...k.p(1.15, 1.8, 44), ICONS.star, "#2b2233", accent);
    // Umbrella tables.
    for (const [u, v] of [
      [0.8, 2.4],
      [2.5, 2.25],
    ]) {
      const [tx, ty] = k.p(u, v);
      k.base.line(tx, ty, tx, ty - 34, "#4b4458", 2);
      k.base.ellipse(tx, ty - 34, 15, 6, (x, y, nx) => (Math.floor((nx + 1) * 4) % 2 ? accent : "#fff8ee"));
      k.base.ellipse(tx, ty - 12, 9, 3.5, "#f4ead8");
    }
    k.pot(2.75, 1.9, "#ff8fab");
  },
};

/* ============================== HOBBY ============================== */

const artStudio: Design = {
  id: "hobby-art",
  name: "Art studio",
  blurb: "Painter's cottage with an easel outside",
  outdoor: false,
  spots: { easel: [2.25, 2.4] },
  accent: "#a888de",
  draw(k, { accent }) {
    k.ground(0.1, 0.1, 2.9, 2.9, (u, v, x, y) => (v > 2.0 && u > 1.6 ? ((x * 7 + y * 3) % 23 === 0 ? ["#e7795f", "#4f9cc4", "#e9c95b"][(x + y) % 3] : "#e6dcc8") : null));
    k.box(0.35, 0.35, 2.1, 1.85, 40, { wall: siding("#f2e8f8"), top: null });
    k.gableU(0.35, 0.35, 2.1, 1.85, 40, 26, accent, "#e2d6ee");
    // Slanted skylight on the roof.
    k.base.poly([k.p(0.7, 1.15, 52), k.p(1.6, 1.15, 52), k.p(1.6, 1.6, 44), k.p(0.7, 1.6, 44)], "#9fd3f0");
    k.windowL(1.85, 0.5, 0.7, 10, 20, { curtain: "#ffd9a8" });
    k.doorL(1.85, 1.5, 0.38, 28, { color: "#e7795f" });
    k.windowR(2.1, 0.75, 0.6, 10, 20);
    // Paint buckets and a big canvas leaning on the wall.
    const [cx, cy] = k.p(2.2, 0.6);
    k.base.rect(cx - 8, cy - 22, 16, 20, "#ffffff");
    k.base.rect(cx - 6, cy - 19, 7, 6, "#4f9cc4");
    k.base.rect(cx, cy - 14, 6, 7, "#e9c95b");
    for (const [u, col] of [
      [2.6, "#e7795f"],
      [2.75, "#5fae84"],
    ] as const) {
      const [x, y] = k.p(u, 1.6);
      k.base.rect(x - 3, y - 6, 6, 6, "#c4bcd4");
      k.base.rect(x - 3, y - 6, 6, 2, col);
    }
  },
};

const gazebo: Design = {
  id: "hobby-gazebo",
  name: "Music gazebo",
  blurb: "Open gazebo stage with a bench",
  outdoor: true,
  spots: { stage: [1.5, 1.75] },
  accent: "#e28aa8",
  draw(k, { accent }) {
    // Round stage.
    const [cx, cy] = k.p(1.5, 1.5);
    k.base.ellipse(cx, cy + 4, 86, 43, "#c9a77a");
    k.base.ellipse(cx, cy, 86, 43, "#efe2c8");
    for (let r = 20; r < 86; r += 18) k.base.ellipse(cx, cy, r, r / 2, (x, y, nx, ny) => (nx * nx + ny * ny > 0.93 ? "#dccaa6" : null));
    // Posts in a ring.
    const posts = Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      return [1.5 + Math.cos(a) * 1.15, 1.5 + Math.sin(a) * 1.15] as [number, number];
    });
    const back = posts.filter(([u, v]) => u + v < 3);
    const front = posts.filter(([u, v]) => u + v >= 3);
    for (const [u, v] of back) k.line([u, v, 0], [u, v, 50], "#fff8ee", 3);
    // Roof (cone).
    const [rx, ry] = k.p(1.5, 1.5, 50);
    k.base.ellipse(rx, ry, 92, 30, (x, y, nx, ny) => (ny < 0.25 ? null : null));
    k.base.poly([[rx - 94, ry + 2], [rx, ry - 36], [rx + 94, ry + 2], [rx, ry + 20]], (x, y) => ((y + Math.floor(Math.abs(x - rx) / 2)) % 5 === 0 ? shade(accent, -0.15) : x > rx ? shade(accent, -0.12) : accent));
    k.base.rect(rx - 1, ry - 42, 3, 7, "#e9c95b");
    void front;
    // Music stand and note sign.
    const [mx, my] = k.p(2.3, 1.1);
    k.base.line(mx, my, mx, my - 22, "#4b4458", 1);
    k.base.rect(mx - 6, my - 28, 12, 7, "#3b3346");
    k.sign(...k.p(2.7, 2.6), ICONS.note, "#2b2233", accent);
  },
};

const gardenPlot: Design = {
  id: "hobby-garden",
  name: "Garden plot",
  blurb: "Raised veggie beds and a greenhouse",
  outdoor: true,
  spots: { bed: [2.05, 2.3] },
  accent: "#5fae84",
  draw(k) {
    k.ground(0.1, 0.1, 2.9, 2.9, (u, v) => (Math.abs(u - 1.55) < 0.12 || Math.abs(v - 1.55) < 0.12 ? "#d4bf96" : null));
    // Greenhouse at the back.
    k.box(0.3, 0.3, 1.35, 1.35, 30, { wall: (a, z) => (Math.abs(a / 0.25 - Math.round(a / 0.25)) < 0.08 || Math.floor(z) % 15 < 1 ? "#f4f1ea" : "#bfe6d4"), top: null });
    k.gableU(0.3, 0.3, 1.35, 1.35, 30, 16, "#cfeee2", "#bfe6d4", 0.04);
    k.doorL(1.35, 0.95, 0.3, 24, { color: "#bfe6d4" });
    // Raised beds with sprouts.
    for (const [u0, v0] of [
      [1.75, 0.35],
      [1.75, 0.95],
      [0.35, 1.75],
      [0.95, 1.75],
      [1.75, 1.75],
    ]) {
      k.box(u0, v0, u0 + 0.5, v0 + 0.45, 7, { wall: planks("#a97c4a"), top: "#6b4a34" });
      for (let i = 0; i < 4; i++) {
        const [x, y] = k.p(u0 + 0.1 + (i % 2) * 0.28, v0 + 0.1 + Math.floor(i / 2) * 0.22, 7);
        k.base.rect(x - 1, y - 4, 2, 4, "#6fb35a");
        k.base.rect(x - 3, y - 5, 2, 2, "#8fd07a");
        k.base.rect(x + 1, y - 5, 2, 2, "#8fd07a");
        if ((u0 * 10 + i) % 3 < 1) k.base.ellipse(x, y - 6, 2, 2, "#e7795f");
      }
    }
    // Scarecrow.
    const [sx, sy] = k.p(2.6, 2.6);
    k.base.line(sx, sy, sx, sy - 34, "#8d6238", 2);
    k.base.line(sx - 10, sy - 26, sx + 10, sy - 26, "#8d6238", 2);
    k.base.rect(sx - 6, sy - 28, 12, 12, "#4f9cc4");
    k.base.ellipse(sx, sy - 34, 5, 5, "#f2d9a8");
    k.base.poly([[sx - 8, sy - 37], [sx + 8, sy - 37], [sx, sy - 45]], "#c99a62");
  },
};

export const DESIGNS: Record<AreaType, [Design, Design, Design]> = {
  gym: [indoorGym, calisthenicsPark, yogaDeck],
  study: [schoolhouse, universityHall, studyCabin],
  library: [grandLibrary, bookCafe, readingGarden],
  photo: [photoStudio, darkroom, lookout],
  track: [oval, sportsField, trailhead],
  workshop: [barn, office, coworking],
  hobby: [artStudio, gazebo, gardenPlot],
};

export const designFor = (type: AreaType, variant: number): Design => DESIGNS[type][((variant % 3) + 3) % 3];

/** Screen-space depth helper: tiles → px offsets (for consumers that need it). */
export const tilePx = { HALF_W, HALF_H };
