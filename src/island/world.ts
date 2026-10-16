import type { Area, IslandMeta } from "@/data/schema";
import {
  MAX_TIER,
  buildLayout,
  isValidLayout,
  placeWithGrowth,
  sizeForTier,
  tierForCount,
  type AreaPos,
  type Layout,
} from "@/lib/island-layout";

export interface ResolvedIsland {
  tier: number;
  layout: Layout;
  /** Positions that had to be repaired (e.g. after importing hand-edited data). */
  repaired: AreaPos[] | null;
}

/** Build the layout for the stored areas, repairing invalid positions instead of crashing. */
export function resolveIsland(meta: IslandMeta, areas: Area[]): ResolvedIsland {
  const positions = [...areas]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map(({ id, x, y }) => ({ id, x, y }));
  const start = Math.max(meta.tier, tierForCount(positions.length));
  for (let t = start; t <= MAX_TIER; t++) {
    if (isValidLayout(sizeForTier(t), meta.seed, positions))
      return { tier: t, layout: buildLayout(sizeForTier(t), meta.seed, positions), repaired: null };
  }
  // Re-place everything in creation order.
  let tier = tierForCount(0);
  const fixed: AreaPos[] = [];
  for (const p of positions) {
    const r = placeWithGrowth(tier, meta.seed, fixed);
    if (!r) break;
    tier = r.tier;
    fixed.push({ id: p.id, x: r.x, y: r.y });
  }
  return { tier, layout: buildLayout(sizeForTier(tier), meta.seed, fixed), repaired: fixed };
}
