import type { Repeat } from "@/data/schema";
import { nextOccurrence } from "./recurrence";
import { addDays, fromDateKey, toDateKey } from "./time";

export interface QuickAddResult {
  title: string;
  priority: number;
  due: string | null;
  listId: string | null;
  repeat: Repeat | null;
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const PRIORITY: Record<string, number> = { "1": 3, high: 3, "2": 2, med: 2, medium: 2, "3": 1, low: 1 };

/**
 * Parse a keyboard-first to-do line:
 *   "Call mum @tomorrow !1 #home" → due tomorrow, high priority, list "home".
 * Supports @today, @tomorrow, @mon…@sun (next occurrence), @YYYY-MM-DD; !1-!3 / !high|med|low; #list;
 * and repeats: "every day|weekday|weekend|week|month|year|monday…" (due defaults to the first occurrence).
 * Unknown tokens stay in the title.
 */
export function parseQuickAdd(
  input: string,
  lists: { id: string; name: string }[] = [],
  today: string = toDateKey(new Date()),
): QuickAddResult {
  let priority = 0;
  let due: string | null = null;
  let listId: string | null = null;
  let repeat: Repeat | null = null;
  const words: string[] = [];
  const tokens = input.trim().split(/\s+/);

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    const lower = word.toLowerCase();
    if (lower === "every" && i + 1 < tokens.length) {
      const r = parseRepeat(tokens[i + 1].toLowerCase());
      if (r) {
        repeat = r;
        i++;
        continue;
      }
    }
    if (lower.length > 1 && lower[0] === "!" && PRIORITY[lower.slice(1)] !== undefined) {
      priority = PRIORITY[lower.slice(1)];
      continue;
    }
    if (lower.length > 1 && lower[0] === "@") {
      const d = parseDue(lower.slice(1), today);
      if (d) {
        due = d;
        continue;
      }
    }
    if (lower.length > 1 && lower[0] === "#") {
      const name = lower.slice(1);
      const match = lists.find((l) => l.name.toLowerCase() === name) ?? lists.find((l) => l.name.toLowerCase().startsWith(name));
      if (match) {
        listId = match.id;
        continue;
      }
    }
    words.push(word);
  }
  // A repeating to-do needs a date to repeat from: the first occurrence from today on.
  if (repeat && !due) due = nextOccurrence(repeat, today, addDays(today, -1));
  return { title: words.join(" "), priority, due, listId, repeat };
}

function parseRepeat(token: string): Repeat | null {
  const r = (freq: Repeat["freq"], weekdays: number[] = []): Repeat => ({ freq, interval: 1, weekdays, until: null });
  const t = token.replace(/s$/, "");
  if (t === "day") return r("daily");
  if (t === "weekday") return r("weekly", [1, 2, 3, 4, 5]);
  if (t === "weekend") return r("weekly", [0, 6]);
  if (t === "week") return r("weekly");
  if (t === "month") return r("monthly");
  if (t === "year") return r("yearly");
  const wd = WEEKDAYS.findIndex((d) => t.startsWith(d) && t.length <= 9);
  return wd === -1 ? null : r("weekly", [wd]);
}

function parseDue(token: string, today: string): string | null {
  if (token === "today" || token === "tod") return today;
  if (token === "tomorrow" || token === "tom") return addDays(today, 1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(token)) return token;
  const wd = WEEKDAYS.findIndex((d) => token.startsWith(d) && token.length <= 9);
  if (wd !== -1) {
    const cur = fromDateKey(today).getDay();
    const diff = (wd - cur + 7) % 7 || 7;
    return addDays(today, diff);
  }
  if (token === "nextweek") return addDays(today, 7);
  return null;
}

export { toDateKey };
