import { describe, expect, it } from "vitest";
import { addMonths, formatWeekRange, greeting, monthGrid, sameMonth, weekDays, weekdayLabels } from "../calendar";
import { fromDateKey } from "../time";

describe("calendar grids", () => {
  it("builds a month grid of whole weeks starting on the configured weekday", () => {
    const mon = monthGrid("2026-10-17", 1);
    expect(mon).toHaveLength(35);
    expect(mon[34]).toBe("2026-11-01");
    expect(mon[0]).toBe("2026-09-28"); // Monday before Oct 1 (a Thursday)
    expect(fromDateKey(mon[0]).getDay()).toBe(1);
    expect(mon).toContain("2026-10-01");
    expect(mon).toContain("2026-10-31");
    const sun = monthGrid("2026-10-17", 0);
    expect(sun[0]).toBe("2026-09-27");
    expect(fromDateKey(sun[0]).getDay()).toBe(0);
    expect(monthGrid("2026-02-10", 0)).toHaveLength(28); // Feb 2026 starts on a Sunday
    expect(monthGrid("2026-08-10", 0)).toHaveLength(42); // Aug 2026 spans six weeks
  });

  it("returns the 7 days of a week", () => {
    expect(weekDays("2026-10-17", 1)).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
    expect(weekDays("2026-10-18", 0)[0]).toBe("2026-10-18");
  });

  it("adds months, clamping to the month's length", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(sameMonth("2026-10-01", "2026-10-31")).toBe(true);
    expect(sameMonth("2026-10-31", "2026-11-01")).toBe(false);
  });

  it("labels weekdays in display order", () => {
    const labels = weekdayLabels(1);
    expect(labels).toHaveLength(7);
    expect(labels[0]).toBe(new Date(2026, 9, 12).toLocaleDateString(undefined, { weekday: "short" }));
    expect(weekdayLabels(0)[0]).toBe(new Date(2026, 9, 11).toLocaleDateString(undefined, { weekday: "short" }));
  });

  it("formats week ranges across months", () => {
    expect(formatWeekRange(weekDays("2026-10-01", 1))).toMatch(/2026$/);
    expect(formatWeekRange(weekDays("2026-10-14", 1))).toMatch(/12 – 18, 2026$/);
  });

  it("greets by time of day", () => {
    expect(greeting(8)).toBe("Good morning");
    expect(greeting(14)).toBe("Good afternoon");
    expect(greeting(20)).toBe("Good evening");
    expect(greeting(2)).toBe("Good night");
  });
});
