import { describe, expect, it } from "vitest";
import { resolveIntent } from "../character-intent";
import type { Activity, Area, Block } from "@/data/schema";

const t = "2026-01-01T00:00:00.000Z";
const meta = (id: string) => ({ id, createdAt: t, updatedAt: t, deletedAt: null });
const areas: Area[] = [
  { ...meta("gym"), type: "gym", name: "Gym", color: null, variant: 0, x: 1, y: 1 },
  { ...meta("track"), type: "track", name: "Track", color: null, variant: 0, x: -3, y: 1 },
];
const activities: Activity[] = [
  { ...meta("jog"), key: "jogging", name: "Jogging", color: "#eea54b", animation: "jog", areaType: "track", areaId: null, preset: true, order: 0 },
  { ...meta("rest"), key: "rest", name: "Rest", color: "#93a6bd", animation: "rest", areaType: null, areaId: null, preset: true, order: 1 },
];
const block = (start: number, end: number, activityId: string): Block => ({
  ...meta(`b${start}`),
  date: "2026-10-16",
  start,
  end,
  title: "",
  activityId,
  color: null,
  notes: "",
  todoId: null,
  goalId: null,
  done: false,
});
const now = new Date(2026, 9, 16, 10, 30);
const base = { activities, areas, today: "2026-10-16", minute: 630, now };

describe("resolveIntent", () => {
  it("follows the active block to its area", () => {
    const i = resolveIntent({ ...base, override: null, blocks: [block(600, 660, "jog")] });
    expect(i).toMatchObject({ source: "block", areaId: "track", animation: "jog", label: "Jogging", until: 660 });
  });
  it("uses the plaza for activities without an area", () => {
    const i = resolveIntent({ ...base, override: null, blocks: [block(600, 660, "rest")] });
    expect(i).toMatchObject({ areaId: null, animation: "rest" });
  });
  it("wanders when nothing is planned", () => {
    expect(resolveIntent({ ...base, override: null, blocks: [] }).source).toBe("none");
  });
  it("manual send-to wins over a block that already started", () => {
    const override = { areaId: "gym", activityId: null, since: new Date(2026, 9, 16, 10, 15).toISOString() };
    const i = resolveIntent({ ...base, override, blocks: [block(600, 660, "jog")] });
    expect(i).toMatchObject({ source: "manual", areaId: "gym", animation: "workout" });
  });
  it("a block starting after the send-to takes over again", () => {
    const override = { areaId: "gym", activityId: null, since: new Date(2026, 9, 16, 9, 0).toISOString() };
    const i = resolveIntent({ ...base, override, blocks: [block(600, 660, "jog")] });
    expect(i.source).toBe("block");
  });
  it("ignores overrides pointing at removed areas", () => {
    const override = { areaId: "gone", activityId: null, since: t };
    expect(resolveIntent({ ...base, override, blocks: [] }).source).toBe("none");
  });
});
