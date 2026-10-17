import { z } from "zod";
import { uuid } from "@/lib/id";

/** Bump when the persisted shape changes; add a migration in migrations.ts. */
export const CURRENT_VERSION = 4;

/**
 * auto = follows your local time (light by day, dark in the evening),
 * system = follows the OS preference, light/dark = fixed.
 */
export const THEMES = ["auto", "system", "light", "dark"] as const;
export type ThemeSetting = (typeof THEMES)[number];

/** Color palettes; the mode above picks whether the light or the dark one is shown. */
export const LIGHT_THEMES = ["paper", "cloud", "sakura", "mint"] as const;
export const DARK_THEMES = ["dusk", "midnight", "dim", "forest", "ember"] as const;
export type LightTheme = (typeof LIGHT_THEMES)[number];
export type DarkTheme = (typeof DARK_THEMES)[number];
export type ThemeId = LightTheme | DarkTheme;

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

export const REPEAT_FREQS = ["daily", "weekly", "monthly", "yearly"] as const;
export type RepeatFreq = (typeof REPEAT_FREQS)[number];

/** How something repeats, relative to an anchor date stored next to it. */
export const repeatSchema = z.object({
  freq: z.enum(REPEAT_FREQS),
  interval: z.number().int().min(1).max(99).catch(1),
  /** Weekly only: weekdays (0 = Sunday). Empty means the anchor's weekday. */
  weekdays: z.array(z.number().int().min(0).max(6)).catch([]),
  /** Last date it can occur on (inclusive), or null for no end. */
  until: dateKey.nullable().catch(null),
});
export type Repeat = z.infer<typeof repeatSchema>;

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
    /** Set when this block is a saved (edited or ticked) occurrence of a repeating series. */
    seriesId: nullableId,
    seriesDate: dateKey.nullable().catch(null),
  })
  .refine((b) => b.end > b.start, "end must be after start");
export type Block = z.infer<typeof blockSchema>;

/**
 * A repeating block. Occurrences are generated on the fly (see lib/series.ts); one only becomes a
 * real Block once you change it (move, tick, edit), and `skip` lists deleted occurrences.
 */
export const seriesSchema = z
  .object({
    ...base,
    /** First date (the repeat's anchor). */
    from: dateKey,
    start: z.number().int().min(0).max(1440),
    end: z.number().int().min(0).max(1440),
    title: z.string().max(120).catch(""),
    activityId: nullableId,
    color: hex.nullable().catch(null),
    notes: z.string().catch(""),
    goalId: nullableId,
    repeat: repeatSchema,
    skip: z.array(dateKey).catch([]),
  })
  .refine((b) => b.end > b.start, "end must be after start");
export type Series = z.infer<typeof seriesSchema>;

export const MARKER_KINDS = ["wake", "sleep"] as const;
export type MarkerKind = (typeof MARKER_KINDS)[number];

/** A wake-up or bedtime line: on one date, or repeating from that date. */
export const markerSchema = z.object({
  ...base,
  kind: z.enum(MARKER_KINDS),
  time: z.number().int().min(0).max(1440),
  date: dateKey,
  repeat: repeatSchema.nullable().catch(null),
  skip: z.array(dateKey).catch([]),
});
export type Marker = z.infer<typeof markerSchema>;

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
  /** Repeats relative to `due`; ticking it off creates the next one. */
  repeat: repeatSchema.nullable().catch(null),
  /** The finished to-do this one was created from, so un-ticking can take it back. */
  repeatOf: nullableId,
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
  id: z.string().min(1).catch(() => uuid()),
  /** Week templates: weekday (0 = Sunday). Day templates: always 0. */
  day: z.number().int().min(0).max(6).catch(0),
  start: z.number().int().min(0).max(1440),
  end: z.number().int().min(0).max(1440),
  title: z.string(),
  activityId: z.string().nullable(),
  color: hex.nullable().catch(null),
  notes: z.string().catch(""),
});
export type TemplateBlock = z.infer<typeof templateBlockSchema>;

export const TEMPLATE_KINDS = ["day", "week"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export const templateSchema = z.object({
  ...base,
  name: z.string().max(60),
  kind: z.enum(TEMPLATE_KINDS).catch("day"),
  blocks: z.array(templateBlockSchema).catch([]),
});
export type Template = z.infer<typeof templateSchema>;

export const settingsSchema = z.object({
  theme: z.enum(THEMES).catch("auto"),
  lightTheme: z.enum(LIGHT_THEMES).catch("paper"),
  darkTheme: z.enum(DARK_THEMES).catch("dusk"),
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
  series: Series[];
  markers: Marker[];
  todos: Todo[];
  lists: TodoList[];
  goals: Goal[];
  templates: Template[];
}

export type CollectionKey = "activities" | "blocks" | "series" | "markers" | "todos" | "lists" | "goals" | "templates";

export const collectionSchemas = {
  activities: activitySchema,
  blocks: blockSchema,
  series: seriesSchema,
  markers: markerSchema,
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
