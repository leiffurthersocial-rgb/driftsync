"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Template } from "@/data/schema";
import { useApp } from "@/store/app-store";
import { toast } from "@/store/ui-store";
import { Dialog } from "@/components/ui/dialog";
import { formatWeekRange, weekDays } from "@/lib/calendar";
import { addDays, formatDateLong, toDateKey } from "@/lib/time";

/** Pick the day (or week) to fill with a template's blocks. */
export function ApplyTemplateDialog({ template, onClose }: { template: Template | null; onClose(): void }) {
  const router = useRouter();
  const weekStart = useApp((s) => s.settings.weekStart);
  const today = toDateKey(new Date());
  const week = template?.kind === "week";
  const [date, setDate] = useState(today);
  useEffect(() => {
    if (template) setDate(week ? weekDays(addDays(today, 7), weekStart)[0] : addDays(today, 1));
  }, [template, week, today, weekStart]);
  const days = weekDays(date, weekStart);

  const apply = () => {
    if (!template) return;
    const n = useApp.getState().applyTemplate(template.id, date);
    toast(`Added ${n} block${n === 1 ? "" : "s"}`, {
      tone: "success",
      action: { label: "View", run: () => router.push(week ? `/calendar?view=week&date=${date}` : `/planner?date=${date}`) },
    });
    onClose();
  };

  return (
    <Dialog
      open={!!template}
      onClose={onClose}
      title={`Apply “${template?.name ?? ""}”`}
      description={week ? "Blocks are added to each matching weekday of the week you pick." : "Blocks are added to the day you pick."}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={apply}>
            Apply
          </button>
        </>
      }
    >
      <label htmlFor="apply-date" className="label">
        {week ? "Any day in the week" : "Day"}
      </label>
      <input id="apply-date" type="date" data-autofocus className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      <p className="mt-2 text-sm text-muted">{week ? `Week of ${formatWeekRange(days)}` : formatDateLong(date)}</p>
    </Dialog>
  );
}
