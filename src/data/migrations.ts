import { createDefaultData } from "./defaults";
import {
  CURRENT_VERSION,
  collectionSchemas,
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
  /**
   * v2 → v3: the island and character are gone. The character's name becomes your name (unless it
   * was the default "Pip"), island themes map onto light/dark, and island-only fields are dropped.
   */
  2: (data) => {
    const out: Raw = { ...data, version: 3 };
    delete out.island;
    delete out.areas;
    if (isObject(data.profile)) {
      const { characterName, onboarded, updatedAt } = data.profile;
      const name = typeof characterName === "string" && characterName !== "Pip" ? characterName : "";
      out.profile = { name, onboarded, updatedAt };
    }
    if (isObject(data.settings)) {
      const map: Record<string, string> = { day: "light", retro: "light", dusk: "dark" };
      const theme = data.settings.theme;
      if (typeof theme === "string" && map[theme]) out.settings = { ...data.settings, theme: map[theme] };
    }
    return out;
  },
  /** v3 → v4: templates gain a kind ("day") and per-block ids; repeating blocks and sleep/wake lines start empty. */
  3: (data) => {
    const out: Raw = { ...data, version: 4 };
    if (Array.isArray(data.templates))
      out.templates = data.templates.map((t) =>
        isObject(t)
          ? {
              ...t,
              kind: t.kind ?? "day",
              blocks: Array.isArray(t.blocks) ? t.blocks.map((b) => (isObject(b) ? { id: uuid(), day: 0, ...b } : b)) : [],
            }
          : t,
      );
    out.series = Array.isArray(data.series) ? data.series : [];
    out.markers = Array.isArray(data.markers) ? data.markers : [];
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
    settings: singleton(settingsSchema, data.settings, defaults.settings),
    // An empty activity list would break the planner, so fall back to presets.
    activities: activities.length ? activities : defaults.activities,
    blocks: parseCollection(data.blocks, "blocks", []),
    series: parseCollection(data.series, "series", []),
    markers: parseCollection(data.markers, "markers", []),
    todos: parseCollection(data.todos, "todos", []),
    lists: parseCollection(data.lists, "lists", []),
    goals: parseCollection(data.goals, "goals", []),
    templates: parseCollection(data.templates, "templates", defaults.templates),
  };
}
