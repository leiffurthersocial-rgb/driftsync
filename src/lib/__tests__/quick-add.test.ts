import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "../quick-add";

const lists = [
  { id: "l1", name: "Home" },
  { id: "l2", name: "Work stuff" },
];
const today = "2026-10-16"; // Friday

describe("parseQuickAdd", () => {
  it("parses plain titles", () => {
    expect(parseQuickAdd("  Water the plants ", lists, today)).toEqual({
      title: "Water the plants",
      priority: 0,
      due: null,
      listId: null,
      repeat: null,
    });
  });
  it("parses due dates, priority and lists", () => {
    const r = parseQuickAdd("Call mum @tomorrow !1 #home", lists, today);
    expect(r).toEqual({ title: "Call mum", priority: 3, due: "2026-10-17", listId: "l1", repeat: null });
  });
  it("resolves weekdays to the next occurrence", () => {
    expect(parseQuickAdd("x @mon", lists, today).due).toBe("2026-10-19");
    expect(parseQuickAdd("x @fri", lists, today).due).toBe("2026-10-23");
  });
  it("matches list prefixes and leaves unknown tokens", () => {
    expect(parseQuickAdd("Report #work", lists, today).listId).toBe("l2");
    expect(parseQuickAdd("Email @someone #nolist !x", lists, today).title).toBe("Email @someone #nolist !x");
  });

  it("parses repeats and sets the first due date", () => {
    const today = "2026-10-17"; // Saturday
    const a = parseQuickAdd("Water plants every day", [], today);
    expect(a).toMatchObject({ title: "Water plants", due: today, repeat: { freq: "daily", interval: 1 } });
    const b = parseQuickAdd("Bins every monday !2", [], today);
    expect(b).toMatchObject({ title: "Bins", due: "2026-10-19", priority: 2, repeat: { freq: "weekly", weekdays: [1] } });
    expect(parseQuickAdd("Standup every weekday", [], today).due).toBe("2026-10-19");
    expect(parseQuickAdd("Rent every month @2026-11-01", [], today)).toMatchObject({ due: "2026-11-01", repeat: { freq: "monthly" } });
    expect(parseQuickAdd("every now and then", [], today)).toMatchObject({ title: "every now and then", repeat: null });
  });
});
