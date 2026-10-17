"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store/app-store";
import { Dialog } from "@/components/ui/dialog";
import { ColorSwatches } from "@/components/ui/controls";
import { DAY_MINUTES, formatDuration, formatMinutes } from "@/lib/time";
import { cn } from "@/lib/cn";

/** Side sheet for one block inside a template. Changes save immediately. */
export function TemplateBlockEditor({
  templateId,
  blockId,
  isNew,
  weekly,
  weekStart,
  onClose,
  onDayChange,
}: {
  templateId: string;
  blockId: string | null;
  isNew: boolean;
  weekly: boolean;
  weekStart: 0 | 1;
  onClose(): void;
  onDayChange(day: number): void;
}) {
  const block = useApp((s) => s.templates.find((t) => t.id === templateId)?.blocks.find((b) => b.id === blockId) ?? null);
  const activities = useApp((s) => s.activities);
  const clock = useApp((s) => s.settings.clock);
  const [title, setTitle] = useState("");
  useEffect(() => {
    if (block) setTitle(block.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block?.id]);
  const times = useMemo(() => Array.from({ length: DAY_MINUTES / 15 + 1 }, (_, i) => i * 15), []);
  const sorted = useMemo(() => [...activities].sort((a, b) => a.order - b.order), [activities]);
  if (!block) return null;

  const st = useApp.getState();
  const update = (patch: Parameters<typeof st.updateTemplateBlock>[2]) => st.updateTemplateBlock(templateId, block.id, patch);
  const close = () => {
    if (title !== block.title) update({ title: title.trim() });
    if (isNew && !title.trim() && !block.activityId) st.removeTemplateBlock(templateId, block.id);
    onClose();
  };
  const act = activities.find((a) => a.id === block.activityId);
  const order = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);

  return (
    <Dialog
      open
      onClose={close}
      variant="sheet"
      title={isNew ? "New template block" : "Edit template block"}
      description={`${formatMinutes(block.start, clock)} – ${formatMinutes(block.end, clock)} · ${formatDuration(block.end - block.start)}`}
      footer={
        <>
          <button
            className="btn-ghost mr-auto text-danger"
            onClick={() => {
              st.removeTemplateBlock(templateId, block.id);
              onClose();
            }}
          >
            <Trash2 size={16} /> Delete
          </button>
          <button className="btn-primary" onClick={close}>
            Done
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="tb-title" className="label">
            Title
          </label>
          <input
            id="tb-title"
            className="input"
            data-autofocus={isNew || undefined}
            value={title}
            maxLength={120}
            placeholder={act?.name ?? "What's the plan?"}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== block.title && update({ title: title.trim() })}
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
                onClick={() => update({ activityId: block.activityId === a.id ? null : a.id })}
                className={cn("chip transition", block.activityId === a.id ? "text-ink" : "text-muted hover:text-ink")}
                style={block.activityId === a.id ? { borderColor: a.color, background: `color-mix(in srgb, ${a.color} 16%, transparent)` } : undefined}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                {a.name}
              </button>
            ))}
          </div>
        </div>
        {weekly && (
          <div>
            <label htmlFor="tb-day" className="label">
              Day
            </label>
            <select
              id="tb-day"
              className="input"
              value={block.day}
              onChange={(e) => {
                const day = Number(e.target.value);
                update({ day });
                onDayChange(day);
              }}
            >
              {order.map((d) => (
                <option key={d} value={d}>
                  {new Date(2023, 0, 1 + d).toLocaleDateString(undefined, { weekday: "long" })}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="tb-start" className="label">
              Start
            </label>
            <select
              id="tb-start"
              className="input"
              value={block.start}
              onChange={(e) => {
                const start = Number(e.target.value);
                const len = block.end - block.start;
                update({ start, end: Math.min(DAY_MINUTES, Math.max(start + 15, start + len)) });
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
            <label htmlFor="tb-end" className="label">
              End
            </label>
            <select id="tb-end" className="input" value={block.end} onChange={(e) => update({ end: Number(e.target.value) })}>
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
          <ColorSwatches value={block.color} onChange={(color) => update({ color })} allowNone label="Block color" />
        </div>
        <div>
          <label htmlFor="tb-notes" className="label">
            Notes
          </label>
          <textarea
            id="tb-notes"
            key={block.id}
            className="input min-h-[72px] resize-y"
            defaultValue={block.notes}
            onBlur={(e) => e.target.value !== block.notes && update({ notes: e.target.value })}
            placeholder="Anything to remember…"
          />
        </div>
      </div>
    </Dialog>
  );
}
