"use client";

import { ArrowLeft, ClipboardCopy, Copy, MoreHorizontal, Play, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/store/app-store";
import { toast } from "@/store/ui-store";
import { findFreeSlot, formatDuration, type Range } from "@/lib/time";
import { weekdayLabels } from "@/lib/calendar";
import { PageContainer } from "@/components/shell/page-header";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/controls";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Timeline, type TimelineHandle } from "@/components/planner/timeline";
import { TemplateBlockEditor } from "./template-block-editor";
import { ApplyTemplateDialog } from "./apply-template-dialog";
import { cn } from "@/lib/cn";

const dayName = (d: number) => new Date(2023, 0, 1 + d).toLocaleDateString(undefined, { weekday: "long" });

/** Edit a template on the same timeline as the planner. Week templates get a tab per weekday. */
export function TemplateEditor({ id }: { id: string }) {
  const router = useRouter();
  const template = useApp((s) => s.templates.find((t) => t.id === id) ?? null);
  const activities = useApp((s) => s.activities);
  const settings = useApp((s) => s.settings);
  const order = Array.from({ length: 7 }, (_, i) => (i + settings.weekStart) % 7);
  const [day, setDay] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; isNew: boolean } | null>(null);
  const [applying, setApplying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState(template?.name ?? "");
  const timeline = useRef<TimelineHandle>(null);
  useEffect(() => setName(template?.name ?? ""), [template?.name]);

  const week = template?.kind === "week";
  const blocks = template ? template.blocks.filter((b) => !week || b.day === day).map((b) => ({ ...b, done: false })) : [];

  useEffect(() => {
    const first = blocks.length ? Math.min(...blocks.map((b) => b.start)) : 8 * 60;
    const t = setTimeout(() => timeline.current?.scrollToMinute(first), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, id]);

  // Delete / Backspace removes the selected block, N adds one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || editing || document.querySelector("[role=dialog]") || !template) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        useApp.getState().removeTemplateBlock(template.id, selectedId);
        setSelectedId(null);
      } else if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        addInNextSlot();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!template)
    return (
      <PageContainer>
        <div className="card">
          <EmptyState icon={<Trash2 size={20} />} title="This template doesn't exist anymore">
            <Link href="/templates" className="text-accent hover:underline">
              Back to templates
            </Link>
          </EmptyState>
        </div>
      </PageContainer>
    );

  const create = (r: Range) => {
    const b = useApp.getState().addTemplateBlock(template.id, { day: week ? day : 0, start: r.start, end: r.end, title: "", activityId: null, color: null, notes: "" });
    setSelectedId(b.id);
    setEditing({ id: b.id, isNew: true });
  };
  function addInNextSlot() {
    const len = settings.defaultBlockMinutes;
    const start = findFreeSlot(blocks, settings.dayStartHour * 60, len, settings.dayEndHour * 60);
    if (start === null) return toast("No free time left on this day", { tone: "danger" });
    create({ start, end: start + len });
    timeline.current?.scrollToMinute(start);
  }

  const saveName = () => {
    const n = name.trim();
    if (n && n !== template.name) useApp.getState().updateTemplate(template.id, { name: n });
    else setName(template.name);
  };

  const copyDayTo = (targets: number[], label: string) => {
    const n = useApp.getState().copyTemplateDay(template.id, day, targets);
    toast(`Copied ${dayName(day)} to ${label}${n ? "" : " (it had no blocks, so those days were cleared)"}`, { tone: "success" });
  };
  const copyItems: (MenuItem | { heading: string })[] = week
    ? [
        { heading: `Copy ${dayName(day)} to…` },
        { label: "Every weekday (Mon–Fri)", icon: <ClipboardCopy size={15} />, onSelect: () => copyDayTo([1, 2, 3, 4, 5], "every weekday") },
        { label: "The weekend", icon: <ClipboardCopy size={15} />, onSelect: () => copyDayTo([0, 6], "the weekend") },
        { label: "Every day", icon: <ClipboardCopy size={15} />, onSelect: () => copyDayTo([0, 1, 2, 3, 4, 5, 6], "every day") },
        ...order.filter((d) => d !== day).map((d) => ({ label: dayName(d), icon: <ClipboardCopy size={15} />, onSelect: () => copyDayTo([d], dayName(d)) })),
      ]
    : [];

  const total = template.blocks.reduce((s, b) => s + b.end - b.start, 0);
  const labels = weekdayLabels(settings.weekStart);

  return (
    <PageContainer>
      <Link href="/templates" className="mb-3 inline-flex items-center gap-1.5 rounded-lg text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> All templates
      </Link>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <h1 className="sr-only">{template.name}</h1>
          <label htmlFor="tpl-edit-name" className="sr-only">
            Template name
          </label>
          <input
            id="tpl-edit-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="w-full max-w-xl rounded-xl bg-transparent px-1 font-pixel text-3xl tracking-wide outline-none transition hover:bg-surface-2/60 focus:bg-surface-2/60 sm:text-4xl"
          />
          <p className="mt-1 px-1 text-sm text-muted">
            {week ? "Week template" : "Day template"} · {template.blocks.length} blocks · {formatDuration(total)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Menu
            label="Template actions"
            trigger={
              <button className="btn-soft h-10 w-10 p-0" aria-label="More template actions">
                <MoreHorizontal size={18} />
              </button>
            }
            items={[
              ...copyItems,
              ...(week ? (["divider"] as const) : []),
              {
                label: "Copy & edit",
                icon: <Copy size={15} />,
                onSelect: () => {
                  const c = useApp.getState().duplicateTemplate(template.id);
                  if (c) {
                    router.push(`/templates?id=${c.id}`);
                    toast("Copied. You're editing the copy.");
                  }
                },
              },
              { label: "Delete template", icon: <Trash2 size={15} />, onSelect: () => setDeleting(true), danger: true },
            ]}
          />
          <button className="btn-soft h-10" onClick={() => setApplying(true)}>
            <Play size={15} /> Apply
          </button>
          <button className="btn-primary h-10" onClick={addInNextSlot}>
            <Plus size={16} /> Block <kbd className="kbd hidden border-white/30 bg-white/15 text-white/80 sm:inline">N</kbd>
          </button>
        </div>
      </div>

      {week && (
        <div role="tablist" aria-label="Day of the week" className="mb-4 grid grid-cols-7 gap-1 rounded-2xl bg-surface-2/70 p-1">
          {order.map((d, i) => {
            const items = template.blocks.filter((b) => b.day === d);
            const mins = items.reduce((s, b) => s + b.end - b.start, 0);
            return (
              <button
                key={d}
                role="tab"
                aria-selected={d === day}
                aria-label={`${dayName(d)}, ${items.length} blocks`}
                onClick={() => {
                  setDay(d);
                  setSelectedId(null);
                }}
                className={cn("rounded-xl px-1 py-2 text-center transition", d === day ? "bg-surface shadow-soft" : "text-muted hover:text-ink")}
              >
                <span className="block text-sm font-medium">{labels[i]}</span>
                <span className="block truncate text-[11px] text-muted">{items.length ? (mins % 60 ? `${(mins / 60).toFixed(1)}h` : `${mins / 60}h`) : "—"}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="card relative h-[calc(100dvh-20rem)] min-h-[420px] overflow-hidden p-2" role={week ? "tabpanel" : undefined} aria-label={week ? dayName(day) : undefined}>
        <Timeline
          ref={timeline}
          label={`Template timeline${week ? ` for ${dayName(day)}` : ""}. Click or drag on empty space to add a block.`}
          blocks={blocks}
          activities={activities}
          clock={settings.clock}
          dayStartHour={settings.dayStartHour}
          dayEndHour={settings.dayEndHour}
          defaultLength={settings.defaultBlockMinutes}
          nowMinute={null}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onOpen={(bid) => setEditing({ id: bid, isNew: false })}
          onCreate={create}
          onChange={(bid, r) => useApp.getState().updateTemplateBlock(template.id, bid, r)}
        />
        {blocks.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center px-6">
            <div className="rounded-2xl bg-surface/90 px-5 py-4 text-center shadow-soft backdrop-blur">
              <p className="font-medium">{week ? `Nothing on ${dayName(day)} yet` : "An empty template"}</p>
              <p className="mt-1 text-sm text-muted">Drag on the timeline or press N to add a block{week ? ", or copy another day from ⋯" : ""}.</p>
            </div>
          </div>
        )}
      </div>

      <TemplateBlockEditor
        templateId={template.id}
        blockId={editing?.id ?? null}
        isNew={!!editing?.isNew}
        weekly={week}
        weekStart={settings.weekStart}
        onClose={() => setEditing(null)}
        onDayChange={(d) => setDay(d)}
      />
      <ApplyTemplateDialog template={applying ? template : null} onClose={() => setApplying(false)} />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete “${template.name}”?`}
        description="Blocks you already added from it stay in your planner."
        confirmLabel="Delete template"
        onConfirm={() => {
          useApp.getState().removeTemplate(template.id);
          router.push("/templates");
          toast("Template deleted");
        }}
      />
    </PageContainer>
  );
}
