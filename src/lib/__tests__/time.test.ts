import { describe, expect, it } from "vitest";
import {
  activeAt,
  addDays,
  findFreeSlot,
  formatDuration,
  formatMinutes,
  layoutDay,
  moveRange,
  nextAfter,
  normalizeRange,
  resizeRange,
  snap,
  startOfWeek,
} from "../time";

describe("snapping", () => {
  it("snaps to 15 minutes", () => {
    expect(snap(7)).toBe(0);
    expect(snap(8)).toBe(15);
    expect(snap(52)).toBe(45);
    expect(snap(53)).toBe(60);
  });

  it("normalizes dragged ranges", () => {
    expect(normalizeRange(130, 62)).toEqual({ start: 60, end: 135 });
    expect(normalizeRange(60, 61)).toEqual({ start: 60, end: 75 });
    expect(normalizeRange(1430, 1440)).toEqual({ start: 1425, end: 1440 });
  });

  it("moves without changing length and clamps", () => {
    expect(moveRange({ start: 60, end: 120 }, 23)).toEqual({ start: 90, end: 150 });
    expect(moveRange({ start: 60, end: 120 }, -500)).toEqual({ start: 0, end: 60 });
    expect(moveRange({ start: 1300, end: 1400 }, 200)).toEqual({ start: 1340, end: 1440 });
  });

  it("resizes edges with a minimum length", () => {
    expect(resizeRange({ start: 60, end: 120 }, "end", 200)).toEqual({ start: 60, end: 195 });
    expect(resizeRange({ start: 60, end: 120 }, "end", 10)).toEqual({ start: 60, end: 75 });
    expect(resizeRange({ start: 60, end: 120 }, "start", 200)).toEqual({ start: 105, end: 120 });
  });
});

describe("overlap layout", () => {
  it("puts non-overlapping blocks in a single column", () => {
    const m = layoutDay([
      { id: "a", start: 0, end: 60 },
      { id: "b", start: 60, end: 120 },
    ]);
    expect(m.get("a")).toEqual({ col: 0, cols: 1, overlapping: false });
    expect(m.get("b")).toEqual({ col: 0, cols: 1, overlapping: false });
  });

  it("splits overlapping clusters into columns", () => {
    const m = layoutDay([
      { id: "a", start: 0, end: 120 },
      { id: "b", start: 30, end: 90 },
      { id: "c", start: 100, end: 150 },
      { id: "d", start: 200, end: 230 },
    ]);
    expect(m.get("a")).toMatchObject({ col: 0, cols: 2, overlapping: true });
    expect(m.get("b")).toMatchObject({ col: 1, cols: 2 });
    expect(m.get("c")).toMatchObject({ col: 1, cols: 2 });
    expect(m.get("d")).toMatchObject({ col: 0, cols: 1, overlapping: false });
  });
});

describe("queries", () => {
  const items = [
    { start: 60, end: 120 },
    { start: 90, end: 180 },
    { start: 300, end: 360 },
  ];
  it("finds active and next blocks", () => {
    expect(activeAt(items, 100)).toBe(items[1]);
    expect(activeAt(items, 200)).toBeNull();
    expect(nextAfter(items, 200)).toBe(items[2]);
  });
  it("finds free slots", () => {
    expect(findFreeSlot(items, 0, 60)).toBe(0);
    expect(findFreeSlot(items, 50, 60)).toBe(180);
    expect(findFreeSlot(items, 180, 150)).toBe(360);
    expect(findFreeSlot(items, 1400, 60)).toBeNull();
  });
});

describe("dates and formatting", () => {
  it("adds days across months", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("finds the start of week", () => {
    // 2026-10-16 is a Friday
    expect(startOfWeek("2026-10-16", 1)).toBe("2026-10-12");
    expect(startOfWeek("2026-10-16", 0)).toBe("2026-10-11");
    expect(startOfWeek("2026-10-12", 1)).toBe("2026-10-12");
  });
  it("formats times", () => {
    expect(formatMinutes(570, "24h")).toBe("09:30");
    expect(formatMinutes(570, "12h")).toBe("9:30am");
    expect(formatMinutes(0, "12h")).toBe("12:00am");
    expect(formatMinutes(780, "12h")).toBe("1:00pm");
    expect(formatMinutes(1440, "24h")).toBe("24:00");
    expect(formatDuration(75)).toBe("1h 15m");
    expect(formatDuration(45)).toBe("45m");
  });
});
