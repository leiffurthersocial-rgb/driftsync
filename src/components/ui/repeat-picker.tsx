"use client";

import { useState } from "react";
import type { Repeat } from "@/data/schema";
import { describeRepeat, matchPreset, repeatPresets, weekdayOf } from "@/lib/recurrence";
import { weekdayLabels } from "@/lib/calendar";
import { addDays } from "@/lib/time";
import { cn } from "@/lib/cn";

const UNITS: { freq: Repeat["freq"]; one: string; many: string }[] = [
  { freq: "daily", one: "day", many: "days" },
  { freq: "weekly", one: "week", many: "weeks" },
  { freq: "monthly", one: "month", many: "months" },
  { freq: "yearly", one: "year", many: "years" },
];

/**
 * Choose how something repeats: common presets in a select, plus a custom editor
 * (every N days/weeks/months/years, which weekdays, optional end date).
 */
export function RepeatPicker({
  id,
  value,
  anchor,
  onChange,
  noneLabel = "Does not repeat",
  weekStart = 1,
}: {
  id: string;
  value: Repeat | null;
  /** The date it repeats from (phrases the presets: "Every Saturday"). */
  anchor: string;
  onChange(r: Repeat | null): void;
  noneLabel?: string;
  weekStart?: 0 | 1;
}) {
  const presets = repeatPresets(anchor);
  const matched = value ? matchPreset(value, anchor) : "none";
  const [custom, setCustom] = useState(!!value && matched === null);
  const selectValue = custom ? "custom" : (matched ?? "custom");
  const order = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
  const labels = weekdayLabels(weekStart, "narrow");
  const r: Repeat = value ?? { freq: "weekly", interval: 1, weekdays: [weekdayOf(anchor)], until: null };
  const set = (patch: Partial<Repeat>) => onChange({ ...r, ...patch });

  return (
    <div className="space-y-3">
      <select
        id={id}
        className="input"
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "none") {
            setCustom(false);
            onChange(null);
          } else if (v === "custom") {
            setCustom(true);
            onChange({ ...r, until: value?.until ?? null });
          } else {
            setCustom(false);
            const p = presets.find((x) => x.id === v)!;
            onChange({ ...p.rule, until: value?.until ?? null });
          }
        }}
      >
        <option value="none">{noneLabel}</option>
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
        <option value="custom">{selectValue === "custom" && value ? `Custom: ${describeRepeat(value, anchor)}` : "Custom…"}</option>
      </select>

      {value && custom && (
        <div className="space-y-3 rounded-2xl bg-surface-2/60 p-3">
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor={`${id}-n`}>Every</label>
            <input
              id={`${id}-n`}
              type="number"
              min={1}
              max={99}
              className="input h-9 w-16 py-1"
              value={r.interval}
              onChange={(e) => set({ interval: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })}
            />
            <label className="sr-only" htmlFor={`${id}-unit`}>
              Unit
            </label>
            <select
              id={`${id}-unit`}
              className="input h-9 w-auto py-1"
              value={r.freq}
              onChange={(e) => {
                const freq = e.target.value as Repeat["freq"];
                set({ freq, weekdays: freq === "weekly" ? r.weekdays : [] });
              }}
            >
              {UNITS.map((u) => (
                <option key={u.freq} value={u.freq}>
                  {r.interval === 1 ? u.one : u.many}
                </option>
              ))}
            </select>
          </div>
          {r.freq === "weekly" && (
            <div role="group" aria-label="On these days" className="flex gap-1">
              {order.map((d, i) => {
                const days = r.weekdays.length ? r.weekdays : [weekdayOf(anchor)];
                const on = days.includes(d);
                const name = new Date(2023, 0, 1 + d).toLocaleDateString(undefined, { weekday: "long" });
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    aria-label={name}
                    onClick={() => {
                      const next = on ? days.filter((x) => x !== d) : [...days, d];
                      if (next.length) set({ weekdays: next.sort() });
                    }}
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-full text-xs font-semibold transition",
                      on ? "bg-accent text-accent-ink" : "bg-surface text-muted hover:text-ink",
                    )}
                  >
                    {labels[i]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {value && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor={`${id}-until-mode`} className="text-muted">
            Ends
          </label>
          <select
            id={`${id}-until-mode`}
            className="input h-9 w-auto py-1"
            value={value.until ? "on" : "never"}
            onChange={(e) => onChange({ ...value, until: e.target.value === "on" ? addDays(anchor, 90) : null })}
          >
            <option value="never">Never</option>
            <option value="on">On a date</option>
          </select>
          {value.until && (
            <input
              id={`${id}-until`}
              aria-label="End date"
              type="date"
              className="input h-9 w-auto py-1"
              min={anchor}
              value={value.until}
              onChange={(e) => e.target.value && onChange({ ...value, until: e.target.value })}
            />
          )}
        </div>
      )}
    </div>
  );
}
