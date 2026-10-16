"use client";

import { Copy, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store/app-store";
import { toast } from "@/store/ui-store";
import { Dialog } from "@/components/ui/dialog";
import { ColorSwatches, Switch } from "@/components/ui/controls";
import { DAY_MINUTES, formatDuration, formatMinutes } from "@/lib/time";
import { cn } from "@/lib/cn";
import { stamp } from "@/lib/id";

/** Side sheet for editing a block. Changes save immediately. */
export function BlockEditor({ blockId, isNew, onClose }: { blockId: string | null; isNew: boolean; onClose(): void }) {
  const block = useApp((s) => s.blocks.find((b) => b.id === blockId) ?? null);
  const activities = useApp((s) => s.activities);
  const todos = useApp((s) => s.todos);
  const goals = useApp((s) => s.goals);
  const clock = useApp((s) => s.settings.clock);
  const { updateBlock, removeBlock } = useApp.getState();
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (block) setTitle(block.title);
    // only when switching blocks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block?.id]);

  const times = useMemo(() => Array.from({ length: DAY_MINUTES / 15 + 1 }, (_, i) => i * 15), []);
  const sorted = useMemo(() => [...activities].sort((a, b) => a.order - b.order), [activities]);

  const close = () => {
    if (block) {
      if (title !== block.title) updateBlock(block.id, { title: title.trim() });
      if (isNew && !title.trim() && !block.activityId) removeBlock(block.id);
    }
    onClose();
  };

  if (!block) return null;

  const act = activities.find((a) => a.id === block.activityId);
  const remove = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, updatedAt, deletedAt, ...rest } = block;
    removeBlock(block.id);
    onClose();
    toast("Block removed", { action: { label: "Undo", run: () => useApp.getState().addBlock(rest) } });
  };

  return (
    <Dialog
      open={!!block}
      onClose={close}
      variant="sheet"
      title={isNew ? "New block" : "Edit block"}
      description={`${formatMinutes(block.start, clock)} – ${formatMinutes(block.end, clock)} · ${formatDuration(block.end - block.start)}`}
      footer={
        <>
          <button className="btn-ghost mr-auto text-danger" onClick={remove}>
            <Trash2 size={16} /> Delete
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              const len = block.end - block.start;
              const start = Math.min(block.end, DAY_MINUTES - len);
              useApp.getState().addBlock({ ...block, ...stamp(), start, end: start + len, done: false });
              toast("Duplicated after this block");
            }}
            aria-label="Duplicate block"
          >
            <Copy size={16} />
          </button>
          <button className="btn-primary" onClick={close}>
            Done
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="block-title" className="label">
            Title
          </label>
          <input
            id="block-title"
            className="input"
            data-autofocus={isNew || undefined}
            value={title}
            maxLength={120}
            placeholder={act?.name ?? "What's the plan?"}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== block.title && updateBlock(block.id, { title: title.trim() })}
            onKeyDown={(e) => e.key === "Enter" && close()}
          />
        </div>

        <div>
          <span className="label">Activity</span>
          <div role="radiogroup" aria-label="Activity" className="flex flex-wrap gap-1.5">
            {sorted.map((a) => (
              <button
                key={a.id}
                role="radio"
                aria-checked={block.activityId === a.id}
                onClick={() => updateBlock(block.id, { activityId: block.activityId === a.id ? null : a.id })}
                className={cn("chip transition", block.activityId === a.id ? "text-ink" : "text-muted hover:text-ink")}
                style={block.activityId === a.id ? { borderColor: a.color, background: `color-mix(in srgb, ${a.color} 16%, transparent)` } : undefined}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                {a.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="block-start" className="label">
              Start
            </label>
            <select
              id="block-start"
              className="input"
              value={block.start}
              onChange={(e) => {
                const start = Number(e.target.value);
                const len = block.end - block.start;
                updateBlock(block.id, { start, end: Math.min(DAY_MINUTES, Math.max(start + 15, start + len)) });
              }}
            >
              {times.slice(0, -1).map((t) => (
                <option key={t} value={t}>
                  {formatMinutes(t, clock)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="block-end" className="label">
              End
            </label>
            <select id="block-end" className="input" value={block.end} onChange={(e) => updateBlock(block.id, { end: Number(e.target.value) })}>
              {times
                .filter((t) => t > block.start)
                .map((t) => (
                  <option key={t} value={t}>
                    {formatMinutes(t, clock)}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div>
          <span className="label">Color</span>
          <ColorSwatches value={block.color} onChange={(color) => updateBlock(block.id, { color })} allowNone label="Block color" />
        </div>

        <div>
          <label htmlFor="block-notes" className="label">
            Notes
          </label>
          <textarea
            id="block-notes"
            className="input min-h-[72px] resize-y"
            defaultValue={block.notes}
            key={block.id}
            onBlur={(e) => e.target.value !== block.notes && updateBlock(block.id, { notes: e.target.value })}
            placeholder="Anything to remember…"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="block-todo" className="label">
              Linked to-do
            </label>
            <select
              id="block-todo"
              className="input"
              value={block.todoId ?? ""}
              onChange={(e) => updateBlock(block.id, { todoId: e.target.value || null })}
            >
              <option value="">None</option>
              {todos
                .filter((t) => !t.done || t.id === block.todoId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="block-goal" className="label">
              Linked goal
            </label>
            <select
              id="block-goal"
              className="input"
              value={block.goalId ?? ""}
              onChange={(e) => updateBlock(block.id, { goalId: e.target.value || null })}
            >
              <option value="">None</option>
              {goals
                .filter((g) => !g.archived || g.id === block.goalId)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-surface-2/60 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Done</p>
            <p className="text-xs text-muted">Marks this block as completed.</p>
          </div>
          <Switch checked={block.done} onChange={(done) => updateBlock(block.id, { done })} label="Done" />
        </div>
      </div>
    </Dialog>
  );
}
