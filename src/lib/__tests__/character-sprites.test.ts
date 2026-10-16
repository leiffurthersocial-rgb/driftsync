import { describe, expect, it } from "vitest";
import { deflateSync } from "zlib";
import { writeFileSync } from "fs";
import { ANIMATIONS, drawCharacter, type AnimName } from "@/island/sprites/character";
import type { Appearance } from "@/data/schema";

const app: Appearance = { skin: 1, hairStyle: "curly", hairColor: "#8a5a35", outfitColor: "#e7795f", accessory: "headphones" };
const REQUIRED: AnimName[] = ["idle", "walk", "study", "workout", "jog", "photo", "read"];

describe("character animations", () => {
  it("defines every required animation", () => {
    for (const a of REQUIRED) expect(ANIMATIONS[a]?.frames.length).toBeGreaterThan(1);
  });

  it("each animation's frames are visually distinct", () => {
    for (const [name, anim] of Object.entries(ANIMATIONS)) {
      const frames = new Set(anim.frames.map((p) => Buffer.from(drawCharacter(app, p).data.buffer).toString("base64")));
      expect(frames.size, name).toBeGreaterThan(1);
    }
  });

  it("activity poses differ from idle", () => {
    const idle = Buffer.from(drawCharacter(app, ANIMATIONS.idle.frames[0]).data.buffer).toString("base64");
    for (const a of ["study", "workout", "jog", "photo", "read"] as AnimName[]) {
      const f = Buffer.from(drawCharacter(app, ANIMATIONS[a].frames[0]).data.buffer).toString("base64");
      expect(f, a).not.toBe(idle);
    }
  });

  // Optional contact sheet for visual review: SPRITE_SHEET=/path/out.png npm test
  it("writes a contact sheet when requested", () => {
    const out = process.env.SPRITE_SHEET;
    if (!out) return;
    const names = Object.keys(ANIMATIONS) as AnimName[];
    const cols = Math.max(...names.map((n) => ANIMATIONS[n].frames.length));
    const S = 6, W = 24, H = 30;
    const w = cols * W * S, h = names.length * H * S;
    const px = new Uint8Array(w * h * 4).fill(255);
    names.forEach((n, r) =>
      ANIMATIONS[n].frames.forEach((p, c) => {
        const buf = drawCharacter(app, p);
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const v = buf.data[y * W + x];
            const a = v >>> 24;
            const rgb = a ? [v & 255, (v >>> 8) & 255, (v >>> 16) & 255] : (r + c) % 2 ? [236, 240, 248] : [246, 241, 233];
            for (let dy = 0; dy < S; dy++)
              for (let dx = 0; dx < S; dx++) {
                const i = (((r * H + y) * S + dy) * w + (c * W + x) * S + dx) * 4;
                px.set([...rgb, 255], i);
              }
          }
      }),
    );
    writeFileSync(out, png(w, h, px));
  });
});

function png(w: number, h: number, rgba: Uint8Array) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8);
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
