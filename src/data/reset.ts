import { createDefaultData } from "./defaults";
import type { AppData } from "./schema";

export const RESET_SCOPES = ["planner", "island", "character", "tasks", "onboarding", "all"] as const;
export type ResetScope = (typeof RESET_SCOPES)[number];

/** Pure: return a copy of `data` with the given scope restored to defaults. */
export function applyReset(data: AppData, scope: ResetScope): AppData {
  const fresh = createDefaultData();
  switch (scope) {
    case "all":
      return fresh;
    case "planner":
      return { ...data, blocks: [], templates: fresh.templates.map((t) => remapTemplate(t, fresh, data)) };
    case "island":
      return {
        ...data,
        areas: [],
        island: { ...fresh.island, name: data.island.name },
        profile: { ...data.profile, override: null },
        activities: data.activities.map((a) => ({ ...a, areaId: null })),
      };
    case "character":
      return {
        ...data,
        profile: { ...data.profile, characterName: fresh.profile.characterName, appearance: fresh.profile.appearance },
      };
    case "tasks":
      return {
        ...data,
        todos: [],
        lists: [],
        goals: [],
        blocks: data.blocks.map((b) => ({ ...b, todoId: null, goalId: null })),
      };
    case "onboarding":
      return { ...data, profile: { ...data.profile, onboarded: false } };
  }
}

/** Default templates reference fresh activity ids; point them at the user's existing presets. */
function remapTemplate(t: AppData["templates"][number], fresh: AppData, data: AppData) {
  return {
    ...t,
    blocks: t.blocks.map((b) => {
      const key = fresh.activities.find((a) => a.id === b.activityId)?.key;
      const existing = data.activities.find((a) => a.key === key);
      return { ...b, activityId: existing?.id ?? null };
    }),
  };
}
