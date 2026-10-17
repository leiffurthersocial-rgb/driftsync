import { describe, expect, it } from "vitest";
import { goalProgress, periodRange, reorderSubset } from "../goals";
import type { Block, Goal, Todo } from "@/data/schema";

const t = "2026-01-01T00:00:00.000Z";
const meta = (id: string) => ({ id, createdAt: t, updatedAt: t, deletedAt: null });
const goal = (patch: Partial<Goal>): Goal => ({
  ...meta("g1"),
  title: "Goal",
  deadline: null,
  type: "milestones",
  milestones: [],
  frequency: null,
  color: "#6e5ee6",
  archived: false,
  order: 0,
  ...patch,
});
const todo = (id: string, done: boolean, goalId: string | null = "g1"): Todo => ({
  ...meta(id),
  title: id,
  listId: null,
  due: null,
  priority: 0,
  done,
  doneAt: null,
  order: 0,
  goalId,
  notes: "",
  repeat: null,
  repeatOf: null,
});
const block = (date: string, done: boolean, activityId = "jog"): Block => ({
  ...meta(`${date}-${done}-${activityId}`),
  date,
  start: 420,
  end: 480,
  title: "",
  activityId,
  color: null,
  notes: "",
  todoId: null,
  goalId: null,
  done,
  seriesId: null,
  seriesDate: null,
});
const ctx = { todos: [] as Todo[], blocks: [] as Block[], today: "2026-10-16", weekStart: 1 as const };

describe("goalProgress", () => {
  it("counts milestones", () => {
    const p = goalProgress(
      goal({ milestones: [{ id: "a", title: "a", done: true }, { id: "b", title: "b", done: false }] }),
      ctx,
    );
    expect(p).toMatchObject({ done: 1, total: 2, ratio: 0.5 });
  });
  it("handles empty goals without dividing by zero", () => {
    expect(goalProgress(goal({}), ctx).ratio).toBe(0);
    expect(goalProgress(goal({ type: "frequency" }), ctx).ratio).toBe(0);
  });
  it("counts linked to-dos only", () => {
    const todos = [todo("a", true), todo("b", false), todo("c", true, null)];
    expect(goalProgress(goal({ type: "todos" }), { ...ctx, todos })).toMatchObject({ done: 1, total: 2 });
  });
  it("counts done blocks of the activity in the current week", () => {
    const blocks = [
      block("2026-10-12", true), // Monday, this week
      block("2026-10-15", true),
      block("2026-10-16", false), // not done
      block("2026-10-11", true), // last week (Sunday)
      block("2026-10-14", true, "read"), // other activity
    ];
    const g = goal({ type: "frequency", frequency: { activityId: "jog", count: 3, period: "week" } });
    const p = goalProgress(g, { ...ctx, blocks });
    expect(p).toMatchObject({ done: 2, total: 3, label: "2 of 3 this week" });
    // Sunday-start weeks include the 11th.
    expect(goalProgress(g, { ...ctx, blocks, weekStart: 0 }).done).toBe(3);
  });
  it("caps the ratio at 1", () => {
    const blocks = [block("2026-10-12", true), block("2026-10-13", true)];
    const g = goal({ type: "frequency", frequency: { activityId: "jog", count: 1, period: "week" } });
    expect(goalProgress(g, { ...ctx, blocks }).ratio).toBe(1);
  });
});

describe("periodRange", () => {
  it("computes month bounds", () => {
    expect(periodRange("2026-02-10", "month", 1)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(periodRange("2026-12-31", "month", 1)).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});

describe("reorderSubset", () => {
  it("reuses the subset's slots and leaves others alone", () => {
    const items = [
      { id: "a", order: 1 },
      { id: "x", order: 2 },
      { id: "b", order: 3 },
      { id: "c", order: 5 },
    ];
    const m = reorderSubset(items, ["c", "a", "b"]);
    expect([...m.entries()]).toEqual([
      ["c", 1],
      ["a", 3],
      ["b", 5],
    ]);
  });
});
