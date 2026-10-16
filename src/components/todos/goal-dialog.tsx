"use client";

import { CalendarRange, ListChecks, Repeat } from "lucide-react";
import { useEffect, useState } from "react";
import type { Goal, GoalType } from "@/data/schema";
import { useApp } from "@/store/app-store";
import { Dialog } from "@/components/ui/dialog";
import { ColorSwatches, Segmented } from "@/components/ui/controls";
import { uuid } from "@/lib/id";
import { cn } from "@/lib/cn";

const TYPES: { id: GoalType; title: string; blurb: string; icon: React.ReactNode }[] = [
  { id: "milestones", title: "Milestones", blurb: "A checklist of steps", icon: <ListChecks size={18} /> },
  { id: "todos", title: "Linked to-dos", blurb: "Progress from to-dos", icon: <CalendarRange size={18} /> },
  { id: "frequency", title: "Habit", blurb: "e.g. jog 3× a week", icon: <Repeat size={18} /> },
];

/** Create or edit a goal. */
export function GoalDialog({ open, goal, onClose }: { open: boolean; goal: Goal | null; onClose(): void }) {
  const activities = useApp((s) => s.activities);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<GoalType>("milestones");
  const [deadline, setDeadline] = useState("");
  const [color, setColor] = useState("#7c8cf0");
  const [milestones, setMilestones] = useState("");
  const [activityId, setActivityId] = useState("");
  const [count, setCount] = useState(3);
  const [period, setPeriod] = useState<"week" | "month">("week");

  useEffect(() => {
    if (!open) return;
    setTitle(goal?.title ?? "");
    setType(goal?.type ?? "milestones");
    setDeadline(goal?.deadline ?? "");
    setColor(goal?.color ?? "#7c8cf0");
    setMilestones("");
    setActivityId(goal?.frequency?.activityId ?? activities.find((a) => a.key === "jogging")?.id ?? activities[0]?.id ?? "");
    setCount(goal?.frequency?.count ?? 3);
    setPeriod(goal?.frequency?.period ?? "week");
  }, [open, goal, activities]);

  const save = () => {
    if (!title.trim()) return;
    const extra = milestones
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((t) => ({ id: uuid(), title: t, done: false }));
    const patch = {
      title: title.trim(),
      type,
      deadline: deadline || null,
      color,
      frequency: type === "frequency" && activityId ? { activityId, count, period } : (goal?.frequency ?? null),
      milestones: [...(goal?.milestones ?? []), ...extra],
    };
    if (goal) useApp.getState().updateGoal(goal.id, patch);
    else useApp.getState().addGoal(patch);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={goal ? "Edit goal" : "New goal"}
      className="max-w-lg"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={!title.trim()}>
            {goal ? "Save" : "Create goal"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="goal-title" className="label">
            Goal
          </label>
          <input id="goal-title" data-autofocus className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Run a 10k, finish the course, read 12 books…" />
        </div>
        <div>
          <span className="label">Track progress by</span>
          <div role="radiogroup" aria-label="Progress type" className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.id}
                role="radio"
                aria-checked={type === t.id}
                onClick={() => setType(t.id)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition",
                  type === t.id ? "border-accent/60 bg-accent/10" : "border-line/70 hover:bg-surface-2",
                )}
              >
                <span className="text-muted">{t.icon}</span>
                <span className="text-sm font-medium">{t.title}</span>
                <span className="text-[11px] leading-tight text-muted">{t.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        {type === "milestones" && (
          <div>
            <label htmlFor="goal-ms" className="label">
              {goal ? "Add milestones" : "Milestones"} <span className="normal-case tracking-normal text-muted/70">(one per line)</span>
            </label>
            <textarea id="goal-ms" className="input min-h-[88px]" value={milestones} onChange={(e) => setMilestones(e.target.value)} placeholder={"Sign up\nFirst 5k\nBuild to 10k"} />
          </div>
        )}
        {type === "todos" && <p className="rounded-2xl bg-surface-2/60 p-3 text-sm text-muted">Link to-dos to this goal from a to-do’s details, or add them right from the goal card.</p>}
        {type === "frequency" && (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="goal-activity" className="label">
                Activity
              </label>
              <select id="goal-activity" className="input" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="goal-count" className="label">
                Times
              </label>
              <div className="flex items-center gap-2">
                <input id="goal-count" type="number" min={1} max={50} className="input w-20" value={count} onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
                <Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: "week", label: "/ week" }, { value: "month", label: "/ month" }]} />
              </div>
            </div>
            <p className="text-xs text-muted sm:col-span-2">Counts planner blocks of this activity that you mark done.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="goal-deadline" className="label">
              Deadline <span className="normal-case tracking-normal text-muted/70">(optional)</span>
            </label>
            <input id="goal-deadline" type="date" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>
        <div>
          <span className="label">Color</span>
          <ColorSwatches value={color} onChange={(c) => c && setColor(c)} label="Goal color" />
        </div>
      </div>
    </Dialog>
  );
}
