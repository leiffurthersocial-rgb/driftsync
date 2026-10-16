"use client";

import { motion } from "framer-motion";
import { CalendarPlus, Check, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useApp } from "@/store/app-store";
import { toast, useUi } from "@/store/ui-store";
import { useCurrentBlocks } from "@/hooks/use-day-blocks";
import { formatDuration, formatMinutes, formatRange } from "@/lib/time";
import { blockColor } from "@/lib/activities";
import { parseQuickAdd } from "@/lib/quick-add";
import { areaAccent } from "@/island/sprites/buildings";
import { cn } from "@/lib/cn";

export function IslandTitle({ now }: { now: Date }) {
  const name = useApp((s) => s.island.name);
  const clock = useApp((s) => s.settings.clock);
  const minutes = now.getHours() * 60 + now.getMinutes();
  return (
    <div className="pointer-events-none absolute left-4 top-[4.5rem] [text-shadow:0_1px_8px_rgb(var(--bg)/0.9)] sm:left-6 sm:top-20">
      <h1 className="font-pixel text-2xl tracking-wide text-ink drop-shadow-[0_1px_0_rgb(var(--surface)/0.6)] sm:text-3xl">{name}</h1>
      <p className="text-sm text-ink/70">
        {now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} · {formatMinutes(minutes, clock)}
      </p>
    </div>
  );
}

export function NowCard({ now, compact }: { now: Date; compact?: boolean }) {
  const { active, next, minute } = useCurrentBlocks(now);
  const activities = useApp((s) => s.activities);
  const clock = useApp((s) => s.settings.clock);
  const act = (id: string | null) => activities.find((a) => a.id === id) ?? null;

  if (compact) {
    const b = active ?? next;
    const color = b ? blockColor(b, act(b.activityId)) : "rgb(var(--muted))";
    return (
      <Link
        href="/planner?day=today"
        aria-label="Open today's plan"
        className="card relative flex items-center gap-3 overflow-hidden bg-surface/85 px-4 py-3 backdrop-blur-md"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">{active ? "Now" : next ? "Next" : "Now"}</span>
          <span className="block truncate text-sm font-medium">
            {b ? b.title || act(b.activityId)?.name || "Planned time" : "Nothing planned — drift a little"}
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted">
          {active ? `${formatDuration(active.end - minute)} left` : next ? formatMinutes(next.start, clock) : "Plan →"}
        </span>
        {active && (
          <span
            className="absolute bottom-0 left-0 h-0.5"
            style={{ width: `${((minute - active.start) / (active.end - active.start)) * 100}%`, background: color }}
            aria-hidden
          />
        )}
      </Link>
    );
  }

  return (
    <motion.section
      aria-label="Current plan"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="card w-full bg-surface/85 p-4 backdrop-blur-md sm:w-72"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Now</span>
        <Link href="/planner?day=today" className="text-xs text-muted hover:text-ink">
          Today’s plan →
        </Link>
      </div>
      {active ? (
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: blockColor(active, act(active.activityId)) }} />
            <p className="truncate font-medium">{active.title || act(active.activityId)?.name || "Planned time"}</p>
            {active.done && <Check size={14} className="text-sage" aria-label="Done" />}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {formatRange(active, clock)} · {formatDuration(active.end - minute)} left
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(((minute - active.start) / (active.end - active.start)) * 100)} aria-label="Time block progress">
            <div
              className="h-full rounded-full transition-[width] duration-1000"
              style={{
                width: `${((minute - active.start) / (active.end - active.start)) * 100}%`,
                background: blockColor(active, act(active.activityId)),
              }}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink/70">Nothing planned right now. A good moment to drift.</p>
      )}
      <div className="mt-3 border-t border-line/60 pt-3 text-sm">
        {next ? (
          <p className="flex items-center gap-2 text-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Next</span>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: blockColor(next, act(next.activityId)) }} />
            <span className="truncate text-ink">{next.title || act(next.activityId)?.name}</span>
            <span className="ml-auto shrink-0 text-xs">{formatMinutes(next.start, clock)}</span>
          </p>
        ) : (
          <Link href="/planner" className="flex items-center gap-2 text-muted hover:text-ink">
            <CalendarPlus size={15} /> Plan tomorrow
          </Link>
        )}
      </div>
    </motion.section>
  );
}

export function QuickAddTodo() {
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const submit = () => {
    const parsed = parseQuickAdd(value, useApp.getState().lists);
    if (!parsed.title) return;
    useApp.getState().addTodo(parsed);
    setValue("");
    toast("Added to your to-dos", { tone: "success" });
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="card flex w-full items-center gap-2 bg-surface/85 py-1.5 pl-4 pr-1.5 backdrop-blur-md"
    >
      <label htmlFor="island-quick-add" className="sr-only">
        Quick add a to-do
      </label>
      <Plus size={16} className="shrink-0 text-muted" aria-hidden />
      <input
        id="island-quick-add"
        ref={input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a to-do…  try “stretch @tomorrow !2”"
        className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
        autoComplete="off"
      />
      <button type="submit" className="btn-primary h-9 px-3" disabled={!value.trim()}>
        Add
      </button>
    </form>
  );
}

export function AreaDock({ vertical }: { vertical?: boolean }) {
  const areas = useApp((s) => s.areas);
  const selectArea = useUi((s) => s.selectArea);
  const selected = useUi((s) => s.selectedAreaId);
  const openAdd = useUi((s) => s.setAddAreaOpen);
  return (
    <nav aria-label="Island areas" className={cn(vertical ? "card w-56 bg-surface/85 p-2 backdrop-blur-md" : "w-full")}>
      {vertical && <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Areas</p>}
      <ul className={cn(vertical ? "flex flex-col" : "flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]")}>
        {areas.map((a) => (
          <li key={a.id} className="shrink-0">
            <button
              onClick={() => selectArea(a.id)}
              aria-pressed={selected === a.id}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sm transition",
                vertical ? "hover:bg-surface-2" : "card bg-surface/85 backdrop-blur-md",
                selected === a.id && "bg-surface-2",
              )}
            >
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: areaAccent(a.type, a.variant, a.color) }} />
              <span className="truncate">{a.name}</span>
            </button>
          </li>
        ))}
        <li className="shrink-0">
          <button
            onClick={() => openAdd(true)}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm text-accent transition hover:bg-accent/10",
              !vertical && "card bg-surface/85 backdrop-blur-md",
            )}
          >
            {areas.length ? <Plus size={15} /> : <Sparkles size={15} />} Add area
          </button>
        </li>
      </ul>
    </nav>
  );
}
