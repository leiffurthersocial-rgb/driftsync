import { describe, expect, it } from "vitest";
import { migrate } from "@/data/migrations";
import { applyReset } from "@/data/reset";
import { LocalStorageRepository, STORAGE_KEY, type KeyValueStore } from "@/data/local-storage-repository";
import { CURRENT_VERSION } from "@/data/schema";

describe("migrate", () => {
  it("returns defaults for missing or garbage input", () => {
    for (const input of [undefined, null, "nope", 42, []]) {
      const d = migrate(input);
      expect(d.version).toBe(CURRENT_VERSION);
      expect(d.activities.length).toBeGreaterThan(0);
      expect(d.profile.onboarded).toBe(false);
    }
  });

  it("upgrades unversioned v0 data and fills record metadata", () => {
    const d = migrate({
      profile: { characterName: "Mo", islandName: "Cloudy", onboarded: true },
      todos: [{ title: "Water plants", done: false }],
    });
    expect(d.version).toBe(CURRENT_VERSION);
    expect(d.profile.characterName).toBe("Mo");
    expect(d.island.name).toBe("Cloudy");
    expect(d.todos).toHaveLength(1);
    expect(d.todos[0].id).toBeTruthy();
    expect(d.todos[0].createdAt).toBeTruthy();
  });

  it("drops only invalid records and repairs bad fields", () => {
    const t = new Date().toISOString();
    const ok = { id: "b1", createdAt: t, updatedAt: t, date: "2026-10-16", start: 60, end: 120, title: "x" };
    const d = migrate({
      version: 1,
      blocks: [ok, { ...ok, id: "b2", end: 30 }, { nonsense: true }],
      settings: { clock: "13h", dayStartHour: 7 },
    });
    expect(d.blocks.map((b) => b.id)).toEqual(["b1"]);
    expect(d.blocks[0].done).toBe(false);
    expect(d.settings.clock).toBe("24h");
    expect(d.settings.dayStartHour).toBe(7);
  });

  it("is idempotent on current data", () => {
    const once = migrate(undefined);
    const twice = migrate(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });
});

describe("resets", () => {
  it("resets scopes independently", () => {
    const d = migrate(undefined);
    d.profile.characterName = "Zed";
    d.profile.onboarded = true;
    d.todos.push({ ...d.activities[0], title: "t", listId: null, due: null, priority: 0, done: false, doneAt: null, order: 0, goalId: null, notes: "" } as never);
    const tasks = applyReset(d, "tasks");
    expect(tasks.todos).toHaveLength(0);
    expect(tasks.profile.characterName).toBe("Zed");
    const ch = applyReset(d, "character");
    expect(ch.profile.characterName).toBe("Pip");
    expect(ch.profile.onboarded).toBe(true);
    expect(applyReset(d, "onboarding").profile.onboarded).toBe(false);
    expect(applyReset(d, "all").profile.onboarded).toBe(false);
  });

  it("planner reset keeps templates pointing at existing activities", () => {
    const d = migrate(undefined);
    const r = applyReset(d, "planner");
    const ids = new Set(d.activities.map((a) => a.id));
    for (const b of r.templates[0].blocks) expect(b.activityId === null || ids.has(b.activityId)).toBe(true);
  });
});

describe("LocalStorageRepository", () => {
  const mem = (): KeyValueStore & { map: Map<string, string> } => {
    const map = new Map<string, string>();
    return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
  };

  it("survives corrupted storage", async () => {
    const s = mem();
    s.setItem(STORAGE_KEY, "{not json");
    const repo = new LocalStorageRepository(s);
    const d = await repo.load();
    expect(d.version).toBe(CURRENT_VERSION);
  });

  it("soft-deletes and persists", async () => {
    const s = mem();
    const repo = new LocalStorageRepository(s);
    const t = new Date().toISOString();
    await repo.lists.put({ id: "l1", createdAt: t, updatedAt: t, deletedAt: null, name: "Home", order: 0 });
    expect(await repo.lists.list()).toHaveLength(1);
    await repo.lists.remove("l1");
    expect(await repo.lists.list()).toHaveLength(0);
    await Promise.resolve();
    const stored = JSON.parse(s.map.get(STORAGE_KEY)!);
    expect(stored.lists[0].deletedAt).toBeTruthy();
  });
});
