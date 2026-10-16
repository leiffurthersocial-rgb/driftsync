import { describe, expect, it } from "vitest";
import {
  FOOTPRINT,
  GAP,
  MAX_AREAS,
  buildLayout,
  fitTier,
  isValidLayout,
  placeArea,
  placeWithGrowth,
  sizeForTier,
  tierForCount,
  type AreaPos,
} from "../island-layout";
import { reachable } from "../pathfinding";

function addMany(n: number, seed = 42) {
  let tier = 0;
  const areas: AreaPos[] = [];
  for (let i = 0; i < n; i++) {
    const res = placeWithGrowth(tier, seed, areas);
    if (!res) break;
    tier = res.tier;
    areas.push({ id: `a${i}`, x: res.x, y: res.y });
  }
  return { tier, areas };
}

describe("tiers", () => {
  it("grows with area count and caps", () => {
    expect(tierForCount(0)).toBe(0);
    expect(tierForCount(2)).toBe(0);
    expect(tierForCount(3)).toBe(1);
    expect(tierForCount(6)).toBe(2);
    expect(tierForCount(100)).toBe(5);
    expect(sizeForTier(99)).toBe(22);
  });
});

describe("placement", () => {
  it("places the first area next to the plaza", () => {
    const pos = placeArea(sizeForTier(0), 7, [])!;
    expect(pos).not.toBeNull();
    expect(Math.abs(pos.x) + Math.abs(pos.y)).toBeLessThanOrEqual(6);
  });

  it("is deterministic", () => {
    expect(addMany(5, 9)).toEqual(addMany(5, 9));
  });

  for (const seed of [1, 42, 1337, 99991]) {
    it(`keeps every area valid, spaced and reachable (seed ${seed})`, () => {
      const { tier, areas } = addMany(MAX_AREAS, seed);
      expect(areas.length).toBeGreaterThanOrEqual(10);
      const size = sizeForTier(tier);
      expect(isValidLayout(size, seed, areas)).toBe(true);

      // No overlaps and at least GAP tiles between footprints.
      for (let i = 0; i < areas.length; i++)
        for (let j = i + 1; j < areas.length; j++) {
          const a = areas[i];
          const b = areas[j];
          const sep = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
          expect(sep).toBeGreaterThanOrEqual(FOOTPRINT + GAP);
        }

      // Generated paths connect every entrance to the plaza.
      const layout = buildLayout(size, seed, areas);
      const seen = reachable(
        { width: size, height: size, walkable: (x, y) => layout.path[y * size + x] === 1 },
        layout.plaza[0],
      );
      for (const a of layout.areas) expect(seen[a.entrance[1] * size + a.entrance[0]]).toBe(1);
    });
  }

  it("grows the island as areas are added", () => {
    const small = addMany(2, 5);
    const big = addMany(8, 5);
    expect(big.tier).toBeGreaterThan(small.tier);
  });

  it("refuses beyond the cap", () => {
    const { areas, tier } = addMany(MAX_AREAS, 3);
    if (areas.length === MAX_AREAS) expect(placeWithGrowth(tier, 3, areas)).toBeNull();
  });

  it("reroll with jitter avoids the current spot", () => {
    const { areas, tier } = addMany(3, 11);
    const [target, ...others] = areas;
    const res = placeArea(sizeForTier(tier), 11, others, { jitter: 123, avoid: target })!;
    expect(Math.abs(res.x - target.x) + Math.abs(res.y - target.y)).toBeGreaterThanOrEqual(2);
  });

  it("fitTier shrinks back when areas are removed", () => {
    const { areas, tier } = addMany(8, 21);
    const kept = areas.slice(0, 1);
    expect(fitTier(21, kept, tier)).toBeLessThanOrEqual(tier);
    expect(isValidLayout(sizeForTier(fitTier(21, kept, tier)), 21, kept)).toBe(true);
  });
});
