import type { Repeat } from "@/data/schema";
import { addDays, fromDateKey } from "./time";

/** Day number in UTC so DST never shifts the math. */
const dayNum = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};
const parts = (key: string) => key.split("-").map(Number) as [number, number, number];
export const weekdayOf = (key: string) => fromDateKey(key).getDay();

/** Does a rule anchored at `anchor` produce an occurrence on `date`? */
export function occursOn(rule: Repeat, anchor: string, date: string): boolean {
  if (date < anchor) return false;
  if (rule.until && date > rule.until) return false;
  const every = Math.max(1, rule.interval);
  const diff = dayNum(date) - dayNum(anchor);
  switch (rule.freq) {
    case "daily":
      return diff % every === 0;
    case "weekly": {
      const days = rule.weekdays.length ? rule.weekdays : [weekdayOf(anchor)];
      if (!days.includes(weekdayOf(date))) return false;
      // Weeks counted Sunday-to-Saturday from the anchor's week, so "every 2 weeks on Mon & Thu" stays in phase.
      const week = Math.floor((diff + weekdayOf(anchor)) / 7);
      return week % every === 0;
    }
    case "monthly": {
      const [ay, am, ad] = parts(anchor);
      const [y, m, d] = parts(date);
      // Months without that day (e.g. the 31st) are skipped, like most calendars do.
      return d === ad && ((y - ay) * 12 + (m - am)) % every === 0;
    }
    case "yearly": {
      const [ay, am, ad] = parts(anchor);
      const [y, m, d] = parts(date);
      return m === am && d === ad && (y - ay) % every === 0;
    }
  }
}

/** Every occurrence between `from` and `to` (inclusive). */
export function occurrencesBetween(rule: Repeat, anchor: string, from: string, to: string): string[] {
  const out: string[] = [];
  let d = from < anchor ? anchor : from;
  const end = rule.until && rule.until < to ? rule.until : to;
  for (; d <= end; d = addDays(d, 1)) if (occursOn(rule, anchor, d)) out.push(d);
  return out;
}

/** First occurrence strictly after `after`, or null if the rule has ended. */
export function nextOccurrence(rule: Repeat, anchor: string, after: string): string | null {
  // Ten years of days is plenty for any rule (yearly on Feb 29 needs at most 8).
  let d = addDays(after < anchor ? addDays(anchor, -1) : after, 1);
  for (let i = 0; i < 3700; i++, d = addDays(d, 1)) {
    if (rule.until && d > rule.until) return null;
    if (occursOn(rule, anchor, d)) return d;
  }
  return null;
}

const WEEKDAY = (i: number, style: "long" | "short" = "short") =>
  new Date(2023, 0, 1 + i).toLocaleDateString(undefined, { weekday: style }); // 2023-01-01 was a Sunday

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

/** "Every weekday", "Every 2 weeks on Mon, Thu", "Monthly on the 17th, until Dec 1". */
export function describeRepeat(rule: Repeat, anchor: string): string {
  const n = Math.max(1, rule.interval);
  let text: string;
  switch (rule.freq) {
    case "daily":
      text = n === 1 ? "Every day" : `Every ${n} days`;
      break;
    case "weekly": {
      const days = (rule.weekdays.length ? rule.weekdays : [weekdayOf(anchor)]).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      if (n === 1 && sameDays(days, [1, 2, 3, 4, 5])) text = "Every weekday";
      else if (n === 1 && sameDays(days, [0, 6])) text = "Every weekend";
      else if (n === 1 && days.length === 7) text = "Every day";
      else {
        const list = days.length === 1 ? WEEKDAY(days[0], "long") : days.map((d) => WEEKDAY(d)).join(", ");
        text = n === 1 ? `Every ${list}` : `Every ${n} weeks on ${list}`;
      }
      break;
    }
    case "monthly":
      text = `${n === 1 ? "Monthly" : `Every ${n} months`} on the ${ordinal(parts(anchor)[2])}`;
      break;
    case "yearly": {
      const label = fromDateKey(anchor).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      text = `${n === 1 ? "Yearly" : `Every ${n} years`} on ${label}`;
      break;
    }
  }
  if (rule.until) text += `, until ${fromDateKey(rule.until).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return text;
}

export interface RepeatPreset {
  id: string;
  label: string;
  rule: Repeat;
}

const rule = (freq: Repeat["freq"], weekdays: number[] = [], interval = 1): Repeat => ({ freq, interval, weekdays, until: null });

/** The common choices offered in repeat pickers, phrased for the given start date. */
export function repeatPresets(anchor: string): RepeatPreset[] {
  const wd = weekdayOf(anchor);
  const list: [string, Repeat][] = [
    ["daily", rule("daily")],
    ["weekdays", rule("weekly", [1, 2, 3, 4, 5])],
    ["weekends", rule("weekly", [0, 6])],
    ["weekly", rule("weekly", [wd])],
    ["biweekly", rule("weekly", [wd], 2)],
    ["monthly", rule("monthly")],
    ["yearly", rule("yearly")],
  ];
  return list.map(([id, r]) => ({ id, rule: r, label: describeRepeat(r, anchor) }));
}

/** Which preset (if any) a rule is, ignoring its end date. */
export function matchPreset(r: Repeat, anchor: string): string | null {
  for (const p of repeatPresets(anchor)) {
    const a = p.rule;
    const days = (x: Repeat) => (x.freq === "weekly" ? (x.weekdays.length ? x.weekdays : [weekdayOf(anchor)]) : []);
    if (a.freq === r.freq && a.interval === r.interval && sameDays(days(a), days(r))) return p.id;
  }
  return null;
}
