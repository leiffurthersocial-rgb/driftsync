import { migrate } from "./migrations";
import { applyReset, type ResetScope } from "./reset";
import type { Collection, Repository, Singleton } from "./repository";
import type { AppData, BaseRecord, CollectionKey } from "./schema";

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
      this.persist();
    }
    return this.data;
  }

  private persist() {
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
    this.data = purge(migrate(raw));
    this.persist();
    return visible(this.data);
  }

  async reset(scope: ResetScope) {
    this.data = applyReset(this.get(), scope);
    this.persist();
    return visible(this.data);
  }
}

const COLLECTIONS: CollectionKey[] = ["activities", "blocks", "series", "markers", "todos", "lists", "goals", "templates"];

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
