import type { Activity, Block, Goal, Todo } from "@/data/schema";
import { addDays, startOfMonth, startOfWeek } from "./time";

export interface GoalProgress {
  done: number;
  total: number;
  /** 0..1, capped. */
  ratio: number;
  label: string;
}

/**
 * Progress for a goal, by type:
 *  - milestones: checked milestones / all milestones
 *  - todos: completed linked to-dos / linked to-dos
 *  - frequency: done blocks of the activity in the current week or month / target count
 */
export function goalProgress(
  goal: Goal,
  ctx: { todos: Todo[]; blocks: Block[]; activities?: Activity[]; today: string; weekStart: 0 | 1 },
): GoalProgress {
  const make = (done: number, total: number, label: string): GoalProgress => ({
    done,
    total,
    ratio: total > 0 ? Math.min(1, done / total) : 0,
    label,
  });

  if (goal.type === "milestones") {
    const total = goal.milestones.length;
    const done = goal.milestones.filter((m) => m.done).length;
    return make(done, total, total ? `${done} of ${total} milestones` : "No milestones yet");
  }

  if (goal.type === "todos") {
    const linked = ctx.todos.filter((t) => t.goalId === goal.id);
    const done = linked.filter((t) => t.done).length;
    return make(done, linked.length, linked.length ? `${done} of ${linked.length} to-dos` : "No linked to-dos yet");
  }

  const f = goal.frequency;
  if (!f) return make(0, 0, "Pick an activity to track");
  const { from, to } = periodRange(ctx.today, f.period, ctx.weekStart);
  const done = ctx.blocks.filter((b) => b.done && b.activityId === f.activityId && b.date >= from && b.date <= to).length;
  return make(done, f.count, `${Math.min(done, f.count)} of ${f.count} this ${f.period}`);
}

export function periodRange(today: string, period: "week" | "month", weekStart: 0 | 1) {
  if (period === "week") {
    const from = startOfWeek(today, weekStart);
    return { from, to: addDays(from, 6) };
  }
  const from = startOfMonth(today);
  const next = addDays(from, 32);
  return { from, to: addDays(startOfMonth(next), -1) };
}

/** Reassign the existing order slots of a subset so the subset follows `orderedIds`. */
export function reorderSubset<T extends { id: string; order: number }>(items: T[], orderedIds: string[]): Map<string, number> {
  const byId = new Map(items.map((t) => [t.id, t]));
  const present = orderedIds.filter((id) => byId.has(id));
  const slots = present.map((id) => byId.get(id)!.order).sort((a, b) => a - b);
  // Duplicate slots (e.g. from older data) are spread out so the order stays strict.
  for (let i = 1; i < slots.length; i++) if (slots[i] <= slots[i - 1]) slots[i] = slots[i - 1] + 1e-3;
  const out = new Map<string, number>();
  present.forEach((id, i) => out.set(id, slots[i]));
  return out;
}
