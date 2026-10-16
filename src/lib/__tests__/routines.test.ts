import { describe, expect, it } from "vitest";
import { ANIMATIONS } from "@/island/sprites/character";
import { DESIGNS } from "@/island/sprites/designs";
import { ROUTINES, isAvailable, routinesFor, selectRoutine } from "@/island/character/routines";
import { ANIMATIONS as KINDS } from "@/data/schema";

const calisthenics = DESIGNS.gym[1];
const indoor = DESIGNS.gym[0];
const oval = DESIGNS.track[0];

describe("routines", () => {
  it("every activity kind has at least one routine and every routine has an animation", () => {
    for (const k of KINDS) expect(routinesFor(k).length, k).toBeGreaterThan(0);
    for (const r of ROUTINES) expect(ANIMATIONS[r.anim], r.id).toBeDefined();
    expect(new Set(ROUTINES.map((r) => r.id)).size).toBe(ROUTINES.length);
  });

  it("offers several ways to do the core activities", () => {
    for (const k of ["study", "workout", "jog", "photo", "read"] as const) expect(routinesFor(k).length, k).toBeGreaterThanOrEqual(2);
  });

  it("only offers spot routines where the design has that spot", () => {
    const pull = ROUTINES.find((r) => r.id === "workout-pullups")!;
    expect(isAvailable(pull, calisthenics, false)).toBe(true);
    expect(isAvailable(pull, indoor, false)).toBe(false);
    expect(isAvailable(ROUTINES.find((r) => r.id === "jog-laps")!, oval, false)).toBe(true);
    expect(isAvailable(ROUTINES.find((r) => r.id === "jog-laps")!, null, false)).toBe(false);
    expect(isAvailable(ROUTINES.find((r) => r.id === "rest-stars")!, null, false)).toBe(false);
  });

  it("honours a pinned style and falls back when unavailable", () => {
    const base = { activity: "jog" as const, seed: "b1", minute: 600, night: false };
    expect(selectRoutine({ ...base, design: oval, style: "jog-island" }).id).toBe("jog-island");
    expect(selectRoutine({ ...base, design: null, style: "jog-laps" }).id).toBe("jog-island");
  });

  it("rotates between ways over a long block", () => {
    const seen = new Set<string>();
    for (let m = 0; m < 600; m += 20) seen.add(selectRoutine({ activity: "workout", design: calisthenics, style: "auto", seed: "blockA", minute: m, night: false }).id);
    expect(seen.size).toBeGreaterThanOrEqual(3);
    expect([...seen].some((id) => id === "workout-pullups" || id === "workout-dips")).toBe(true);
  });

  it("is stable within a 20-minute slot", () => {
    const a = selectRoutine({ activity: "read", design: null, style: "auto", seed: "x", minute: 601, night: false });
    const b = selectRoutine({ activity: "read", design: null, style: "auto", seed: "x", minute: 619, night: false });
    expect(a.id).toBe(b.id);
  });
});
