import { describe, expect, it } from "vitest";
import { areaVitality } from "../feedback";
import type { Activity, Area, Block } from "@/data/schema";

const old = "2026-01-01T00:00:00.000Z";
const meta = (id: string) => ({ id, createdAt: old, updatedAt: old, deletedAt: null });
const areas: Area[] = [
  { ...meta("gym"), type: "gym", name: "Gym", color: null, variant: 0, x: 1, y: 1 },
  { ...meta("lib"), type: "library", name: "Library", color: null, variant: 0, x: -3, y: 1 },
];
const activities: Activity[] = [
  { ...meta("workout"), key: "workout", name: "Working out", color: "#e7795f", animation: "workout", areaType: "gym", areaId: null, preset: true, order: 0 },
];
const block = (date: string, done: boolean, start = 600, end = 660): Block => ({
  ...meta(`b-${date}-${start}`),
  date,
  start,
  end,
  title: "",
  activityId: "workout",
  color: null,
  notes: "",
  todoId: null,
  goalId: null,
  done,
});

describe("areaVitality", () => {
  const today = "2026-10-16";
  it("marks recently used areas as lived in and idle old areas as dusty", () => {
    const v = areaVitality(areas, activities, [block("2026-10-15", true), block("2026-10-14", true)], today, 720);
    expect(v.gym).toBe("lived");
    expect(v.lib).toBe("dusty");
  });
  it("lets old usage fade back to neutral", () => {
    const v = areaVitality(areas, activities, [block("2026-10-05", true)], today, 720);
    expect(v.gym).toBe("neutral");
  });
  it("ignores future blocks", () => {
    const v = areaVitality(areas, activities, [block(today, false, 900, 960)], today, 720);
    expect(v.gym).toBe("dusty");
  });
  it("never shows brand-new areas as dusty", () => {
    const fresh = [{ ...areas[1], createdAt: new Date().toISOString() }];
    expect(areaVitality(fresh, activities, [], today, 720).lib).toBe("neutral");
  });
});
