import { describe, expect, it } from "vitest";
import type { Block, Marker, Repeat, Series } from "@/data/schema";
import { describeRepeat, matchPreset, nextOccurrence, occurrencesBetween, occursOn, repeatPresets } from "../recurrence";
import { expandBlocks, findBlock, markersFor, parseVirtualId, virtualId } from "../series";

const r = (freq: Repeat["freq"], weekdays: number[] = [], interval = 1, until: string | null = null): Repeat => ({ freq, interval, weekdays, until });

describe("recurrence rules", () => {
  it("daily with an interval, never before the anchor, never after until", () => {
    const rule = r("daily", [], 2, "2026-10-25");
    expect(occurrencesBetween(rule, "2026-10-17", "2026-10-10", "2026-10-31")).toEqual(["2026-10-17", "2026-10-19", "2026-10-21", "2026-10-23", "2026-10-25"]);
  });

  it("weekdays and weekly phase", () => {
    // 2026-10-17 is a Saturday.
    expect(occurrencesBetween(r("weekly", [1, 2, 3, 4, 5]), "2026-10-17", "2026-10-17", "2026-10-24")).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]);
    const biweekly = r("weekly", [1, 4], 2);
    expect(occurrencesBetween(biweekly, "2026-10-19", "2026-10-19", "2026-11-08")).toEqual(["2026-10-19", "2026-10-22", "2026-11-02", "2026-11-05"]);
    // Empty weekdays = the anchor's weekday.
    expect(occursOn(r("weekly"), "2026-10-17", "2026-10-24")).toBe(true);
    expect(occursOn(r("weekly"), "2026-10-17", "2026-10-25")).toBe(false);
  });

  it("monthly skips months without the day; yearly handles Feb 29", () => {
    expect(occurrencesBetween(r("monthly"), "2026-01-31", "2026-01-01", "2026-05-31")).toEqual(["2026-01-31", "2026-03-31", "2026-05-31"]);
    expect(nextOccurrence(r("yearly"), "2028-02-29", "2028-02-29")).toBe("2032-02-29");
  });

  it("finds the next occurrence and stops at until", () => {
    expect(nextOccurrence(r("weekly", [1, 3, 5]), "2026-10-19", "2026-10-19")).toBe("2026-10-21");
    expect(nextOccurrence(r("daily"), "2026-10-19", "2026-10-01")).toBe("2026-10-19");
    expect(nextOccurrence(r("daily", [], 1, "2026-10-20"), "2026-10-19", "2026-10-20")).toBeNull();
  });

  it("describes rules in plain words and matches presets", () => {
    expect(describeRepeat(r("weekly", [1, 2, 3, 4, 5]), "2026-10-19")).toBe("Every weekday");
    expect(describeRepeat(r("weekly", [0, 6]), "2026-10-17")).toBe("Every weekend");
    expect(describeRepeat(r("daily", [], 3), "2026-10-17")).toBe("Every 3 days");
    expect(describeRepeat(r("monthly"), "2026-10-17")).toBe("Monthly on the 17th");
    expect(describeRepeat(r("monthly"), "2026-10-22")).toBe("Monthly on the 22nd");
    expect(describeRepeat(r("daily", [], 1, "2026-12-01"), "2026-10-17")).toMatch(/^Every day, until /);
    const presets = repeatPresets("2026-10-17");
    expect(presets.map((p) => p.id)).toEqual(["daily", "weekdays", "weekends", "weekly", "biweekly", "monthly", "yearly"]);
    expect(matchPreset(r("weekly", [6]), "2026-10-17")).toBe("weekly");
    expect(matchPreset(r("weekly", [], 2), "2026-10-17")).toBe("biweekly");
    expect(matchPreset(r("weekly", [1, 3]), "2026-10-17")).toBeNull();
  });
});

const t = "2026-10-01T00:00:00.000Z";
const series = (o: Partial<Series> = {}): Series => ({
  id: "s1", createdAt: t, updatedAt: t, deletedAt: null, from: "2026-10-19", start: 1050, end: 1110, title: "Gym",
  activityId: null, color: null, notes: "", goalId: null, repeat: r("weekly", [1, 3, 5]), skip: [], ...o,
});
const block = (o: Partial<Block>): Block => ({
  id: "b", createdAt: t, updatedAt: t, deletedAt: null, date: "2026-10-19", start: 600, end: 660, title: "x", activityId: null,
  color: null, notes: "", todoId: null, goalId: null, done: false, seriesId: null, seriesDate: null, ...o,
});

describe("series expansion", () => {
  it("generates occurrences, honouring skips and saved occurrences", () => {
    const s = series({ skip: ["2026-10-21"] });
    const saved = block({ id: "real", date: "2026-10-23", start: 1080, end: 1140, done: true, seriesId: "s1", seriesDate: "2026-10-23" });
    const out = expandBlocks([saved, block({ id: "other", date: "2026-10-30" })], [s], "2026-10-19", "2026-10-25");
    expect(out.map((b) => b.id)).toEqual([virtualId("s1", "2026-10-19"), "real"]);
    expect(out[0]).toMatchObject({ title: "Gym", seriesId: "s1", seriesDate: "2026-10-19", done: false });
  });

  it("round-trips virtual ids and finds blocks", () => {
    expect(parseVirtualId(virtualId("abc-1", "2026-10-19"))).toEqual({ seriesId: "abc-1", date: "2026-10-19" });
    expect(parseVirtualId("plain")).toBeNull();
    expect(findBlock(virtualId("s1", "2026-10-21"), [], [series()])?.start).toBe(1050);
    expect(findBlock(virtualId("s1", "2026-10-20"), [], [series()])).toBeNull(); // a Tuesday
  });
});

describe("wake and bedtime lines", () => {
  const m = (o: Partial<Marker>): Marker => ({ id: "m", createdAt: t, updatedAt: t, deletedAt: null, kind: "wake", time: 420, date: "2026-10-01", repeat: null, skip: [], ...o });
  const markers = [
    m({ id: "daily", repeat: r("daily"), time: 420 }),
    m({ id: "weekend", repeat: r("weekly", [0, 6]), time: 540, createdAt: "2026-10-02T00:00:00.000Z" }),
    m({ id: "once", date: "2026-10-24", time: 600, createdAt: "2026-09-01T00:00:00.000Z" }),
    m({ id: "bed", kind: "sleep", repeat: r("daily"), time: 1380, skip: ["2026-10-20"] }),
  ];
  it("resolves one-off over repeating, newer repeating over older", () => {
    expect(markersFor(markers, "2026-10-19")).toEqual([
      { kind: "wake", time: 420, markerId: "daily", repeating: true },
      { kind: "sleep", time: 1380, markerId: "bed", repeating: true },
    ]);
    expect(markersFor(markers, "2026-10-18")[0].markerId).toBe("weekend");
    expect(markersFor(markers, "2026-10-24")[0]).toMatchObject({ markerId: "once", time: 600, repeating: false });
    expect(markersFor(markers, "2026-10-20").map((x) => x.kind)).toEqual(["wake"]);
    expect(markersFor(markers, "2026-09-30")).toEqual([]);
  });
});
