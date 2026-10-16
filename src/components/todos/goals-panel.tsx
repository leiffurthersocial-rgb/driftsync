"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Archive, MoreHorizontal, Pencil, Plus, Target, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Goal } from "@/data/schema";
import { useApp } from "@/store/app-store";
import { toast } from "@/store/ui-store";
import { goalProgress } from "@/lib/goals";
import { formatDateShort, toDateKey } from "@/lib/time";
import { uuid } from "@/lib/id";
import { EmptyState } from "@/components/ui/controls";
import { Menu } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ProgressBar, ProgressRing } from "@/components/ui/progress-ring";
import { Checkbox } from "./todo-item";
import { GoalDialog } from "./goal-dialog";
import { cn } from "@/lib/cn";

export function GoalsPanel() {
  const goals = useApp((s) => s.goals);
  const [dialog, setDialog] = useState<{ goal: Goal | null } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const active = goals.filter((g) => !g.archived).sort((a, b) => a.order - b.order);
  const archived = goals.filter((g) => g.archived);

  return (
    <section id="goals" aria-labelledby="goals-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="goals-heading" className="text-lg font-semibold">
          Goals
        </h2>
        <button className="btn-soft h-8 px-3" onClick={() => setDialog({ goal: null })}>
          <Plus size={15} /> New goal
        </button>
      </div>
      {active.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Target size={20} />} title="No goals yet">
            Goals can be a checklist, a set of to-dos, or a habit like “jog 3× a week” that fills in from your planner.
          </EmptyState>
        </div>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {active.map((g) => (
              <motion.li key={g.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}>
                <GoalCard goal={g} onEdit={() => setDialog({ goal: g })} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {archived.length > 0 && (
        <div>
          <button className="text-sm text-muted hover:text-ink" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived}>
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-2 space-y-2">
              {archived.map((g) => (
                <li key={g.id} className="flex items-center justify-between rounded-2xl border border-line/60 px-4 py-2.5 text-sm">
                  <span className="text-muted">{g.title}</span>
                  <button className="text-accent hover:underline" onClick={() => useApp.getState().updateGoal(g.id, { archived: false })}>
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <GoalDialog open={!!dialog} goal={dialog?.goal ?? null} onClose={() => setDialog(null)} />
    </section>
  );
}

function GoalCard({ goal, onEdit }: { goal: Goal; onEdit(): void }) {
  const todos = useApp((s) => s.todos);
  const blocks = useApp((s) => s.blocks);
  const activities = useApp((s) => s.activities);
  const weekStart = useApp((s) => s.settings.weekStart);
  const today = toDateKey(new Date());
  const progress = useMemo(() => goalProgress(goal, { todos, blocks, today, weekStart }), [goal, todos, blocks, today, weekStart]);
  const [confirm, setConfirm] = useState(false);
  const [draft, setDraft] = useState("");
  const { updateGoal } = useApp.getState();
  const complete = progress.total > 0 && progress.ratio >= 1;

  const addItem = () => {
    const t = draft.trim();
    if (!t) return;
    if (goal.type === "milestones") updateGoal(goal.id, { milestones: [...goal.milestones, { id: uuid(), title: t, done: false }] });
    else if (goal.type === "todos") useApp.getState().addTodo({ title: t, goalId: goal.id });
    setDraft("");
  };

  const linked = todos.filter((t) => t.goalId === goal.id).sort((a, b) => Number(a.done) - Number(b.done) || a.order - b.order);
  const freqActivity = goal.frequency ? activities.find((a) => a.id === goal.frequency!.activityId) : null;

  return (
    <article className="card p-4" aria-label={goal.title}>
      <div className="flex items-start gap-3">
        <ProgressRing ratio={progress.ratio} color={goal.color} label={progress.label} />
        <div className="min-w-0 flex-1">
          <h3 className="font-medium leading-tight">{goal.title}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {complete ? "Reached — lovely." : progress.label}
            {goal.deadline && ` · by ${formatDateShort(goal.deadline)}`}
          </p>
        </div>
        <Menu
          label="Goal options"
          trigger={
            <button className="btn-ghost -mr-1 -mt-1 h-8 w-8 p-0" aria-label={`Options for ${goal.title}`}>
              <MoreHorizontal size={16} />
            </button>
          }
          items={[
            { label: "Edit", icon: <Pencil size={15} />, onSelect: onEdit },
            {
              label: "Archive",
              icon: <Archive size={15} />,
              onSelect: () => {
                updateGoal(goal.id, { archived: true });
                toast("Goal archived", { action: { label: "Undo", run: () => updateGoal(goal.id, { archived: false }) } });
              },
            },
            { label: "Delete", icon: <Trash2 size={15} />, danger: true, onSelect: () => setConfirm(true) },
          ]}
        />
      </div>

      <div className="mt-3">
        {goal.type === "frequency" ? (
          <div>
            <div className="flex items-center gap-1.5" aria-hidden>
              {Array.from({ length: goal.frequency?.count ?? 0 }, (_, i) => (
                <motion.span
                  key={i}
                  className="h-3 flex-1 rounded-full"
                  initial={false}
                  animate={{ backgroundColor: i < progress.done ? goal.color : "rgb(var(--surface-2))" }}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              {freqActivity ? `${freqActivity.name}, ${goal.frequency!.count}× per ${goal.frequency!.period}. Mark planner blocks done to fill these in.` : "Choose an activity in Edit."}
            </p>
          </div>
        ) : (
          <>
            <ProgressBar ratio={progress.ratio} color={goal.color} label={progress.label} />
            <ul className="mt-3 space-y-1">
              {goal.type === "milestones"
                ? goal.milestones.map((m) => (
                    <li key={m.id} className="group flex items-center gap-2.5 text-sm">
                      <Checkbox
                        checked={m.done}
                        color={goal.color}
                        label={`Milestone ${m.title}`}
                        onChange={() => updateGoal(goal.id, { milestones: goal.milestones.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)) })}
                      />
                      <span className={cn("flex-1", m.done && "text-muted line-through")}>{m.title}</span>
                      <button
                        className="opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                        aria-label={`Remove milestone ${m.title}`}
                        onClick={() => updateGoal(goal.id, { milestones: goal.milestones.filter((x) => x.id !== m.id) })}
                      >
                        <X size={14} className="text-muted" />
                      </button>
                    </li>
                  ))
                : linked.slice(0, 6).map((t) => (
                    <li key={t.id} className="flex items-center gap-2.5 text-sm">
                      <Checkbox checked={t.done} color={goal.color} label={`To-do ${t.title}`} onChange={() => useApp.getState().toggleTodo(t.id)} />
                      <span className={cn("truncate", t.done && "text-muted line-through")}>{t.title}</span>
                    </li>
                  ))}
            </ul>
            {goal.type === "todos" && linked.length > 6 && <p className="mt-1 text-xs text-muted">+ {linked.length - 6} more</p>}
            <form
              className="mt-2"
              onSubmit={(e) => {
                e.preventDefault();
                addItem();
              }}
            >
              <label className="sr-only" htmlFor={`goal-add-${goal.id}`}>
                {goal.type === "milestones" ? "Add milestone" : "Add linked to-do"}
              </label>
              <input
                id={`goal-add-${goal.id}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={goal.type === "milestones" ? "+ Add milestone" : "+ Add a to-do for this goal"}
                className="w-full rounded-lg bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted/70 focus:bg-surface-2/60"
              />
            </form>
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete “${goal.title}”?`}
        description="Linked to-dos and blocks stay, they just won't point at this goal anymore."
        confirmLabel="Delete goal"
        onConfirm={() => useApp.getState().removeGoal(goal.id)}
      />
    </article>
  );
}
