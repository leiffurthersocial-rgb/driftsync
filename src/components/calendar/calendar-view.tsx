"use client";

import { CalendarClock, Check, ChevronLeft, ChevronRight, Plus, Target } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Activity, Block, Goal, Todo } from "@/data/schema";
import { useApp } from "@/store/app-store";
import { toast } from "@/store/ui-store";
import { useNow } from "@/hooks/use-now";
import { blockColor } from "@/lib/activities";
import { addMonths, formatMonth, formatWeekRange, monthGrid, sameMonth, weekDays, weekdayLabels } from "@/lib/calendar";
import { parseQuickAdd } from "@/lib/quick-add";
import { addDays, formatDateLong, formatDuration, formatMinutes, formatRange, fromDateKey, layoutDay, minutesOfDay, relativeDayLabel, toDateKey } from "@/lib/time";
import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Checkbox } from "@/components/todos/todo-item";
import { Segmented } from "@/components/ui/controls";
import { cn } from "@/lib/cn";

type View = "month" | "week";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HOUR = 44;

interface DayIndex {
  blocks: Map<string, Block[]>;
  todos: Map<string, Todo[]>;
  goals: Map<string, Goal[]>;
}

function useDayIndex(): DayIndex {
  const blocks = useApp((s) => s.blocks);
  const todos = useApp((s) => s.todos);
  const goals = useApp((s) => s.goals);
  return useMemo(() => {
    const group = <T,>(items: T[], key: (t: T) => string | null) => {
      const m = new Map<string, T[]>();
      for (const it of items) {
        const k = key(it);
        if (k) m.set(k, [...(m.get(k) ?? []), it]);
      }
      return m;
    };
    const byStart = group(blocks, (b) => b.date);
    for (const list of byStart.values()) list.sort((a, b) => a.start - b.start);
    return {
      blocks: byStart,
      todos: group(todos, (t) => t.due),
      goals: group(
        goals.filter((g) => !g.archived),
        (g) => g.deadline,
      ),
    };
  }, [blocks, todos, goals]);
}

export function CalendarView() {
  const params = useSearchParams();
  const router = useRouter();
  const now = useNow(60_000);
  const today = toDateKey(now);
  const weekStart = useApp((s) => s.settings.weekStart);
  const activities = useApp((s) => s.activities);
  const byId = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);
  const index = useDayIndex();

  const [view, setView] = useState<View>(() => (params.get("view") === "week" ? "week" : "month"));
  const [date, setDate] = useState(() => {
    const d = params.get("date");
    return d && DATE_RE.test(d) ? d : today;
  });

  // Keep the URL shareable/back-button friendly without adding history entries per keypress.
  useEffect(() => {
    const qs = new URLSearchParams();
    if (view === "week") qs.set("view", "week");
    if (date !== today) qs.set("date", date);
    const next = qs.toString() ? `/calendar?${qs}` : "/calendar";
    if (next !== `${window.location.pathname}${window.location.search}`) router.replace(next, { scroll: false });
  }, [view, date, today, router]);

  const step = (dir: -1 | 1) => setDate((d) => (view === "month" ? addMonths(d, dir) : addDays(d, dir * 7)));
  const days = view === "week" ? weekDays(date, weekStart) : null;

  return (
    <PageContainer>
      <PageHeader
        title="Calendar"
        subtitle={<span aria-live="polite">{view === "month" ? formatMonth(date) : formatWeekRange(days!)}</span>}
        actions={
          <>
            <Segmented
              label="Calendar view"
              value={view}
              onChange={setView}
              options={[
                { value: "month", label: "Month" },
                { value: "week", label: "Week" },
              ]}
            />
            <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1">
              <button className="btn h-8 w-8 p-0 text-muted hover:bg-surface hover:text-ink" onClick={() => step(-1)} aria-label={view === "month" ? "Previous month" : "Previous week"}>
                <ChevronLeft size={16} />
              </button>
              <button className="btn h-8 px-3 text-sm hover:bg-surface" onClick={() => setDate(today)} disabled={date === today}>
                Today
              </button>
              <button className="btn h-8 w-8 p-0 text-muted hover:bg-surface hover:text-ink" onClick={() => step(1)} aria-label={view === "month" ? "Next month" : "Next week"}>
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        }
      />
      {view === "month" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <MonthGrid date={date} today={today} weekStart={weekStart} index={index} byId={byId} onSelect={setDate} />
          <DayPanel date={date} today={today} index={index} byId={byId} />
        </div>
      ) : (
        <WeekGrid days={days!} today={today} minute={minutesOfDay(now)} index={index} byId={byId} />
      )}
    </PageContainer>
  );
}

function MonthGrid({
  date,
  today,
  weekStart,
  index,
  byId,
  onSelect,
}: {
  date: string;
  today: string;
  weekStart: 0 | 1;
  index: DayIndex;
  byId: Map<string, Activity>;
  onSelect(d: string): void;
}) {
  const clock = useApp((s) => s.settings.clock);
  const router = useRouter();
  const cells = monthGrid(date, weekStart);
  const grid = useRef<HTMLDivElement>(null);
  const fromKeyboard = useRef(false);

  // Move focus with the selection, but only when the keyboard moved it.
  useEffect(() => {
    if (!fromKeyboard.current) return;
    fromKeyboard.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus();
  }, [date]);

  const onKey = (e: KeyboardEvent) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(date, -1),
      ArrowRight: () => addDays(date, 1),
      ArrowUp: () => addDays(date, -7),
      ArrowDown: () => addDays(date, 7),
      PageUp: () => addMonths(date, -1),
      PageDown: () => addMonths(date, 1),
      Home: () => weekDays(date, weekStart)[0],
      End: () => weekDays(date, weekStart)[6],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    fromKeyboard.current = true;
    onSelect(move());
  };

  return (
    <div className="card min-w-0 overflow-hidden p-2 sm:p-3">
      <div className="grid grid-cols-7 pb-1" aria-hidden>
        {weekdayLabels(weekStart).map((l) => (
          <div key={l} className="px-1 py-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted sm:text-left sm:px-2">
            {l}
          </div>
        ))}
      </div>
      <div ref={grid} role="group" aria-label={`${formatMonth(date)}. Arrow keys move between days, Page Up and Page Down change month.`} className="grid grid-cols-7 gap-1" onKeyDown={onKey}>
        {cells.map((d) => {
          const blocks = index.blocks.get(d) ?? [];
          const due = (index.todos.get(d) ?? []).filter((t) => !t.done);
          const goals = index.goals.get(d) ?? [];
          const inMonth = sameMonth(d, date);
          const selected = d === date;
          const isToday = d === today;
          const summary = [
            blocks.length && `${blocks.length} ${blocks.length === 1 ? "block" : "blocks"}`,
            due.length && `${due.length} to-do${due.length === 1 ? "" : "s"} due`,
            goals.length && `${goals.length} goal deadline${goals.length === 1 ? "" : "s"}`,
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <button
              key={d}
              data-date={d}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(d)}
              onDoubleClick={() => router.push(`/planner?date=${d}`)}
              aria-pressed={selected}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${formatDateLong(d)}${summary ? `: ${summary}` : ""}`}
              className={cn(
                "group flex min-h-[64px] min-w-0 flex-col items-stretch gap-1 rounded-xl border p-1 text-left transition sm:min-h-[104px] sm:p-1.5",
                selected ? "border-accent/60 bg-accent/10" : "border-transparent hover:bg-surface-2",
                !inMonth && !selected && "bg-surface-2/40",
              )}
            >
              <span className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-full text-xs font-medium tabular-nums",
                    isToday ? "bg-accent text-accent-ink" : d < today || !inMonth ? "text-muted" : "text-ink",
                  )}
                >
                  {fromDateKey(d).getDate()}
                </span>
                <span className="flex items-center gap-1">
                  {goals.length > 0 && <Target size={11} className="text-accent" aria-hidden />}
                  {due.length > 0 && (
                    <span className="rounded-full border border-peach/50 px-1.5 text-[10px] font-semibold leading-4 text-peach" aria-hidden>
                      {due.length}
                    </span>
                  )}
                </span>
              </span>
              {/* Chips on wider screens, dots on phones. */}
              <span className="hidden min-w-0 flex-col gap-0.5 sm:flex" aria-hidden>
                {blocks.slice(0, 3).map((b) => {
                  const act = byId.get(b.activityId ?? "");
                  const color = blockColor(b, act);
                  return (
                    <span key={b.id} className="flex min-w-0 items-center gap-1 rounded-md px-1 py-px text-[11px] leading-4" style={{ background: `${color}${b.done ? "12" : "22"}` }}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full border" style={{ borderColor: color, background: b.done ? "transparent" : color }} />
                      <span className="hidden shrink-0 tabular-nums text-muted 2xl:inline">{formatMinutes(b.start, clock)}</span>
                      <span className="truncate">{b.title || act?.name || "Untitled"}</span>
                    </span>
                  );
                })}
                {blocks.length > 3 && <span className="px-1 text-[11px] text-muted">+{blocks.length - 3} more</span>}
              </span>
              <span className="flex flex-wrap gap-0.5 px-0.5 sm:hidden" aria-hidden>
                {blocks.slice(0, 4).map((b) => (
                  <span key={b.id} className="h-1.5 w-1.5 rounded-full" style={{ background: blockColor(b, byId.get(b.activityId ?? "")) }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayPanel({ date, today, index, byId }: { date: string; today: string; index: DayIndex; byId: Map<string, Activity> }) {
  const clock = useApp((s) => s.settings.clock);
  const lists = useApp((s) => s.lists);
  const { updateBlock, toggleTodo } = useApp.getState();
  const [text, setText] = useState("");
  const blocks = index.blocks.get(date) ?? [];
  const todos = [...(index.todos.get(date) ?? [])].sort((a, b) => Number(a.done) - Number(b.done) || b.priority - a.priority);
  const goals = index.goals.get(date) ?? [];
  const planned = blocks.reduce((s, b) => s + b.end - b.start, 0);
  const rel = relativeDayLabel(date, today);

  const add = () => {
    const parsed = parseQuickAdd(text, lists, today);
    if (!parsed.title) return;
    useApp.getState().addTodo({ ...parsed, due: parsed.due ?? date });
    setText("");
    toast("To-do added", { tone: "success" });
  };

  return (
    <aside aria-label={`Details for ${formatDateLong(date)}`} className="card h-fit min-w-0 lg:sticky lg:top-24">
      <div className="px-5 pt-4">
        {rel && <p className="text-xs font-medium uppercase tracking-wide text-accent">{rel}</p>}
        <h2 className="font-semibold">{formatDateLong(date)}</h2>
        <p className="text-xs text-muted">{blocks.length ? `${blocks.length} ${blocks.length === 1 ? "block" : "blocks"} · ${formatDuration(planned)} planned` : "Nothing planned yet"}</p>
      </div>

      {blocks.length > 0 && (
        <ul className="mt-3 space-y-0.5 px-3">
          {blocks.map((b) => {
            const act = byId.get(b.activityId ?? "");
            const color = blockColor(b, act);
            const title = b.title || act?.name || "Untitled";
            return (
              <li key={b.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-surface-2/70">
                <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm font-medium", b.done && "text-muted line-through")}>{title}</span>
                  <span className="block text-[11px] tabular-nums text-muted">{formatRange(b, clock)}</span>
                </span>
                <Checkbox checked={b.done} onChange={() => updateBlock(b.id, { done: !b.done })} label={`Mark ${title} done`} color={color} />
              </li>
            );
          })}
        </ul>
      )}

      {goals.length > 0 && (
        <div className="mt-3 px-5">
          <p className="label">Goal deadlines</p>
          <ul className="space-y-1">
            {goals.map((g) => (
              <li key={g.id} className="flex items-center gap-2 text-sm">
                <Target size={14} style={{ color: g.color }} aria-hidden />
                <span className="truncate">{g.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 px-5 pb-4">
        <p className="label">To-dos due</p>
        {todos.length > 0 && (
          <ul className="mb-2 space-y-1">
            {todos.map((t) => (
              <li key={t.id} className="flex items-center gap-2.5 py-0.5">
                <Checkbox checked={t.done} onChange={() => toggleTodo(t.id)} label={`Mark ${t.title} ${t.done ? "not done" : "done"}`} />
                <span className={cn("min-w-0 flex-1 truncate text-sm", t.done && "text-muted line-through")}>{t.title}</span>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label htmlFor="cal-add" className="sr-only">
            Add a to-do due {formatDateLong(date)}
          </label>
          <input id="cal-add" className="input h-9 flex-1 py-1 text-sm" placeholder="Add a to-do for this day…" value={text} onChange={(e) => setText(e.target.value)} />
          <button type="submit" className="btn-soft h-9 w-9 shrink-0 p-0" aria-label="Add to-do" disabled={!text.trim()}>
            <Plus size={16} />
          </button>
        </form>
      </div>
      <div className="border-t border-line/60 p-3">
        <Link href={`/planner?date=${date}`} className="btn-soft w-full">
          <CalendarClock size={15} aria-hidden /> {blocks.length ? "Open in planner" : "Plan this day"}
        </Link>
      </div>
    </aside>
  );
}

function WeekGrid({ days, today, minute, index, byId }: { days: string[]; today: string; minute: number; index: DayIndex; byId: Map<string, Activity> }) {
  const settings = useApp((s) => s.settings);
  const startMin = settings.dayStartHour * 60;
  const endMin = settings.dayEndHour * 60;
  const hours = Array.from({ length: settings.dayEndHour - settings.dayStartHour }, (_, i) => settings.dayStartHour + i);
  const height = ((endMin - startMin) / 60) * HOUR;
  const y = (m: number) => ((Math.min(endMin, Math.max(startMin, m)) - startMin) / 60) * HOUR;

  return (
    <div className="card overflow-x-auto" tabIndex={0} aria-label={`Week of ${formatWeekRange(days)}`}>
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-line/60">
          <div />
          {days.map((d) => {
            const due = (index.todos.get(d) ?? []).filter((t) => !t.done).length;
            const goals = (index.goals.get(d) ?? []).length;
            const isToday = d === today;
            return (
              <Link
                key={d}
                href={`/planner?date=${d}`}
                className="flex flex-col items-center gap-0.5 rounded-none py-2.5 transition hover:bg-surface-2/70"
                aria-label={`Open ${formatDateLong(d)} in the planner${due ? `, ${due} to-dos due` : ""}${goals ? `, ${goals} goal deadlines` : ""}`}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{fromDateKey(d).toLocaleDateString(undefined, { weekday: "short" })}</span>
                <span className={cn("grid h-7 w-7 place-items-center rounded-full text-sm font-medium", isToday && "bg-accent text-accent-ink", d < today && "text-muted")}>
                  {fromDateKey(d).getDate()}
                </span>
                <span className="flex h-4 items-center gap-1" aria-hidden>
                  {goals > 0 && <Target size={11} className="text-accent" />}
                  {due > 0 && <span className="rounded-full border border-peach/50 px-1.5 text-[10px] font-semibold leading-4 text-peach">{due} due</span>}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="relative grid grid-cols-[52px_repeat(7,minmax(0,1fr))]" style={{ height }}>
          <div className="relative">
            {hours.map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted" style={{ top: y(h * 60) }}>
                {h === settings.dayStartHour ? "" : formatMinutes(h * 60, settings.clock)}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const blocks = (index.blocks.get(d) ?? []).filter((b) => b.end > startMin && b.start < endMin);
            const layout = layoutDay(blocks);
            return (
              <div key={d} className={cn("relative border-l border-line/50", d === today && "bg-accent/[0.04]")}>
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-line/40" style={{ top: y(h * 60) }} aria-hidden />
                ))}
                {blocks.map((b) => {
                  const act = byId.get(b.activityId ?? "");
                  const color = blockColor(b, act);
                  const slot = layout.get(b.id) ?? { col: 0, cols: 1 };
                  const top = y(b.start);
                  const h = Math.max(18, y(b.end) - top - 2);
                  const title = b.title || act?.name || "Untitled";
                  return (
                    <Link
                      key={b.id}
                      href={`/planner?date=${d}`}
                      className="absolute overflow-hidden rounded-lg border-l-[3px] px-1.5 py-0.5 text-[11px] leading-tight transition hover:brightness-95"
                      style={{
                        top: top + 1,
                        height: h,
                        left: `calc(${(slot.col / slot.cols) * 100}% + 2px)`,
                        width: `calc(${100 / slot.cols}% - 4px)`,
                        background: `${color}${b.done ? "16" : "2e"}`,
                        borderColor: color,
                      }}
                      aria-label={`${title}, ${formatRange(b, settings.clock)}, ${formatDateLong(d)}${b.done ? ", done" : ""}`}
                    >
                      <span className="flex items-center gap-1 font-medium">
                        {b.done && <Check size={11} strokeWidth={3} className="shrink-0" style={{ color }} aria-hidden />}
                        <span className="truncate">{title}</span>
                      </span>
                      {h > 30 && <span className="block truncate tabular-nums text-ink/75">{formatRange(b, settings.clock)}</span>}
                    </Link>
                  );
                })}
                {d === today && minute >= startMin && minute <= endMin && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: y(minute) }} aria-hidden>
                    <span className="-ml-1 h-2 w-2 rounded-full bg-peach" />
                    <span className="h-px flex-1 bg-peach" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
