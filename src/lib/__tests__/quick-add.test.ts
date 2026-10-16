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
    });
  });
  it("parses due dates, priority and lists", () => {
    const r = parseQuickAdd("Call mum @tomorrow !1 #home", lists, today);
    expect(r).toEqual({ title: "Call mum", priority: 3, due: "2026-10-17", listId: "l1" });
  });
  it("resolves weekdays to the next occurrence", () => {
    expect(parseQuickAdd("x @mon", lists, today).due).toBe("2026-10-19");
    expect(parseQuickAdd("x @fri", lists, today).due).toBe("2026-10-23");
  });
  it("matches list prefixes and leaves unknown tokens", () => {
    expect(parseQuickAdd("Report #work", lists, today).listId).toBe("l2");
    expect(parseQuickAdd("Email @someone #nolist !x", lists, today).title).toBe("Email @someone #nolist !x");
  });
});
