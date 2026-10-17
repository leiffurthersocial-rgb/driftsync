"use client";

import { CalendarClock, GripVertical, Inbox, LayoutTemplate } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/store/app-store";
import { EmptyState } from "@/components/ui/controls";
import { formatDateShort } from "@/lib/time";
import { TODO_DRAG_TYPE } from "./timeline";
import { cn } from "@/lib/cn";

/** Open to-dos you can drag onto the timeline (or schedule with a button), plus templates. */
const LONG_PRESS_MS = 280;

export function PlannerSide({
  date,
  onSchedule,
  onApplyTemplate,
  onPointerDragMove,
  onPointerDragEnd,
}: {
  date: string;
  onSchedule(todoId: string): void;
  onApplyTemplate(id: string): void;
  /** Touch/pen drag: hovering a viewport point. */
  onPointerDragMove(x: number, y: number): void;
  /** Touch/pen drag: released at a viewport point. */
  onPointerDragEnd(todoId: string, x: number, y: number): void;
}) {
  // Touch and pen can't use HTML5 drag and drop, so long-press starts a pointer-driven drag.
  const [ghost, setGhost] = useState<{ id: string; title: string; x: number; y: number } | null>(null);
  const press = useRef<{ id: string; title: string; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [coarse, setCoarse] = useState(false);
  useEffect(() => setCoarse(window.matchMedia("(pointer: coarse)").matches), []);
  useEffect(() => {
    if (!ghost) return;
    const block = (e: TouchEvent) => e.preventDefault();
    document.addEventListener("touchmove", block, { passive: false });
    return () => document.removeEventListener("touchmove", block);
  }, [ghost]);

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
          <span className="hidden text-xs text-muted lg:inline">{coarse ? "Hold, then drag onto the timeline" : "Drag onto the timeline"}</span>
        </div>
        {open.length === 0 ? (
          <EmptyState icon={<Inbox size={20} />} title="All clear">
            Add to-dos from Today or the To-dos page, then time-block them here.
          </EmptyState>
        ) : (
          <ul className="-mx-1 max-h-[42vh] space-y-0.5 overflow-y-auto">
            {open.map((t) => (
              <li
                key={t.id}
                draggable={!coarse}
                onPointerDown={(e) => {
                  if (e.pointerType === "mouse" || (e.target as HTMLElement).closest("button")) return;
                  const target = e.currentTarget;
                  const { clientX: x, clientY: y, pointerId } = e;
                  press.current = {
                    id: t.id,
                    title: t.title,
                    x,
                    y,
                    timer: setTimeout(() => {
                      try {
                        target.setPointerCapture(pointerId);
                      } catch {
                        /* pointer gone */
                      }
                      navigator.vibrate?.(8);
                      setGhost({ id: t.id, title: t.title, x, y });
                    }, LONG_PRESS_MS),
                  };
                }}
                onPointerMove={(e) => {
                  const p = press.current;
                  if (!p) return;
                  if (!ghost) {
                    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) {
                      clearTimeout(p.timer);
                      press.current = null;
                    }
                    return;
                  }
                  setGhost({ ...ghost, x: e.clientX, y: e.clientY });
                  onPointerDragMove(e.clientX, e.clientY);
                }}
                onPointerUp={(e) => {
                  const p = press.current;
                  if (p) clearTimeout(p.timer);
                  press.current = null;
                  if (ghost) onPointerDragEnd(ghost.id, e.clientX, e.clientY);
                  setGhost(null);
                }}
                onPointerCancel={() => {
                  if (press.current) clearTimeout(press.current.timer);
                  press.current = null;
                  if (ghost) onPointerDragMove(-1, -1);
                  setGhost(null);
                }}
                onContextMenu={(e) => coarse && e.preventDefault()}
                style={{ touchAction: ghost?.id === t.id ? "none" : "pan-y", WebkitUserSelect: "none" }}
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
      {ghost &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[70] max-w-[220px] -translate-x-1/2 -translate-y-[130%] truncate rounded-xl border border-accent/40 bg-surface px-3 py-2 text-sm font-medium shadow-float"
            style={{ left: ghost.x, top: ghost.y }}
            aria-hidden
          >
            {ghost.title}
          </div>,
          document.body,
        )}
    </div>
  );
}
