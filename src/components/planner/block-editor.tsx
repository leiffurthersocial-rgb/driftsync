"use client";

import { Copy, Repeat as RepeatIcon, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Block } from "@/data/schema";
import { useApp, type RepeatScope, type SeriesPatch } from "@/store/app-store";
import { toast } from "@/store/ui-store";
import { Dialog } from "@/components/ui/dialog";
import { ColorSwatches, Segmented, Switch } from "@/components/ui/controls";
import { RepeatPicker } from "@/components/ui/repeat-picker";
import { DAY_MINUTES, formatDateLong, formatDuration, formatMinutes } from "@/lib/time";
import { describeRepeat } from "@/lib/recurrence";
import { findBlock } from "@/lib/series";
import { cn } from "@/lib/cn";

const SERIES_FIELDS = ["title", "activityId", "color", "notes", "goalId", "start", "end"] as const;

/**
 * Side sheet for editing a block. Changes save immediately. For a repeating block you choose
 * whether edits apply to this day only or to this and every later occurrence.
 */
export function BlockEditor({
  blockId,
  isNew,
  onClose,
  onIdChange,
}: {
  blockId: string | null;
  isNew: boolean;
  onClose(): void;
  /** Editing an unsaved repeat occurrence saves it under a new id. */
  onIdChange?(id: string): void;
}) {
  const blocks = useApp((s) => s.blocks);
  const allSeries = useApp((s) => s.series);
  const block = useMemo(() => (blockId ? findBlock(blockId, blocks, allSeries) : null), [blockId, blocks, allSeries]);
  const series = block?.seriesId ? (allSeries.find((x) => x.id === block.seriesId) ?? null) : null;
  const activities = useApp((s) => s.activities);
  const todos = useApp((s) => s.todos);
  const goals = useApp((s) => s.goals);
  const clock = useApp((s) => s.settings.clock);
  const weekStart = useApp((s) => s.settings.weekStart);
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<RepeatScope>("one");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const opened = blockId !== null;

  useEffect(() => {
    if (block) setTitle(block.title);
    // only when switching blocks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block?.id]);
  useEffect(() => {
    setScope("one");
    setConfirmDelete(false);
  }, [opened]);

  const follow = (id: string | null) => {
    if (id === null) onClose();
    else if (id !== blockId) onIdChange?.(id);
  };

  /** Apply a change to this block, or to the series from here on. */
  const updateBlock = (id: string, patch: Partial<Block>) => {
    const st = useApp.getState();
    if (series && scope === "upcoming") {
      const sp: SeriesPatch = {};
      const rest: Partial<Block> = {};
      for (const [k, v] of Object.entries(patch)) {
        if ((SERIES_FIELDS as readonly string[]).includes(k)) (sp as Record<string, unknown>)[k] = v;
        else (rest as Record<string, unknown>)[k] = v;
      }
      let next = Object.keys(sp).length ? st.updateSeriesFrom(id, sp) : id;
      if (next && Object.keys(rest).length) next = st.updateBlock(next, rest);
      follow(next);
    } else follow(st.updateBlock(id, patch));
  };
  const removeBlock = (id: string, sc: RepeatScope = "one") => useApp.getState().removeBlock(id, sc);

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
    if (series) return setConfirmDelete(true);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, updatedAt, deletedAt, ...rest } = block;
    removeBlock(block.id);
    onClose();
    toast("Block removed", { action: { label: "Undo", run: () => useApp.getState().addBlock(rest) } });
  };
  const removeSeries = (sc: RepeatScope) => {
    removeBlock(block.id, sc);
    onClose();
    toast(sc === "one" ? `Removed from ${formatDateLong(block.date)}` : "Removed this and upcoming");
  };

  return (
    <Dialog
      open={!!block}
      onClose={close}
      variant="sheet"
      title={isNew ? "New block" : "Edit block"}
      description={`${formatMinutes(block.start, clock)} – ${formatMinutes(block.end, clock)} · ${formatDuration(block.end - block.start)}`}
      footer={
        confirmDelete ? (
          <div className="flex w-full flex-wrap items-center gap-2" role="group" aria-label="Delete repeating block">
            <span className="mr-auto text-sm font-medium">Delete…</span>
            <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button className="btn-soft text-danger" onClick={() => removeSeries("one")} data-autofocus>
              This day
            </button>
            <button className="btn-danger" onClick={() => removeSeries("upcoming")}>
              This &amp; upcoming
            </button>
          </div>
        ) : (
          <>
            <button className="btn-ghost mr-auto text-danger" onClick={remove}>
              <Trash2 size={16} /> Delete
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                const len = block.end - block.start;
                const start = Math.min(block.end, DAY_MINUTES - len);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id, createdAt, updatedAt, deletedAt, ...rest } = block;
                useApp.getState().addBlock({ ...rest, start, end: start + len, done: false, seriesId: null, seriesDate: null });
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
        )
      }
    >
      <div className="space-y-5">
        {series && (
          <div className="space-y-2 rounded-2xl bg-surface-2/60 px-4 py-3">
            <p className="flex items-center gap-2 text-sm">
              <RepeatIcon size={14} className="shrink-0 text-accent" aria-hidden />
              <span>{describeRepeat(series.repeat, series.from)}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted" id="scope-label">
                Changes apply to
              </span>
              <Segmented
                label="Changes apply to"
                value={scope}
                onChange={setScope}
                options={[
                  { value: "one", label: "This day" },
                  { value: "upcoming", label: "This & upcoming" },
                ]}
              />
            </div>
          </div>
        )}
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
          <label htmlFor="block-repeat" className="label">
            Repeat
          </label>
          <RepeatPicker
            id="block-repeat"
            value={series?.repeat ?? null}
            anchor={block.date}
            weekStart={weekStart}
            onChange={(r) => {
              if (title !== block.title) useApp.getState().updateBlock(block.id, { title: title.trim() });
              follow(useApp.getState().setBlockRepeat(block.id, r));
              if (r && !series) toast(describeRepeat(r, block.date), { tone: "success" });
            }}
          />
          {series && <p className="mt-1.5 text-xs text-muted">Changing the repeat applies from this day on. “Does not repeat” keeps this day and stops the ones after.</p>}
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
