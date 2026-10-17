import { describe, expect, it, vi } from "vitest";
import { LocalStorageRepository, type KeyValueStore } from "@/data/local-storage-repository";
import type { Profile, Settings } from "@/data/schema";
import { EMPTY_META, syncOnce, type Remote, type RemoteRow, type RemoteSnapshot, type SyncMeta } from "../engine";

/** In-memory stand-in for Supabase that follows the same rules as supabase/schema.sql. */
class FakeRemote implements Remote {
  rows = new Map<string, RemoteRow & { synced_at: string }>();
  appState: { profile: Record<string, unknown>; settings: Record<string, unknown>; version: number } | null = null;
  private clock = Date.parse("2026-10-17T12:00:00Z");
  pushes = 0;
  private tick() {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }
  async pull(since: string | null): Promise<RemoteSnapshot> {
    const rows = [...this.rows.values()].filter((r) => !since || r.synced_at > since).sort((a, b) => a.synced_at.localeCompare(b.synced_at));
    return { rows: structuredClone(rows), appState: structuredClone(this.appState), cursor: rows.length ? rows[rows.length - 1].synced_at : since };
  }
  async push(rows: RemoteRow[], profile: Profile | null, settings: Settings | null, version: number) {
    this.pushes++;
    for (const r of rows) {
      const k = `${r.collection}:${r.id}`;
      const cur = this.rows.get(k);
      if (cur && Date.parse(cur.updated_at) >= Date.parse(r.updated_at)) continue; // older or same copy: ignored
      this.rows.set(k, { ...structuredClone(r), synced_at: this.tick() });
    }
    if (profile || settings) {
      const a = (this.appState ??= { profile: {}, settings: {}, version });
      if (profile && String(profile.updatedAt) > String(a.profile.updatedAt ?? "")) a.profile = structuredClone(profile);
      if (settings && String(settings.updatedAt) > String(a.settings.updatedAt ?? "")) a.settings = structuredClone(settings);
    }
  }
  live(collection: string) {
    return [...this.rows.values()].filter((r) => r.collection === collection && !r.deleted_at);
  }
}

const memory = (): KeyValueStore => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

/** A device: its own local repository and sync bookkeeping. */
class Device {
  repo = new LocalStorageRepository(memory());
  meta: SyncMeta = EMPTY_META;
  choice: "merge" | "account" = "merge";
  asked = 0;
  constructor(private remote: FakeRemote, private user = "u1") {}
  async sync() {
    const r = await syncOnce({
      local: this.repo,
      remote: this.remote,
      meta: this.meta,
      userId: this.user,
      chooseFirstSync: async () => {
        this.asked++;
        return this.choice;
      },
    });
    this.meta = r.meta;
    return r;
  }
  data() {
    return this.repo.load();
  }
  async addTodo(title: string) {
    const t = new Date().toISOString();
    return this.repo.todos.put({ id: crypto.randomUUID(), createdAt: t, updatedAt: t, deletedAt: null, title, listId: null, due: null, priority: 0, done: false, doneAt: null, order: 0, goalId: null, notes: "", repeat: null, repeatOf: null });
  }
}

const later = () => vi.advanceTimersByTime(1000);

describe("sync engine", () => {
  it("uploads everything when the account is empty, then a fresh device downloads it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const remote = new FakeRemote();
    const a = new Device(remote);
    await a.addTodo("Water plants");
    await a.repo.profile.save({ ...(await a.data()).profile, name: "Leif", onboarded: true });
    expect((await a.sync()).outcome).toBe("upload-all");
    expect(remote.live("todos").map((r) => (r.data as { title: string }).title)).toEqual(["Water plants"]);
    expect(remote.appState?.profile).toMatchObject({ name: "Leif", onboarded: true });

    const b = new Device(remote);
    const r = await b.sync();
    expect(r.outcome).toBe("download-all");
    expect(b.asked).toBe(0);
    const d = await b.data();
    expect(d.todos.map((t) => t.title)).toEqual(["Water plants"]);
    expect(d.profile).toMatchObject({ name: "Leif", onboarded: true });
    // The fresh device's default activities were replaced by the account's (no duplicates).
    expect(d.activities.map((x) => x.id).sort()).toEqual((await a.data()).activities.map((x) => x.id).sort());
  });

  it("syncs edits and deletes both ways, newest edit winning", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const remote = new FakeRemote();
    const a = new Device(remote);
    const b = new Device(remote);
    const todo = await a.addTodo("Draft");
    await a.sync();
    await b.sync();

    later();
    await b.repo.todos.put({ ...todo, title: "Edited on B" });
    await b.sync();
    later();
    await a.sync();
    expect((await a.data()).todos[0].title).toBe("Edited on B");

    // Conflicting edits: A edits later than B, so A wins on both devices.
    later();
    await b.repo.todos.put({ ...todo, title: "B's version" });
    later();
    await a.repo.todos.put({ ...todo, title: "A's version" });
    await b.sync();
    await a.sync();
    await b.sync();
    expect((await a.data()).todos[0].title).toBe("A's version");
    expect((await b.data()).todos[0].title).toBe("A's version");

    later();
    await a.repo.todos.remove(todo.id);
    await a.sync();
    await b.sync();
    expect((await b.data()).todos).toHaveLength(0);
  });

  it("an offline device can't overwrite newer edits with stale ones", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const remote = new FakeRemote();
    const a = new Device(remote);
    const b = new Device(remote);
    const todo = await a.addTodo("v1");
    await a.sync();
    await b.sync();
    later();
    await b.repo.todos.put({ ...todo, title: "stale (edited offline)" });
    later();
    await a.repo.todos.put({ ...todo, title: "fresh" });
    await a.sync();
    await b.sync(); // B comes back online
    expect((remote.live("todos")[0].data as { title: string }).title).toBe("fresh");
    expect((await b.data()).todos[0].title).toBe("fresh");
  });

  it("asks when both sides have data; merge keeps both and de-duplicates preset activities", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const remote = new FakeRemote();
    const a = new Device(remote);
    await a.addTodo("From A");
    await a.sync();
    later();
    const b = new Device(remote);
    await b.addTodo("From B");
    const bWork = (await b.data()).activities.find((x) => x.key === "work")!;
    const bBlock = { id: "blk", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null, date: "2026-10-19", start: 540, end: 600, title: "Work", activityId: bWork.id, color: null, notes: "", todoId: null, goalId: null, done: false, seriesId: null, seriesDate: null };
    await b.repo.blocks.put(bBlock);
    const r = await b.sync();
    expect(r.outcome).toBe("merge");
    expect(b.asked).toBe(1);
    const d = await b.data();
    expect(d.todos.map((t) => t.title).sort()).toEqual(["From A", "From B"]);
    const works = d.activities.filter((x) => x.key === "work");
    expect(works).toHaveLength(1);
    const aWork = (await a.data()).activities.find((x) => x.key === "work")!;
    expect(works[0].id).toBe(aWork.id);
    expect(d.blocks[0].activityId).toBe(aWork.id);
    await a.sync();
    const ad = await a.data();
    expect(ad.todos.map((t) => t.title).sort()).toEqual(["From A", "From B"]);
    expect(ad.activities.filter((x) => x.key === "work")).toHaveLength(1);
  });

  it("'use account data' replaces this device without uploading it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const remote = new FakeRemote();
    const a = new Device(remote);
    await a.addTodo("Account todo");
    await a.sync();
    const b = new Device(remote);
    b.choice = "account";
    await b.addTodo("Local scratch");
    expect((await b.sync()).outcome).toBe("account");
    expect((await b.data()).todos.map((t) => t.title)).toEqual(["Account todo"]);
    expect(remote.live("todos")).toHaveLength(1);
  });

  it("resets and imports reach other devices as deletions", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const remote = new FakeRemote();
    const a = new Device(remote);
    const b = new Device(remote);
    await a.addTodo("Gone soon");
    await a.sync();
    await b.sync();
    later();
    await a.repo.reset("tasks");
    await a.sync();
    await b.sync();
    expect((await b.data()).todos).toHaveLength(0);
  });

  it("does nothing when there is nothing to send", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const remote = new FakeRemote();
    const a = new Device(remote);
    await a.data();
    later(); // defaults were created a moment before the first sync, as in the app
    await a.sync();
    const before = remote.pushes;
    later();
    const r = await a.sync();
    expect(r.pushed).toBe(0);
    expect(remote.pushes).toBe(before);
  });

  it("doesn't send downloaded changes straight back", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const remote = new FakeRemote();
    const a = new Device(remote);
    const b = new Device(remote);
    await a.addTodo("x");
    later();
    await a.sync();
    later();
    await b.sync();
    later();
    await a.addTodo("y");
    later();
    await a.sync();
    later();
    const r = await b.sync();
    expect(r.changedLocal).toBe(true);
    expect(r.pushed).toBe(0);
  });

  it("signing in to a different account counts as a first sync", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const remote = new FakeRemote();
    const a = new Device(remote, "u1");
    await a.addTodo("Mine");
    await a.sync();
    const other = new FakeRemote();
    const a2 = Object.assign(new Device(other, "u2"), { repo: a.repo, meta: a.meta });
    expect((await a2.sync()).outcome).toBe("upload-all");
  });
});
