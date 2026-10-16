import { describe, expect, it } from "vitest";
import { deflateSync } from "zlib";
import { writeFileSync } from "fs";
import { ANIMATIONS, drawCharacter, type AnimName, type Pose } from "@/island/sprites/character";
import { appearanceSchema, EYE_STYLES, EYEWEAR, FACIAL_HAIR, HAIR_STYLES, HEADWEAR, TOPS, type Appearance } from "@/data/schema";

const app: Appearance = appearanceSchema.parse({ hairStyle: "curly", hairColor: "#8a5a35", outfitColor: "#e7795f", headwear: "headphones" });
/** idle, walk, and studying / working out / jogging / photography / reading. */
const REQUIRED: AnimName[] = ["idle", "walk", "study", "curls", "pullups", "run", "photo", "read"];
const key = (a: Appearance, p: Pose, o: "casual" | "sport" = "casual") => Buffer.from(drawCharacter(a, p, o).data.buffer).toString("base64");
const SPORTY: AnimName[] = ["curls", "press", "squats", "jacks", "pullups", "dips", "yoga", "run", "jogInPlace"];

describe("character animations", () => {
  it("defines every required animation", () => {
    for (const a of REQUIRED) expect(ANIMATIONS[a]?.frames.length).toBeGreaterThan(1);
  });

  it("each animation's frames are visually distinct", () => {
    for (const [name, anim] of Object.entries(ANIMATIONS)) {
      const frames = new Set(anim.frames.map((p) => key(app, p)));
      expect(frames.size, name).toBeGreaterThan(1);
    }
  });

  it("activity poses differ from idle", () => {
    const idle = key(app, ANIMATIONS.idle.frames[0]);
    for (const a of ["study", "curls", "run", "photo", "read"] as AnimName[]) expect(key(app, ANIMATIONS[a].frames[0]), a).not.toBe(idle);
  });

  it("sport outfit differs from casual", () => {
    const p = ANIMATIONS.idle.frames[0];
    expect(key(app, p, "casual")).not.toBe(key(app, p, "sport"));
  });

  it("renders every customization option, nearly all distinct", () => {
    const p = ANIMATIONS.idle.frames[0];
    const opts: Partial<Appearance>[] = [
      ...HAIR_STYLES.map((hairStyle) => ({ hairStyle })),
      ...HEADWEAR.map((headwear) => ({ headwear })),
      ...EYEWEAR.map((eyewear) => ({ eyewear })),
      ...TOPS.map((top) => ({ top })),
      ...EYE_STYLES.map((eyeStyle) => ({ eyeStyle })),
      ...FACIAL_HAIR.map((facialHair) => ({ facialHair })),
    ];
    const seen = new Set(opts.map((o) => key({ ...app, ...o }, p)));
    // A few options equal the base look (e.g. curly hair, headphones), so allow some overlap.
    expect(seen.size).toBeGreaterThan(opts.length - 7);
  });

  // Optional contact sheets for visual review: SPRITE_SHEET=/path/out.png npm test
  it("writes contact sheets when requested", () => {
    const out = process.env.SPRITE_SHEET;
    if (!out) return;
    const looks: Appearance[] = [
      app,
      { ...app, skin: 5, hairStyle: "afro", hairColor: "#2b2233", outfitColor: "#5fae84", top: "hoodie", eyewear: "round", headwear: "none" },
      { ...app, skin: 0, hairStyle: "ponytail", hairColor: "#d6a058", outfitColor: "#d77fb4", top: "dress", eyeStyle: "lashes", headwear: "bow", freckles: true },
      { ...app, skin: 3, hairStyle: "mohawk", hairColor: "#c4553a", outfitColor: "#3b3346", top: "tank", facialHair: "beard", eyewear: "sunglasses", headwear: "none" },
      { ...app, skin: 7, hairStyle: "bun", hairColor: "#2b2233", outfitColor: "#eea54b", top: "overalls", bottomColor: "#4f9cc4", headwear: "none", neckwear: "scarf" },
      { ...app, skin: 2, hairStyle: "spiky", hairColor: "#7c8cf0", outfitColor: "#7c8cf0", top: "shirt", headwear: "cap", backpack: true },
      { ...app, skin: 4, hairStyle: "bob", hairColor: "#5a3a26", outfitColor: "#e9c95b", top: "sweater", topPattern: "stripes", bottom: "skirt", headwear: "beanie" },
      { ...app, skin: 1, hairStyle: "pigtails", hairColor: "#e28aa8", outfitColor: "#a888de", top: "tee", topPattern: "dots", bottom: "shorts", eyeStyle: "sparkle", headwear: "flower" },
    ];
    writeFileSync(out.replace(".png", "-looks.png"), sheet(looks.map((a) => [a, ANIMATIONS.idle.frames[0], "casual"]), 8, 8));
    writeFileSync(out.replace(".png", "-sport.png"), sheet(looks.map((a) => [a, ANIMATIONS.run.frames[0], "sport"]), 8, 8));
    writeFileSync(out.replace(".png", "-back.png"), sheet(looks.map((a) => [a, { ...ANIMATIONS.walk.frames[0], back: true }, "casual"]), 8, 8));
    const names = Object.keys(ANIMATIONS) as AnimName[];
    const cols = Math.max(...names.map((n) => ANIMATIONS[n].frames.length));
    const cells: (Cell | null)[] = [];
    for (const n of names)
      for (let c = 0; c < cols; c++) {
        const f = ANIMATIONS[n].frames[c];
        cells.push(f ? [app, f, SPORTY.includes(n) ? "sport" : "casual"] : null);
      }
    writeFileSync(out, sheet(cells, cols, 4));
  });
});

type Cell = [Appearance, Pose, "casual" | "sport"];

function sheet(cells: (Cell | null)[], cols: number, S: number) {
  const W = 40;
  const H = 56;
  const rows = Math.ceil(cells.length / cols);
  const w = cols * W * S;
  const h = rows * H * S;
  const px = new Uint8Array(w * h * 4).fill(255);
  cells.forEach((cell, k) => {
    const r = Math.floor(k / cols);
    const c = k % cols;
    const buf = cell ? drawCharacter(cell[0], cell[1], cell[2]) : null;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = buf ? buf.data[y * W + x] : 0;
        const rgb = v >>> 24 ? [v & 255, (v >>> 8) & 255, (v >>> 16) & 255] : (r + c) % 2 ? [236, 240, 248] : [246, 241, 233];
        for (let dy = 0; dy < S; dy++)
          for (let dx = 0; dx < S; dx++) px.set([...rgb, 255], (((r * H + y) * S + dy) * w + (c * W + x) * S + dx) * 4);
      }
  });
  return png(w, h, px);
}

function png(w: number, h: number, rgba: Uint8Array) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = table[(c ^ x) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
