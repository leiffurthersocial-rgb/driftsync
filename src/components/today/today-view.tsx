"use client";

import { ArrowRight, CalendarClock, CalendarDays, CheckSquare, Coffee, Plus, Target } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { Activity, Block } from "@/data/schema";
import { useApp } from "@/store/app-store";
import { toast } from "@/store/ui-store";
import { useNow } from "@/hooks/use-now";
import { useCurrentBlocks } from "@/hooks/use-day-blocks";
import { blockColor } from "@/lib/activities";
import { greeting, weekDays } from "@/lib/calendar";
import { goalProgress } from "@/lib/goals";
import { parseQuickAdd } from "@/lib/quick-add";
import { formatDateLong, formatDateShort, formatDuration, formatMinutes, formatRange, fromDateKey } from "@/lib/time";
import { PageContainer } from "@/components/shell/page-header";
import { Checkbox } from "@/components/todos/todo-item";
import { ProgressBar, ProgressRing } from "@/components/ui/progress-ring";
import { cn } from "@/lib/cn";

/** Home: what's happening now, today's plan, what's due, goals and the week at a glance. */
export function TodayView() {
  const now = useNow(30_000);
  const name = useApp((s) => s.profile.name);
  const { today, minute, todays, active, next } = useCurrentBlocks(now);
  const activities = useApp((s) => s.activities);
  const byId = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);

  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{formatDateLong(today)}</p>
          <h1 className="font-pixel text-3xl tracking-wide sm:text-4xl">
            {greeting(now.getHours())}
            {name ? `, ${name}` : ""}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/calendar" className="btn-soft">
            <CalendarDays size={16} aria-hidden /> Calendar
          </Link>
          <Link href="/planner" className="btn-primary">
            <CalendarClock size={16} aria-hidden /> Plan tomorrow
          </Link>
        </div>
      </div>

      {/* Two columns on desktop; on phones the columns dissolve so to-dos come right after the plan. */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start">
        <div className="contents lg:block lg:min-w-0 lg:space-y-5">
          <NowCard active={active} next={next} minute={minute} byId={byId} />
          <AgendaCard blocks={todays} minute={minute} byId={byId} />
          <WeekCard today={today} byId={byId} className="order-last lg:order-none" />
        </div>
        <div className="contents lg:block lg:min-w-0 lg:space-y-5">
          <TodosCard today={today} />
          <GoalsCard today={today} />
        </div>
      </div>
    </PageContainer>
  );
}

function Card({ title, icon, action, children, className }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  const id = `card-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={cn("card overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <h2 id={id} className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-muted" aria-hidden>
            {icon}
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const CardLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="inline-flex items-center gap-1 rounded-lg text-xs font-medium text-accent hover:underline">
    {children} <ArrowRight size={12} aria-hidden />
  </Link>
);

function NowCard({ active, next, minute, byId }: { active: Block | null; next: Block | null; minute: number; byId: Map<string, Activity> }) {
  const clock = useApp((s) => s.settings.clock);
  if (!active) {
    return (
      <section aria-label="Right now" className="card flex items-center gap-4 px-5 py-5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-muted">
          <Coffee size={22} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Right now</p>
          <p className="text-lg font-semibold">Free time</p>
          <p className="truncate text-sm text-muted">
            {next ? (
              <>
                Next: <span className="text-ink">{next.title || byId.get(next.activityId ?? "")?.name || "Untitled"}</span> at{" "}
                {formatMinutes(next.start, clock)} · in {formatDuration(next.start - minute)}
              </>
            ) : (
              "Nothing else planned today."
            )}
          </p>
        </div>
      </section>
    );
  }
  const act = byId.get(active.activityId ?? "");
  const color = blockColor(active, act);
  const ratio = (minute - active.start) / (active.end - active.start);
  return (
    <section aria-label="Right now" className="card relative overflow-hidden px-5 py-5">
      <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} aria-hidden />
      <div className="absolute inset-0 opacity-[0.07]" style={{ background: color }} aria-hidden />
      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Right now</p>
        <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-4">
          <p className="text-xl font-semibold">{active.title || act?.name || "Untitled"}</p>
          <p className="text-sm tabular-nums text-muted">{formatRange(active, clock)}</p>
        </div>
        {act && active.title && act.name !== active.title && <p className="text-sm text-muted">{act.name}</p>}
        <div className="mt-3">
          <ProgressBar ratio={ratio} color={color} label="Time elapsed in the current block" />
        </div>
        <p className="mt-2 text-xs text-muted">
          {formatDuration(active.end - minute)} left
          {next && (
            <>
              {" "}
              · then {next.title || byId.get(next.activityId ?? "")?.name || "Untitled"} at {formatMinutes(next.start, clock)}
            </>
          )}
        </p>
      </div>
    </section>
  );
}

function AgendaCard({ blocks, minute, byId }: { blocks: Block[]; minute: number; byId: Map<string, Activity> }) {
  const clock = useApp((s) => s.settings.clock);
  const updateBlock = useApp((s) => s.updateBlock);
  const planned = blocks.reduce((sum, b) => sum + b.end - b.start, 0);
  return (
    <Card
      title="Today’s plan"
      icon={<CalendarClock size={15} />}
      action={<CardLink href="/planner?day=today">{blocks.length ? "Edit" : "Plan today"}</CardLink>}
    >
      {blocks.length === 0 ? (
        <div className="px-5 pb-5 pt-1">
          <p className="text-sm text-muted">Nothing planned for today. Block out some time, or apply a template in the planner.</p>
        </div>
      ) : (
        <>
          <p className="px-5 text-xs text-muted">
            {blocks.length} {blocks.length === 1 ? "block" : "blocks"} · {formatDuration(planned)} planned
          </p>
          <ul className="mt-2 pb-2">
            {blocks.map((b) => {
              const act = byId.get(b.activityId ?? "");
              const color = blockColor(b, act);
              const current = b.start <= minute && minute < b.end;
              const past = b.end <= minute;
              const title = b.title || act?.name || "Untitled";
              return (
                <li key={b.id} className={cn("flex items-center gap-3 px-5 py-2", current && "bg-surface-2/70")}>
                  <span className="w-[92px] shrink-0 text-xs tabular-nums text-muted">{formatRange(b, clock)}</span>
                  <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                  <span className={cn("min-w-0 flex-1", past && !current && "opacity-60")}>
                    <span className={cn("block truncate text-sm font-medium", b.done && "text-muted line-through")}>{title}</span>
                    {act && b.title && act.name !== b.title && <span className="block truncate text-xs text-muted">{act.name}</span>}
                  </span>
                  {current && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">Now</span>}
                  <Checkbox checked={b.done} onChange={() => updateBlock(b.id, { done: !b.done })} label={`Mark ${title} done`} color={color} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

function WeekCard({ today, byId, className }: { today: string; byId: Map<string, Activity>; className?: string }) {
  const weekStart = useApp((s) => s.settings.weekStart);
  const blocks = useApp((s) => s.blocks);
  const todos = useApp((s) => s.todos);
  const days = weekDays(today, weekStart);
  const perDay = days.map((d) => {
    const bs = blocks.filter((b) => b.date === d).sort((a, b) => a.start - b.start);
    return { date: d, blocks: bs, minutes: bs.reduce((s, b) => s + b.end - b.start, 0), due: todos.filter((t) => !t.done && t.due === d).length };
  });
  const max = Math.max(240, ...perDay.map((d) => d.minutes));
  return (
    <Card title="This week" icon={<CalendarDays size={15} />} action={<CardLink href="/calendar?view=week">Open week</CardLink>} className={className}>
      <ul className="grid grid-cols-7 gap-1.5 px-4 pb-4 pt-1">
        {perDay.map((d) => {
          const isToday = d.date === today;
          const label = fromDateKey(d.date).toLocaleDateString(undefined, { weekday: "short" });
          return (
            <li key={d.date}>
              <Link
                href={`/planner?date=${d.date}`}
                className={cn("flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition hover:bg-surface-2", isToday && "bg-accent/10")}
                aria-label={`${formatDateLong(d.date)}: ${d.blocks.length} blocks, ${formatDuration(d.minutes)} planned${d.due ? `, ${d.due} to-dos due` : ""}`}
              >
                <span className="text-[11px] text-muted">{label}</span>
                <span className={cn("grid h-7 w-7 place-items-center rounded-full text-sm font-medium", isToday && "bg-accent text-accent-ink", d.date < today && "text-muted")}>
                  {fromDateKey(d.date).getDate()}
                </span>
                <span className="flex h-14 w-3 flex-col-reverse overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  {d.blocks.map((b) => (
                    <span key={b.id} style={{ height: `${((b.end - b.start) / max) * 100}%`, background: blockColor(b, byId.get(b.activityId ?? "")) }} />
                  ))}
                </span>
                <span className="h-1.5" aria-hidden>
                  {d.due > 0 && <span className="block h-1.5 w-1.5 rounded-full bg-peach" />}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function TodosCard({ today }: { today: string }) {
  const todos = useApp((s) => s.todos);
  const lists = useApp((s) => s.lists);
  const toggleTodo = useApp((s) => s.toggleTodo);
  const [text, setText] = useState("");

  const open = todos.filter((t) => !t.done);
  const overdue = open.filter((t) => t.due && t.due < today).sort((a, b) => a.due!.localeCompare(b.due!));
  const dueToday = open.filter((t) => t.due === today).sort((a, b) => b.priority - a.priority || a.order - b.order);
  // Completed today stay visible (struck through) so ticking one off doesn't make it vanish.
  const doneToday = todos.filter((t) => t.done && t.due === today);
  const upNext = overdue.length + dueToday.length === 0 ? open.filter((t) => !t.due).sort((a, b) => a.order - b.order).slice(0, 4) : [];
  const shown = [...overdue, ...dueToday, ...upNext, ...doneToday];

  const add = () => {
    const parsed = parseQuickAdd(text, lists, today);
    if (!parsed.title) return;
    useApp.getState().addTodo({ ...parsed, due: parsed.due ?? today });
    setText("");
    toast("Added for today", { tone: "success" });
  };

  return (
    <Card title="To-dos" icon={<CheckSquare size={15} />} action={<CardLink href="/todos">All to-dos</CardLink>}>
      <form
        className="flex items-center gap-2 px-5 pb-2 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label htmlFor="today-add" className="sr-only">
          Add a to-do for today
        </label>
        <input id="today-add" className="input h-9 flex-1 py-1 text-sm" placeholder="Add for today…  try “call mum !1”" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn-soft h-9 w-9 shrink-0 p-0" aria-label="Add to-do" disabled={!text.trim()}>
          <Plus size={16} />
        </button>
      </form>
      {shown.length === 0 ? (
        <p className="px-5 pb-5 pt-1 text-sm text-muted">Nothing due today.</p>
      ) : (
        <>
          {upNext.length > 0 && <p className="px-5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Nothing due · up next</p>}
          <ul className="pb-3 pt-1">
            {shown.map((t) => {
              const late = !t.done && t.due && t.due < today;
              return (
                <li key={t.id} className="flex items-center gap-3 px-5 py-1.5">
                  <Checkbox checked={t.done} onChange={() => toggleTodo(t.id)} label={`Mark ${t.title} ${t.done ? "not done" : "done"}`} />
                  <span className={cn("min-w-0 flex-1 truncate text-sm", t.done && "text-muted line-through")}>{t.title}</span>
                  {late && <span className="shrink-0 text-[11px] text-peach">{formatDateShort(t.due!)}</span>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

function GoalsCard({ today }: { today: string }) {
  const goals = useApp((s) => s.goals);
  const todos = useApp((s) => s.todos);
  const blocks = useApp((s) => s.blocks);
  const weekStart = useApp((s) => s.settings.weekStart);
  const active = goals.filter((g) => !g.archived).sort((a, b) => a.order - b.order).slice(0, 4);
  return (
    <Card title="Goals" icon={<Target size={15} />} action={<CardLink href="/todos#goals">{active.length ? "All goals" : "Add a goal"}</CardLink>}>
      {active.length === 0 ? (
        <p className="px-5 pb-5 pt-1 text-sm text-muted">No goals yet. Set one up and link to-dos or a weekly rhythm to it.</p>
      ) : (
        <ul className="pb-3 pt-1">
          {active.map((g) => {
            const p = goalProgress(g, { todos, blocks, today, weekStart });
            return (
              <li key={g.id} className="flex items-center gap-3 px-5 py-2">
                <ProgressRing ratio={p.ratio} color={g.color} size={36} stroke={4} label={`${g.title}: ${p.label}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{g.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {p.label}
                    {g.deadline && ` · by ${formatDateShort(g.deadline)}`}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
