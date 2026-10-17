"use client";

import { Moon, Plus, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import type { MarkerKind, Repeat } from "@/data/schema";
import { useApp } from "@/store/app-store";
import { toast } from "@/store/ui-store";
import { Dialog } from "@/components/ui/dialog";
import { RepeatPicker } from "@/components/ui/repeat-picker";
import { markersFor } from "@/lib/series";
import { describeRepeat } from "@/lib/recurrence";
import { DAY_MINUTES, formatDateLong, formatDateShort, formatMinutes } from "@/lib/time";
import { MARKER_STYLE } from "./timeline";

const DEFAULT_TIME: Record<MarkerKind, number> = { wake: 7 * 60, sleep: 23 * 60 };
const DAILY: Repeat = { freq: "daily", interval: 1, weekdays: [], until: null };

interface Draft {
  enabled: boolean;
  time: number;
  repeat: Repeat | null;
}

const sameRule = (a: Repeat | null, b: Repeat | null) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Set the wake-up and bedtime lines for a day, either for that day only or repeating
 * (every day, weekdays, weekends, …). A one-day line overrides a repeating one.
 */
export function SleepDialog({ open, date, onClose }: { open: boolean; date: string; onClose(): void }) {
  const markers = useApp((s) => s.markers);
  const clock = useApp((s) => s.settings.clock);
  const weekStart = useApp((s) => s.settings.weekStart);
  const current = markersFor(markers, date);
  const [drafts, setDrafts] = useState<Record<MarkerKind, Draft>>(() => initial());

  function initial(): Record<MarkerKind, Draft> {
    const out = {} as Record<MarkerKind, Draft>;
    for (const kind of ["wake", "sleep"] as const) {
      const dm = current.find((m) => m.kind === kind);
      const m = dm ? markers.find((x) => x.id === dm.markerId) : null;
      out[kind] = { enabled: !!dm, time: dm?.time ?? DEFAULT_TIME[kind], repeat: m ? m.repeat : DAILY };
    }
    return out;
  }
  useEffect(() => {
    if (open) setDrafts(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date]);

  const save = () => {
    const st = useApp.getState();
    for (const kind of ["wake", "sleep"] as const) {
      const d = drafts[kind];
      if (!d.enabled) continue;
      const dm = current.find((m) => m.kind === kind);
      const m = dm ? st.markers.find((x) => x.id === dm.markerId) : null;
      if (!m) st.addMarker({ kind, time: d.time, date, repeat: d.repeat });
      else if (!m.repeat) st.updateMarker(m.id, d.repeat ? { time: d.time, repeat: d.repeat, date } : { time: d.time });
      else if (!d.repeat) st.addMarker({ kind, time: d.time, date, repeat: null }); // one-day override
      else if (sameRule(m.repeat, d.repeat)) {
        if (m.time !== d.time) st.updateMarker(m.id, { time: d.time });
      } else st.addMarker({ kind, time: d.time, date, repeat: d.repeat }); // newer repeating line wins where they overlap
    }
    toast("Sleep times saved", { tone: "success" });
    onClose();
  };

  const remove = (kind: MarkerKind, upcoming: boolean) => {
    const st = useApp.getState();
    const dm = current.find((m) => m.kind === kind);
    if (upcoming && dm) st.endMarkerFrom(dm.markerId, date);
    else st.clearMarkerOn(kind, date);
    setDrafts((d) => ({ ...d, [kind]: { ...d[kind], enabled: false } }));
    toast(`${MARKER_STYLE[kind].label} line removed${upcoming ? " from this day on" : ` on ${formatDateShort(date)}`}`);
  };

  const times = Array.from({ length: DAY_MINUTES / 15 }, (_, i) => i * 15);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Wake-up & bedtime"
      description={`Lines on the timeline for ${formatDateLong(date)}. The hours you're asleep are shaded.`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={!drafts.wake.enabled && !drafts.sleep.enabled}>
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {(["wake", "sleep"] as const).map((kind) => {
          const d = drafts[kind];
          const st = MARKER_STYLE[kind];
          const Icon = kind === "wake" ? Sun : Moon;
          const dm = current.find((m) => m.kind === kind);
          const m = dm ? markers.find((x) => x.id === dm.markerId) : null;
          const set = (patch: Partial<Draft>) => setDrafts((all) => ({ ...all, [kind]: { ...all[kind], ...patch } }));
          return (
            <section key={kind} aria-labelledby={`sl-${kind}`} className="rounded-2xl border border-line/70 p-4">
              <div className="flex items-center gap-2">
                <Icon size={16} style={{ color: st.color }} aria-hidden />
                <h3 id={`sl-${kind}`} className="flex-1 text-sm font-semibold">
                  {st.label}
                </h3>
                {m && (
                  <span className="text-xs text-muted">
                    {m.repeat ? describeRepeat(m.repeat, m.date) : `Only ${formatDateShort(m.date)}`}
                  </span>
                )}
              </div>
              {!d.enabled ? (
                <button className="btn-soft mt-3 h-9" onClick={() => set({ enabled: true })}>
                  <Plus size={15} /> Add {st.label.toLowerCase()} line
                </button>
              ) : (
                <div className="mt-3 space-y-3">
                  <div>
                    <label htmlFor={`sl-${kind}-time`} className="label">
                      Time
                    </label>
                    <select id={`sl-${kind}-time`} className="input" value={d.time} onChange={(e) => set({ time: Number(e.target.value) })}>
                      {times.map((t) => (
                        <option key={t} value={t}>
                          {formatMinutes(t, clock)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`sl-${kind}-repeat`} className="label">
                      Applies
                    </label>
                    <RepeatPicker
                      id={`sl-${kind}-repeat`}
                      value={d.repeat}
                      anchor={date}
                      weekStart={weekStart}
                      noneLabel={`Only on ${formatDateShort(date)}`}
                      onChange={(repeat) => set({ repeat })}
                    />
                  </div>
                  {m && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button className="btn-ghost h-8 px-2.5 text-xs text-danger" onClick={() => remove(kind, false)}>
                        Remove on this day
                      </button>
                      {m.repeat && (
                        <button className="btn-ghost h-8 px-2.5 text-xs text-danger" onClick={() => remove(kind, true)}>
                          Stop repeating from here
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </Dialog>
  );
}
