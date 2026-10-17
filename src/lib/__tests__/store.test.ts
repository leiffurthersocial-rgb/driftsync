import { beforeEach, describe, expect, it, vi } from "vitest";
import { useApp } from "@/store/app-store";
import { virtualId } from "@/lib/series";

const S = () => useApp.getState();
const gym = (from = "2026-10-19") => {
  const b = S().addBlock({ date: from, start: 1050, end: 1110, title: "Gym", activityId: null, color: null, notes: "", todoId: null, goalId: null, done: false });
  S().setBlockRepeat(b.id, { freq: "weekly", interval: 1, weekdays: [1, 3, 5], until: null });
  return { block: b, series: S().series[0] };
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-17T12:00:00"));
  await S().hydrate();
  await S().reset("all");
});

describe("repeating blocks", () => {
  it("turns a block into a series whose first occurrence is the saved block", () => {
    const { block, series } = gym();
    expect(series.from).toBe("2026-10-19");
    const week = S().blocksBetween("2026-10-19", "2026-10-25");
    expect(week.map((b) => b.date)).toEqual(["2026-10-19", "2026-10-21", "2026-10-23"]);
    expect(week[0].id).toBe(block.id);
    expect(week[1].id).toBe(virtualId(series.id, "2026-10-21"));
  });

  it("editing one occurrence saves just that one", () => {
    const { series } = gym();
    const id = S().updateBlock(virtualId(series.id, "2026-10-21"), { start: 1080, end: 1140 });
    expect(id).not.toMatch(/^rpt:/);
    const week = S().blocksBetween("2026-10-19", "2026-10-25");
    expect(week.find((b) => b.date === "2026-10-21")).toMatchObject({ id, start: 1080, seriesId: series.id });
    expect(week.find((b) => b.date === "2026-10-23")?.start).toBe(1050);
  });

  it("deletes one occurrence or this-and-upcoming", () => {
    const { series } = gym();
    S().removeBlock(virtualId(series.id, "2026-10-21"), "one");
    expect(S().blocksBetween("2026-10-19", "2026-10-25").map((b) => b.date)).toEqual(["2026-10-19", "2026-10-23"]);
    S().removeBlock(virtualId(series.id, "2026-10-23"), "upcoming");
    expect(S().blocksBetween("2026-10-19", "2026-11-30").map((b) => b.date)).toEqual(["2026-10-19"]);
  });

  it("splits a series for this-and-upcoming edits, moving saved occurrences along", () => {
    const { series } = gym();
    const done = S().updateBlock(virtualId(series.id, "2026-10-30"), { done: true });
    const id = S().updateSeriesFrom(virtualId(series.id, "2026-10-26"), { title: "Lift", start: 1020, end: 1080 });
    expect(S().series).toHaveLength(2);
    const all = S().blocksBetween("2026-10-19", "2026-11-01");
    expect(all.filter((b) => b.date < "2026-10-26").every((b) => b.title === "Gym")).toBe(true);
    expect(all.filter((b) => b.date >= "2026-10-26").every((b) => b.title === "Lift" && b.start === 1020)).toBe(true);
    expect(all.find((b) => b.id === done)).toMatchObject({ done: true, title: "Lift" });
    expect(id).toBe(virtualId(S().series[1].id, "2026-10-26"));
  });

  it("stopping repeat keeps this occurrence and ends the series", () => {
    const { series } = gym();
    const plain = S().setBlockRepeat(virtualId(series.id, "2026-10-23"), null)!;
    const all = S().blocksBetween("2026-10-19", "2026-11-30");
    expect(all.map((b) => b.date)).toEqual(["2026-10-19", "2026-10-21", "2026-10-23"]);
    expect(all[2]).toMatchObject({ id: plain, seriesId: null });
  });

  it("copy day skips occurrences that already repeat there; clear day skips them", () => {
    gym();
    S().addBlock({ date: "2026-10-19", start: 600, end: 660, title: "Call", activityId: null, color: null, notes: "", todoId: null, goalId: null, done: false });
    expect(S().copyDay("2026-10-19", "2026-10-21")).toBe(1);
    expect(S().clearDay("2026-10-21")).toBe(2);
    expect(S().blocksBetween("2026-10-21", "2026-10-21")).toHaveLength(0);
    expect(S().blocksBetween("2026-10-23", "2026-10-23")).toHaveLength(1);
  });
});

describe("repeating to-dos", () => {
  it("ticking creates the next one; un-ticking takes it back", () => {
    const t = S().addTodo({ title: "Water plants", due: "2026-10-17", repeat: { freq: "daily", interval: 2, weekdays: [], until: null } });
    S().toggleTodo(t.id);
    const next = S().todos.find((x) => x.repeatOf === t.id)!;
    expect(next).toMatchObject({ due: "2026-10-19", done: false, title: "Water plants" });
    expect(S().todos.find((x) => x.id === t.id)).toMatchObject({ done: true, repeat: null });
    S().toggleTodo(t.id);
    expect(S().todos).toHaveLength(1);
    expect(S().todos[0]).toMatchObject({ done: false, repeat: { freq: "daily", interval: 2 } });
  });

  it("an overdue repeating to-do jumps to the next date after today", () => {
    const t = S().addTodo({ title: "Stretch", due: "2026-10-10", repeat: { freq: "daily", interval: 1, weekdays: [], until: null } });
    S().toggleTodo(t.id);
    expect(S().todos.find((x) => x.repeatOf === t.id)?.due).toBe("2026-10-18");
  });
});

describe("templates", () => {
  it("applies week templates to the right weekdays and duplicates deeply", () => {
    const week = S().templates.find((t) => t.kind === "week")!;
    const n = S().applyTemplate(week.id, "2026-10-21"); // a Wednesday; weeks start Monday
    expect(n).toBe(week.blocks.length);
    const blocks = S().blocksBetween("2026-10-19", "2026-10-25");
    expect(blocks.filter((b) => b.title === "Long run").map((b) => b.date)).toEqual(["2026-10-24"]);
    expect(blocks.filter((b) => b.title === "Slow morning").map((b) => b.date)).toEqual(["2026-10-25"]);
    const copy = S().duplicateTemplate(week.id)!;
    expect(copy.name).toBe("My usual week (copy)");
    expect(copy.blocks[0].id).not.toBe(week.blocks[0].id);
    S().updateTemplateBlock(copy.id, copy.blocks[0].id, { title: "Changed" });
    expect(S().templates.find((t) => t.id === week.id)!.blocks[0].title).not.toBe("Changed");
  });

  it("copies one template day onto others and saves a week as a template", () => {
    const t = S().addTemplate({ name: "Blank", kind: "week" });
    S().addTemplateBlock(t.id, { day: 1, start: 540, end: 600, title: "Standup", activityId: null, color: null, notes: "" });
    expect(S().copyTemplateDay(t.id, 1, [1, 2, 3, 4, 5])).toBe(4);
    S().applyTemplate(t.id, "2026-10-19");
    const saved = S().saveWeekTemplate("This week", "2026-10-22");
    expect(saved.blocks.filter((b) => b.title === "Standup").map((b) => b.day).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("wake & bedtime lines", () => {
  it("clears a day and ends repeating lines", () => {
    const m = S().addMarker({ kind: "wake", time: 420, date: "2026-10-19", repeat: { freq: "daily", interval: 1, weekdays: [], until: null } });
    S().clearMarkerOn("wake", "2026-10-20");
    expect(S().markers[0].skip).toEqual(["2026-10-20"]);
    S().endMarkerFrom(m.id, "2026-10-25");
    expect(S().markers[0].repeat?.until).toBe("2026-10-24");
    S().endMarkerFrom(m.id, "2026-10-19");
    expect(S().markers).toHaveLength(0);
  });
});
