import { describe, expect, it } from "vitest";
import { deflateSync } from "zlib";
import { writeFileSync } from "fs";
import { AREA_TYPES } from "@/data/schema";
import { DESIGNS } from "@/island/sprites/designs";
import { Kit, SH, SW } from "@/island/sprites/kit";

describe("area designs", () => {
  it("every area type has three distinct, named designs", () => {
    for (const t of AREA_TYPES) {
      const ds = DESIGNS[t];
      expect(ds).toHaveLength(3);
      expect(new Set(ds.map((d) => d.name)).size).toBe(3);
      const renders = new Set(
        ds.map((d) => {
          const k = new Kit(true);
          d.draw(k, { accent: d.accent });
          return Buffer.from(k.base.data.buffer).toString("base64");
        }),
      );
      expect(renders.size).toBe(3);
    }
  });

  it("spots and loops stay inside the footprint", () => {
    for (const t of AREA_TYPES)
      for (const d of DESIGNS[t]) {
        for (const [u, v] of Object.values(d.spots)) {
          expect(u).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(3);
        }
        for (const [u, v] of d.loop ?? []) expect(Math.min(u, v) >= 0 && Math.max(u, v) <= 3).toBe(true);
      }
  });

  it("writes a design sheet when requested", () => {
    const out = process.env.DESIGN_SHEET;
    if (!out) return;
    const S = 2;
    const cols = 3;
    const rows = AREA_TYPES.length;
    const w = cols * SW * S;
    const h = rows * SH * S;
    const px = new Uint8Array(w * h * 4);
    AREA_TYPES.forEach((t, r) =>
      DESIGNS[t].forEach((d, c) => {
        const k = new Kit(false);
        // Grass pad so the design reads as placed on the island.
        k.ground(-0.3, -0.3, 3.3, 3.3, (u, v) => ((Math.floor(u * 2) + Math.floor(v * 2)) % 2 ? "#9ad582" : "#8fcd78"));
        d.draw(k, { accent: d.accent });
        k.base.outline("#3d3352");
        for (let y = 0; y < SH; y++)
          for (let x = 0; x < SW; x++) {
            const v = k.base.data[y * SW + x];
            const rgb = v >>> 24 ? [v & 255, (v >>> 8) & 255, (v >>> 16) & 255] : [200, 228, 244];
            for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) px.set([...rgb, 255], (((r * SH + y) * S + dy) * w + (c * SW + x) * S + dx) * 4);
          }
      }),
    );
    writeFileSync(out, png(w, h, px));
  });
});

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
