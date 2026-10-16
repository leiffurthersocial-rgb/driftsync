/**
 * Mini-me sprite composer (v2, 40x56 px). Everything is procedural: poseable limbs drawn as
 * thick lines, layered clothing, hair styles built from ellipses, and a light rim-shading pass.
 *
 * Anchor (between the feet, on the ground) is at (20, 51).
 */
import type { Appearance } from "@/data/schema";
import { PixelBuffer, toSprite, type Sprite } from "../pixel-buffer";
import { mix, shade, hexToRgb } from "../color";

export const SKIN_TONES = ["#ffe6d5", "#f8d1b3", "#efbc94", "#d9a07a", "#c08159", "#9a6443", "#77482f", "#56331f"];
export const HAIR_COLORS = ["#2b2233", "#4a3426", "#7a4b2c", "#a86b3c", "#d6a058", "#efe0b0", "#c4553a", "#8f8a99", "#f4f1ea", "#7c8cf0", "#e28aa8", "#5fae84"];
export const EYE_COLORS = ["#2b2233", "#5b3a29", "#3f6fa8", "#3f7a52", "#7a6a8f", "#8a5a2a"];

export const W = 40;
export const H = 56;
export const AX = 20;
export const AY = 51;
/** Hand height (px above the ground) when hanging from a pull-up bar; designs draw bars to match. */
export const BAR_HEIGHT = 52;
/** Hand height for dips on parallel bars. */
export const PARALLEL_HEIGHT = 26;

const OUTLINE = "#33283f";
const EYE_WHITE = "#ffffff";

export type Legs =
  | "stand"
  | "walkA"
  | "walkB"
  | "runA"
  | "runB"
  | "sit"
  | "bench"
  | "squat"
  | "jack"
  | "tree"
  | "lunge"
  | "crouch"
  | "hang"
  | "hangUp"
  | "dip";
export type Arms =
  | "down"
  | "swingA"
  | "swingB"
  | "up"
  | "wide"
  | "hold"
  | "holdLow"
  | "press"
  | "curl"
  | "camera"
  | "typing"
  | "guitarA"
  | "guitarB"
  | "paint"
  | "water"
  | "bar"
  | "barBent"
  | "dip"
  | "dipBent"
  | "wave"
  | "hammerUp"
  | "hammerDown"
  | "pray"
  | "stretchL"
  | "stretchR"
  | "hips";
export type Eyes = "open" | "closed" | "left" | "right" | "happy" | "up" | "wink";
export type HeldProp =
  | "bookOpen"
  | "bookFlip"
  | "notebook"
  | "laptop"
  | "desk"
  | "dumbbellsUp"
  | "dumbbellsDown"
  | "dumbbellsCurl"
  | "camera"
  | "tripod"
  | "hammerUp"
  | "hammerDown"
  | "anvil"
  | "easel"
  | "brush"
  | "guitar"
  | "can"
  | "flowers"
  | "mat"
  | "bench"
  | "cards"
  | "saw"
  | "log";
export type Fx = "zzz1" | "zzz2" | "note1" | "note2" | "flash" | "sweat" | "sparkle1" | "sparkle2" | "heart" | "poof" | "star";

export interface Pose {
  legs: Legs;
  arms: Arms;
  eyes: Eyes;
  back?: boolean;
  /** Vertical body offset in px (negative = up). */
  bob?: number;
  props?: HeldProp[];
  fx?: Fx | null;
  /** Lying on the ground (nap, stargazing, reading on the grass). */
  lie?: "nap" | "stargaze" | "read";
}

export type Outfit = "casual" | "sport";

/* ---------------- cache ---------------- */

const cache = new Map<string, Sprite>();

export function characterSprite(app: Appearance, pose: Pose, flip = false, outfit: Outfit = "casual"): Sprite {
  const key = `${JSON.stringify(app)}|${JSON.stringify(pose)}|${flip}|${outfit}`;
  let s = cache.get(key);
  if (!s) {
    if (cache.size > 600) cache.clear();
    const buf = drawCharacter(app, pose, outfit);
    if (flip) mirror(buf);
    s = toSprite(buf, AX, AY);
    cache.set(key, s);
  }
  return s;
}

function mirror(buf: PixelBuffer) {
  const { width: w, height: h, data } = buf;
  for (let y = 0; y < h; y++) data.subarray(y * w, y * w + w).reverse();
}

/* ---------------- geometry ---------------- */

type Pt = [number, number];

interface LegPose {
  /** Pelvis/torso lowering (px). */
  drop: number;
  left: Pt[];
  right: Pt[];
}

function legPose(legs: Legs): LegPose {
  // Points: hip → knee → ankle, in canvas coords before `drop` (applied to hips only).
  const hipL: Pt = [17.5, 37];
  const hipR: Pt = [22.5, 37];
  switch (legs) {
    case "walkA":
      return { drop: 0, left: [hipL, [17, 42], [16, 47]], right: [hipR, [23.5, 41.5], [24.5, 45]] };
    case "walkB":
      return { drop: 0, left: [hipL, [16.5, 41.5], [15.5, 45]], right: [hipR, [23, 42], [24, 47]] };
    case "runA":
      return { drop: -1, left: [hipL, [15, 41], [12, 44]], right: [hipR, [25, 40], [25.5, 46]] };
    case "runB":
      return { drop: -1, left: [hipL, [15, 40], [14.5, 46]], right: [hipR, [25, 41], [28, 44]] };
    case "sit":
      return { drop: 9, left: [hipL, [15, 47], [12, 48]], right: [hipR, [25, 47], [28, 48]] };
    case "bench":
      return { drop: 5, left: [hipL, [17, 45], [16.5, 47]], right: [hipR, [23, 45], [23.5, 47]] };
    case "squat":
      return { drop: 6, left: [hipL, [13, 44], [15.5, 47]], right: [hipR, [27, 44], [24.5, 47]] };
    case "jack":
      return { drop: 0, left: [hipL, [14.5, 42], [12, 47]], right: [hipR, [25.5, 42], [28, 47]] };
    case "tree":
      return { drop: 0, left: [hipL, [17.5, 42], [17.5, 47]], right: [hipR, [27, 39], [19.5, 41]] };
    case "lunge":
      return { drop: 3, left: [hipL, [14, 44], [14, 47]], right: [hipR, [25, 44], [28, 47]] };
    case "crouch":
      return { drop: 7, left: [hipL, [15, 41], [16, 47]], right: [hipR, [25, 44], [24, 47]] };
    case "hang":
      return { drop: 0, left: [hipL, [17, 42], [18, 46]], right: [hipR, [23, 42], [22, 46]] };
    case "hangUp":
      return { drop: -6, left: [hipL, [16.5, 40], [18, 43]], right: [hipR, [23.5, 40], [22, 43]] };
    case "dip":
      return { drop: -2, left: [hipL, [17, 42], [16.5, 45]], right: [hipR, [23, 42], [23.5, 45]] };
    default:
      return { drop: 0, left: [hipL, [17.5, 42], [17.5, 47]], right: [hipR, [22.5, 42], [22.5, 47]] };
  }
}

interface ArmPose {
  left: Pt[];
  right: Pt[];
}

/** Shoulder → elbow → hand, relative to the torso (shoulders at y=27 before upper-body offset). */
function armPose(arms: Arms): ArmPose {
  const sl: Pt = [13.5, 27];
  const sr: Pt = [26.5, 27];
  switch (arms) {
    case "swingA":
      return { left: [sl, [12, 31], [12.5, 35]], right: [sr, [28, 30], [29.5, 33]] };
    case "swingB":
      return { left: [sl, [12, 30], [10.5, 33]], right: [sr, [28, 31], [27.5, 35]] };
    case "up":
      return { left: [sl, [11, 22], [11.5, 16]], right: [sr, [29, 22], [28.5, 16]] };
    case "wide":
      return { left: [sl, [9, 23], [6, 18]], right: [sr, [31, 23], [34, 18]] };
    case "hold":
      return { left: [sl, [12.5, 32], [16, 33]], right: [sr, [27.5, 32], [24, 33]] };
    case "holdLow":
      return { left: [sl, [12.5, 33], [16, 36]], right: [sr, [27.5, 33], [24, 36]] };
    case "press":
      return { left: [sl, [10, 22], [11, 15]], right: [sr, [30, 22], [29, 15]] };
    case "curl":
      return { left: [sl, [12.5, 33], [13, 27]], right: [sr, [27.5, 33], [27, 27]] };
    case "camera":
      return { left: [sl, [12, 26], [16, 21]], right: [sr, [28, 26], [24, 21]] };
    case "typing":
      return { left: [sl, [13, 33], [16, 35]], right: [sr, [27, 33], [24, 35]] };
    case "guitarA":
      return { left: [sl, [11, 31], [9, 30]], right: [sr, [27, 32], [23, 34]] };
    case "guitarB":
      return { left: [sl, [11, 31], [9, 29]], right: [sr, [27, 31], [23, 32]] };
    case "paint":
      return { left: [sl, [12.5, 32], [14, 34]], right: [sr, [30, 26], [33, 22]] };
    case "water":
      return { left: [sl, [12.5, 32], [13, 36]], right: [sr, [29, 31], [32, 32]] };
    case "bar":
      return { left: [sl, [12, 18], [12.5, 7]], right: [sr, [28, 18], [27.5, 7]] };
    case "barBent":
      // Body raised by 6px: hands stay on the bar (y=7 after the offset), elbows flare out.
      return { left: [sl, [7.5, 21], [12.5, 13]], right: [sr, [32.5, 21], [27.5, 13]] };
    case "dip":
      return { left: [sl, [11, 29], [11, 31]], right: [sr, [29, 29], [29, 31]] };
    case "dipBent":
      // Body lowered by 3px: elbows bend back, hands stay on the bars.
      return { left: [sl, [9, 25], [11, 28]], right: [sr, [31, 25], [29, 28]] };
    case "wave":
      return { left: [sl, [12, 31], [12.5, 35]], right: [sr, [30, 23], [31, 17]] };
    case "hammerUp":
      return { left: [sl, [12.5, 32], [15, 34]], right: [sr, [30, 23], [29, 17]] };
    case "hammerDown":
      return { left: [sl, [12.5, 32], [15, 34]], right: [sr, [29, 31], [31, 35]] };
    case "pray":
      return { left: [sl, [13, 31], [19, 29]], right: [sr, [27, 31], [21, 29]] };
    case "stretchL":
      return { left: [sl, [9, 22], [7, 16]], right: [sr, [23, 20], [15, 15]] };
    case "stretchR":
      return { left: [sl, [17, 20], [25, 15]], right: [sr, [31, 22], [33, 16]] };
    case "hips":
      return { left: [sl, [10.5, 31], [14, 34]], right: [sr, [29.5, 31], [26, 34]] };
    default:
      return { left: [sl, [12.5, 31], [12.5, 36]], right: [sr, [27.5, 31], [27.5, 36]] };
  }
}

/* ---------------- drawing ---------------- */

interface Colors {
  skin: string;
  skinShade: string;
  hair: string;
  hairShade: string;
  top: string;
  topShade: string;
  bottom: string;
  bottomShade: string;
  shoes: string;
  sole: string;
}

interface Wear {
  top: Appearance["top"] | "sport";
  pattern: Appearance["topPattern"];
  bottom: Appearance["bottom"];
  headwear: Appearance["headwear"];
  sport: boolean;
}

export function drawCharacter(app: Appearance, pose: Pose, outfit: Outfit = "casual"): PixelBuffer {
  if (pose.lie) return drawLying(app, pose, outfit);
  const buf = new PixelBuffer(W, H);
  const sport = outfit === "sport";
  const skin = SKIN_TONES[app.skin] ?? SKIN_TONES[1];
  const c: Colors = {
    skin,
    skinShade: shade(skin, -0.16),
    hair: app.hairColor,
    hairShade: shade(app.hairColor, -0.25),
    top: sport ? app.sportColor : app.outfitColor,
    topShade: shade(sport ? app.sportColor : app.outfitColor, -0.2),
    bottom: sport ? "#3b3850" : app.top === "overalls" ? app.bottomColor : app.bottomColor,
    bottomShade: shade(sport ? "#3b3850" : app.bottomColor, -0.2),
    shoes: sport ? "#f4f1ea" : app.shoesColor,
    sole: sport ? app.sportColor : shade(app.shoesColor, -0.3),
  };
  const wear: Wear = {
    top: sport ? "sport" : app.top,
    pattern: sport ? "solid" : app.topPattern,
    bottom: sport ? "shorts" : app.top === "dress" ? "skirt" : app.bottom,
    headwear: sport ? (app.headwear === "cap" || app.headwear === "headphones" ? app.headwear : "headband") : app.headwear,
    sport,
  };
  const legs = legPose(pose.legs);
  const ub = (pose.bob ?? 0) + legs.drop; // upper-body offset
  const back = !!pose.back;
  const props = pose.props ?? [];

  if (props.includes("mat")) drawMat(buf);
  if (props.includes("bench")) drawBench(buf);
  if (props.includes("tripod")) drawTripod(buf);
  if (props.includes("easel")) drawEasel(buf);
  if (props.includes("anvil")) drawAnvil(buf);
  if (props.includes("log")) drawLog(buf);

  // Hair that falls behind the body.
  drawHairBack(buf, app.hairStyle, c, ub, back);

  // Legs and shoes.
  drawLegs(buf, legs, c, wear);

  // Torso.
  drawTorso(buf, c, wear, ub, back, app);

  // Arms behind props like the desk are drawn after the desk.
  if (props.includes("desk")) drawDesk(buf, ub);
  if (props.includes("guitar") && !back) drawGuitar(buf, ub);

  // Head.
  const hx = 20;
  const hy = 15 + ub;
  buf.rect(18, 22 + ub, 5, 4, c.skinShade); // neck
  buf.ellipse(hx, hy, 9, 8.5, (_x, _y, nx, ny) => (nx + ny * 0.4 > 0.72 ? c.skinShade : c.skin));
  // Ears.
  buf.ellipse(hx - 9, hy + 1.5, 1.6, 2.2, c.skin);
  buf.ellipse(hx + 9, hy + 1.5, 1.6, 2.2, c.skinShade);
  if (!back) drawFace(buf, app, pose.eyes, hx, hy, c, sport);
  drawHairFront(buf, app.hairStyle, c, hx, hy, back);
  drawHeadwear(buf, wear.headwear, app, hx, hy, back, sport);
  if (!back) drawEyewear(buf, app.eyewear, hx, hy);
  if (!sport) drawNeckwear(buf, app, ub, back);
  if (app.backpack && !sport) drawBackpack(buf, ub, back);

  // Arms on top.
  drawArms(buf, armPose(pose.arms), c, wear, ub);
  for (const p of props) drawProp(buf, p, ub);

  rimShade(buf);
  buf.outline(OUTLINE);
  if (pose.fx) drawFx(buf, pose.fx, ub);
  return buf;
}

function drawLegs(buf: PixelBuffer, legs: LegPose, c: Colors, wear: Wear) {
  for (const side of ["left", "right"] as const) {
    const pts = legs[side].map(([x, y], i) => [x, i === 0 ? y + legs.drop : y] as Pt);
    const [hip, knee, ankle] = pts;
    const thigh = side === "left" ? c.bottom : c.bottomShade;
    const shin =
      wear.bottom === "pants" ? (side === "left" ? c.bottom : c.bottomShade) : side === "left" ? c.skin : c.skinShade;
    buf.line(hip[0], hip[1], knee[0], knee[1], wear.bottom === "skirt" ? c.skin : thigh, 5);
    buf.line(knee[0], knee[1], ankle[0], ankle[1], shin, 4);
    if (wear.bottom === "shorts") {
      // Shorts cover the upper thigh.
      const mx = (hip[0] + knee[0]) / 2;
      const my = (hip[1] + knee[1]) / 2;
      buf.line(hip[0], hip[1], mx, my + 1, thigh, 6);
    }
    // Shoe: a little rounded block pointing outward.
    const dir = side === "left" ? -1 : 1;
    const sx = Math.round(ankle[0]);
    const sy = Math.round(ankle[1]);
    buf.rect(sx - 2 + (dir < 0 ? -1 : 0), sy + 1, 6, 3, c.shoes);
    buf.rect(sx - 2 + (dir < 0 ? -1 : 0), sy + 3, 6, 1, c.sole);
  }
  if (wear.bottom === "skirt" || wear.top === "dress") {
    const top = 35 + legs.drop;
    buf.poly(
      [
        [14, top],
        [26, top],
        [28.5, top + 8],
        [11.5, top + 8],
      ],
      (_x, y) => ((y - top) % 3 === 2 ? c.bottomShade : c.bottom),
    );
  }
}

function patternFor(base: string, pattern: Wear["pattern"]) {
  const stripe = shade(base, 0.35);
  const dot = shade(base, 0.45);
  return (x: number, y: number): string => {
    if (pattern === "stripes" && y % 4 === 0) return stripe;
    if (pattern === "dots" && (x + (y % 6 < 3 ? 0 : 3)) % 6 === 0 && y % 3 === 0) return dot;
    return x >= 24 ? shade(base, -0.16) : base;
  };
}

function drawTorso(buf: PixelBuffer, c: Colors, wear: Wear, ub: number, back: boolean, app: Appearance) {
  const y0 = 24 + ub;
  const y1 = 38 + ub;
  const fill = patternFor(c.top, wear.pattern);
  const shoulders: [number, number][] =
    wear.top === "tank" || wear.top === "sport"
      ? [
          [15, y0 + 1],
          [25, y0 + 1],
          [26, y1],
          [14, y1],
        ]
      : [
          [14, y0 + 2],
          [15.5, y0],
          [24.5, y0],
          [26, y0 + 2],
          [26.5, y1],
          [13.5, y1],
        ];
  buf.poly(shoulders, (x, y) => fill(x, y));
  if (wear.top === "dress") {
    // Dress uses the top color for the skirt too.
    buf.poly(
      [
        [14, y1 - 1],
        [26, y1 - 1],
        [29, y1 + 8],
        [11, y1 + 8],
      ],
      (x, y) => fill(x, y),
    );
  }
  if (back) {
    if (wear.top === "hoodie") buf.ellipse(20, y0 + 2, 6, 3, c.topShade);
    return;
  }
  switch (wear.top) {
    case "tee":
    case "sport":
      buf.rect(18, y0, 5, 2, c.skin);
      buf.setHex(19, y0 + 2, c.skin);
      buf.setHex(20, y0 + 2, c.skin);
      buf.setHex(21, y0 + 2, c.skin);
      if (wear.sport) {
        buf.rect(16, y0 + 1, 1, 6, shade(c.top, 0.3));
        buf.rect(24, y0 + 1, 1, 6, shade(c.top, 0.3));
      }
      break;
    case "tank":
      buf.rect(17, y0, 7, 3, c.skin);
      break;
    case "hoodie":
      buf.ellipse(20, y0 + 1, 5, 2.5, c.topShade);
      buf.rect(18, y0 + 2, 1, 4, "#f4f1ea");
      buf.rect(22, y0 + 2, 1, 4, "#f4f1ea");
      buf.rect(16, y0 + 9, 9, 3, c.topShade);
      break;
    case "sweater":
      buf.rect(17, y0, 7, 2, c.topShade);
      buf.rect(14, y1 - 2, 13, 2, c.topShade);
      break;
    case "shirt":
      buf.poly(
        [
          [16.5, y0],
          [20, y0 + 4],
          [23.5, y0],
        ],
        "#f6f2ea",
      );
      for (let i = 0; i < 4; i++) buf.setHex(20, y0 + 5 + i * 2, shade(c.top, -0.35));
      break;
    case "overalls":
      // Bib in the bottom color over the top.
      buf.rect(16, y0 + 4, 9, y1 - y0 - 4, app.bottomColor);
      buf.rect(16, y0, 2, 5, app.bottomColor);
      buf.rect(23, y0, 2, 5, app.bottomColor);
      buf.setHex(17, y0 + 4, "#f2d27a");
      buf.setHex(23, y0 + 4, "#f2d27a");
      buf.rect(18, y0 + 7, 5, 3, shade(app.bottomColor, -0.15));
      break;
    case "dress":
      buf.rect(18, y0, 5, 2, c.skin);
      buf.rect(14, y1 - 3, 13, 1, shade(c.top, 0.35));
      break;
  }
}

function drawArms(buf: PixelBuffer, arms: ArmPose, c: Colors, wear: Wear, ub: number) {
  const longSleeve = wear.top === "hoodie" || wear.top === "sweater" || wear.top === "shirt";
  const noSleeve = wear.top === "tank" || wear.top === "sport";
  for (const side of ["left", "right"] as const) {
    const [s, e, h] = arms[side].map(([x, y]) => [x, y + ub] as Pt);
    const sleeve = side === "left" ? c.top : c.topShade;
    const skin = side === "left" ? c.skin : c.skinShade;
    buf.line(s[0], s[1], e[0], e[1], noSleeve ? skin : sleeve, 3);
    if (!noSleeve && !longSleeve) {
      // Short sleeve ends halfway down the upper arm.
      buf.line(e[0] * 0.5 + s[0] * 0.5, e[1] * 0.5 + s[1] * 0.5, e[0], e[1], skin, 3);
    }
    buf.line(e[0], e[1], h[0], h[1], longSleeve ? sleeve : skin, 3);
    buf.ellipse(h[0], h[1], 1.8, 1.8, c.skin);
  }
}

function drawFace(buf: PixelBuffer, app: Appearance, eyes: Eyes, hx: number, hy: number, c: Colors, sport: boolean) {
  const lx = Math.round(hx - 4);
  const rx = Math.round(hx + 3);
  const ey = Math.round(hy + 1);
  const ink = "#2b2233";
  const iris = app.eyeColor;
  const shift = eyes === "left" ? -1 : eyes === "right" ? 1 : 0;
  const lift = eyes === "up" ? -1 : 0;

  const drawEye = (x: number, isRight: boolean) => {
    const X = x + shift;
    const Y = ey + lift;
    if (eyes === "closed" || (eyes === "wink" && isRight)) {
      buf.rect(X - 1, Y + 1, 3, 1, ink);
      return;
    }
    if (eyes === "happy") {
      buf.setHex(X - 1, Y + 1, ink);
      buf.setHex(X, Y, ink);
      buf.setHex(X + 1, Y + 1, ink);
      return;
    }
    switch (app.eyeStyle) {
      case "dot":
        buf.rect(X, Y, 2, 2, ink);
        break;
      case "sleepy":
        buf.rect(X - 1, Y + 1, 3, 1, ink);
        buf.setHex(X, Y + 2, iris);
        buf.setHex(X + 1, Y + 2, iris);
        break;
      case "sparkle":
        buf.rect(X - 1, Y - 1, 3, 4, iris);
        buf.rect(X - 1, Y + 2, 3, 1, shade(iris, -0.3));
        buf.setHex(X - 1, Y - 1, EYE_WHITE);
        buf.setHex(X + 1, Y + 1, EYE_WHITE);
        break;
      case "lashes":
        buf.rect(X, Y, 2, 3, iris);
        buf.setHex(X, Y, EYE_WHITE);
        buf.setHex(isRight ? X + 2 : X - 1, Y - 1, ink);
        buf.rect(X - 1, Y - 1, 4, 1, ink);
        break;
      default:
        buf.rect(X, Y, 2, 3, iris);
        buf.setHex(X, Y, EYE_WHITE);
    }
  };
  drawEye(lx, false);
  drawEye(rx, true);

  if (app.blush) {
    buf.blend(lx - 2, ey + 4, "#ff8fa3", 0.5);
    buf.blend(lx - 1, ey + 4, "#ff8fa3", 0.5);
    buf.blend(rx + 2, ey + 4, "#ff8fa3", 0.5);
    buf.blend(rx + 3, ey + 4, "#ff8fa3", 0.5);
  }
  if (app.freckles)
    for (const [x, y] of [
      [lx - 2, ey + 3],
      [lx, ey + 4],
      [lx - 1, ey + 5],
      [rx + 1, ey + 3],
      [rx + 3, ey + 4],
      [rx + 2, ey + 5],
    ])
      buf.blend(x, y, "#9a5a3a", 0.55);

  // Mouth.
  const my = ey + 5;
  if (eyes === "happy" || eyes === "wink") {
    buf.rect(19, my, 3, 1, "#8a3b4a");
    buf.setHex(20, my + 1, "#c95f6f");
  } else buf.rect(19, my, 2, 1, "#8a3b4a");
  if (sport && eyes === "closed") buf.rect(19, my, 3, 2, "#8a3b4a");

  switch (app.facialHair) {
    case "stubble":
      for (let x = 13; x <= 27; x++)
        for (let y = my - 1; y <= hy + 8; y++) if ((x + y) % 2 === 0 && Math.hypot((x - hx) / 9, (y - hy) / 8.5) > 0.62) buf.blend(x, y, c.hair, 0.45);
      break;
    case "mustache":
      buf.rect(17, my - 1, 7, 1, c.hair);
      buf.setHex(17, my, c.hair);
      buf.setHex(23, my, c.hair);
      break;
    case "beard":
      buf.ellipse(hx, hy + 5.5, 8, 4.2, (x, y) => (y >= my - 1 && !(x >= 19 && x <= 21 && y === my) ? c.hair : null));
      buf.rect(17, my - 1, 7, 1, c.hair);
      buf.rect(19, my, 2, 1, "#8a3b4a");
      break;
  }
}

/** Hair pixels that sit behind the head/body. */
function drawHairBack(buf: PixelBuffer, style: Appearance["hairStyle"], c: Colors, ub: number, back: boolean) {
  const hy = 15 + ub;
  const tone = (_x: number, _y: number, nx: number) => (nx > 0.4 ? c.hairShade : c.hair);
  switch (style) {
    case "long":
      buf.ellipse(20, hy + 7, 11, 14, tone);
      break;
    case "wavy":
      buf.ellipse(20, hy + 5, 11, 11, (x, y, nx) => ((x + Math.floor(y / 2)) % 4 === 0 ? c.hairShade : tone(x, y, nx)));
      break;
    case "ponytail":
      if (back) buf.ellipse(20, hy + 11, 3, 8, tone);
      else buf.ellipse(29, hy + 6, 3, 7, tone);
      break;
    case "pigtails":
      buf.ellipse(9, hy + 7, 3.2, 6, tone);
      buf.ellipse(31, hy + 7, 3.2, 6, (x, y, nx) => (nx > -0.2 ? c.hairShade : c.hair));
      break;
    case "afro":
      buf.ellipse(20, hy - 2, 13.5, 12.5, (x, y, nx, ny) => ((x * 7 + y * 13) % 5 === 0 ? c.hairShade : nx + ny * 0.4 > 0.5 ? c.hairShade : c.hair));
      break;
    case "curly":
      for (const [dx, dy] of [
        [-9, 2],
        [9, 2],
        [-8, 7],
        [8, 7],
      ])
        buf.ellipse(20 + dx, hy + dy, 3.5, 3.5, tone);
      break;
  }
}

function drawHairFront(buf: PixelBuffer, style: Appearance["hairStyle"], c: Colors, hx: number, hy: number, back: boolean) {
  if (style === "bald") {
    if (!back) buf.blend(hx - 4, hy - 6, "#ffffff", 0.35);
    return;
  }
  const tone = (_x: number, _y: number, nx: number, ny: number) => (nx + ny * 0.3 > 0.55 ? c.hairShade : c.hair);
  const capTo = (limit: number, rx = 9.8, ry = 9.4, dy = -0.6) =>
    buf.ellipse(hx, hy + dy, rx, ry, (x, y, nx, ny) => (y <= limit ? tone(x, y, nx, ny) : null));

  if (back) {
    // Back of the head is (mostly) hair.
    if (style === "mohawk") {
      buf.ellipse(hx, hy, 9, 8.5, (x, y) => (y < hy + 3 ? c.skin : null));
      buf.rect(hx - 2, hy - 11, 5, 16, c.hair);
      return;
    }
    capTo(hy + 7, 9.6, 9.2);
    if (style === "bun") buf.ellipse(hx, hy - 9, 4, 3.6, tone);
    if (style === "spiky")
      for (const sx of [-6, -2, 2, 6])
        buf.poly(
          [
            [hx + sx - 2.5, hy - 6],
            [hx + sx, hy - 12],
            [hx + sx + 2.5, hy - 6],
          ],
          c.hair,
        );
    return;
  }

  switch (style) {
    case "buzz":
      buf.ellipse(hx, hy - 0.3, 9.3, 8.8, (x, y) => (y <= hy - 3 ? ((x + y) % 2 ? c.hair : c.hairShade) : null));
      break;
    case "mohawk":
      buf.rect(hx - 2, hy - 12, 5, 7, c.hair);
      buf.rect(hx + 1, hy - 12, 2, 7, c.hairShade);
      buf.ellipse(hx, hy, 9, 8.5, (x, y) => (y <= hy - 4 && Math.abs(x - hx) > 2 ? (x % 2 ? c.hairShade : null) : null));
      break;
    case "afro":
      capTo(hy - 3, 10, 9.6);
      break;
    case "spiky":
      capTo(hy - 3);
      for (const sx of [-7, -3, 1, 5])
        buf.poly(
          [
            [hx + sx - 2.5, hy - 6],
            [hx + sx + 1, hy - 13],
            [hx + sx + 3, hy - 6],
          ],
          sx > 0 ? c.hairShade : c.hair,
        );
      break;
    case "bun":
      capTo(hy - 3);
      buf.ellipse(hx, hy - 10, 4, 3.6, tone);
      break;
    case "curly":
      capTo(hy - 2, 10.4, 10);
      for (let i = -8; i <= 8; i += 4) buf.ellipse(hx + i, hy - 3, 2.4, 2.2, i > 0 ? c.hairShade : c.hair);
      break;
    case "bob":
      capTo(hy - 3);
      buf.rect(hx - 10, hy - 4, 3, 11, c.hair);
      buf.rect(hx + 8, hy - 4, 3, 11, c.hairShade);
      break;
    case "long":
    case "wavy":
      capTo(hy - 3);
      buf.rect(hx - 10, hy - 4, 3, 12, c.hair);
      buf.rect(hx + 8, hy - 4, 3, 12, c.hairShade);
      break;
    case "ponytail":
    case "pigtails":
      capTo(hy - 3);
      buf.rect(hx - 10, hy - 4, 2, 5, c.hair);
      buf.rect(hx + 9, hy - 4, 2, 5, c.hairShade);
      break;
    default:
      // short
      capTo(hy - 3);
      buf.rect(hx - 10, hy - 4, 2, 6, c.hair);
      buf.rect(hx + 9, hy - 4, 2, 6, c.hairShade);
      // Side-swept fringe.
      buf.poly(
        [
          [hx - 6, hy - 4],
          [hx + 3, hy - 4],
          [hx - 3, hy - 1],
        ],
        c.hair,
      );
  }
}

function drawHeadwear(buf: PixelBuffer, hw: Wear["headwear"], app: Appearance, hx: number, hy: number, back: boolean, sport: boolean) {
  const col = sport && hw === "headband" ? app.sportColor : app.headwearColor;
  const dark = shade(col, -0.22);
  switch (hw) {
    case "cap":
      buf.ellipse(hx, hy - 3, 10, 7.5, (x, y) => (y <= hy - 3 ? (x > hx + 3 ? dark : col) : null));
      if (!back) buf.rect(hx - 11, hy - 4, 16, 2, dark);
      buf.setHex(hx, hy - 10, "#ffffff");
      break;
    case "beanie":
      buf.ellipse(hx, hy - 2, 10, 9, (x, y) => (y <= hy - 2 ? ((x - hx + 20) % 3 === 0 ? dark : col) : null));
      buf.rect(hx - 10, hy - 3, 21, 2, dark);
      buf.ellipse(hx, hy - 12, 2.5, 2.5, "#f4f1ea");
      break;
    case "bucket":
      buf.ellipse(hx, hy - 4, 8.5, 6.5, (x, y) => (y <= hy - 3 ? col : null));
      buf.rect(hx - 12, hy - 3, 25, 2, dark);
      break;
    case "headband":
      buf.rect(hx - 9, hy - 5, 19, 2, col);
      if (back) buf.rect(hx - 1, hy - 4, 3, 5, col);
      break;
    case "headphones":
      buf.line(hx - 9, hy, hx - 7, hy - 9, "#4b4458", 2);
      buf.line(hx - 7, hy - 9, hx + 7, hy - 9, "#4b4458", 2);
      buf.line(hx + 7, hy - 9, hx + 9, hy, "#4b4458", 2);
      buf.ellipse(hx - 9.5, hy + 1, 2.4, 3.2, col);
      buf.ellipse(hx + 9.5, hy + 1, 2.4, 3.2, dark);
      break;
    case "flower":
      if (!back) {
        const fx = hx + 6;
        const fy = hy - 7;
        for (const [dx, dy] of [
          [-2, 0],
          [2, 0],
          [0, -2],
          [0, 2],
        ])
          buf.ellipse(fx + dx, fy + dy, 1.6, 1.6, col);
        buf.setHex(fx, fy, "#ffd166");
      }
      break;
    case "bow":
      buf.poly(
        [
          [hx + 2, hy - 11],
          [hx + 6, hy - 9],
          [hx + 2, hy - 7],
        ],
        col,
      );
      buf.poly(
        [
          [hx + 10, hy - 11],
          [hx + 6, hy - 9],
          [hx + 10, hy - 7],
        ],
        dark,
      );
      buf.rect(hx + 5, hy - 10, 2, 2, dark);
      break;
  }
}

function drawEyewear(buf: PixelBuffer, ew: Appearance["eyewear"], hx: number, hy: number) {
  const frame = "#2f2a3a";
  const ey = Math.round(hy + 1);
  const lx = Math.round(hx - 4);
  const rx = Math.round(hx + 3);
  switch (ew) {
    case "round":
      for (const x of [lx, rx]) {
        buf.ellipse(x + 1, ey + 1.5, 3.2, 3, (px, py, nx, ny) => (nx * nx + ny * ny > 0.5 ? frame : null));
      }
      buf.rect(lx + 4, ey, rx - lx - 4, 1, frame);
      break;
    case "square":
      for (const x of [lx, rx]) {
        buf.rect(x - 2, ey - 1, 6, 1, frame);
        buf.rect(x - 2, ey + 3, 6, 1, frame);
        buf.rect(x - 2, ey - 1, 1, 5, frame);
        buf.rect(x + 3, ey - 1, 1, 5, frame);
      }
      buf.rect(lx + 4, ey, rx - lx - 6, 1, frame);
      break;
    case "sunglasses":
      for (const x of [lx, rx]) {
        buf.rect(x - 2, ey - 1, 6, 4, "#1f1a2a");
        buf.setHex(x - 1, ey, "#8fb8d8");
      }
      buf.rect(lx + 4, ey, rx - lx - 6, 1, "#1f1a2a");
      break;
  }
}

function drawNeckwear(buf: PixelBuffer, app: Appearance, ub: number, back: boolean) {
  const col = app.neckwearColor;
  if (app.neckwear === "scarf") {
    buf.rect(14, 23 + ub, 13, 3, col);
    buf.rect(14, 25 + ub, 13, 1, shade(col, -0.2));
    if (!back) buf.rect(22, 26 + ub, 3, 6, col);
  }
  if (app.neckwear === "necklace" && !back) {
    for (let x = 17; x <= 23; x++) buf.setHex(x, 25 + ub + (x === 17 || x === 23 ? 0 : 1), "#e9c95b");
    buf.rect(19, 27 + ub, 2, 2, col);
  }
}

function drawBackpack(buf: PixelBuffer, ub: number, back: boolean) {
  const pack = "#c9874f";
  if (back) {
    buf.rect(14, 26 + ub, 13, 12, pack);
    buf.rect(14, 31 + ub, 13, 1, shade(pack, -0.25));
    buf.rect(17, 33 + ub, 7, 4, shade(pack, 0.12));
    buf.rect(19, 34 + ub, 3, 1, "#f2d27a");
  } else {
    buf.rect(15, 25 + ub, 2, 9, shade(pack, -0.2));
    buf.rect(24, 25 + ub, 2, 9, shade(pack, -0.2));
  }
}

/* ---------------- props ---------------- */

function drawProp(buf: PixelBuffer, p: HeldProp, ub: number) {
  const metal = "#6b6478";
  const plate = "#3b3346";
  switch (p) {
    case "bookOpen":
    case "bookFlip": {
      const y = 30 + ub;
      buf.rect(13, y, 14, 7, "#ffffff");
      buf.rect(19, y, 2, 7, "#d9d2e6");
      buf.rect(13, y + 6, 14, 2, "#7c8cf0");
      for (let r = 1; r < 5; r += 2) {
        buf.rect(14, y + r, 4, 1, "#c4bcd4");
        buf.rect(22, y + r, 4, 1, "#c4bcd4");
      }
      if (p === "bookFlip") buf.poly([[21, y], [25, y - 3], [26, y + 3]], "#f2eefa");
      break;
    }
    case "notebook":
      buf.rect(23, 27 + ub, 1, 7, "#eea54b");
      buf.setHex(23, 34 + ub, "#4b4458");
      break;
    case "cards":
      buf.rect(14, 28 + ub, 6, 5, "#ffffff");
      buf.rect(15, 29 + ub, 4, 1, "#7c8cf0");
      buf.rect(15, 31 + ub, 3, 1, "#c4bcd4");
      break;
    case "laptop":
      buf.poly([[12, 34 + ub], [28, 34 + ub], [26, 37 + ub], [14, 37 + ub]], "#8f8a99");
      buf.rect(14, 27 + ub, 12, 7, "#4b4458");
      buf.rect(15, 28 + ub, 10, 5, "#9fd3f0");
      buf.rect(16, 29 + ub, 5, 1, "#ffffff");
      break;
    case "dumbbellsUp":
      for (const x of [11, 29]) {
        buf.rect(x - 4, 13 + ub, 9, 2, metal);
        buf.rect(x - 4, 11 + ub, 2, 6, plate);
        buf.rect(x + 3, 11 + ub, 2, 6, plate);
      }
      break;
    case "dumbbellsDown":
      for (const x of [12.5, 27.5]) {
        buf.rect(x - 1, 33 + ub, 2, 7, metal);
        buf.rect(x - 2, 32 + ub, 4, 2, plate);
        buf.rect(x - 2, 39 + ub, 4, 2, plate);
      }
      break;
    case "dumbbellsCurl":
      for (const x of [13, 27]) {
        buf.rect(x - 4, 26 + ub, 9, 2, metal);
        buf.rect(x - 4, 24 + ub, 2, 6, plate);
        buf.rect(x + 3, 24 + ub, 2, 6, plate);
      }
      break;
    case "camera":
      buf.rect(14, 17 + ub, 12, 7, "#3b3346");
      buf.rect(17, 15 + ub, 4, 2, "#3b3346");
      buf.ellipse(20, 20.5 + ub, 2.6, 2.6, "#9fd3f0");
      buf.setHex(19, 19 + ub, "#ffffff");
      buf.rect(23, 18 + ub, 2, 1, "#e7795f");
      break;
    case "hammerUp":
      buf.line(29, 17 + ub, 29, 9 + ub, "#8d6238", 2);
      buf.rect(25, 6 + ub, 9, 4, metal);
      break;
    case "hammerDown":
      buf.line(31, 35 + ub, 36, 37 + ub, "#8d6238", 2);
      buf.rect(34, 33 + ub, 4, 8, metal);
      break;
    case "brush":
      buf.line(33, 22 + ub, 36, 15 + ub, "#8d6238", 1);
      buf.setHex(36, 14 + ub, "#e7795f");
      buf.ellipse(14, 34 + ub, 4, 2.5, "#f4e4c8");
      buf.setHex(12, 34 + ub, "#e7795f");
      buf.setHex(14, 33 + ub, "#4f9cc4");
      buf.setHex(16, 34 + ub, "#5fae84");
      break;
    case "can":
      buf.rect(31, 30 + ub, 6, 5, "#5fae84");
      buf.line(36, 31 + ub, 39, 28 + ub, "#5fae84", 1);
      buf.setHex(39, 30 + ub, "#9fd3f0");
      buf.setHex(39, 33 + ub, "#9fd3f0");
      break;
    case "flowers":
      for (const [x, col] of [
        [33, "#ff8fab"],
        [36, "#ffd166"],
      ] as const) {
        buf.rect(x, 45, 1, 5, "#5f9e4c");
        buf.ellipse(x, 44, 1.6, 1.6, col);
      }
      break;
    case "saw":
      buf.poly([[26, 33 + ub], [37, 37 + ub], [37, 40 + ub], [26, 36 + ub]], "#c4bcd4");
      buf.rect(23, 32 + ub, 4, 4, "#8d6238");
      break;
    default:
  }
}

function drawDesk(buf: PixelBuffer, ub: number) {
  const y = 35 + Math.max(0, ub);
  buf.rect(5, y, 30, 3, "#b9864f");
  buf.rect(5, y + 3, 30, 1, "#8d6238");
  buf.rect(7, y + 4, 2, 47 - y, "#8d6238");
  buf.rect(31, y + 4, 2, 47 - y, "#8d6238");
  buf.rect(8, y - 3, 6, 3, "#ffffff");
  buf.rect(8, y - 4, 6, 1, "#7c8cf0");
  buf.rect(28, y - 5, 4, 5, "#e7795f");
}

function drawGuitar(buf: PixelBuffer, ub: number) {
  buf.line(6, 27 + ub, 18, 33 + ub, "#8d6238", 2);
  buf.ellipse(21, 35 + ub, 5, 4, "#d9774f");
  buf.ellipse(25, 37 + ub, 4, 3.5, "#d9774f");
  buf.ellipse(22.5, 36 + ub, 1.4, 1.4, "#3b3346");
  buf.rect(4, 25 + ub, 3, 3, "#5d4a5e");
}

function drawMat(buf: PixelBuffer) {
  buf.poly([[2, 47], [38, 47], [36, 53], [4, 53]], "#a888de");
  buf.poly([[2, 47], [38, 47], [38, 48], [2, 48]], "#c4b0f0");
}

function drawBench(buf: PixelBuffer) {
  buf.rect(5, 42, 30, 3, "#c99a62");
  buf.rect(5, 45, 30, 1, "#a97c4a");
  buf.rect(7, 46, 2, 5, "#4b4458");
  buf.rect(31, 46, 2, 5, "#4b4458");
}

function drawTripod(buf: PixelBuffer) {
  const k = "#3b3346";
  buf.line(32, 30, 28, 51, k, 1);
  buf.line(32, 30, 36, 51, k, 1);
  buf.line(32, 30, 32, 51, k, 1);
  buf.rect(28, 24, 9, 6, k);
  buf.ellipse(28, 27, 2, 2, "#9fd3f0");
}

function drawEasel(buf: PixelBuffer) {
  const wood = "#8d6238";
  buf.line(31, 20, 27, 51, wood, 1);
  buf.line(35, 20, 39, 51, wood, 1);
  buf.rect(26, 19, 13, 15, "#ffffff");
  buf.rect(28, 22, 4, 4, "#e7795f");
  buf.rect(31, 26, 6, 3, "#4f9cc4");
  buf.rect(28, 29, 7, 2, "#5fae84");
}

function drawAnvil(buf: PixelBuffer) {
  buf.poly([[29, 41], [39, 41], [37, 44], [31, 44]], "#5b5568");
  buf.rect(32, 44, 4, 4, "#4b4458");
  buf.rect(30, 48, 8, 3, "#5b5568");
}

function drawLog(buf: PixelBuffer) {
  buf.ellipse(33, 45, 6, 3, "#a97c4a");
  buf.ellipse(28, 45, 2, 3, "#e0c08a");
}

/* ---------------- lying poses ---------------- */

function drawLying(app: Appearance, pose: Pose, outfit: Outfit): PixelBuffer {
  const buf = new PixelBuffer(W, H);
  const sport = outfit === "sport";
  const skin = SKIN_TONES[app.skin] ?? SKIN_TONES[1];
  const top = sport ? app.sportColor : app.outfitColor;
  const bottom = sport ? "#3b3850" : app.bottomColor;
  // Blanket for naps.
  if (pose.lie === "nap") buf.poly([[3, 46], [37, 46], [39, 52], [1, 52]], "#e7b0b8");
  // Legs (to the right), torso, head (left).
  buf.rect(26, 43, 10, 4, bottom);
  buf.rect(36, 42, 3, 5, sport ? "#f4f1ea" : app.shoesColor);
  buf.rect(14, 41, 13, 7, top);
  buf.rect(14, 46, 13, 1, shade(top, -0.2));
  buf.ellipse(8, 43, 7.5, 6.5, (x, y, nx, ny) => (ny > 0.5 ? shade(skin, -0.15) : skin));
  // Hair on the "top" (left/up) side of the head.
  buf.ellipse(7, 41, 7.5, 5.5, (x, y, nx, ny) => (nx < -0.1 || ny < -0.4 ? (app.hairStyle === "bald" ? null : app.hairColor) : null));
  const ink = "#2b2233";
  if (pose.lie === "stargaze") {
    buf.rect(8, 43, 2, 1, ink);
    buf.rect(12, 43, 2, 1, ink);
    buf.setHex(8, 42, "#ffffff");
  } else {
    buf.rect(8, 44, 2, 1, ink);
    buf.rect(12, 44, 2, 1, ink);
  }
  if (app.blush) buf.blend(10, 46, "#ff8fa3", 0.5);
  // Arm and book.
  if (pose.lie === "read") {
    buf.line(17, 41, 13, 35, skin, 3);
    buf.rect(6, 31, 12, 5, "#ffffff");
    buf.rect(11, 31, 2, 5, "#d9d2e6");
    buf.rect(6, 35, 12, 1, "#7c8cf0");
  } else buf.line(17, 44, 24, 44, shade(top, -0.1), 3);
  if (pose.lie === "nap") buf.poly([[14, 45], [37, 45], [38, 50], [14, 50]], "#f4c6cc");
  rimShade(buf);
  buf.outline(OUTLINE);
  if (pose.fx) drawFx(buf, pose.fx, 8);
  return buf;
}

/* ---------------- effects & shading ---------------- */

/** Light from the top-left: darken pixels on the right/bottom silhouette edge, lift the top edge. */
function rimShade(buf: PixelBuffer) {
  const { width: w, height: h, data } = buf;
  const src = data.slice();
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 > 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      const rgbHex = (v: number) => "#" + [v & 255, (v >>> 8) & 255, (v >>> 16) & 255].map((n) => n.toString(16).padStart(2, "0")).join("");
      const cur = rgbHex(src[y * w + x]);
      if (!solid(x + 1, y) || !solid(x, y + 1)) buf.setHex(x, y, shade(cur, -0.12));
      else if (!solid(x, y - 1)) buf.setHex(x, y, shade(cur, 0.12));
    }
  void hexToRgb;
}

function drawFx(buf: PixelBuffer, fx: Fx, ub: number) {
  const set = (x: number, y: number, c: string) => buf.setHex(x, y, c);
  switch (fx) {
    case "zzz1":
    case "zzz2": {
      const o = fx === "zzz1" ? 0 : 3;
      const z = (x: number, y: number, s: number) => {
        for (let i = 0; i < s; i++) set(x + i, y, "#ffffff");
        for (let i = 0; i < s; i++) set(x + s - 1 - i, y + i, "#ffffff");
        for (let i = 0; i < s; i++) set(x + i, y + s - 1, "#ffffff");
      };
      z(29 + o, 8 - o + ub * 0, 4);
      z(34 - o, 2 + o, 3);
      return;
    }
    case "note1":
    case "note2": {
      const o = fx === "note1" ? 0 : 3;
      const c = "#ffd166";
      buf.rect(33, 2 + o, 1, 6, c);
      buf.rect(33, 2 + o, 3, 1, c);
      buf.ellipse(32, 8 + o, 1.6, 1.3, c);
      return;
    }
    case "flash":
      for (const [x, y] of [
        [5, 18],
        [3, 16],
        [7, 16],
        [5, 14],
        [1, 18],
        [9, 18],
        [5, 22],
        [3, 20],
        [7, 20],
      ])
        set(x, y + ub, "#fffbe6");
      return;
    case "sweat":
      set(31, 10 + ub, "#9fd3f0");
      set(31, 11 + ub, "#9fd3f0");
      set(30, 12 + ub, "#9fd3f0");
      set(31, 12 + ub, "#cfeaf8");
      return;
    case "sparkle1":
    case "sparkle2":
    case "star": {
      const [x, y] = fx === "sparkle1" ? [34, 6] : fx === "sparkle2" ? [5, 10] : [33, 3];
      const c = fx === "star" ? "#ffd166" : "#ffffff";
      set(x, y - 2, c);
      set(x, y - 1, c);
      set(x - 2, y, c);
      set(x - 1, y, c);
      set(x, y, "#ffe08a");
      set(x + 1, y, c);
      set(x + 2, y, c);
      set(x, y + 1, c);
      set(x, y + 2, c);
      return;
    }
    case "heart":
      buf.ellipse(32, 6, 1.6, 1.6, "#ff8fab");
      buf.ellipse(35, 6, 1.6, 1.6, "#ff8fab");
      buf.poly([[30.5, 6.5], [36.5, 6.5], [33.5, 10]], "#ff8fab");
      return;
    case "poof":
      for (const [x, y, r] of [
        [10, 40, 4],
        [30, 38, 4],
        [20, 44, 5],
        [14, 26, 3],
        [27, 24, 3],
      ])
        buf.ellipse(x, y, r, r * 0.8, (px, py, nx, ny) => (nx * nx + ny * ny > 0.4 ? "#ffffff" : "#efe9fb"));
      return;
  }
}

/* ---------------- animations ---------------- */

export type AnimName =
  | "idle"
  | "look"
  | "stretch"
  | "sit"
  | "wave"
  | "walk"
  | "run"
  | "jogInPlace"
  | "study"
  | "studyLaptop"
  | "studyCards"
  | "read"
  | "readLying"
  | "readBench"
  | "curls"
  | "press"
  | "squats"
  | "jacks"
  | "pullups"
  | "dips"
  | "yoga"
  | "photo"
  | "photoTripod"
  | "photoCrouch"
  | "work"
  | "workLaptop"
  | "workSaw"
  | "paint"
  | "guitar"
  | "garden"
  | "rest"
  | "nap"
  | "stargaze"
  | "generic"
  | "change";

export interface Animation {
  fps: number;
  frames: Pose[];
}

const P = (legs: Legs, arms: Arms, eyes: Eyes, extra: Partial<Pose> = {}): Pose => ({ legs, arms, eyes, ...extra });
const L = (lie: NonNullable<Pose["lie"]>, extra: Partial<Pose> = {}): Pose => ({ legs: "stand", arms: "down", eyes: "closed", lie, ...extra });

export const ANIMATIONS: Record<AnimName, Animation> = {
  idle: { fps: 3, frames: [...Array(8).fill(P("stand", "down", "open")), P("stand", "down", "closed"), P("stand", "down", "open", { bob: 0 })] },
  look: { fps: 2, frames: [P("stand", "down", "left"), P("stand", "hips", "left"), P("stand", "down", "open"), P("stand", "down", "right"), P("stand", "hips", "right"), P("stand", "down", "open")] },
  stretch: { fps: 2, frames: [P("stand", "up", "closed", { bob: -1 }), P("stand", "stretchL", "happy", { bob: -1 }), P("stand", "stretchR", "happy", { bob: -1 }), P("stand", "down", "open")] },
  sit: { fps: 2, frames: [P("sit", "holdLow", "open"), P("sit", "holdLow", "open"), P("sit", "holdLow", "open"), P("sit", "holdLow", "closed")] },
  wave: { fps: 4, frames: [P("stand", "wave", "happy"), P("stand", "down", "happy")] },
  walk: { fps: 8, frames: [P("walkA", "swingA", "open"), P("stand", "down", "open", { bob: -1 }), P("walkB", "swingB", "open"), P("stand", "down", "open", { bob: -1 })] },
  run: { fps: 10, frames: [P("runA", "swingB", "open", { bob: -1 }), P("walkA", "swingB", "open"), P("runB", "swingA", "open", { bob: -1 }), P("walkB", "swingA", "open")] },
  jogInPlace: { fps: 8, frames: [P("walkA", "swingB", "open", { bob: -1 }), P("stand", "down", "open"), P("walkB", "swingA", "open", { bob: -1 }), P("stand", "down", "open", { fx: "sweat" })] },
  study: {
    fps: 3,
    frames: [
      P("stand", "typing", "open", { props: ["desk", "notebook"] }),
      P("stand", "typing", "open", { props: ["desk", "notebook"], bob: 1 }),
      P("stand", "typing", "open", { props: ["desk", "notebook"] }),
      P("stand", "typing", "happy", { props: ["desk", "notebook"], bob: 1 }),
    ],
  },
  studyLaptop: {
    fps: 3,
    frames: [
      P("bench", "typing", "open", { props: ["bench", "laptop"] }),
      P("bench", "typing", "open", { props: ["bench", "laptop"], bob: 1 }),
      P("bench", "typing", "closed", { props: ["bench", "laptop"] }),
      P("bench", "typing", "open", { props: ["bench", "laptop"], bob: 1 }),
    ],
  },
  studyCards: {
    fps: 1.5,
    frames: [P("stand", "hold", "open", { props: ["cards"] }), P("stand", "hold", "up", { props: ["cards"] }), P("stand", "hold", "happy", { props: ["cards"], fx: "star" }), P("stand", "hold", "open", { props: ["cards"] })],
  },
  read: {
    fps: 1.5,
    frames: [P("sit", "hold", "open", { props: ["bookOpen"] }), P("sit", "hold", "open", { props: ["bookOpen"] }), P("sit", "hold", "closed", { props: ["bookOpen"] }), P("sit", "hold", "open", { props: ["bookFlip"] })],
  },
  readBench: {
    fps: 1.5,
    frames: [P("bench", "hold", "open", { props: ["bench", "bookOpen"] }), P("bench", "hold", "open", { props: ["bench", "bookOpen"] }), P("bench", "hold", "happy", { props: ["bench", "bookFlip"] })],
  },
  readLying: { fps: 1, frames: [L("read", { eyes: "open" }), L("read", { eyes: "open" }), L("read", { eyes: "open", fx: "heart" })] },
  curls: {
    fps: 2,
    frames: [P("stand", "curl", "closed", { props: ["dumbbellsCurl"] }), P("stand", "down", "open", { props: ["dumbbellsDown"], fx: "sweat" })],
  },
  press: {
    fps: 2,
    frames: [P("stand", "press", "closed", { props: ["dumbbellsUp"], bob: -1 }), P("stand", "curl", "open", { props: ["dumbbellsCurl"], fx: "sweat" })],
  },
  squats: { fps: 2, frames: [P("squat", "hold", "closed"), P("stand", "hold", "open", { fx: "sweat" })] },
  jacks: { fps: 4, frames: [P("jack", "wide", "happy", { bob: -2 }), P("stand", "down", "open")] },
  pullups: { fps: 1.5, frames: [P("hang", "bar", "open"), P("hangUp", "barBent", "closed", { fx: "sweat" })] },
  dips: { fps: 1.5, frames: [P("dip", "dip", "open"), P("dip", "dipBent", "closed", { bob: 3 })] },
  yoga: {
    fps: 0.6,
    frames: [P("tree", "pray", "closed", { props: ["mat"] }), P("tree", "up", "closed", { props: ["mat"] }), P("lunge", "wide", "closed", { props: ["mat"] }), P("stand", "pray", "happy", { props: ["mat"] })],
  },
  photo: {
    fps: 2,
    frames: [P("stand", "camera", "open", { props: ["camera"] }), P("stand", "camera", "open", { props: ["camera"] }), P("stand", "camera", "open", { props: ["camera"], fx: "flash" }), P("stand", "down", "happy")],
  },
  photoTripod: {
    fps: 1.5,
    frames: [P("stand", "hips", "right", { props: ["tripod"] }), P("stand", "wave", "happy", { props: ["tripod"] }), P("stand", "hips", "open", { props: ["tripod"], fx: "flash" })],
  },
  photoCrouch: {
    fps: 1.5,
    frames: [P("crouch", "camera", "open", { props: ["camera", "flowers"] }), P("crouch", "camera", "open", { props: ["camera", "flowers"], fx: "flash" })],
  },
  work: { fps: 3, frames: [P("stand", "hammerUp", "open", { props: ["hammerUp", "anvil"] }), P("stand", "hammerDown", "closed", { props: ["hammerDown", "anvil"], bob: 1, fx: "sparkle1" })] },
  workLaptop: {
    fps: 3,
    frames: [
      P("bench", "typing", "open", { props: ["bench", "laptop"] }),
      P("bench", "typing", "right", { props: ["bench", "laptop"], bob: 1 }),
      P("bench", "typing", "open", { props: ["bench", "laptop"] }),
    ],
  },
  workSaw: { fps: 3, frames: [P("lunge", "typing", "open", { props: ["saw", "log"] }), P("lunge", "hold", "closed", { props: ["saw", "log"], bob: 1 })] },
  paint: { fps: 1.5, frames: [P("stand", "paint", "open", { props: ["easel", "brush"] }), P("stand", "hold", "happy", { props: ["easel", "brush"] }), P("stand", "paint", "right", { props: ["easel", "brush"], fx: "sparkle2" })] },
  guitar: { fps: 3, frames: [P("bench", "guitarA", "closed", { props: ["bench", "guitar"], fx: "note1" }), P("bench", "guitarB", "happy", { props: ["bench", "guitar"], fx: "note2" })] },
  garden: { fps: 2, frames: [P("stand", "water", "open", { props: ["can", "flowers"] }), P("stand", "water", "happy", { props: ["can", "flowers"], bob: 1 })] },
  rest: { fps: 1.2, frames: [P("sit", "holdLow", "closed", { fx: "zzz1" }), P("sit", "holdLow", "closed", { fx: "zzz2", bob: 1 })] },
  nap: { fps: 1, frames: [L("nap", { fx: "zzz1" }), L("nap", { fx: "zzz2" })] },
  stargaze: { fps: 0.8, frames: [L("stargaze", { eyes: "open" }), L("stargaze", { eyes: "open", fx: "star" })] },
  generic: { fps: 2, frames: [P("stand", "swingA", "happy", { fx: "sparkle1" }), P("stand", "swingB", "open", { bob: -1, fx: "sparkle2" })] },
  change: { fps: 6, frames: [P("stand", "down", "closed", { fx: "poof" }), P("stand", "up", "happy", { fx: "poof", bob: -1 })] },
};

export function frameAt(anim: AnimName, timeSec: number): Pose {
  const a = ANIMATIONS[anim];
  const i = Math.floor(Math.max(0, timeSec) * a.fps) % a.frames.length;
  return a.frames[i];
}

/** Which colors the creator offers for skin (re-exported for UI). */
export const SKIN_LABELS = SKIN_TONES.map((_, i) => `Tone ${i + 1}`);
export { mix };
