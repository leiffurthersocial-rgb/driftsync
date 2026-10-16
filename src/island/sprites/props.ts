/**
 * Decoration props, drawn procedurally at the 64x32-tile scale. Each prop returns a buffer and
 * the anchor pixel that sits on the ground point. `variant` gives seeded variety.
 */
import { rng } from "@/lib/random";
import { PixelBuffer } from "../pixel-buffer";
import { shade } from "../color";
import { HALF_H, HALF_W } from "../iso";

export const PROP_NAMES = [
  "oak",
  "pine",
  "birch",
  "blossom",
  "bush",
  "flowers",
  "tallGrass",
  "rock",
  "boulder",
  "mushroom",
  "reeds",
  "lily",
  "lamp",
  "bench",
  "stump",
  "fountain",
  "floatRock",
] as const;
export type PropName = (typeof PROP_NAMES)[number];

export interface PropArt {
  buf: PixelBuffer;
  ax: number;
  ay: number;
  /** Optional glow layer (lamp light). */
  glow?: PixelBuffer;
}

const LEAF = { light: "#b8e49a", mid: "#86c46f", dark: "#5f9e52", deep: "#467e46" };

function canopy(buf: PixelBuffer, cx: number, cy: number, r: number, rand: () => number, pal = LEAF) {
  // Cluster of blobs with light from the top-left.
  const blobs: [number, number, number][] = [[cx, cy, r]];
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2;
    const d = r * (0.35 + rand() * 0.4);
    blobs.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, r * (0.45 + rand() * 0.25)]);
  }
  for (const [x, y, rr] of blobs)
    buf.ellipse(x, y, rr, rr * 0.9, (_px, _py, nx, ny) => {
      const l = nx * 0.7 + ny * 0.7;
      return l > 0.55 ? pal.dark : l < -0.55 ? pal.light : pal.mid;
    });
  // Leaf speckles.
  for (let i = 0; i < r * 3; i++) {
    const x = Math.round(cx + (rand() - 0.5) * r * 1.8);
    const y = Math.round(cy + (rand() - 0.5) * r * 1.6);
    if (buf.alphaAt(x, y)) buf.setHex(x, y, rand() < 0.5 ? pal.light : pal.deep);
  }
}

const cache = new Map<string, PropArt>();

export function propArt(name: PropName, variant: number, outline: string): PropArt {
  const key = `${name}|${variant}|${outline}`;
  let art = cache.get(key);
  if (!art) {
    art = draw(name, variant);
    if (name !== "lily" && name !== "flowers" && name !== "tallGrass") art.buf.outline(outline);
    cache.set(key, art);
  }
  return art;
}

function draw(name: PropName, variant: number): PropArt {
  const rand = rng(variant * 7919 + name.length * 131);
  switch (name) {
    case "oak": {
      const h = 46 + Math.floor(rand() * 14);
      const buf = new PixelBuffer(56, h + 8);
      const ax = 28;
      const ay = h + 4;
      buf.rect(ax - 3, ay - 22, 6, 22, "#8d6238");
      buf.rect(ax + 1, ay - 22, 2, 22, "#714c2c");
      buf.line(ax, ay - 16, ax - 8, ay - 24, "#8d6238", 2);
      canopy(buf, ax, ay - h + 20, 19 + rand() * 4, rand);
      return { buf, ax, ay };
    }
    case "pine": {
      const h = 58 + Math.floor(rand() * 16);
      const buf = new PixelBuffer(44, h + 6);
      const ax = 22;
      const ay = h + 3;
      buf.rect(ax - 2, ay - 12, 5, 12, "#7a5038");
      const tiers = 4;
      for (let t = 0; t < tiers; t++) {
        const top = ay - h + t * ((h - 14) / tiers);
        const w = 7 + t * 4.5;
        const bottom = top + (h - 14) / tiers + 8;
        buf.poly(
          [
            [ax, top],
            [ax + w, bottom],
            [ax - w, bottom],
          ],
          (x, y) => (x > ax + 1 ? "#4d8a52" : (x + y) % 9 === 0 ? "#8fd08a" : "#6fb26a"),
        );
        buf.rect(ax - w + 1, Math.round(bottom) - 1, w * 2 - 1, 1, "#3f7444");
      }
      return { buf, ax, ay };
    }
    case "birch": {
      const h = 52 + Math.floor(rand() * 10);
      const buf = new PixelBuffer(46, h + 6);
      const ax = 23;
      const ay = h + 3;
      buf.rect(ax - 2, ay - 30, 4, 30, "#f4f1ea");
      for (let y = ay - 28; y < ay; y += 5) buf.rect(ax - 2 + (y % 2), y, 2, 1, "#3b3346");
      canopy(buf, ax, ay - h + 18, 15, rand, { light: "#e6f0a0", mid: "#b8d66a", dark: "#8fb24f", deep: "#6f9a44" });
      return { buf, ax, ay };
    }
    case "blossom": {
      const h = 44 + Math.floor(rand() * 8);
      const buf = new PixelBuffer(56, h + 6);
      const ax = 28;
      const ay = h + 3;
      buf.rect(ax - 3, ay - 20, 6, 20, "#7a5038");
      buf.line(ax, ay - 14, ax + 9, ay - 22, "#7a5038", 2);
      canopy(buf, ax, ay - h + 18, 18, rand, { light: "#ffe3ee", mid: "#f7b6cf", dark: "#e58fb2", deep: "#d0769c" });
      return { buf, ax, ay };
    }
    case "bush": {
      const buf = new PixelBuffer(34, 22);
      const ax = 17;
      const ay = 19;
      canopy(buf, ax, ay - 8, 10 + rand() * 3, rand);
      if (rand() < 0.4) for (let i = 0; i < 4; i++) buf.ellipse(ax - 8 + rand() * 16, ay - 14 + rand() * 10, 1.4, 1.4, "#ff8fab");
      return { buf, ax, ay };
    }
    case "flowers": {
      const buf = new PixelBuffer(48, 26);
      const ax = 24;
      const ay = 14;
      const cols = ["#ff8fab", "#ffd166", "#ffffff", "#b49cff", "#ff9a5c", "#8fd3ff"];
      const c1 = cols[Math.floor(rand() * cols.length)];
      const c2 = cols[Math.floor(rand() * cols.length)];
      for (let i = 0; i < 16; i++) {
        const u = rand() - 0.5;
        const v = rand() - 0.5;
        const x = Math.round(ax + (u - v) * HALF_W * 0.8);
        const y = Math.round(ay + (u + v) * HALF_H * 0.8);
        buf.rect(x, y - 3, 1, 3, "#4f8c42");
        buf.ellipse(x + 0.5, y - 4, 1.6, 1.4, i % 3 ? c1 : c2);
        buf.setHex(x, y - 4, "#ffe08a");
      }
      return { buf, ax, ay };
    }
    case "tallGrass": {
      const buf = new PixelBuffer(30, 18);
      const ax = 15;
      const ay = 14;
      for (let i = 0; i < 9; i++) {
        const x = ax - 10 + Math.round(rand() * 20);
        const hgt = 5 + Math.round(rand() * 7);
        const lean = rand() < 0.5 ? -1 : 1;
        buf.line(x, ay, x + lean * 2, ay - hgt, i % 2 ? "#6aa857" : "#86c46f", 1);
      }
      return { buf, ax, ay };
    }
    case "rock":
    case "boulder": {
      const big = name === "boulder";
      const buf = new PixelBuffer(big ? 40 : 24, big ? 30 : 16);
      const ax = buf.width / 2;
      const ay = buf.height - 3;
      const rx = big ? 15 : 8;
      const ry = big ? 12 : 6;
      buf.ellipse(ax, ay - ry * 0.8, rx, ry, (_x, _y, nx, ny) => (nx + ny > 0.5 ? "#8f88a0" : nx + ny < -0.6 ? "#d2ccdc" : "#b4adc2"));
      if (big) for (let i = 0; i < 5; i++) buf.setHex(Math.round(ax - 8 + rand() * 12), Math.round(ay - 16 + rand() * 6), "#6fae5b");
      return { buf, ax, ay };
    }
    case "mushroom": {
      const buf = new PixelBuffer(20, 18);
      const ax = 10;
      const ay = 15;
      for (const [dx, s] of [
        [-4, 1],
        [4, 0.7],
      ] as const) {
        buf.rect(ax + dx - 1, ay - 6 * s, 3, 6 * s, "#f4ead8");
        buf.ellipse(ax + dx, ay - 6 * s - 1, 5 * s, 3.5 * s, "#e7795f");
        buf.setHex(Math.round(ax + dx - 2 * s), Math.round(ay - 7 * s - 1), "#ffffff");
        buf.setHex(Math.round(ax + dx + s), Math.round(ay - 8 * s), "#ffffff");
      }
      return { buf, ax, ay };
    }
    case "reeds": {
      const buf = new PixelBuffer(24, 30);
      const ax = 12;
      const ay = 26;
      for (let i = 0; i < 6; i++) {
        const x = ax - 7 + Math.round(rand() * 14);
        const h = 12 + Math.round(rand() * 10);
        buf.line(x, ay, x, ay - h, "#6aa857", 1);
        if (i % 2 === 0) buf.rect(x - 1, ay - h - 3, 3, 5, "#8d6238");
      }
      return { buf, ax, ay };
    }
    case "lily": {
      const buf = new PixelBuffer(16, 10);
      buf.ellipse(8, 5, 6, 3, (x) => (x === 9 ? null : "#6fb35a"));
      if (rand() < 0.5) buf.ellipse(6, 4, 1.6, 1.4, "#ffd6e6");
      return { buf, ax: 8, ay: 5 };
    }
    case "lamp": {
      const buf = new PixelBuffer(16, 52);
      const glow = new PixelBuffer(16, 52);
      const ax = 8;
      const ay = 49;
      buf.rect(ax - 1, ay - 38, 3, 38, "#4b4458");
      buf.rect(ax - 3, ay - 3, 7, 3, "#4b4458");
      buf.rect(ax - 5, ay - 46, 11, 9, "#4b4458");
      buf.rect(ax - 4, ay - 45, 9, 7, "#ffe7a3");
      buf.rect(ax - 6, ay - 48, 13, 2, "#3b3346");
      glow.rect(ax - 4, ay - 45, 9, 7, "#ffd27a");
      return { buf, ax, ay, glow };
    }
    case "bench": {
      const buf = new PixelBuffer(44, 26);
      const ax = 22;
      const ay = 20;
      const wood = "#c99a62";
      // Seat along the u axis.
      buf.line(ax - 16, ay - 14, ax + 8, ay - 2, wood, 3);
      buf.line(ax - 16, ay - 19, ax + 8, ay - 7, shade(wood, -0.12), 2);
      buf.line(ax - 14, ay - 12, ax - 14, ay - 6, "#4b4458", 2);
      buf.line(ax + 6, ay - 1, ax + 6, ay + 4, "#4b4458", 2);
      return { buf, ax, ay };
    }
    case "stump": {
      const buf = new PixelBuffer(24, 18);
      buf.rect(5, 6, 14, 9, "#8d6238");
      buf.ellipse(12, 6, 7, 3, "#d6b07a");
      buf.ellipse(12, 6, 4, 1.6, "#b8925f");
      return { buf, ax: 12, ay: 13 };
    }
    case "fountain": {
      // Sits on the 2x2 fountain tiles; anchor is the center of those tiles.
      const buf = new PixelBuffer(140, 90);
      const ax = 70;
      const ay = 58;
      buf.ellipse(ax, ay + 4, 58, 26, "#9a93a8");
      buf.ellipse(ax, ay, 58, 26, "#d6d0dc");
      buf.ellipse(ax, ay + 1, 50, 21, "#6fb8de");
      buf.ellipse(ax - 12, ay - 4, 18, 6, "#9fd3f0");
      // Center column and bowl.
      buf.rect(ax - 6, ay - 30, 12, 30, "#c4bcd4");
      buf.rect(ax + 2, ay - 30, 4, 30, "#a8a0b8");
      buf.ellipse(ax, ay - 30, 18, 7, "#d6d0dc");
      buf.ellipse(ax, ay - 30, 14, 5, "#6fb8de");
      buf.rect(ax - 2, ay - 42, 4, 12, "#c4bcd4");
      return { buf, ax, ay };
    }
    case "floatRock": {
      const s = 0.6 + (variant % 4) * 0.25;
      const w = Math.round(70 * s);
      const h = Math.round(60 * s);
      const buf = new PixelBuffer(w + 4, h + 4);
      const ax = Math.round(w / 2) + 2;
      const ay = Math.round(h * 0.32);
      // Grassy top.
      buf.ellipse(ax, ay, w * 0.45, h * 0.18, (_x, _y, nx, ny) => (ny < -0.3 ? "#b0e294" : nx > 0.4 ? "#7cc06a" : "#9ad582"));
      // Rocky cone underneath.
      buf.poly(
        [
          [ax - w * 0.45, ay + 1],
          [ax + w * 0.45, ay + 1],
          [ax + w * 0.08, ay + h * 0.65],
          [ax - w * 0.05, ay + h * 0.7],
        ],
        (x, y) => (y < ay + 5 ? "#b07e58" : x > ax ? "#7d7590" : (x + y) % 7 === 0 ? "#625a78" : "#9a92a8"),
      );
      if (variant % 3 === 0) {
        buf.rect(ax - 2, ay - 14, 4, 12, "#8d6238");
        buf.ellipse(ax, ay - 18, 8, 7, "#86c46f");
      }
      return { buf, ax, ay };
    }
  }
}
