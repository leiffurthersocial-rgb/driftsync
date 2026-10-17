import { createDefaultData } from "./defaults";
import type { AppData } from "./schema";

export const RESET_SCOPES = ["planner", "tasks", "onboarding", "all"] as const;
export type ResetScope = (typeof RESET_SCOPES)[number];

/** Pure: return a copy of `data` with the given scope restored to defaults. */
export function applyReset(data: AppData, scope: ResetScope): AppData {
  const fresh = createDefaultData();
  switch (scope) {
    case "all":
      return fresh;
    case "planner":
      return { ...data, blocks: [], templates: fresh.templates.map((t) => remapTemplate(t, fresh, data)) };
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
