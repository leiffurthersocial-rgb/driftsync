"use client";

import { CalendarClock, GripVertical, Inbox, LayoutTemplate } from "lucide-react";
import { useMemo } from "react";
import { useApp } from "@/store/app-store";
import { EmptyState } from "@/components/ui/controls";
import { formatDateShort } from "@/lib/time";
import { TODO_DRAG_TYPE } from "./timeline";
import { cn } from "@/lib/cn";

/** Open to-dos you can drag onto the timeline (or schedule with a button), plus templates. */
export function PlannerSide({
  date,
  onSchedule,
  onApplyTemplate,
}: {
  date: string;
  onSchedule(todoId: string): void;
  onApplyTemplate(id: string): void;
}) {
  const todos = useApp((s) => s.todos);
  const templates = useApp((s) => s.templates);
  const blocks = useApp((s) => s.blocks);
  const scheduled = useMemo(() => new Set(blocks.filter((b) => b.date === date && b.todoId).map((b) => b.todoId)), [blocks, date]);
  const open = useMemo(
    () =>
      todos
        .filter((t) => !t.done)
        .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || b.priority - a.priority || a.order - b.order)
        .slice(0, 40),
    [todos],
  );

  return (
    <div className="space-y-4">
      <section className="card p-4" aria-labelledby="side-todos">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="side-todos" className="text-sm font-semibold">
            To-dos
          </h2>
          <span className="hidden text-xs text-muted lg:inline">Drag onto the timeline</span>
        </div>
        {open.length === 0 ? (
          <EmptyState icon={<Inbox size={20} />} title="All clear">
            Add to-dos from the island or the To-dos page, then time-block them here.
          </EmptyState>
        ) : (
          <ul className="-mx-1 max-h-[42vh] space-y-0.5 overflow-y-auto">
            {open.map((t) => (
              <li
                key={t.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(TODO_DRAG_TYPE, t.id);
                  e.dataTransfer.setData("text/plain", t.title);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="group flex cursor-grab items-center gap-2 rounded-xl px-1 py-1.5 hover:bg-surface-2 active:cursor-grabbing"
              >
                <GripVertical size={14} className="shrink-0 text-muted/50" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm", scheduled.has(t.id) && "text-muted")}>{t.title}</span>
                  {t.due && <span className="text-[11px] text-muted">due {formatDateShort(t.due)}</span>}
                </span>
                <button
                  onClick={() => onSchedule(t.id)}
                  className="btn-ghost h-8 w-8 shrink-0 p-0 text-muted opacity-70 group-hover:opacity-100"
                  aria-label={`Schedule “${t.title}” in the next free slot`}
                  title="Schedule in next free slot"
                >
                  <CalendarClock size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4" aria-labelledby="side-templates">
        <h2 id="side-templates" className="mb-2 text-sm font-semibold">
          Templates
        </h2>
        {templates.length === 0 ? (
          <p className="text-sm text-muted">Save a day as a template from the ⋯ menu.</p>
        ) : (
          <ul className="space-y-1">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <LayoutTemplate size={15} className="shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
                <span className="text-xs text-muted">{t.blocks.length} blocks</span>
                <button className="btn-soft h-7 px-2.5 text-xs" onClick={() => onApplyTemplate(t.id)}>
                  Apply
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
