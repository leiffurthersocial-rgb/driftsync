/**
 * Mini-me sprite composer. Built from small palette-indexed matrices (head, hair styles,
 * accessories) plus procedural limbs, so every pose and customization is generated in code.
 *
 * Canvas is 24x30 px; the body occupies the middle and props/effects use the margins.
 * Anchor (feet) is at (12, 27).
 */
import type { Appearance } from "@/data/schema";
import { PixelBuffer, toSprite, type Sprite } from "../pixel-buffer";
import { shade, mix } from "../color";

export const SKIN_TONES = ["#ffe3cf", "#f6c9a5", "#e3a77f", "#c68457", "#8f5a3a", "#5e3a26"];
export const HAIR_COLORS = ["#2b2233", "#4a3426", "#8a5a35", "#d6a058", "#efe0b0", "#c4553a", "#7c8cf0", "#e28aa8", "#f4f1ea"];

const W = 24;
const H = 30;
const AX = 12;
const AY = 27;
/** Offset of the 16x22 body grid inside the canvas. */
const OX = 4;
const OY = 5;

const EYE = "#2b2233";
const SHOE = "#4b4458";
const OUTLINE = "#3d3352";

export type Legs = "stand" | "walkA" | "walkB" | "runA" | "runB" | "sit";
export type Arms = "down" | "swingA" | "swingB" | "up" | "hold" | "holdHigh" | "wave" | "camera";
export type Eyes = "open" | "closed" | "left" | "right" | "happy";
export type HeldProp =
  | "bookOpen"
  | "bookFlip"
  | "notebook"
  | "dumbbellUp"
  | "dumbbellDown"
  | "camera"
  | "hammerUp"
  | "hammerDown"
  | "brush"
  | "desk";
export type Fx = "zzz1" | "zzz2" | "note1" | "note2" | "flash" | "sweat" | "sparkle1" | "sparkle2";

export interface Pose {
  legs: Legs;
  arms: Arms;
  eyes: Eyes;
  back?: boolean;
  /** Vertical body offset in px (negative = up). */
  bob?: number;
  props?: HeldProp[];
  fx?: Fx | null;
}

/* ---------- matrices ---------- */

/** Head: S skin, s shade, C blush. Eyes are painted separately. 8x8 at body (4,3). */
const HEAD = ["..SSSS..", ".SSSSSS.", "SSSSSSSS", "SSSSSSSS", "SSSSSSSS", "SCSSSSCS", ".SSSSSS.", "..ssss.."];

/** Hair overlays (10 wide, placed at body (3,1)). H hair, h hair shade. */
const HAIR: Record<Appearance["hairStyle"], { front: string[]; back: string[] }> = {
  short: {
    front: ["..........", "...hHHH...", "..HHHHHHh.", ".HHHHHHHHh", ".HHHHHHHHh", ".HH.....Hh", ".H......h."],
    back: ["..........", "...hHHH...", "..HHHHHHh.", ".HHHHHHHHh", ".HHHHHHHHh", ".HHHHHHHHh", ".HHHHHHHHh", ".hHHHHHHh.", "..hhhhhh.."],
  },
  long: {
    front: ["..........", "...hHHH...", "..HHHHHHh.", ".HHHHHHHHh", ".HHHHHHHHh", ".HH.....Hh", ".HH.....Hh", ".HH.....Hh", ".Hh.....hh", ".hh......h", ".h.......h"],
    back: ["..........", "...hHHH...", "..HHHHHHh.", ".HHHHHHHHh", ".HHHHHHHHh", ".HHHHHHHHh", ".HHHHHHHHh", ".HHHHHHHHh", ".HHHHHHHHh", ".hHHHHHHHh", ".hhHHHHhhh", "..hhhhhh.."],
  },
  bun: {
    front: ["....HH....", "...hHHh...", "..HHHHHHh.", ".HHHHHHHHh", ".HHHHHHHHh", ".H......Hh"],
    back: ["....HH....", "...hHHh...", "..HHHHHHh.", ".HHHHHHHHh", ".HHHHHHHHh", ".HHHHHHHHh", ".HHHHHHHHh", ".hHHHHHHh.", "..hhhhhh.."],
  },
  spiky: {
    front: [".H..H..H..", ".HH.HH.HH.", "..HHHHHHh.", ".HHHHHHHHh", ".HHHHHHHHh", ".HH.....Hh"],
    back: [".H..H..H..", ".HH.HH.HH.", "..HHHHHHh.", ".HHHHHHHHh", ".HHHHHHHHh", ".HHHHHHHHh", ".HHHHHHHHh", ".hHHHHHHh.", "..hhhhhh.."],
  },
  curly: {
    front: ["..hHHHh...", ".HHHHHHHh.", "HHHHHHHHHh", "HHHHHHHHHh", "HHHHHHHHHh", "HH......Hh", "Hh......hh", ".h.......h"],
    back: ["..hHHHh...", ".HHHHHHHh.", "HHHHHHHHHh", "HHHHHHHHHh", "HHHHHHHHHh", "HHHHHHHHHh", "HHHHHHHHHh", "HHHHHHHHHh", "hHHHHHHHhh", ".hhhhhhhh."],
  },
  bald: { front: [], back: [] },
};

/* ---------- composer ---------- */

const cache = new Map<string, Sprite>();

export function characterSprite(app: Appearance, pose: Pose, flip = false): Sprite {
  const key = `${app.skin}|${app.hairStyle}|${app.hairColor}|${app.outfitColor}|${app.accessory}|${JSON.stringify(pose)}|${flip}`;
  let s = cache.get(key);
  if (!s) {
    if (cache.size > 400) cache.clear();
    const buf = drawCharacter(app, pose);
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

export function drawCharacter(app: Appearance, pose: Pose): PixelBuffer {
  const buf = new PixelBuffer(W, H);
  const skin = SKIN_TONES[app.skin] ?? SKIN_TONES[1];
  const skinShade = shade(skin, -0.14);
  const hair = app.hairColor;
  const hairShade = shade(hair, -0.22);
  const outfit = app.outfitColor;
  const outfitShade = shade(outfit, -0.2);
  const pants = mix("#3d3a5c", outfit, 0.15);
  const sit = pose.legs === "sit";
  const by = OY + (pose.bob ?? 0) + (sit ? 3 : 0);
  const px = (x: number, y: number, c: string) => buf.setHex(OX + x, by + y, c);
  const rect = (x: number, y: number, w: number, h: number, c: string) => buf.rect(OX + x, by + y, w, h, c);
  const back = !!pose.back;

  // Desk sits behind the hands, in front of the body (drawn later).
  // Legs
  drawLegs(pose.legs, rect, pants, shade(pants, -0.18));

  // Torso
  rect(5, 11, 6, 5, outfit);
  rect(10, 11, 1, 5, outfitShade);
  rect(5, 15, 6, 1, outfitShade);
  if (!back) {
    px(7, 11, skinShade);
    px(8, 11, skinShade);
  }
  if (app.accessory === "backpack") {
    if (back) {
      rect(5, 11, 6, 6, "#c9874f");
      rect(5, 13, 6, 1, "#a96a3a");
      rect(7, 14, 2, 1, "#f2d27a");
    } else {
      rect(6, 11, 1, 4, "#a96a3a");
      rect(9, 11, 1, 4, "#a96a3a");
    }
  }

  // Head
  buf.matrix(HEAD, { S: skin, s: skinShade, C: back ? skin : mix(skin, "#ff8fa3", 0.45) }, OX + 4, by + 3);
  if (!back) drawEyes(pose.eyes, px, skinShade);

  // Hair
  const hm = HAIR[app.hairStyle];
  if (back && app.hairStyle === "bald") rect(4, 3, 8, 7, skin);
  else buf.matrix(back ? hm.back : hm.front, { H: hair, h: hairShade }, OX + 3, by + 1);

  // Accessories on the head
  drawHeadAccessory(app.accessory, back, rect, px);

  // Scarf
  if (app.accessory === "scarf") {
    rect(4, 10, 8, 2, "#e7795f");
    rect(4, 11, 8, 1, "#c95f47");
    if (!back) rect(9, 12, 2, 3, "#e7795f");
  }

  // Arms + held props
  const props = pose.props ?? [];
  if (props.includes("desk")) drawDesk(rect);
  drawArms(pose.arms, rect, outfit, outfitShade, skin);
  for (const p of props) drawProp(p, rect, px);

  buf.outline(OUTLINE);
  if (pose.fx) drawFx(pose.fx, buf);
  return buf;
}

type Rect = (x: number, y: number, w: number, h: number, c: string) => void;
type Px = (x: number, y: number, c: string) => void;

function drawLegs(legs: Legs, rect: Rect, pants: string, pantsShade: string) {
  switch (legs) {
    case "sit":
      rect(5, 15, 6, 2, pants);
      rect(4, 16, 3, 1, pantsShade);
      rect(9, 16, 3, 1, pantsShade);
      rect(3, 16, 1, 1, SHOE);
      rect(12, 16, 1, 1, SHOE);
      return;
    case "walkA":
      rect(5, 16, 3, 3, pants);
      rect(8, 16, 3, 2, pantsShade);
      rect(5, 19, 3, 1, SHOE);
      rect(8, 18, 3, 1, SHOE);
      return;
    case "walkB":
      rect(5, 16, 3, 2, pants);
      rect(8, 16, 3, 3, pantsShade);
      rect(5, 18, 3, 1, SHOE);
      rect(8, 19, 3, 1, SHOE);
      return;
    case "runA":
      rect(4, 16, 3, 3, pants);
      rect(9, 16, 3, 1, pantsShade);
      rect(4, 19, 3, 1, SHOE);
      rect(10, 17, 3, 1, SHOE);
      return;
    case "runB":
      rect(5, 16, 3, 1, pants);
      rect(9, 16, 3, 3, pantsShade);
      rect(3, 17, 3, 1, SHOE);
      rect(9, 19, 3, 1, SHOE);
      return;
    default:
      rect(5, 16, 3, 3, pants);
      rect(8, 16, 3, 3, pantsShade);
      rect(5, 19, 3, 1, SHOE);
      rect(8, 19, 3, 1, SHOE);
  }
}

function drawEyes(eyes: Eyes, px: Px, skinShade: string) {
  const ex = eyes === "left" ? -1 : eyes === "right" ? 1 : 0;
  if (eyes === "closed") {
    px(6, 7, skinShade);
    px(9, 7, skinShade);
    px(6, 7, EYE);
    px(9, 7, EYE);
    return;
  }
  if (eyes === "happy") {
    px(5, 7, EYE);
    px(6, 6, EYE);
    px(7, 7, EYE);
    px(8, 7, EYE);
    px(9, 6, EYE);
    px(10, 7, EYE);
    return;
  }
  px(6 + ex, 6, EYE);
  px(6 + ex, 7, EYE);
  px(9 + ex, 6, EYE);
  px(9 + ex, 7, EYE);
}

function drawHeadAccessory(acc: Appearance["accessory"], back: boolean, rect: Rect, px: Px) {
  switch (acc) {
    case "glasses":
      if (back) {
        rect(3, 6, 1, 1, "#3b3346");
        rect(12, 6, 1, 1, "#3b3346");
        return;
      }
      rect(5, 5, 3, 1, "#3b3346");
      rect(8, 5, 3, 1, "#3b3346");
      rect(5, 8, 3, 1, "#3b3346");
      rect(8, 8, 3, 1, "#3b3346");
      px(5, 6, "#3b3346");
      px(5, 7, "#3b3346");
      px(10, 6, "#3b3346");
      px(10, 7, "#3b3346");
      px(7, 6, "#cfe8f5");
      px(8, 6, "#cfe8f5");
      return;
    case "cap":
      rect(4, 2, 8, 3, "#e7795f");
      rect(5, 1, 6, 1, "#e7795f");
      rect(4, 4, 8, 1, "#c95f47");
      if (!back) rect(3, 5, 10, 1, "#c95f47");
      px(8, 1, "#ffffff");
      return;
    case "headphones":
      rect(4, 1, 8, 1, "#4b4458");
      rect(3, 2, 1, 4, "#4b4458");
      rect(12, 2, 1, 4, "#4b4458");
      rect(2, 5, 2, 3, "#7c8cf0");
      rect(12, 5, 2, 3, "#7c8cf0");
      return;
    default:
  }
}

function drawArms(arms: Arms, rect: Rect, outfit: string, outfitShade: string, skin: string) {
  const sleeve = (x: number, y: number, h: number, c = outfit) => rect(x, y, 1, h, c);
  switch (arms) {
    case "up":
      sleeve(4, 8, 3);
      sleeve(11, 8, 3, outfitShade);
      rect(4, 7, 1, 1, skin);
      rect(11, 7, 1, 1, skin);
      return;
    case "holdHigh":
      sleeve(4, 6, 5);
      sleeve(11, 6, 5, outfitShade);
      rect(4, 5, 1, 1, skin);
      rect(11, 5, 1, 1, skin);
      return;
    case "wave":
      sleeve(4, 11, 3);
      rect(4, 14, 1, 1, skin);
      sleeve(11, 8, 3, outfitShade);
      rect(11, 7, 1, 1, skin);
      return;
    case "hold":
      sleeve(4, 11, 2);
      sleeve(11, 11, 2, outfitShade);
      rect(5, 13, 1, 1, skin);
      rect(10, 13, 1, 1, skin);
      return;
    case "camera":
      sleeve(4, 9, 3);
      sleeve(11, 9, 3, outfitShade);
      rect(5, 8, 1, 1, skin);
      rect(10, 8, 1, 1, skin);
      return;
    case "swingA":
      sleeve(4, 11, 2);
      rect(4, 13, 1, 1, skin);
      sleeve(11, 11, 3, outfitShade);
      rect(11, 14, 1, 1, skin);
      return;
    case "swingB":
      sleeve(4, 11, 3);
      rect(4, 14, 1, 1, skin);
      sleeve(11, 11, 2, outfitShade);
      rect(11, 13, 1, 1, skin);
      return;
    default:
      sleeve(4, 11, 3);
      sleeve(11, 11, 3, outfitShade);
      rect(4, 14, 1, 1, skin);
      rect(11, 14, 1, 1, skin);
  }
}

function drawDesk(rect: Rect) {
  rect(1, 14, 14, 2, "#b9864f");
  rect(1, 16, 14, 1, "#8d6238");
  rect(2, 17, 1, 3, "#8d6238");
  rect(13, 17, 1, 3, "#8d6238");
  rect(4, 13, 5, 1, "#ffffff");
}

function drawProp(p: HeldProp, rect: Rect, px: Px) {
  switch (p) {
    case "bookOpen":
    case "bookFlip":
      rect(4, 12, 8, 4, "#ffffff");
      rect(7, 12, 2, 4, "#d9d2e6");
      rect(4, 15, 8, 1, "#7c8cf0");
      if (p === "bookFlip") rect(8, 11, 3, 2, "#f2eefa");
      px(5, 13, "#b8b0c8");
      px(10, 13, "#b8b0c8");
      return;
    case "notebook":
      rect(9, 12, 1, 3, "#eea54b");
      px(9, 15, "#4b4458");
      return;
    case "dumbbellUp":
      rect(2, 4, 12, 1, "#6b6478");
      rect(1, 3, 2, 3, "#4b4458");
      rect(13, 3, 2, 3, "#4b4458");
      return;
    case "dumbbellDown":
      rect(2, 12, 12, 1, "#6b6478");
      rect(1, 11, 2, 3, "#4b4458");
      rect(13, 11, 2, 3, "#4b4458");
      return;
    case "camera":
      rect(5, 6, 6, 3, "#3b3346");
      rect(7, 5, 2, 1, "#3b3346");
      rect(7, 7, 2, 1, "#9fd3f0");
      return;
    case "hammerUp":
      rect(12, 3, 1, 5, "#8d6238");
      rect(11, 1, 4, 2, "#6b6478");
      rect(1, 17, 5, 2, "#6b6478");
      return;
    case "hammerDown":
      rect(11, 13, 4, 1, "#8d6238");
      rect(14, 11, 2, 4, "#6b6478");
      rect(1, 17, 5, 2, "#6b6478");
      return;
    case "brush":
      rect(11, 5, 1, 3, "#8d6238");
      px(11, 4, "#e7795f");
      return;
    default:
  }
}

function drawFx(fx: Fx, buf: PixelBuffer) {
  const set = (x: number, y: number, c: string) => buf.setHex(x, y, c);
  switch (fx) {
    case "zzz1":
    case "zzz2": {
      const o = fx === "zzz1" ? 0 : 2;
      const c = "#ffffff";
      for (const [x, y] of [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]]) set(17 + x + o, 4 - o + y, c);
      set(21, 1 + o, c);
      return;
    }
    case "note1":
    case "note2": {
      const o = fx === "note1" ? 0 : 2;
      const c = "#ffd166";
      set(18 + o, 2, c);
      set(18 + o, 3, c);
      set(18 + o, 4, c);
      set(19 + o, 2, c);
      set(17 + o, 5, c);
      set(18 + o, 5, c);
      return;
    }
    case "flash":
      for (const [x, y] of [[3, 9], [2, 8], [4, 8], [3, 7], [1, 9], [5, 9], [3, 11]]) set(x, y, "#fffbe6");
      return;
    case "sweat":
      set(19, 8, "#9fd3f0");
      set(19, 9, "#9fd3f0");
      set(18, 10, "#9fd3f0");
      return;
    case "sparkle1":
    case "sparkle2": {
      const [x, y] = fx === "sparkle1" ? [19, 4] : [3, 6];
      set(x, y - 1, "#ffffff");
      set(x - 1, y, "#ffffff");
      set(x, y, "#ffe08a");
      set(x + 1, y, "#ffffff");
      set(x, y + 1, "#ffffff");
      return;
    }
  }
}

/* ---------- animations ---------- */

export type AnimName =
  | "idle"
  | "look"
  | "stretch"
  | "sit"
  | "walk"
  | "jog"
  | "study"
  | "read"
  | "workout"
  | "photo"
  | "work"
  | "hobby"
  | "rest"
  | "generic";

export interface Animation {
  fps: number;
  frames: Pose[];
}

const P = (legs: Legs, arms: Arms, eyes: Eyes, extra: Partial<Pose> = {}): Pose => ({ legs, arms, eyes, ...extra });

export const ANIMATIONS: Record<AnimName, Animation> = {
  idle: { fps: 3, frames: [...Array(8).fill(P("stand", "down", "open")), P("stand", "down", "closed"), P("stand", "down", "open", { bob: 0 })] },
  look: { fps: 2, frames: [P("stand", "down", "left"), P("stand", "down", "left"), P("stand", "down", "open"), P("stand", "down", "right"), P("stand", "down", "right"), P("stand", "down", "open")] },
  stretch: { fps: 2, frames: [P("stand", "up", "closed", { bob: -1 }), P("stand", "up", "happy", { bob: -1 }), P("stand", "down", "open")] },
  sit: { fps: 2, frames: [P("sit", "hold", "open"), P("sit", "hold", "open"), P("sit", "hold", "open"), P("sit", "hold", "closed")] },
  walk: { fps: 8, frames: [P("walkA", "swingA", "open"), P("stand", "down", "open", { bob: -1 }), P("walkB", "swingB", "open"), P("stand", "down", "open", { bob: -1 })] },
  jog: { fps: 10, frames: [P("runA", "swingB", "open", { bob: -1 }), P("stand", "down", "open"), P("runB", "swingA", "open", { bob: -1 }), P("stand", "down", "open")] },
  study: {
    fps: 3,
    frames: [
      P("stand", "hold", "open", { props: ["desk", "notebook"] }),
      P("stand", "hold", "open", { props: ["desk", "notebook"], bob: 1 }),
      P("stand", "hold", "open", { props: ["desk", "notebook"] }),
      P("stand", "hold", "happy", { props: ["desk", "notebook"], bob: 1 }),
    ],
  },
  read: {
    fps: 1.5,
    frames: [
      P("sit", "hold", "open", { props: ["bookOpen"] }),
      P("sit", "hold", "open", { props: ["bookOpen"] }),
      P("sit", "hold", "closed", { props: ["bookOpen"] }),
      P("sit", "hold", "open", { props: ["bookFlip"] }),
    ],
  },
  workout: {
    fps: 2,
    frames: [
      P("stand", "holdHigh", "closed", { props: ["dumbbellUp"], bob: -1 }),
      P("stand", "hold", "open", { props: ["dumbbellDown"], bob: 1, fx: "sweat" }),
    ],
  },
  photo: {
    fps: 2,
    frames: [
      P("stand", "camera", "open", { props: ["camera"] }),
      P("stand", "camera", "open", { props: ["camera"] }),
      P("stand", "camera", "open", { props: ["camera"], fx: "flash" }),
      P("stand", "down", "happy"),
    ],
  },
  work: {
    fps: 3,
    frames: [P("stand", "up", "open", { props: ["hammerUp"] }), P("stand", "hold", "closed", { props: ["hammerDown"], bob: 1, fx: "sparkle2" })],
  },
  hobby: {
    fps: 2,
    frames: [P("stand", "wave", "happy", { props: ["brush"], fx: "note1" }), P("stand", "down", "open", { fx: "note2", bob: -1 })],
  },
  rest: { fps: 1.2, frames: [P("sit", "down", "closed", { fx: "zzz1" }), P("sit", "down", "closed", { fx: "zzz2", bob: 1 })] },
  generic: {
    fps: 2,
    frames: [P("stand", "swingA", "happy", { fx: "sparkle1" }), P("stand", "swingB", "open", { bob: -1, fx: "sparkle2" })],
  },
};

export function frameAt(anim: AnimName, timeSec: number): Pose {
  const a = ANIMATIONS[anim];
  const i = Math.floor(Math.max(0, timeSec) * a.fps) % a.frames.length;
  return a.frames[i];
}
