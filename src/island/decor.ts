import type { Layout } from "@/lib/island-layout";
import { hash01 } from "@/lib/random";
import type { PropName } from "./sprites/props";

export interface Decoration {
  x: number;
  y: number;
  prop: PropName;
  flip: boolean;
}

/** Deterministic scatter of trees, bushes, flowers and rocks on free land. */
export function decorate(layout: Layout): Decoration[] {
  const { size, land, path, blocked, seed, center: c } = layout;
  const out: Decoration[] = [];
  const entrances = new Set(layout.areas.map((a) => a.entrance[1] * size + a.entrance[0]));

  const nearArea = (x: number, y: number, r: number) =>
    layout.areas.some((a) => x >= a.gx - r && x <= a.gx + 1 + r && y >= a.gy - r && y <= a.gy + 1 + r);
  // Tiles directly in front of a building (screen-down) hide it, so keep tall props off them.
  const inFront = (x: number, y: number) =>
    layout.areas.some((a) => x >= a.gx && x <= a.gx + 3 && y >= a.gy && y <= a.gy + 3);

  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (!land[i] || path[i] || blocked[i] || entrances.has(i)) continue;
      const k = hash01(x - c + 401, y - c + 77, seed);
      const flip = hash01(x - c, y - c, seed + 5) < 0.5;
      const nearPlaza = Math.abs(x + 0.5 - c) < 2.5 && Math.abs(y + 0.5 - c) < 2.5;
      if (k < 0.15 && !nearArea(x, y, 1) && !inFront(x, y) && !nearPlaza) {
        out.push({ x, y, prop: hash01(x, y, seed + 9) < 0.55 ? "treeRound" : "treePine", flip });
      } else if (k < 0.25 && !nearArea(x, y, 0)) out.push({ x, y, prop: "bush", flip });
      else if (k < 0.32) out.push({ x, y, prop: "flowers", flip });
      else if (k < 0.35 && !nearPlaza) out.push({ x, y, prop: "rock", flip });
    }

  // A lamp and a bench on the plaza.
  out.push({ x: c - 1, y: c - 1, prop: "lamp", flip: false });
  return out;
}
