import { z } from "zod";

/** Bump when the persisted shape changes; add a migration in migrations.ts. */
export const CURRENT_VERSION = 2;

export const AREA_TYPES = ["gym", "study", "library", "photo", "track", "workshop", "hobby"] as const;
export type AreaType = (typeof AREA_TYPES)[number];

export const ANIMATIONS = ["study", "workout", "jog", "photo", "read", "work", "hobby", "rest", "generic"] as const;
export type AnimationKind = (typeof ANIMATIONS)[number];

export const HAIR_STYLES = [
  "short",
  "buzz",
  "long",
  "bob",
  "ponytail",
  "bun",
  "pigtails",
  "curly",
  "afro",
  "spiky",
  "mohawk",
  "wavy",
  "bald",
] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export const EYE_STYLES = ["dot", "round", "sparkle", "sleepy", "lashes"] as const;
export const FACIAL_HAIR = ["none", "stubble", "mustache", "beard"] as const;
export const TOPS = ["tee", "hoodie", "sweater", "shirt", "tank", "dress", "overalls"] as const;
export const TOP_PATTERNS = ["solid", "stripes", "dots"] as const;
export const BOTTOMS = ["pants", "shorts", "skirt"] as const;
export const HEADWEAR = ["none", "cap", "beanie", "bucket", "headband", "headphones", "flower", "bow"] as const;
export const EYEWEAR = ["none", "round", "square", "sunglasses"] as const;
export const NECKWEAR = ["none", "scarf", "necklace"] as const;

export const THEMES = ["auto", "day", "dusk", "retro"] as const;
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

export const appearanceSchema = z.object({
  skin: z.number().int().min(0).max(7).catch(1),
  hairStyle: z.enum(HAIR_STYLES).catch("short"),
  hairColor: hex.catch("#4a3426"),
  eyeStyle: z.enum(EYE_STYLES).catch("round"),
  eyeColor: hex.catch("#2b2233"),
  blush: z.boolean().catch(true),
  freckles: z.boolean().catch(false),
  facialHair: z.enum(FACIAL_HAIR).catch("none"),
  top: z.enum(TOPS).catch("tee"),
  /** Top color (kept as `outfitColor` for compatibility with v1 data). */
  outfitColor: hex.catch("#6e5ee6"),
  topPattern: z.enum(TOP_PATTERNS).catch("solid"),
  bottom: z.enum(BOTTOMS).catch("pants"),
  bottomColor: hex.catch("#3d3a5c"),
  shoesColor: hex.catch("#4b4458"),
  headwear: z.enum(HEADWEAR).catch("none"),
  headwearColor: hex.catch("#e7795f"),
  eyewear: z.enum(EYEWEAR).catch("none"),
  neckwear: z.enum(NECKWEAR).catch("none"),
  neckwearColor: hex.catch("#e7795f"),
  backpack: z.boolean().catch(false),
  /** Gym clothes worn for sporty activities. */
  sportColor: hex.catch("#4fb3b0"),
  sportSwitch: z.boolean().catch(true),
});export type Appearance = z.infer<typeof appearanceSchema>;

export const overrideSchema = z.object({
  areaId: z.string(),
  activityId: z.string().nullable(),
  since: z.string(),
});
export type ManualOverride = z.infer<typeof overrideSchema>;

export const profileSchema = z.object({
  characterName: z.string().max(40).catch("Pip"),
  appearance: appearanceSchema.catch(appearanceSchema.parse({})),
  onboarded: z.boolean().catch(false),
  override: overrideSchema.nullable().catch(null),
  updatedAt: z.string().catch(""),
});
export type Profile = z.infer<typeof profileSchema>;

export const islandSchema = z.object({
  name: z.string().max(40).catch("Driftsync"),
  seed: z.number().int().catch(1),
  /** Minimum size tier; the effective tier also depends on area count. */
  tier: z.number().int().min(0).catch(0),
  updatedAt: z.string().catch(""),
});
export type IslandMeta = z.infer<typeof islandSchema>;

export const areaSchema = z.object({
  ...base,
  type: z.enum(AREA_TYPES),
  name: z.string().max(40),
  color: hex.nullable().catch(null),
  variant: z.number().int().min(0).max(2).catch(0),
  /** Footprint position relative to island center, in tiles. */
  x: z.number().int(),
  y: z.number().int(),
});
export type Area = z.infer<typeof areaSchema>;

export const activitySchema = z.object({
  ...base,
  key: z.string(),
  name: z.string().max(40),
  color: hex,
  animation: z.enum(ANIMATIONS).catch("generic"),
  areaType: z.enum(AREA_TYPES).nullable().catch(null),
  areaId: nullableId,
  /** "auto" rotates between routines; otherwise a routine id (see island/character/routines.ts). */
  style: z.string().catch("auto"),
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
  island: IslandMeta;
  settings: Settings;
  areas: Area[];
  activities: Activity[];
  blocks: Block[];
  todos: Todo[];
  lists: TodoList[];
  goals: Goal[];
  templates: Template[];
}

export type CollectionKey = "areas" | "activities" | "blocks" | "todos" | "lists" | "goals" | "templates";

export const collectionSchemas = {
  areas: areaSchema,
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
