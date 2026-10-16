"use client";

import { AlertTriangle, Check } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Activity, Block } from "@/data/schema";
import { blockColor } from "@/lib/activities";
import {
  DAY_MINUTES,
  formatMinutes,
  formatRange,
  layoutDay,
  moveRange,
  normalizeRange,
  resizeRange,
  snapDown,
  type Range,
} from "@/lib/time";
import { cn } from "@/lib/cn";

export const HOUR_PX = 64;
const PPM = HOUR_PX / 60;
const GUTTER = 56;
const DRAG_THRESHOLD = 4;
const LONG_PRESS_MS = 320;

export const TODO_DRAG_TYPE = "application/x-driftsync-todo";

interface Props {
  blocks: Block[];
  activities: Activity[];
  clock: "12h" | "24h";
  dayStartHour: number;
  dayEndHour: number;
  defaultLength: number;
  /** Minute of day for the now-line, or null when not viewing today. */
  nowMinute: number | null;
  selectedId: string | null;
  onSelect(id: string | null): void;
  onOpen(id: string): void;
  onCreate(range: Range): void;
  onChange(id: string, range: Range): void;
  onDropTodo(todoId: string, minute: number): void;
}

export interface TimelineHandle {
  scrollToMinute(minute: number): void;
  /** Snapped minute under a viewport point, or null when the point is outside the timeline. */
  minuteAtPoint(clientX: number, clientY: number): number | null;
  /** Show (or clear) the drop indicator, for pointer-driven to-do drags. */
  previewDrop(minute: number | null): void;
}

type Drag =
  | { kind: "create"; anchor: number; startY: number; pointerId: number; moved: boolean }
  | { kind: "move"; id: string; offset: number; orig: Range; startY: number; pointerId: number; moved: boolean; armed: boolean }
  | { kind: "resize"; id: string; edge: "start" | "end"; orig: Range; pointerId: number };

/** Vertical day timeline with drag-to-create, drag-to-move and edge-resize, all snapped to 15 min. */
export const Timeline = forwardRef<TimelineHandle, Props>(function Timeline(props, ref) {
  const { blocks, activities, clock, dayStartHour, dayEndHour, nowMinute, selectedId } = props;
  const scroller = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draft, setDraft] = useState<{ id: string | null; range: Range } | null>(null);
  const [dropMinute, setDropMinute] = useState<number | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  // Visible range: settings, expanded to fit any block outside it.
  const range = useMemo(() => {
    let start = dayStartHour * 60;
    let end = Math.max(start + 60, dayEndHour * 60);
    for (const b of blocks) {
      start = Math.min(start, Math.floor(b.start / 60) * 60);
      end = Math.max(end, Math.ceil(b.end / 60) * 60);
    }
    return { start, end: Math.min(DAY_MINUTES, end) };
  }, [blocks, dayStartHour, dayEndHour]);

  const layout = useMemo(() => {
    const items = blocks.map((b) => (draft?.id === b.id ? { ...b, ...draft.range } : b));
    return { items, slots: layoutDay(items) };
  }, [blocks, draft]);

  useImperativeHandle(ref, () => ({
    scrollToMinute(minute: number) {
      const el = scroller.current;
      if (!el) return;
      el.scrollTo({ top: Math.max(0, (minute - range.start) * PPM - el.clientHeight * 0.3), behavior: "smooth" });
    },
    minuteAtPoint(clientX: number, clientY: number) {
      const view = scroller.current?.getBoundingClientRect();
      if (!view || clientX < view.left || clientX > view.right || clientY < view.top || clientY > view.bottom) return null;
      return Math.min(Math.max(range.start, snapDown(minuteAt(clientY))), range.end - 15);
    },
    previewDrop(minute: number | null) {
      setDropMinute(minute);
    },
  }));

  // While a touch drag is active, stop the page from scrolling.
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      const d = drag.current;
      if (d && (d.kind !== "move" || d.armed)) e.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  const minuteAt = (clientY: number) => {
    const rect = surface.current!.getBoundingClientRect();
    return range.start + (clientY - rect.top) / PPM;
  };

  const clearLongPress = () => {
    if (longPress.current) clearTimeout(longPress.current);
    longPress.current = null;
  };

  const onSurfaceDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    props.onSelect(null);
    if (e.pointerType === "touch") {
      // Touch: a tap creates a block; dragging scrolls.
      drag.current = { kind: "create", anchor: snapDown(minuteAt(e.clientY)), startY: e.clientY, pointerId: e.pointerId, moved: false };
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const anchor = snapDown(minuteAt(e.clientY));
    drag.current = { kind: "create", anchor, startY: e.clientY, pointerId: e.pointerId, moved: false };
  };

  const onBlockDown = (e: React.PointerEvent, b: Block) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    props.onSelect(b.id);
    const target = e.currentTarget as HTMLElement;
    const m = minuteAt(e.clientY);
    const touch = e.pointerType === "touch";
    drag.current = { kind: "move", id: b.id, offset: m - b.start, orig: { start: b.start, end: b.end }, startY: e.clientY, pointerId: e.pointerId, moved: false, armed: !touch };
    if (!touch) target.setPointerCapture(e.pointerId);
    else {
      longPress.current = setTimeout(() => {
        const d = drag.current;
        if (d?.kind === "move") {
          d.armed = true;
          try {
            target.setPointerCapture(e.pointerId);
          } catch {
            /* pointer already gone */
          }
          navigator.vibrate?.(8);
          setDraft({ id: d.id, range: d.orig });
        }
      }, LONG_PRESS_MS);
    }
  };

  const onHandleDown = (e: React.PointerEvent, b: Block, edge: "start" | "end") => {
    if (e.button !== 0) return;
    e.stopPropagation();
    props.onSelect(b.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind: "resize", id: b.id, edge, orig: { start: b.start, end: b.end }, pointerId: e.pointerId };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const m = minuteAt(e.clientY);
    if (d.kind === "create") {
      if (e.pointerType === "touch") {
        if (Math.abs(e.clientY - d.startY) > DRAG_THRESHOLD) drag.current = null; // it's a scroll
        return;
      }
      if (!d.moved && Math.abs(e.clientY - d.startY) < DRAG_THRESHOLD) return;
      d.moved = true;
      setDraft({ id: null, range: normalizeRange(d.anchor, m, range.start, range.end) });
    } else if (d.kind === "move") {
      if (!d.armed) {
        if (Math.abs(e.clientY - d.startY) > DRAG_THRESHOLD) {
          clearLongPress();
          drag.current = null;
        }
        return;
      }
      if (!d.moved && Math.abs(e.clientY - d.startY) < DRAG_THRESHOLD) return;
      d.moved = true;
      setDraft({ id: d.id, range: moveRange(d.orig, m - d.offset - d.orig.start, range.start, range.end) });
    } else {
      setDraft({ id: d.id, range: resizeRange(d.orig, d.edge, m, range.start, range.end) });
    }
  };

  const onUp = (e: React.PointerEvent) => {
    clearLongPress();
    const d = drag.current;
    drag.current = null;
    if (!d || d.pointerId !== e.pointerId) return;
    const p = propsRef.current;
    if (d.kind === "create") {
      if (d.moved && draft) p.onCreate(draft.range);
      else if (!d.moved) {
        const start = Math.min(d.anchor, range.end - 15);
        p.onCreate(normalizeRange(start, start + p.defaultLength, range.start, range.end));
      }
    } else if (d.kind === "move") {
      if (d.moved && draft) p.onChange(d.id, draft.range);
      else if (!d.moved && !d.armed) p.onOpen(d.id);
      else if (!d.moved && e.pointerType === "touch") p.onOpen(d.id);
    } else if (draft) p.onChange(d.id, draft.range);
    setDraft(null);
  };

  const onCancel = () => {
    clearLongPress();
    drag.current = null;
    setDraft(null);
  };

  const onBlockKey = (e: React.KeyboardEvent, b: Block) => {
    const step = 15;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      props.onOpen(b.id);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const delta = e.key === "ArrowUp" ? -step : step;
      const r = e.shiftKey ? resizeRange(b, "end", b.end + delta, range.start, range.end) : moveRange(b, delta, range.start, range.end);
      props.onChange(b.id, r);
    }
  };

  const hours: number[] = [];
  for (let h = range.start; h < range.end; h += 60) hours.push(h);
  const activityOf = (id: string | null) => activities.find((a) => a.id === id);

  return (
    <div ref={scroller} className="relative h-full overflow-y-auto overscroll-contain" tabIndex={-1}>
      <div
        ref={surface}
        className="relative select-none"
        style={{ height: (range.end - range.start) * PPM + 16, touchAction: "pan-y" }}
        onPointerDown={onSurfaceDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(TODO_DRAG_TYPE)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDropMinute(snapDown(minuteAt(e.clientY)));
        }}
        onDragLeave={() => setDropMinute(null)}
        onDrop={(e) => {
          const id = e.dataTransfer.getData(TODO_DRAG_TYPE);
          setDropMinute(null);
          if (!id) return;
          e.preventDefault();
          props.onDropTodo(id, Math.min(snapDown(minuteAt(e.clientY)), range.end - 15));
        }}
        role="application"
        aria-label="Day timeline. Click or drag on empty space to add a block."
      >
        {hours.map((h) => (
          <div key={h} className="pointer-events-none absolute inset-x-0" style={{ top: (h - range.start) * PPM }}>
            <div className="absolute right-0 border-t border-line/70" style={{ left: GUTTER }} />
            <div className="absolute right-0 border-t border-dashed border-line/40" style={{ left: GUTTER, top: HOUR_PX / 2 }} />
            <span className="absolute -top-2 w-12 pr-2 text-right text-[11px] tabular-nums text-muted" style={{ left: 0 }}>
              {formatMinutes(h, clock)}
            </span>
          </div>
        ))}

        {/* Blocks */}
        {layout.items.map((b) => {
          const slot = layout.slots.get(b.id) ?? { col: 0, cols: 1, overlapping: false };
          const act = activityOf(b.activityId);
          const color = blockColor(b, act);
          const height = (b.end - b.start) * PPM;
          const short = height < 36;
          const selected = selectedId === b.id;
          const dragging = draft?.id === b.id;
          return (
            <div
              key={b.id}
              role="button"
              tabIndex={0}
              aria-label={`${b.title || act?.name || "Block"}, ${formatRange(b, clock)}${b.done ? ", done" : ""}${slot.overlapping ? ", overlaps another block" : ""}`}
              aria-pressed={selected}
              onPointerDown={(e) => onBlockDown(e, b)}
              onKeyDown={(e) => onBlockKey(e, b)}
              onFocus={() => props.onSelect(b.id)}
              className={cn(
                "group absolute overflow-hidden rounded-xl border text-left outline-none transition-shadow",
                dragging ? "z-20 cursor-grabbing shadow-float" : "cursor-grab hover:shadow-soft",
                selected && "z-10 ring-2 ring-offset-1 ring-offset-surface",
                b.done && "opacity-60",
              )}
              style={{
                top: (b.start - range.start) * PPM + 1,
                height: height - 2,
                left: `calc(${GUTTER}px + (100% - ${GUTTER + 8}px) * ${slot.col / slot.cols})`,
                width: `calc((100% - ${GUTTER + 8}px) / ${slot.cols} - 4px)`,
                background: `color-mix(in srgb, ${color} 18%, rgb(var(--surface)))`,
                borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
                ["--tw-ring-color" as string]: color,
                touchAction: "pan-y",
              }}
            >
              <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} aria-hidden />
              <div className={cn("flex h-full gap-1.5 pl-3 pr-2", short ? "items-center" : "flex-col pt-1.5")}>
                <div className="flex min-w-0 items-center gap-1.5">
                  {b.done && <Check size={13} className="shrink-0" style={{ color }} aria-hidden />}
                  <span className={cn("truncate text-[13px] font-medium leading-tight", b.done && "line-through")}>
                    {b.title || act?.name || "New block"}
                  </span>
                  {slot.overlapping && <AlertTriangle size={12} className="shrink-0 text-peach" aria-hidden />}
                </div>
                <span className="truncate text-[11px] leading-tight text-muted">
                  {formatRange(b, clock)}
                  {!short && act && b.title ? ` · ${act.name}` : ""}
                </span>
              </div>
              {/* Resize handles */}
              {(["start", "end"] as const).map((edge) => (
                <span
                  key={edge}
                  onPointerDown={(e) => onHandleDown(e, b, edge)}
                  className={cn(
                    "absolute inset-x-0 z-10 flex cursor-ns-resize justify-center",
                    edge === "start" ? "top-0" : "bottom-0",
                    "h-2.5 [@media(pointer:coarse)]:h-4",
                  )}
                  style={{ touchAction: "none" }}
                  aria-hidden
                >
                  <span
                    className={cn(
                      "mt-0.5 h-1 w-8 rounded-full opacity-0 transition group-hover:opacity-60",
                      selected && "opacity-80 [@media(pointer:coarse)]:opacity-90",
                      edge === "end" && "mt-auto mb-0.5",
                    )}
                    style={{ background: color }}
                  />
                </span>
              ))}
            </div>
          );
        })}

        {/* Create preview */}
        {draft && draft.id === null && (
          <div
            className="pointer-events-none absolute rounded-xl border-2 border-dashed border-accent bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
            style={{ top: (draft.range.start - range.start) * PPM, height: (draft.range.end - draft.range.start) * PPM, left: GUTTER, right: 8 }}
          >
            {formatRange(draft.range, clock)}
          </div>
        )}

        {/* To-do drop indicator */}
        {dropMinute !== null && (
          <div className="pointer-events-none absolute right-2 h-0.5 rounded-full bg-accent" style={{ top: (dropMinute - range.start) * PPM, left: GUTTER }}>
            <span className="absolute -top-2.5 left-2 rounded-md bg-accent px-1.5 text-[11px] text-accent-ink">{formatMinutes(dropMinute, clock)}</span>
          </div>
        )}

        {/* Now line */}
        {nowMinute !== null && nowMinute >= range.start && nowMinute <= range.end && (
          <div className="pointer-events-none absolute right-0 z-30" style={{ top: (nowMinute - range.start) * PPM, left: GUTTER - 6 }} aria-hidden>
            <div className="absolute -top-[5px] left-0 h-2.5 w-2.5 rounded-full bg-danger" />
            <div className="h-0.5 bg-danger/80" />
          </div>
        )}
      </div>
    </div>
  );
});
