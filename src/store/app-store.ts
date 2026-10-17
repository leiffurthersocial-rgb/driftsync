"use client";

import { create } from "zustand";
import { getRepository } from "@/data";
import type {
  Activity,
  AppData,
  Block,
  Goal,
  Marker,
  MarkerKind,
  Profile,
  Repeat,
  Series,
  Settings,
  Template,
  TemplateBlock,
  TemplateKind,
  Todo,
  TodoList,
} from "@/data/schema";
import type { ResetScope } from "@/data/reset";
import { stamp, nowIso, uuid } from "@/lib/id";
import { addDays, toDateKey } from "@/lib/time";
import { reorderSubset } from "@/lib/goals";
import { weekDays } from "@/lib/calendar";
import { nextOccurrence, occursOn, weekdayOf } from "@/lib/recurrence";
import { expandBlocks, findBlock, isVirtual, virtualId } from "@/lib/series";

type Patch<T> = Partial<Omit<T, "id" | "createdAt">>;
type Meta = "id" | "createdAt" | "updatedAt" | "deletedAt";
export type BlockInput = Omit<Block, Meta | "seriesId" | "seriesDate"> & Partial<Pick<Block, "seriesId" | "seriesDate">>;
/** Fields that can change for a whole repeating series. */
export type SeriesPatch = Partial<Pick<Series, "title" | "activityId" | "color" | "notes" | "goalId" | "start" | "end" | "repeat">>;
/** "one" = only this occurrence; "upcoming" = this and every later one. */
export type RepeatScope = "one" | "upcoming";

type Key = "activities" | "blocks" | "series" | "markers" | "todos" | "lists" | "goals" | "templates";

export interface AppState extends AppData {
  ready: boolean;

  hydrate(): Promise<void>;

  // profile & activities
  updateProfile(patch: Partial<Profile>): void;
  completeOnboarding(input: { name: string; activityIds?: string[] }): void;
  saveActivity(activity: Activity): void;
  addActivity(input: Pick<Activity, "name" | "color">): Activity;
  removeActivity(id: string): void;

  // planner (ids may be unsaved repeat occurrences, see lib/series.ts)
  /** Real blocks plus generated repeat occurrences between two dates (inclusive). */
  blocksBetween(from: string, to: string): Block[];
  addBlock(input: BlockInput): Block;
  /** Returns the block's id afterwards: editing an unsaved repeat occurrence saves it under a new id. */
  updateBlock(id: string, patch: Patch<Block>): string;
  removeBlock(id: string, scope?: RepeatScope): void;
  /** Change this occurrence and every later one. Returns the id to keep editing, or null if it no longer occurs. */
  updateSeriesFrom(id: string, patch: SeriesPatch): string | null;
  /** Start, change or stop repeating. Returns the id to keep editing. */
  setBlockRepeat(id: string, repeat: Repeat | null): string | null;
  copyDay(from: string, to: string): number;
  clearDay(date: string): number;

  // wake & bedtime lines
  addMarker(input: Pick<Marker, "kind" | "time" | "date" | "repeat">): Marker;
  updateMarker(id: string, patch: Patch<Marker>): void;
  removeMarker(id: string): void;
  /** Hide every line of this kind on one date (deletes one-day lines, skips repeating ones). */
  clearMarkerOn(kind: MarkerKind, date: string): void;
  /** Stop a repeating line from `date` on. */
  endMarkerFrom(id: string, date: string): void;

  // templates
  addTemplate(input: { name: string; kind: TemplateKind }): Template;
  updateTemplate(id: string, patch: Partial<Pick<Template, "name">>): void;
  duplicateTemplate(id: string): Template | null;
  removeTemplate(id: string): void;
  saveTemplate(name: string, date: string): Template;
  saveWeekTemplate(name: string, date: string): Template;
  /** Day templates fill `date`; week templates fill the week containing `date`. */
  applyTemplate(templateId: string, date: string): number;
  addTemplateBlock(templateId: string, input: Omit<TemplateBlock, "id">): TemplateBlock;
  updateTemplateBlock(templateId: string, blockId: string, patch: Partial<Omit<TemplateBlock, "id">>): void;
  removeTemplateBlock(templateId: string, blockId: string): void;
  /** Week templates: replace the blocks of `toDays` with copies of `fromDay`'s. */
  copyTemplateDay(templateId: string, fromDay: number, toDays: number[]): number;

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
  function put<K extends Key>(
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

  function drop(key: Key, id: string) {
    set((s) => ({ [key]: (s[key] as { id: string }[]).filter((r) => r.id !== id) }) as Partial<AppState>);
    fire(repo()[key].remove(id));
  }

  function patchRecord<K extends Key>(
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

  const seriesOf = (b: Block) => (b.seriesId ? (get().series.find((x) => x.id === b.seriesId) ?? null) : null);

  /** End a series the day before `date` (or delete it if that's its start) and drop saved occurrences after. */
  function endSeriesFrom(s: Series, date: string) {
    if (date <= s.from) drop("series", s.id);
    else put("series", { ...s, repeat: { ...s.repeat, until: addDays(date, -1) }, skip: s.skip.filter((d) => d < date) });
    for (const blk of get().blocks) if (blk.seriesId === s.id && blk.seriesDate && blk.seriesDate >= date) drop("blocks", blk.id);
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
      for (const sr of get().series) if (sr.activityId === id) put("series", { ...sr, activityId: null, color: sr.color ?? color });
      for (const t of get().templates)
        if (t.blocks.some((b) => b.activityId === id))
          put("templates", { ...t, blocks: t.blocks.map((b) => (b.activityId === id ? { ...b, activityId: null, color: b.color ?? color } : b)) });
    },

    blocksBetween: (from, to) => expandBlocks(get().blocks, get().series, from, to),

    addBlock: (input) => put("blocks", { seriesId: null, seriesDate: null, ...input, ...stamp() }),

    updateBlock(id, patch) {
      if (!isVirtual(id)) {
        patchRecord("blocks", id, patch);
        return id;
      }
      const occ = findBlock(id, get().blocks, get().series);
      return occ ? put("blocks", { ...occ, ...patch, ...stamp() }).id : id;
    },

    removeBlock(id, scope = "one") {
      const b = findBlock(id, get().blocks, get().series);
      if (!b) return;
      const s = seriesOf(b);
      if (!isVirtual(id)) drop("blocks", id);
      if (!s || !b.seriesDate) return;
      if (scope === "one") put("series", { ...s, skip: [...new Set([...s.skip, b.seriesDate])] });
      else endSeriesFrom(s, b.seriesDate);
    },

    updateSeriesFrom(id, patch) {
      const b = findBlock(id, get().blocks, get().series);
      if (!b) return null;
      const s = seriesOf(b);
      const { repeat, ...fields } = patch;
      if (!s || !b.seriesDate) return get().updateBlock(id, fields);
      const date = b.seriesDate;
      let target: Series;
      if (date <= s.from) target = put("series", { ...s, ...fields, repeat: repeat ?? s.repeat });
      else {
        // Split: the old series ends the day before, a new one carries the change forward.
        put("series", { ...s, repeat: { ...s.repeat, until: addDays(date, -1) }, skip: s.skip.filter((d) => d < date) });
        target = put("series", { ...s, ...fields, ...stamp(), from: date, repeat: repeat ?? s.repeat, skip: s.skip.filter((d) => d >= date) });
      }
      // Saved occurrences from here on follow the series (or drop out if the new rule skips their day).
      for (const blk of get().blocks) {
        if (blk.seriesId !== s.id || !blk.seriesDate || blk.seriesDate < date) continue;
        if (occursOn(target.repeat, target.from, blk.seriesDate)) put("blocks", { ...blk, ...fields, seriesId: target.id });
        else if (blk.done) put("blocks", { ...blk, seriesId: null, seriesDate: null });
        else drop("blocks", blk.id);
      }
      if (!occursOn(target.repeat, target.from, date)) return null;
      return isVirtual(id) ? virtualId(target.id, date) : id;
    },

    setBlockRepeat(id, repeat) {
      const b = findBlock(id, get().blocks, get().series);
      if (!b) return null;
      const s = seriesOf(b);
      if (!repeat) {
        if (!s || !b.seriesDate) return id;
        // Keep this occurrence as a one-off and end the series here.
        const plain = isVirtual(id)
          ? put("blocks", { ...b, ...stamp(), seriesId: null, seriesDate: null })
          : put("blocks", { ...b, seriesId: null, seriesDate: null });
        endSeriesFrom(s, b.seriesDate);
        return plain.id;
      }
      if (s) return get().updateSeriesFrom(id, { repeat });
      const created = put("series", {
        ...stamp(),
        from: b.date,
        start: b.start,
        end: b.end,
        title: b.title,
        activityId: b.activityId,
        color: b.color,
        notes: b.notes,
        goalId: b.goalId,
        repeat,
        skip: [],
      });
      put("blocks", { ...b, seriesId: created.id, seriesDate: b.date });
      return id;
    },

    copyDay(from, to) {
      const src = get().blocksBetween(from, from);
      // A repeating block that already happens on the target day isn't copied twice.
      const there = new Set(get().blocksBetween(to, to).map((b) => b.seriesId));
      let n = 0;
      for (const b of src) {
        if (b.seriesId && there.has(b.seriesId)) continue;
        put("blocks", { ...b, ...stamp(), date: to, done: false, seriesId: null, seriesDate: null });
        n++;
      }
      return n;
    },

    clearDay(date) {
      const day = get().blocksBetween(date, date);
      for (const b of day) get().removeBlock(b.id, "one");
      return day.length;
    },

    addMarker: (input) => put("markers", { ...stamp(), skip: [], ...input }),
    updateMarker: (id, patch) => patchRecord("markers", id, patch),
    removeMarker: (id) => drop("markers", id),
    clearMarkerOn(kind, date) {
      for (const m of get().markers) {
        if (m.kind !== kind) continue;
        if (!m.repeat && m.date === date) drop("markers", m.id);
        else if (m.repeat && occursOn(m.repeat, m.date, date) && !m.skip.includes(date)) put("markers", { ...m, skip: [...m.skip, date] });
      }
    },
    endMarkerFrom(id, date) {
      const m = get().markers.find((x) => x.id === id);
      if (!m) return;
      if (!m.repeat || date <= m.date) drop("markers", id);
      else put("markers", { ...m, repeat: { ...m.repeat, until: addDays(date, -1) }, skip: m.skip.filter((d) => d < date) });
    },

    addTemplate: ({ name, kind }) => put("templates", { ...stamp(), name: name.trim() || (kind === "week" ? "New week" : "New day"), kind, blocks: [] }),
    updateTemplate: (id, patch) => patchRecord("templates", id, patch),
    duplicateTemplate(id) {
      const t = get().templates.find((x) => x.id === id);
      if (!t) return null;
      return put("templates", { ...t, ...stamp(), name: `${t.name} (copy)`.slice(0, 60), blocks: t.blocks.map((b) => ({ ...b, id: uuid() })) });
    },
    removeTemplate: (id) => drop("templates", id),

    saveTemplate(name, date) {
      const blocks = get()
        .blocksBetween(date, date)
        .map(({ start, end, title, activityId, color, notes }) => ({ id: uuid(), day: 0, start, end, title, activityId, color, notes }));
      return put("templates", { ...stamp(), name: name.trim() || "Template", kind: "day", blocks });
    },

    saveWeekTemplate(name, date) {
      const days = weekDays(date, get().settings.weekStart);
      const blocks = get()
        .blocksBetween(days[0], days[6])
        .map(({ date: d, start, end, title, activityId, color, notes }) => ({ id: uuid(), day: weekdayOf(d), start, end, title, activityId, color, notes }));
      return put("templates", { ...stamp(), name: name.trim() || "My week", kind: "week", blocks });
    },

    applyTemplate(templateId, date) {
      const t = get().templates.find((x) => x.id === templateId);
      if (!t) return 0;
      const days = weekDays(date, get().settings.weekStart);
      for (const b of t.blocks) {
        const target = t.kind === "week" ? days.find((d) => weekdayOf(d) === b.day)! : date;
        const { start, end, title, activityId, color, notes } = b;
        get().addBlock({ date: target, start, end, title, activityId, color, notes, done: false, todoId: null, goalId: null });
      }
      return t.blocks.length;
    },

    addTemplateBlock(templateId, input) {
      const t = get().templates.find((x) => x.id === templateId);
      const block = { ...input, id: uuid() };
      if (t) put("templates", { ...t, blocks: [...t.blocks, block] });
      return block;
    },
    updateTemplateBlock(templateId, blockId, patch) {
      const t = get().templates.find((x) => x.id === templateId);
      if (t) put("templates", { ...t, blocks: t.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) });
    },
    removeTemplateBlock(templateId, blockId) {
      const t = get().templates.find((x) => x.id === templateId);
      if (t) put("templates", { ...t, blocks: t.blocks.filter((b) => b.id !== blockId) });
    },
    copyTemplateDay(templateId, fromDay, toDays) {
      const t = get().templates.find((x) => x.id === templateId);
      if (!t) return 0;
      const targets = toDays.filter((d) => d !== fromDay);
      const src = t.blocks.filter((b) => b.day === fromDay);
      const kept = t.blocks.filter((b) => !targets.includes(b.day));
      const copies = targets.flatMap((day) => src.map((b) => ({ ...b, id: uuid(), day })));
      put("templates", { ...t, blocks: [...kept, ...copies] });
      return copies.length;
    },

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
        repeat: null,
        repeatOf: null,
        order,
        ...input,
        title: input.title.trim(),
      });
    },
    updateTodo: (id, patch) => patchRecord("todos", id, patch),
    toggleTodo(id) {
      const t = get().todos.find((x) => x.id === id);
      if (!t) return;
      if (t.done) {
        // Un-ticking takes back the next copy it created (if that one isn't done yet).
        const spawned = get().todos.find((x) => x.repeatOf === t.id && !x.done);
        if (spawned) drop("todos", spawned.id);
        put("todos", { ...t, done: false, doneAt: null, repeat: spawned?.repeat ?? t.repeat });
        return;
      }
      put("todos", { ...t, done: true, doneAt: nowIso(), repeat: null });
      if (!t.repeat) return;
      const anchor = t.due ?? toDateKey(new Date());
      const today = toDateKey(new Date());
      const due = nextOccurrence(t.repeat, anchor, anchor > today ? anchor : today);
      if (!due) return;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, createdAt, updatedAt, deletedAt, ...rest } = t;
      put("todos", { ...rest, ...stamp(), due, done: false, doneAt: null, repeat: t.repeat, repeatOf: t.id });
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
      for (const sr of get().series) if (sr.goalId === id) put("series", { ...sr, goalId: null });
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
    settings: { theme: "auto", lightTheme: "paper", darkTheme: "dusk", dayStartHour: 6, dayEndHour: 24, clock: "24h", weekStart: 1, defaultBlockMinutes: 60, updatedAt: t },
    activities: [],
    blocks: [],
    series: [],
    markers: [],
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
