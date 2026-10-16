import type { Activity, Area, Block } from "@/data/schema";
import { areaForActivity } from "./activities";
import { addDays, fromDateKey } from "./time";

export type Vitality = "lived" | "neutral" | "dusty";

const WINDOW_DAYS = 14;
const HALF_LIFE_DAYS = 5;
const NEW_AREA_GRACE_DAYS = 4;

/**
 * Soft, number-free island feedback. Recent time spent at an area (done blocks count fully,
 * past planned blocks count a little) makes it look lived in; long-unused areas get dusty.
 * New areas never start dusty.
 */
export function areaVitality(
  areas: Area[],
  activities: Activity[],
  blocks: Block[],
  today: string,
  nowMinute: number,
): Record<string, Vitality> {
  const activityById = new Map(activities.map((a) => [a.id, a]));
  const score = new Map<string, number>();
  const from = addDays(today, -WINDOW_DAYS);
  const todayMs = fromDateKey(today).getTime();

  for (const b of blocks) {
    if (b.date < from || b.date > today) continue;
    const happened = b.date < today || b.end <= nowMinute || b.done;
    if (!happened) continue;
    const area = areaForActivity(b.activityId ? activityById.get(b.activityId) : null, areas);
    if (!area) continue;
    const daysAgo = Math.round((todayMs - fromDateKey(b.date).getTime()) / 86_400_000);
    const hours = Math.min(3, (b.end - b.start) / 60);
    const weight = (b.done ? 1 : 0.5) * (0.5 + hours / 2) * Math.pow(0.5, daysAgo / HALF_LIFE_DAYS);
    score.set(area.id, (score.get(area.id) ?? 0) + weight);
  }

  const out: Record<string, Vitality> = {};
  const graceCutoff = fromDateKey(addDays(today, -NEW_AREA_GRACE_DAYS)).getTime();
  for (const a of areas) {
    const s = score.get(a.id) ?? 0;
    const isNew = Date.parse(a.createdAt) > graceCutoff;
    out[a.id] = s >= 1.2 ? "lived" : s < 0.2 && !isNew ? "dusty" : "neutral";
  }
  return out;
}
