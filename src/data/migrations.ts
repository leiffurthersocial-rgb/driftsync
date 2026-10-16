import { createDefaultData } from "./defaults";
import {
  CURRENT_VERSION,
  collectionSchemas,
  islandSchema,
  profileSchema,
  settingsSchema,
  type AppData,
  type CollectionKey,
} from "./schema";
import { uuid } from "@/lib/id";

type Raw = Record<string, unknown>;
type Migration = (data: Raw) => Raw;

const isObject = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Migrations keyed by the version they upgrade FROM.
 * v0 = early unversioned drafts: records may lack ids/timestamps, island name lived on the profile.
 */
export const migrations: Record<number, Migration> = {
  0: (data) => {
    const t = new Date().toISOString();
    const fill = (arr: unknown) =>
      Array.isArray(arr)
        ? arr.filter(isObject).map((r) => ({
            id: typeof r.id === "string" && r.id ? r.id : uuid(),
            createdAt: typeof r.createdAt === "string" ? r.createdAt : t,
            updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : t,
            deletedAt: r.deletedAt ?? null,
            ...r,
          }))
        : arr;
    const out: Raw = { ...data, version: 1 };
    for (const key of Object.keys(collectionSchemas)) out[key] = fill(data[key]);
    const profile = isObject(data.profile) ? data.profile : {};
    if (!isObject(data.island) && typeof profile.islandName === "string") {
      out.island = { name: profile.islandName };
    }
    return out;
  },
  /** v1 → v2: single `accessory` split into headwear/eyewear/neckwear/backpack; activities gain `style`. */
  1: (data) => {
    const out: Raw = { ...data, version: 2 };
    if (isObject(data.profile) && isObject(data.profile.appearance)) {
      const a = { ...data.profile.appearance };
      const acc = a.accessory;
      delete a.accessory;
      if (acc === "glasses") a.eyewear = "round";
      if (acc === "cap") a.headwear = "cap";
      if (acc === "headphones") a.headwear = "headphones";
      if (acc === "scarf") a.neckwear = "scarf";
      if (acc === "backpack") a.backpack = true;
      out.profile = { ...data.profile, appearance: a };
    }
    if (Array.isArray(data.activities))
      out.activities = data.activities.map((x) => (isObject(x) && typeof x.style !== "string" ? { ...x, style: "auto" } : x));
    return out;
  },
};

/** Validate a collection, dropping only the records that fail rather than the whole dataset. */
function parseCollection<K extends CollectionKey>(raw: unknown, key: K, fallback: AppData[K]): AppData[K] {
  if (!Array.isArray(raw)) return fallback;
  const schema = collectionSchemas[key];
  const out: unknown[] = [];
  for (const item of raw) {
    const res = schema.safeParse(item);
    if (res.success) out.push(res.data);
  }
  return out as AppData[K];
}

/**
 * Turn anything (old versions, partial or corrupted data) into a valid AppData.
 * Never throws.
 */
export function migrate(input: unknown): AppData {
  const defaults = createDefaultData();
  if (!isObject(input)) return defaults;

  let data: Raw = input;
  let version = typeof data.version === "number" && Number.isFinite(data.version) ? data.version : 0;
  while (version < CURRENT_VERSION) {
    const step = migrations[version];
    try {
      data = step ? step(data) : data;
    } catch {
      return defaults;
    }
    version += 1;
  }

  const singleton = <T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, raw: unknown, fb: T): T => {
    if (!isObject(raw)) return fb;
    const res = schema.safeParse({ ...(fb as object), ...raw });
    return res.success ? (res.data as T) : fb;
  };

  const activities = parseCollection(data.activities, "activities", defaults.activities);
  return {
    version: CURRENT_VERSION,
    profile: singleton(profileSchema, data.profile, defaults.profile),
    island: singleton(islandSchema, data.island, defaults.island),
    settings: singleton(settingsSchema, data.settings, defaults.settings),
    areas: parseCollection(data.areas, "areas", []),
    // An empty activity list would break the planner, so fall back to presets.
    activities: activities.length ? activities : defaults.activities,
    blocks: parseCollection(data.blocks, "blocks", []),
    todos: parseCollection(data.todos, "todos", []),
    lists: parseCollection(data.lists, "lists", []),
    goals: parseCollection(data.goals, "goals", []),
    templates: parseCollection(data.templates, "templates", defaults.templates),
  };
}
