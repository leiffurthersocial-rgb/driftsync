import { z } from "zod";

/** Bump when the persisted shape changes; add a migration in migrations.ts. */
export const CURRENT_VERSION = 3;

/**
 * auto = follows your local time (light by day, dark in the evening),
 * system = follows the OS preference, light/dark = fixed.
 */
export const THEMES = ["auto", "system", "light", "dark"] as const;
export type ThemeSetting = (typeof THEMES)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableId = z.string().nullable().catch(null);

/** Shared metadata on every record: sync-friendly ids, timestamps and soft delete. */
const base = {
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().catch(null),
};

export const profileSchema = z.object({
  /** What to call you in greetings; empty means no name. */
  name: z.string().max(40).catch(""),
  onboarded: z.boolean().catch(false),
  updatedAt: z.string().catch(""),
});
export type Profile = z.infer<typeof profileSchema>;

export const activitySchema = z.object({
  ...base,
  key: z.string(),
  name: z.string().max(40),
  color: hex,
  preset: z.boolean().catch(false),
  order: z.number().catch(0),
});
export type Activity = z.infer<typeof activitySchema>;

export const blockSchema = z
  .object({
    ...base,
    date: dateKey,
    start: z.number().int().min(0).max(1440),
    end: z.number().int().min(0).max(1440),
    title: z.string().max(120).catch(""),
    activityId: nullableId,
    color: hex.nullable().catch(null),
    notes: z.string().catch(""),
    todoId: nullableId,
    goalId: nullableId,
    done: z.boolean().catch(false),
  })
  .refine((b) => b.end > b.start, "end must be after start");
export type Block = z.infer<typeof blockSchema>;

export const todoListSchema = z.object({ ...base, name: z.string().max(40), order: z.number().catch(0) });
export type TodoList = z.infer<typeof todoListSchema>;

export const todoSchema = z.object({
  ...base,
  title: z.string().max(240),
  listId: nullableId,
  due: dateKey.nullable().catch(null),
  priority: z.number().int().min(0).max(3).catch(0),
  done: z.boolean().catch(false),
  doneAt: z.string().nullable().catch(null),
  order: z.number().catch(0),
  goalId: nullableId,
  notes: z.string().catch(""),
});
export type Todo = z.infer<typeof todoSchema>;

export const milestoneSchema = z.object({ id: z.string(), title: z.string(), done: z.boolean().catch(false) });
export type Milestone = z.infer<typeof milestoneSchema>;

export const GOAL_TYPES = ["milestones", "todos", "frequency"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const frequencySchema = z.object({
  activityId: z.string(),
  count: z.number().int().min(1).max(50),
  period: z.enum(["week", "month"]),
});
export type FrequencyTarget = z.infer<typeof frequencySchema>;

export const goalSchema = z.object({
  ...base,
  title: z.string().max(120),
  deadline: dateKey.nullable().catch(null),
  type: z.enum(GOAL_TYPES).catch("milestones"),
  milestones: z.array(milestoneSchema).catch([]),
  frequency: frequencySchema.nullable().catch(null),
  color: hex.catch("#6e5ee6"),
  archived: z.boolean().catch(false),
  order: z.number().catch(0),
});
export type Goal = z.infer<typeof goalSchema>;

export const templateBlockSchema = z.object({
  start: z.number().int().min(0).max(1440),
  end: z.number().int().min(0).max(1440),
  title: z.string(),
  activityId: z.string().nullable(),
  color: hex.nullable().catch(null),
  notes: z.string().catch(""),
});
export type TemplateBlock = z.infer<typeof templateBlockSchema>;

export const templateSchema = z.object({ ...base, name: z.string().max(60), blocks: z.array(templateBlockSchema).catch([]) });
export type Template = z.infer<typeof templateSchema>;

export const settingsSchema = z.object({
  theme: z.enum(THEMES).catch("auto"),
  dayStartHour: z.number().int().min(0).max(23).catch(6),
  dayEndHour: z.number().int().min(1).max(24).catch(24),
  clock: z.enum(["12h", "24h"]).catch("24h"),
  weekStart: z.union([z.literal(0), z.literal(1)]).catch(1),
  defaultBlockMinutes: z.number().int().min(15).max(480).catch(60),
  updatedAt: z.string().catch(""),
});
export type Settings = z.infer<typeof settingsSchema>;

export interface AppData {
  version: number;
  profile: Profile;
  settings: Settings;
  activities: Activity[];
  blocks: Block[];
  todos: Todo[];
  lists: TodoList[];
  goals: Goal[];
  templates: Template[];
}

export type CollectionKey = "activities" | "blocks" | "todos" | "lists" | "goals" | "templates";

export const collectionSchemas = {
  activities: activitySchema,
  blocks: blockSchema,
  todos: todoSchema,
  lists: todoListSchema,
  goals: goalSchema,
  templates: templateSchema,
} as const;

export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
