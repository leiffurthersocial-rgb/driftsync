import { describe, expect, it } from "vitest";
import { dayLight, isDark } from "../daycycle";

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
    expect(isDark("light", 0)).toBe(false);
    expect(isDark("dark", 12 * 60)).toBe(true);
    expect(isDark("system", 12 * 60, true)).toBe(true);
    expect(isDark("auto", 12 * 60)).toBe(false);
    expect(isDark("auto", 23 * 60)).toBe(true);
  });
});
