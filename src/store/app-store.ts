"use client";

import { create } from "zustand";
import { getRepository } from "@/data";
import type {
  Activity,
  AppData,
  Block,
  Goal,
  Profile,
  Settings,
  Template,
  Todo,
  TodoList,
} from "@/data/schema";
import type { ResetScope } from "@/data/reset";
import { stamp, nowIso } from "@/lib/id";
import { addDays } from "@/lib/time";
import { reorderSubset } from "@/lib/goals";

type Patch<T> = Partial<Omit<T, "id" | "createdAt">>;

export interface AppState extends AppData {
  ready: boolean;

  hydrate(): Promise<void>;

  // profile & activities
  updateProfile(patch: Partial<Profile>): void;
  completeOnboarding(input: { name: string; activityIds?: string[] }): void;
  saveActivity(activity: Activity): void;
  addActivity(input: Pick<Activity, "name" | "color">): Activity;
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
  function put<K extends "activities" | "blocks" | "todos" | "lists" | "goals" | "templates">(
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

  function drop(key: "activities" | "blocks" | "todos" | "lists" | "goals" | "templates", id: string) {
    set((s) => ({ [key]: (s[key] as { id: string }[]).filter((r) => r.id !== id) }) as Partial<AppState>);
    fire(repo()[key].remove(id));
  }

  function patchRecord<K extends "activities" | "blocks" | "todos" | "lists" | "goals" | "templates">(
    key: K,
    id: string,
    patch: object,
  ) {
    const cur = (get()[key] as AppData[K][number][]).find((r) => r.id === id);
    if (cur) put(key, { ...cur, ...patch } as AppData[K][number]);
  }

  function saveSingleton<K extends "profile" | "settings">(key: K, value: AppData[K]) {
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

    completeOnboarding({ name, activityIds }) {
      // Unpicked activities are dropped so the planner only offers what you do, unless something
      // already uses them (replaying onboarding must never strip existing plans).
      if (activityIds?.length) {
        const { blocks, goals } = get();
        const used = new Set([...blocks.map((b) => b.activityId), ...goals.map((g) => g.frequency?.activityId)]);
        for (const a of get().activities) if (!activityIds.includes(a.id) && !used.has(a.id)) get().removeActivity(a.id);
      }
      saveSingleton("profile", { ...get().profile, name: name.trim(), onboarded: true });
    },

    saveActivity: (activity) => void put("activities", activity),
    addActivity(input) {
      const order = Math.max(0, ...get().activities.map((a) => a.order)) + 1;
      return put("activities", { ...stamp(), key: `custom-${Date.now()}`, preset: false, order, ...input });
    },
    removeActivity(id) {
      // Blocks and template entries keep the activity's color so plans don't turn grey.
      const color = get().activities.find((a) => a.id === id)?.color ?? null;
      drop("activities", id);
      for (const b of get().blocks) if (b.activityId === id) put("blocks", { ...b, activityId: null, color: b.color ?? color });
      for (const t of get().templates)
        if (t.blocks.some((b) => b.activityId === id))
          put("templates", { ...t, blocks: t.blocks.map((b) => (b.activityId === id ? { ...b, activityId: null, color: b.color ?? color } : b)) });
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

function emptyData(): AppData {
  const t = "";
  return {
    version: 1,
    profile: { name: "", onboarded: true, updatedAt: t },
    settings: { theme: "auto", dayStartHour: 6, dayEndHour: 24, clock: "24h", weekStart: 1, defaultBlockMinutes: 60, updatedAt: t },
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
