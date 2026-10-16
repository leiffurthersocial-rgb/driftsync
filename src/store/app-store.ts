"use client";

import { create } from "zustand";
import { getRepository } from "@/data";
import { appearanceSchema } from "@/data/schema";
import type {
  Activity,
  AppData,
  Appearance,
  Area,
  AreaType,
  Block,
  Goal,
  IslandMeta,
  ManualOverride,
  Profile,
  Settings,
  Template,
  Todo,
  TodoList,
} from "@/data/schema";
import type { ResetScope } from "@/data/reset";
import { stamp, nowIso } from "@/lib/id";
import { fitTier, placeWithGrowth, MAX_AREAS } from "@/lib/island-layout";
import { AREA_LABELS } from "@/lib/activities";
import { addDays } from "@/lib/time";
import { reorderSubset } from "@/lib/goals";

type Patch<T> = Partial<Omit<T, "id" | "createdAt">>;

export interface AddAreaResult {
  ok: boolean;
  area?: Area;
  reason?: string;
}

export interface AppState extends AppData {
  ready: boolean;

  hydrate(): Promise<void>;

  // profile & island
  updateProfile(patch: Partial<Profile>): void;
  updateAppearance(patch: Partial<Appearance>): void;
  updateIsland(patch: Partial<IslandMeta>): void;
  setOverride(override: Omit<ManualOverride, "since"> | null): void;
  completeOnboarding(input: { characterName: string; islandName: string; appearance: Appearance; areaTypes: AreaType[] }): void;

  // areas
  addArea(type: AreaType, opts?: { name?: string; color?: string | null; variant?: number }): AddAreaResult;
  updateArea(id: string, patch: Patch<Area>): void;
  removeArea(id: string): void;
  rerollArea(id: string): boolean;

  // activities
  saveActivity(activity: Activity): void;
  addActivity(input: Pick<Activity, "name" | "color" | "animation" | "areaId" | "areaType"> & { style?: string }): Activity;
  removeActivity(id: string): void;

  // planner
  addBlock(input: Omit<Block, "id" | "createdAt" | "updatedAt" | "deletedAt">): Block;
  updateBlock(id: string, patch: Patch<Block>): void;
  removeBlock(id: string): void;
  copyDay(from: string, to: string): number;
  saveTemplate(name: string, date: string): Template;
  applyTemplate(templateId: string, date: string): number;
  removeTemplate(id: string): void;

  // todos & goals
  addTodo(input: Partial<Todo> & { title: string }): Todo;
  updateTodo(id: string, patch: Patch<Todo>): void;
  toggleTodo(id: string): void;
  removeTodo(id: string): void;
  reorderTodos(orderedIds: string[]): void;
  addList(name: string): TodoList;
  updateList(id: string, patch: Patch<TodoList>): void;
  removeList(id: string): void;
  addGoal(input: Partial<Goal> & { title: string }): Goal;
  updateGoal(id: string, patch: Patch<Goal>): void;
  removeGoal(id: string): void;

  // settings & data
  updateSettings(patch: Partial<Settings>): void;
  exportData(): Promise<AppData>;
  importData(raw: unknown): Promise<void>;
  reset(scope: ResetScope): Promise<void>;
}

const repo = () => getRepository();
const touch = <T extends object>(r: T): T => ({ ...r, updatedAt: nowIso() });
const fire = (p: Promise<unknown>) => void p.catch((e) => console.warn("[driftsync] save failed", e));

export const useApp = create<AppState>()((set, get) => {
  /** Upsert a record into a collection in state + repository. */
  function put<K extends "areas" | "activities" | "blocks" | "todos" | "lists" | "goals" | "templates">(
    key: K,
    record: AppData[K][number],
  ) {
    const next = touch(record);
    set((s) => {
      const arr = s[key] as AppData[K][number][];
      const exists = arr.some((r) => r.id === next.id);
      return { [key]: exists ? arr.map((r) => (r.id === next.id ? next : r)) : [...arr, next] } as Partial<AppState>;
    });
    fire((repo()[key] as { put(x: unknown): Promise<unknown> }).put(next));
    return next;
  }

  function drop(key: "areas" | "activities" | "blocks" | "todos" | "lists" | "goals" | "templates", id: string) {
    set((s) => ({ [key]: (s[key] as { id: string }[]).filter((r) => r.id !== id) }) as Partial<AppState>);
    fire(repo()[key].remove(id));
  }

  function patchRecord<K extends "areas" | "activities" | "blocks" | "todos" | "lists" | "goals" | "templates">(
    key: K,
    id: string,
    patch: object,
  ) {
    const cur = (get()[key] as AppData[K][number][]).find((r) => r.id === id);
    if (cur) put(key, { ...cur, ...patch } as AppData[K][number]);
  }

  function saveSingleton<K extends "profile" | "island" | "settings">(key: K, value: AppData[K]) {
    const next = touch(value);
    set({ [key]: next } as Partial<AppState>);
    fire((repo()[key] as { save(v: unknown): Promise<unknown> }).save(next));
  }

  const applyData = (data: AppData) => set({ ...data, ready: true });

  return {
    ...emptyData(),
    ready: false,

    async hydrate() {
      if (get().ready) return;
      applyData(await repo().load());
    },

    updateProfile: (patch) => saveSingleton("profile", { ...get().profile, ...patch }),
    updateAppearance: (patch) =>
      saveSingleton("profile", { ...get().profile, appearance: { ...get().profile.appearance, ...patch } }),
    updateIsland: (patch) => saveSingleton("island", { ...get().island, ...patch }),
    setOverride: (o) => saveSingleton("profile", { ...get().profile, override: o ? { ...o, since: nowIso() } : null }),

    completeOnboarding({ characterName, islandName, appearance, areaTypes }) {
      saveSingleton("island", { ...get().island, name: islandName.trim() || "Driftsync" });
      // Replaying onboarding keeps existing areas; only missing types are added.
      const existing = new Set(get().areas.map((a) => a.type));
      for (const t of areaTypes) if (!existing.has(t)) get().addArea(t);
      saveSingleton("profile", {
        ...get().profile,
        characterName: characterName.trim() || "Pip",
        appearance,
        onboarded: true,
      });
    },

    addArea(type, opts = {}) {
      const { areas, island } = get();
      if (areas.length >= MAX_AREAS) return { ok: false, reason: "The island is full. Remove an area to make room." };
      const pos = placeWithGrowth(island.tier, island.seed, areas);
      if (!pos) return { ok: false, reason: "No room left for another area." };
      if (pos.tier !== island.tier) saveSingleton("island", { ...island, tier: pos.tier });
      const area = put("areas", {
        ...stamp(),
        type,
        name: opts.name?.trim() || uniqueName(AREA_LABELS[type], areas),
        color: opts.color ?? null,
        variant: opts.variant ?? 0,
        x: pos.x,
        y: pos.y,
      });
      return { ok: true, area };
    },

    updateArea: (id, patch) => patchRecord("areas", id, patch),

    removeArea(id) {
      drop("areas", id);
      const { areas, island, profile, activities } = get();
      const tier = fitTier(island.seed, areas, island.tier);
      if (tier !== island.tier) saveSingleton("island", { ...island, tier });
      if (profile.override?.areaId === id) saveSingleton("profile", { ...profile, override: null });
      for (const a of activities) if (a.areaId === id) put("activities", { ...a, areaId: null });
    },

    rerollArea(id) {
      const { areas, island } = get();
      const target = areas.find((a) => a.id === id);
      if (!target) return false;
      const others = areas.filter((a) => a.id !== id);
      const pos = placeWithGrowth(island.tier, island.seed, others, {
        jitter: Math.floor(Math.random() * 100000) + 1,
        avoid: target,
      });
      if (!pos) return false;
      if (pos.tier !== island.tier) saveSingleton("island", { ...island, tier: pos.tier });
      put("areas", { ...target, x: pos.x, y: pos.y });
      return true;
    },

    saveActivity: (activity) => void put("activities", activity),
    addActivity(input) {
      const order = Math.max(0, ...get().activities.map((a) => a.order)) + 1;
      return put("activities", { ...stamp(), key: `custom-${Date.now()}`, preset: false, order, style: "auto", ...input });
    },
    removeActivity(id) {
      drop("activities", id);
      for (const b of get().blocks) if (b.activityId === id) put("blocks", { ...b, activityId: null });
    },

    addBlock: (input) => put("blocks", { ...stamp(), ...input }),
    updateBlock: (id, patch) => patchRecord("blocks", id, patch),
    removeBlock: (id) => drop("blocks", id),

    copyDay(from, to) {
      const src = get().blocks.filter((b) => b.date === from);
      for (const b of src) put("blocks", { ...b, ...stamp(), date: to, done: false });
      return src.length;
    },

    saveTemplate(name, date) {
      const blocks = get()
        .blocks.filter((b) => b.date === date)
        .sort((a, b) => a.start - b.start)
        .map(({ start, end, title, activityId, color, notes }) => ({ start, end, title, activityId, color, notes }));
      return put("templates", { ...stamp(), name: name.trim() || "Template", blocks });
    },

    applyTemplate(templateId, date) {
      const t = get().templates.find((x) => x.id === templateId);
      if (!t) return 0;
      for (const b of t.blocks)
        put("blocks", { ...stamp(), ...b, date, done: false, todoId: null, goalId: null });
      return t.blocks.length;
    },

    removeTemplate: (id) => drop("templates", id),

    addTodo(input) {
      const order = Math.min(0, ...get().todos.map((t) => t.order)) - 1;
      return put("todos", {
        ...stamp(),
        listId: null,
        due: null,
        priority: 0,
        done: false,
        doneAt: null,
        goalId: null,
        notes: "",
        order,
        ...input,
        title: input.title.trim(),
      });
    },
    updateTodo: (id, patch) => patchRecord("todos", id, patch),
    toggleTodo(id) {
      const t = get().todos.find((x) => x.id === id);
      if (t) put("todos", { ...t, done: !t.done, doneAt: t.done ? null : nowIso() });
    },
    removeTodo(id) {
      drop("todos", id);
      for (const b of get().blocks) if (b.todoId === id) put("blocks", { ...b, todoId: null });
    },
    reorderTodos(orderedIds) {
      const slots = reorderSubset(get().todos, orderedIds);
      const changed = get()
        .todos.filter((t) => slots.has(t.id) && slots.get(t.id) !== t.order)
        .map((t) => touch({ ...t, order: slots.get(t.id)! }));
      if (!changed.length) return;
      const map = new Map(changed.map((t) => [t.id, t]));
      set((s) => ({ todos: s.todos.map((t) => map.get(t.id) ?? t) }));
      fire(repo().todos.putMany(changed));
    },
    addList(name) {
      const order = get().lists.length;
      return put("lists", { ...stamp(), name: name.trim() || "List", order });
    },
    updateList: (id, patch) => patchRecord("lists", id, patch),
    removeList(id) {
      drop("lists", id);
      for (const t of get().todos) if (t.listId === id) put("todos", { ...t, listId: null });
    },
    addGoal(input) {
      return put("goals", {
        ...stamp(),
        deadline: null,
        type: "milestones",
        milestones: [],
        frequency: null,
        color: "#6e5ee6",
        archived: false,
        order: get().goals.length,
        ...input,
        title: input.title.trim(),
      });
    },
    updateGoal: (id, patch) => patchRecord("goals", id, patch),
    removeGoal(id) {
      drop("goals", id);
      for (const t of get().todos) if (t.goalId === id) put("todos", { ...t, goalId: null });
      for (const b of get().blocks) if (b.goalId === id) put("blocks", { ...b, goalId: null });
    },

    updateSettings: (patch) => saveSingleton("settings", { ...get().settings, ...patch }),

    exportData: () => repo().exportAll(),
    async importData(raw) {
      applyData(await repo().importAll(raw));
    },
    async reset(scope) {
      applyData(await repo().reset(scope));
    },
  };
});

function uniqueName(base: string, areas: Area[]) {
  const names = new Set(areas.map((a) => a.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
}

function emptyData(): AppData {
  const t = "";
  return {
    version: 1,
    profile: {
      characterName: "",
      appearance: appearanceSchema.parse({}),
      onboarded: true,
      override: null,
      updatedAt: t,
    },
    island: { name: "", seed: 1, tier: 0, updatedAt: t },
    settings: { theme: "auto", dayStartHour: 6, dayEndHour: 24, clock: "24h", weekStart: 1, defaultBlockMinutes: 60, updatedAt: t },
    areas: [],
    activities: [],
    blocks: [],
    todos: [],
    lists: [],
    goals: [],
    templates: [],
  };
}

/** Helper for "copy yesterday". */
export const yesterdayOf = (date: string) => addDays(date, -1);

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __driftsync: typeof useApp }).__driftsync = useApp;
}
