import { addDays, fromDateKey, toDateKey } from "./time";

export interface QuickAddResult {
  title: string;
  priority: number;
  due: string | null;
  listId: string | null;
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const PRIORITY: Record<string, number> = { "1": 3, high: 3, "2": 2, med: 2, medium: 2, "3": 1, low: 1 };

/**
 * Parse a keyboard-first to-do line:
 *   "Call mum @tomorrow !1 #home" → due tomorrow, high priority, list "home".
 * Supports @today, @tomorrow, @mon…@sun (next occurrence), @YYYY-MM-DD; !1-!3 / !high|med|low; #list.
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
  const words: string[] = [];

  for (const word of input.trim().split(/\s+/)) {
    const lower = word.toLowerCase();
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
  return { title: words.join(" "), priority, due, listId };
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
