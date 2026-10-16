"use client";

import { ChevronLeft, ChevronRight, ClipboardCopy, Eraser, Keyboard, LayoutTemplate, MoreHorizontal, Plus, Save } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/store/app-store";
import { toast } from "@/store/ui-store";
import { useNow } from "@/hooks/use-now";
import { addDays, findFreeSlot, formatDateLong, formatDuration, minutesOfDay, relativeDayLabel, toDateKey, type Range } from "@/lib/time";
import { blockColor } from "@/lib/activities";
import { PageContainer } from "@/components/shell/page-header";
import { Menu } from "@/components/ui/menu";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/controls";
import { Timeline, type TimelineHandle } from "./timeline";
import { BlockEditor } from "./block-editor";
import { PlannerSide } from "./planner-side";

const SHORTCUTS: [string, string][] = [
  ["N", "New block in the next free slot"],
  ["T / M", "Jump to today / tomorrow"],
  ["← / →", "Previous / next day"],
  ["↑ / ↓", "Move selected block 15 min"],
  ["Shift + ↑ / ↓", "Shorten / lengthen selected block"],
  ["Enter", "Edit selected block"],
  ["D", "Toggle done on selected block"],
  ["Delete", "Remove selected block"],
  ["⌘/Ctrl + K", "Command palette"],
];

const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
};

export function PlannerView() {
  const params = useSearchParams();
  const router = useRouter();
  const now = useNow(30_000);
  const today = toDateKey(now);
  const initial = useMemo(() => {
    const d = params.get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return params.get("day") === "today" ? today : addDays(today, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [date, setDate] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; isNew: boolean } | null>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [copyFromOpen, setCopyFromOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const timeline = useRef<TimelineHandle>(null);

  const allBlocks = useApp((s) => s.blocks);
  const activities = useApp((s) => s.activities);
  const templates = useApp((s) => s.templates);
  const settings = useApp((s) => s.settings);
  const blocks = useMemo(() => allBlocks.filter((b) => b.date === date).sort((a, b) => a.start - b.start), [allBlocks, date]);
  const isToday = date === today;
  const nowMinute = isToday ? minutesOfDay(now) : null;

  // Keep the URL in sync (shareable/bookmarkable day) without adding history entries.
  useEffect(() => {
    router.replace(date === addDays(today, 1) ? "/planner" : `/planner?date=${date}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Scroll to "now" on today, else the first block, else the morning.
  useEffect(() => {
    const target = isToday ? minutesOfDay(new Date()) : (blocks[0]?.start ?? Math.max(settings.dayStartHour * 60, 8 * 60));
    const t = setTimeout(() => timeline.current?.scrollToMinute(target), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const create = useCallback(
    (range: Range, extra: Partial<{ title: string; todoId: string | null }> = {}) => {
      const b = useApp.getState().addBlock({
        date,
        start: range.start,
        end: range.end,
        title: extra.title ?? "",
        activityId: null,
        color: null,
        notes: "",
        todoId: extra.todoId ?? null,
        goalId: null,
        done: false,
      });
      setSelectedId(b.id);
      return b;
    },
    [date],
  );

  const nextFreeStart = useCallback(
    (length: number) => {
      const from = isToday ? Math.ceil(minutesOfDay(new Date()) / 15) * 15 : settings.dayStartHour * 60;
      return findFreeSlot(blocks, from, length, settings.dayEndHour * 60) ?? findFreeSlot(blocks, 0, length, 1440);
    },
    [blocks, isToday, settings.dayStartHour, settings.dayEndHour],
  );

  const newBlock = useCallback(() => {
    const len = settings.defaultBlockMinutes;
    const start = nextFreeStart(len);
    if (start === null) return toast("No free time left on this day", { tone: "danger" });
    const b = create({ start, end: start + len });
    setEditing({ id: b.id, isNew: true });
    timeline.current?.scrollToMinute(start);
  }, [create, nextFreeStart, settings.defaultBlockMinutes]);

  const scheduleTodo = (todoId: string, minute?: number) => {
    const todo = useApp.getState().todos.find((t) => t.id === todoId);
    if (!todo) return;
    const len = settings.defaultBlockMinutes;
    const start = minute ?? nextFreeStart(len);
    if (start === null) return toast("No free time left on this day", { tone: "danger" });
    create({ start, end: Math.min(1440, start + len) }, { title: todo.title, todoId });
    timeline.current?.scrollToMinute(start);
    toast(`Scheduled “${todo.title}”`, { tone: "success" });
  };

  const copyFrom = (from: string) => {
    const n = useApp.getState().copyDay(from, date);
    toast(n ? `Copied ${n} block${n === 1 ? "" : "s"}` : "Nothing to copy from that day", { tone: n ? "success" : "default" });
  };

  const applyTemplate = (id: string) => {
    const n = useApp.getState().applyTemplate(id, date);
    toast(`Added ${n} block${n === 1 ? "" : "s"} from template`, { tone: "success" });
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey || editing || document.querySelector("[role=dialog]")) return;
      const sel = selectedId ? useApp.getState().blocks.find((b) => b.id === selectedId) : null;
      switch (e.key) {
        case "n":
        case "N":
          e.preventDefault();
          newBlock();
          break;
        case "t":
        case "T":
          setDate(today);
          break;
        case "m":
        case "M":
          setDate(addDays(today, 1));
          break;
        case "ArrowLeft":
          setDate((d) => addDays(d, -1));
          break;
        case "ArrowRight":
          setDate((d) => addDays(d, 1));
          break;
        case "?":
          setHelpOpen(true);
          break;
        case "d":
        case "D":
          if (sel) useApp.getState().updateBlock(sel.id, { done: !sel.done });
          break;
        case "Delete":
        case "Backspace":
          if (sel) {
            useApp.getState().removeBlock(sel.id);
            setSelectedId(null);
            toast("Block removed");
          }
          break;
        case "Escape":
          setSelectedId(null);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [today, selectedId, editing, newBlock]);

  const rel = relativeDayLabel(date, today);
  const totals = useMemo(() => {
    const m = new Map<string, { name: string; color: string; minutes: number }>();
    for (const b of blocks) {
      const a = activities.find((x) => x.id === b.activityId);
      const key = a?.id ?? "none";
      const cur = m.get(key) ?? { name: a?.name ?? "Unsorted", color: blockColor(b, a), minutes: 0 };
      cur.minutes += b.end - b.start;
      m.set(key, cur);
    }
    return [...m.values()].sort((a, b) => b.minutes - a.minutes);
  }, [blocks, activities]);

  return (
    <PageContainer>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-pixel text-3xl tracking-wide sm:text-4xl">{rel ?? formatDateLong(date).split(",")[0]}</h1>
          <p className="mt-1 text-sm text-muted">{formatDateLong(date)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl bg-surface-2 p-1">
            <button className="btn-ghost h-8 w-8 p-0" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
              <ChevronLeft size={16} />
            </button>
            <label className="sr-only" htmlFor="planner-date">
              Pick a date
            </label>
            <input
              id="planner-date"
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-8 rounded-lg bg-transparent px-2 text-sm text-ink outline-none [color-scheme:inherit]"
            />
            <button className="btn-ghost h-8 w-8 p-0" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
              <ChevronRight size={16} />
            </button>
          </div>
          <Segmented
            label="Quick day"
            value={date === today ? "today" : date === addDays(today, 1) ? "tomorrow" : "other"}
            onChange={(v) => v !== "other" && setDate(v === "today" ? today : addDays(today, 1))}
            options={[
              { value: "today", label: "Today" },
              { value: "tomorrow", label: "Tomorrow" },
            ]}
          />
          <Menu
            label="Day actions"
            trigger={
              <button className="btn-soft h-10 w-10 p-0" aria-label="More day actions">
                <MoreHorizontal size={18} />
              </button>
            }
            items={[
              { label: "Copy previous day", icon: <ClipboardCopy size={15} />, onSelect: () => copyFrom(addDays(date, -1)) },
              { label: "Copy from a date…", icon: <ClipboardCopy size={15} />, onSelect: () => setCopyFromOpen(true) },
              ...(templates.length ? [{ heading: "Apply template" } as const] : []),
              ...templates.map((t) => ({ label: t.name, icon: <LayoutTemplate size={15} />, onSelect: () => applyTemplate(t.id) })),
              "divider",
              { label: "Save day as template…", icon: <Save size={15} />, onSelect: () => setSaveTemplateOpen(true), disabled: !blocks.length },
              { label: "Keyboard shortcuts", icon: <Keyboard size={15} />, onSelect: () => setHelpOpen(true), hint: "?" },
              "divider",
              { label: "Clear this day", icon: <Eraser size={15} />, onSelect: () => setClearOpen(true), danger: true, disabled: !blocks.length },
            ]}
          />
          <button className="btn-primary h-10" onClick={newBlock}>
            <Plus size={16} /> Block <kbd className="kbd hidden border-white/30 bg-white/15 text-white/80 sm:inline">N</kbd>
          </button>
        </div>
      </div>

      {totals.length > 0 && (
        <ul className="mb-4 hidden flex-wrap gap-2 sm:flex" aria-label="Time planned by activity">
          {totals.map((t) => (
            <li key={t.name} className="chip bg-surface text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
              <span className="text-ink">{t.name}</span> {formatDuration(t.minutes)}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="card relative h-[calc(100dvh-17rem)] min-h-[420px] overflow-hidden p-2 md:h-[calc(100dvh-15rem)]">
          <Timeline
            ref={timeline}
            blocks={blocks}
            activities={activities}
            clock={settings.clock}
            dayStartHour={settings.dayStartHour}
            dayEndHour={settings.dayEndHour}
            defaultLength={settings.defaultBlockMinutes}
            nowMinute={nowMinute}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpen={(id) => setEditing({ id, isNew: false })}
            onCreate={(r) => {
              const b = create(r);
              setEditing({ id: b.id, isNew: true });
            }}
            onChange={(id, r) => useApp.getState().updateBlock(id, r)}
            onDropTodo={(id, minute) => scheduleTodo(id, minute)}
          />
          {blocks.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center px-6">
              <div className="rounded-2xl bg-surface/90 px-5 py-4 text-center shadow-soft backdrop-blur">
                <p className="font-medium">An open day</p>
                <p className="mt-1 text-sm text-muted">Drag on the timeline to add a block, press N, or apply a template from ⋯</p>
              </div>
            </div>
          )}
        </div>
        <PlannerSide date={date} onSchedule={(id) => scheduleTodo(id)} onApplyTemplate={applyTemplate} />
      </div>

      <BlockEditor blockId={editing?.id ?? null} isNew={!!editing?.isNew} onClose={() => setEditing(null)} />

      <SaveTemplateDialog open={saveTemplateOpen} onClose={() => setSaveTemplateOpen(false)} date={date} />
      <CopyFromDialog open={copyFromOpen} onClose={() => setCopyFromOpen(false)} date={date} onCopy={copyFrom} />
      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Clear this day?"
        description={`Removes all ${blocks.length} blocks on ${formatDateLong(date)}.`}
        confirmLabel="Clear day"
        onConfirm={() => {
          for (const b of blocks) useApp.getState().removeBlock(b.id);
          toast("Day cleared");
        }}
      />
      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} title="Keyboard shortcuts">
        <dl className="divide-y divide-line/60">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-2 text-sm">
              <dt className="text-muted">{v}</dt>
              <dd>
                <kbd className="kbd">{k}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </Dialog>
    </PageContainer>
  );
}

function SaveTemplateDialog({ open, onClose, date }: { open: boolean; onClose(): void; date: string }) {
  const [name, setName] = useState("");
  const save = () => {
    useApp.getState().saveTemplate(name || "My usual day", date);
    toast("Template saved", { tone: "success" });
    setName("");
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Save as template"
      description="Reuse this day's blocks on any other day."
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save}>
            Save template
          </button>
        </>
      }
    >
      <label htmlFor="tpl-name" className="label">
        Name
      </label>
      <input id="tpl-name" data-autofocus className="input" placeholder="My usual weekday" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
    </Dialog>
  );
}

function CopyFromDialog({ open, onClose, date, onCopy }: { open: boolean; onClose(): void; date: string; onCopy(from: string): void }) {
  const [from, setFrom] = useState(addDays(date, -7));
  useEffect(() => setFrom(addDays(date, -7)), [date]);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Copy blocks from…"
      description={`Blocks are added to ${formatDateLong(date)}.`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              onCopy(from);
              onClose();
            }}
          >
            Copy
          </button>
        </>
      }
    >
      <label htmlFor="copy-from" className="label">
        Source day
      </label>
      <input id="copy-from" type="date" data-autofocus className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
    </Dialog>
  );
}
