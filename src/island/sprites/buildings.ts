import type { AreaType } from "@/data/schema";
import { toSprite, type Sprite } from "../pixel-buffer";
import { desaturate, hexToRgb, rgbToHex } from "../color";
import { designFor } from "./designs";
import { Kit, SAX, SAY } from "./kit";
export type { Vitality } from "@/lib/feedback";
import type { Vitality } from "@/lib/feedback";

export interface BuildingSprites {
  base: Sprite;
  glow: Sprite;
}

/** Accent color of an area (sign ink, UI chips): the user's color, else the design default. */
export function areaAccent(type: AreaType, variant: number, color: string | null): string {
  return color ?? designFor(type, variant).accent;
}

const FLOWERS = ["#ff8fab", "#ffd166", "#ffffff", "#b49cff", "#ff9a5c"];

/** Rasterize one area design. Cached by the caller. */
export function renderBuilding(type: AreaType, variant: number, color: string | null, vitality: Vitality, outline: string): BuildingSprites {
  const design = designFor(type, variant);
  const kit = new Kit(vitality !== "dusty");
  design.draw(kit, { accent: color ?? design.accent });

  if (vitality === "lived") {
    // Flower borders along the two front edges plus a couple of planters.
    for (let i = 0; i < 9; i++) {
      for (const [u, v] of [
        [0.15 + i * 0.32, 2.95],
        [2.95, 0.15 + i * 0.32],
      ] as const) {
        if (design.outdoor && i % 2) continue;
        const [x, y] = kit.p(u, v);
        kit.base.rect(x - 1, y - 3, 3, 3, "#5f9e4c");
        kit.base.rect(x - 1, y - 5, 2, 2, FLOWERS[(i + Math.round(u * 3)) % FLOWERS.length]);
      }
    }
  }

  kit.base.outline(outline);

  if (vitality === "dusty") {
    const grey = hexToRgb("#8f8a99");
    kit.base.map(([r, g, b]) => {
      const d = hexToRgb(desaturate(rgbToHex([r, g, b]), 0.32));
      return [d[0] * 0.92 + grey[0] * 0.04, d[1] * 0.92 + grey[1] * 0.04, d[2] * 0.92 + grey[2] * 0.04];
    });
    // Cobweb in the top-left corner of the silhouette and a few dust specks.
    const web = "#ece9f2";
    let wx = -1;
    let wy = -1;
    outer: for (let y = 0; y < kit.base.height; y++)
      for (let x = 0; x < kit.base.width / 2; x++)
        if (kit.base.alphaAt(x, y)) {
          wx = x + 6;
          wy = y + 14;
          break outer;
        }
    if (wx > 0) for (let i = 0; i < 7; i++) kit.base.blend(wx + i, wy - Math.floor(i * 0.6), web, 0.8);
    for (const [u, v] of [
      [0.8, 2.9],
      [2.1, 2.95],
      [2.9, 1.2],
    ] as const) {
      const [x, y] = kit.p(u, v);
      kit.base.blend(x, y - 1, "#b8a99a", 0.8, true);
    }
  }

  return { base: toSprite(kit.base, SAX, SAY), glow: toSprite(kit.glow, SAX, SAY) };
}
