import type { Activity, AnimationKind, Area, AreaType, Block, ManualOverride } from "@/data/schema";
import { areaForActivity } from "./activities";
import { activeAt } from "./time";

export const AREA_ANIMATION: Record<AreaType, AnimationKind> = {
  gym: "workout",
  study: "study",
  library: "read",
  photo: "photo",
  track: "jog",
  workshop: "work",
  hobby: "hobby",
};

export const ANIMATION_VERB: Record<AnimationKind, string> = {
  study: "Studying",
  workout: "Working out",
  jog: "Jogging",
  photo: "Taking photos",
  read: "Reading",
  work: "Working",
  hobby: "Doing a hobby",
  rest: "Resting",
  generic: "Busy",
};

export interface Intent {
  source: "manual" | "block" | "none";
  /** Where to go; null = the plaza. */
  areaId: string | null;
  areaType: AreaType | null;
  animation: AnimationKind;
  label: string;
  /** Minute of day the activity ends (blocks only). */
  until: number | null;
  key: string;
}

/**
 * What the character should be doing right now.
 * A manual "send to" wins until cleared, or until a new time block starts after it was given.
 * Otherwise the active time block, otherwise wander.
 */
export function resolveIntent(input: {
  override: ManualOverride | null;
  blocks: Block[];
  activities: Activity[];
  areas: Area[];
  today: string;
  minute: number;
  now: Date;
}): Intent {
  const { override, blocks, activities, areas, today, minute, now } = input;
  const todays = blocks.filter((b) => b.date === today);
  const active = activeAt(todays, minute);

  const overrideArea = override ? areas.find((a) => a.id === override.areaId) : undefined;
  if (override && overrideArea) {
    const sentAt = new Date(override.since);
    const blockStart = active ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, active.start) : null;
    const supersededByBlock = blockStart && blockStart > sentAt;
    if (!supersededByBlock) {
      const act = override.activityId ? activities.find((a) => a.id === override.activityId) : undefined;
      const animation = act?.animation ?? AREA_ANIMATION[overrideArea.type];
      return {
        source: "manual",
        areaId: overrideArea.id,
        areaType: overrideArea.type,
        animation,
        label: act?.name ?? ANIMATION_VERB[animation],
        until: null,
        key: `m:${overrideArea.id}:${animation}`,
      };
    }
  }

  if (active) {
    const act = activities.find((a) => a.id === active.activityId) ?? null;
    const area = areaForActivity(act, areas);
    const animation = act?.animation ?? "generic";
    return {
      source: "block",
      areaId: area?.id ?? null,
      areaType: area?.type ?? null,
      animation,
      label: active.title || act?.name || ANIMATION_VERB[animation],
      until: active.end,
      key: `b:${active.id}:${area?.id ?? "plaza"}:${animation}`,
    };
  }
  return { source: "none", areaId: null, areaType: null, animation: "generic", label: "", until: null, key: "none" };
}
