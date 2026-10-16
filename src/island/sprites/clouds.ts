import { PixelBuffer } from "../pixel-buffer";
import { rng } from "@/lib/random";

/** Procedural puffy pixel cloud: union of blobs with a soft lavender underside. */
export function renderCloud(seed: number, night: boolean): PixelBuffer {
  const rand = rng(seed);
  const w = 34 + Math.floor(rand() * 26);
  const h = 14 + Math.floor(rand() * 6);
  const buf = new PixelBuffer(w + 4, h + 4);
  const blobs: [number, number, number][] = [];
  const count = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    const r = 4 + rand() * (h / 2 - 3);
    const x = 2 + r + (rand() * (w - 2 * r));
    const y = h - r + 1;
    blobs.push([x, y, r]);
  }
  const top = night ? "#c9c0e6" : "#ffffff";
  const mid = night ? "#a99fcf" : "#f4eefc";
  const under = night ? "#8b80b8" : "#ddd3f2";
  for (let y = 0; y < buf.height; y++)
    for (let x = 0; x < buf.width; x++) {
      let inside = false;
      for (const [bx, by, r] of blobs) if ((x - bx) ** 2 + ((y - by) * 1.15) ** 2 <= r * r) inside = true;
      if (y > h + 1) inside = false;
      if (!inside) continue;
      buf.setHex(x, y, y > h - 1 ? under : y > h - 4 ? mid : top);
    }
  return buf;
}
