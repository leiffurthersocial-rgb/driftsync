import { migrate } from "./migrations";
import { applyReset, type ResetScope } from "./reset";
import type { Collection, Repository, Singleton } from "./repository";
import { CURRENT_VERSION, collectionSchemas, profileSchema, settingsSchema, type AppData, type BaseRecord, type CollectionKey, type Profile, type Settings } from "./schema";
import { defaultProfile, defaultSettings } from "./defaults";

export const STORAGE_KEY = "driftsync:data";
/** Soft-deleted records older than this are purged on load. */
const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/** Minimal storage surface so tests can inject an in-memory store. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const memoryStore = (): KeyValueStore => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

/**
 * Keeps the whole dataset in memory and writes it back to localStorage on every mutation
 * (coalesced into one write per microtask).
 */
export class LocalStorageRepository implements Repository {
  readonly kind = "local" as const;
  private data: AppData | null = null;
  private flushQueued = false;
  private store: KeyValueStore;
  private listeners = new Set<() => void>();

  constructor(store?: KeyValueStore) {
    this.store = store ?? (typeof window !== "undefined" && window.localStorage ? window.localStorage : memoryStore());
  }

  private get(): AppData {
    if (!this.data) {
      let raw: unknown = undefined;
      try {
        const text = this.store.getItem(STORAGE_KEY);
        raw = text ? JSON.parse(text) : undefined;
      } catch {
        raw = undefined;
      }
      this.data = purge(migrate(raw));
      this.persist(true);
    }
    return this.data;
  }

  /** Save to storage. Local edits notify listeners (the sync engine); sync's own writes are silent. */
  private persist(silent = false) {
    if (!silent) for (const l of this.listeners) l();
    if (this.flushQueued) return;
    this.flushQueued = true;
    queueMicrotask(() => {
      this.flushQueued = false;
      try {
        this.store.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch (err) {
        console.warn("[driftsync] could not persist data", err);
      }
    });
  }

  private collection<K extends CollectionKey>(key: K): Collection<AppData[K][number]> {
    type T = AppData[K][number];
    return {
      list: async () => (this.get()[key] as T[]).filter((r) => !r.deletedAt),
      put: async (item) => {
        const next = { ...item, updatedAt: new Date().toISOString() } as T;
        const d = this.get();
        const arr = d[key] as T[];
        const i = arr.findIndex((r) => r.id === item.id);
        (d[key] as T[]) = i === -1 ? [...arr, next] : arr.map((r, j) => (j === i ? next : r));
        this.persist();
        return next;
      },
      putMany: async (items) => {
        const d = this.get();
        const t = new Date().toISOString();
        const byId = new Map((d[key] as T[]).map((r) => [r.id, r]));
        for (const it of items) byId.set(it.id, { ...it, updatedAt: t } as T);
        (d[key] as T[]) = [...byId.values()];
        this.persist();
      },
      remove: async (id) => {
        const d = this.get();
        const t = new Date().toISOString();
        (d[key] as T[]) = (d[key] as T[]).map((r) =>
          r.id === id ? ({ ...r, deletedAt: t, updatedAt: t } as T) : r,
        );
        this.persist();
      },
    };
  }

  private singleton<K extends "profile" | "settings">(key: K): Singleton<AppData[K]> {
    return {
      get: async () => this.get()[key],
      save: async (value) => {
        const next = { ...value, updatedAt: new Date().toISOString() };
        this.get()[key] = next;
        this.persist();
        return next;
      },
    };
  }

  profile = this.singleton("profile");
  settings = this.singleton("settings");
  activities = this.collection("activities");
  blocks = this.collection("blocks");
  series = this.collection("series");
  markers = this.collection("markers");
  todos = this.collection("todos");
  lists = this.collection("lists");
  goals = this.collection("goals");
  templates = this.collection("templates");

  async load() {
    return visible(this.get());
  }

  async exportAll() {
    return structuredClone(this.get());
  }

  async importAll(raw: unknown) {
    // Imported data replaces everything, so it counts as edited now (and wins when syncing).
    const t = new Date().toISOString();
    const next = restamp(purge(migrate(raw)), t);
    this.data = withTombstones(this.get(), next, t);
    this.persist();
    return visible(this.data);
  }

  async reset(scope: ResetScope) {
    const t = new Date().toISOString();
    this.data = withTombstones(this.get(), applyReset(this.get(), scope), t);
    this.persist();
    return visible(this.data);
  }

  /* ---------- sync support (see src/sync/engine.ts) ---------- */

  /** Called after every local edit. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Everything edited after `since` (deletions included), for uploading. */
  changedSince(since: string): SyncChanges {
    const d = this.get();
    const after = ms(since);
    const records: SyncRecord[] = [];
    for (const collection of COLLECTIONS)
      for (const r of d[collection] as BaseRecord[]) if (ms(r.updatedAt) > after) records.push({ collection, record: r });
    return {
      records,
      profile: ms(d.profile.updatedAt) > after ? d.profile : null,
      settings: ms(d.settings.updatedAt) > after ? d.settings : null,
    };
  }

  /**
   * Merge changes from another device: for each record the newer `updatedAt` wins (ties keep
   * the local copy). Invalid records are skipped. Returns how many local records changed.
   */
  applyRemote(changes: RemoteChanges, opts: { dedupePresets?: boolean } = {}): number {
    const d = this.get();
    let changed = 0;
    const copies = new Map<CollectionKey, { arr: BaseRecord[]; index: Map<string, number> }>();
    for (const { collection, record } of changes.records) {
      const schema = collectionSchemas[collection];
      if (!schema) continue;
      const res = schema.safeParse(record);
      if (!res.success) continue;
      const next = res.data as BaseRecord;
      let c = copies.get(collection);
      if (!c) {
        const arr = [...(d[collection] as BaseRecord[])];
        c = { arr, index: new Map(arr.map((r, i) => [r.id, i])) };
        copies.set(collection, c);
      }
      const i = c.index.get(next.id);
      if (i === undefined) {
        c.index.set(next.id, c.arr.length);
        c.arr.push(next);
      } else if (ms(next.updatedAt) > ms(c.arr[i].updatedAt)) c.arr[i] = next;
      else continue;
      changed++;
    }
    for (const [k, c] of copies) (d[k] as BaseRecord[]) = c.arr;
    const prof = changes.profile ? profileSchema.safeParse({ ...defaultProfile(), ...(changes.profile as object) }) : null;
    if (prof?.success && ms(prof.data.updatedAt) > ms(d.profile.updatedAt)) {
      d.profile = prof.data;
      changed++;
    }
    const sett = changes.settings ? settingsSchema.safeParse({ ...defaultSettings(), ...(changes.settings as object) }) : null;
    if (sett?.success && ms(sett.data.updatedAt) > ms(d.settings.updatedAt)) {
      d.settings = sett.data;
      changed++;
    }
    if (opts.dedupePresets) changed += dedupePresetActivities(d);
    if (changed) this.persist(true);
    return changed;
  }

  /** Replace everything on this device with an account's data (first sign-in on a fresh device). */
  replaceWithRemote(changes: RemoteChanges, version = CURRENT_VERSION) {
    const raw: Record<string, unknown> = { version, profile: changes.profile ?? undefined, settings: changes.settings ?? undefined };
    for (const c of COLLECTIONS) raw[c] = changes.records.filter((r) => r.collection === c).map((r) => r.record);
    this.data = purge(migrate(raw));
    this.persist(true);
  }

  /** True when nothing here was made by the user (only defaults), so an account's data can simply replace it. */
  isPristine(): boolean {
    const d = this.get();
    const live = <T extends BaseRecord>(arr: T[]) => arr.some((r) => !r.deletedAt);
    return !live(d.blocks) && !live(d.series) && !live(d.markers) && !live(d.todos) && !live(d.lists) && !live(d.goals);
  }
}

export interface SyncRecord {
  collection: CollectionKey;
  record: BaseRecord;
}
export interface SyncChanges {
  records: SyncRecord[];
  profile: Profile | null;
  settings: Settings | null;
}
/** Incoming changes are untrusted shapes until validated. */
export interface RemoteChanges {
  records: { collection: CollectionKey; record: unknown }[];
  profile: unknown;
  settings: unknown;
}

const ms = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : 0;
};

/** Records that existed before but not after a reset/import become deletions, so other devices learn about them. */
function withTombstones(before: AppData, after: AppData, t: string): AppData {
  const out = { ...after };
  for (const k of COLLECTIONS) {
    const ids = new Set((after[k] as BaseRecord[]).map((r) => r.id));
    const gone = (before[k] as BaseRecord[]).filter((r) => !ids.has(r.id) && !r.deletedAt).map((r) => ({ ...r, deletedAt: t, updatedAt: t }));
    (out[k] as BaseRecord[]) = [...(after[k] as BaseRecord[]), ...gone];
  }
  return out;
}

function restamp(data: AppData, t: string): AppData {
  return {
    ...mapCollections(data, (arr) => arr.map((r) => ({ ...r, updatedAt: t }))),
    profile: { ...data.profile, updatedAt: t },
    settings: { ...data.settings, updatedAt: t },
  };
}

/**
 * Two devices that both started from the default activities have "Work", "School", … with
 * different ids. When merging, keep the account's copy and point this device's plans at it.
 */
function dedupePresetActivities(d: AppData): number {
  const t = new Date().toISOString();
  let changed = 0;
  // The older copy (usually the account's) is kept.
  const older = (x: AppData["activities"][number], y: AppData["activities"][number]) => x.createdAt < y.createdAt || (x.createdAt === y.createdAt && x.id < y.id);
  for (const a of d.activities.filter((x) => x.preset && !x.deletedAt)) {
    const keep = d.activities.find((b) => b.key === a.key && b.id !== a.id && !b.deletedAt && older(b, a));
    if (!keep) continue;
    const swap = (id: string | null) => (id === a.id ? keep.id : id);
    d.blocks = d.blocks.map((b) => (b.activityId === a.id ? { ...b, activityId: keep.id, updatedAt: t } : b));
    d.series = d.series.map((s) => (s.activityId === a.id ? { ...s, activityId: keep.id, updatedAt: t } : s));
    d.templates = d.templates.map((tp) =>
      tp.blocks.some((b) => b.activityId === a.id) ? { ...tp, blocks: tp.blocks.map((b) => ({ ...b, activityId: swap(b.activityId) })), updatedAt: t } : tp,
    );
    d.goals = d.goals.map((g) => (g.frequency?.activityId === a.id ? { ...g, frequency: { ...g.frequency, activityId: keep.id }, updatedAt: t } : g));
    d.activities = d.activities.map((x) => (x.id === a.id ? { ...x, deletedAt: t, updatedAt: t } : x));
    changed++;
  }
  return changed;
}

export const COLLECTIONS: CollectionKey[] = ["activities", "blocks", "series", "markers", "todos", "lists", "goals", "templates"];

function mapCollections(data: AppData, fn: <T extends BaseRecord>(arr: T[]) => T[]): AppData {
  const out = { ...data };
  for (const k of COLLECTIONS) (out[k] as BaseRecord[]) = fn(data[k] as BaseRecord[]);
  return out;
}

/** Copy without soft-deleted records, for handing to the UI. */
export const visible = (data: AppData) => mapCollections(data, (arr) => arr.filter((r) => !r.deletedAt));

function purge(data: AppData): AppData {
  const cutoff = Date.now() - PURGE_AFTER_MS;
  return mapCollections(data, (arr) => arr.filter((r) => !r.deletedAt || Date.parse(r.deletedAt) > cutoff));
}
