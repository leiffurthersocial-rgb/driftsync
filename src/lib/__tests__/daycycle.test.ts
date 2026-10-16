import { describe, expect, it } from "vitest";
import { dayLight, lightFor } from "../daycycle";

describe("dayLight", () => {
  it("is bright at noon and dark at midnight", () => {
    expect(dayLight(12 * 60).night).toBe(0);
    expect(dayLight(0).night).toBe(1);
    expect(dayLight(23 * 60).night).toBe(1);
  });
  it("interpolates smoothly through dusk", () => {
    const a = dayLight(18 * 60).night;
    const b = dayLight(19 * 60).night;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThan(1);
    expect(dayLight(18 * 60 + 45).golden).toBeGreaterThan(0.9);
  });
  it("honours fixed themes", () => {
    expect(lightFor("day", 0).night).toBe(0);
    expect(lightFor("dusk", 12 * 60).night).toBeGreaterThan(0.5);
  });
});
