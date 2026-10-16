/** Day/night factors from local time. Pure: minutes since midnight → light parameters. */

export interface DayLight {
  /** 0 = full day, 1 = deep night. */
  night: number;
  /** 0..1 golden-hour warmth, peaks around sunrise/sunset. */
  golden: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const ramp = (x: number, a: number, b: number) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));

const SUNRISE_START = 5 * 60;
const SUNRISE_END = 7 * 60 + 30;
const SUNSET_START = 17 * 60 + 30;
const SUNSET_END = 20 * 60 + 30;

export function dayLight(minutes: number): DayLight {
  const m = ((minutes % 1440) + 1440) % 1440;
  const night = m < 12 * 60 ? 1 - ramp(m, SUNRISE_START, SUNRISE_END) : ramp(m, SUNSET_START, SUNSET_END);
  const bell = (center: number, width: number) => Math.max(0, 1 - Math.abs(m - center) / width);
  const golden = Math.max(bell(6 * 60 + 30, 90), bell(18 * 60 + 45, 120));
  return { night, golden: smooth(golden) };
}

export type ThemeMode = "auto" | "day" | "dusk" | "retro";

export function lightFor(theme: ThemeMode, minutes: number): DayLight {
  if (theme === "day" || theme === "retro") return { night: 0, golden: 0 };
  if (theme === "dusk") return { night: 0.85, golden: 0.15 };
  return dayLight(minutes);
}
