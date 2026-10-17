"use client";

import { Download, LayoutTemplate, Moon, Plus, RotateCcw, Sun, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Activity, ThemeSetting } from "@/data/schema";
import type { ResetScope } from "@/data/reset";
import { useApp } from "@/store/app-store";
import { toast } from "@/store/ui-store";
import { isDark } from "@/lib/daycycle";
import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { ColorSwatches, Segmented } from "@/components/ui/controls";
import { ConfirmDialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { DARK_DEFS, LIGHT_DEFS, THEME_DEFS } from "@/lib/themes";
import { ThemePicker } from "./theme-picker";
import { AccountSection } from "@/components/account/account-section";
import { SleepDialog } from "@/components/planner/sleep-dialog";
import { describeRepeat } from "@/lib/recurrence";
import { formatDateShort, formatMinutes, minutesOfDay, toDateKey } from "@/lib/time";

const SECTIONS = [
  ["account", "Account"],
  ["profile", "Profile"],
  ["appearance", "Appearance"],
  ["activities", "Activities"],
  ["planner", "Planner"],
  ["sleep", "Sleep"],
  ["data", "Data"],
  ["reset", "Reset"],
] as const;

export function SettingsView() {
  const [active, setActive] = useState<string>("profile");

  useEffect(() => {
    const els = SECTIONS.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    return () => io.disconnect();
  }, []);

  return (
    <PageContainer>
      <PageHeader title="Settings" subtitle="Everything is stored on this device. Change anything, any time." />
      <div className="grid gap-8 lg:grid-cols-[180px_1fr]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-24 space-y-0.5">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={cn("block rounded-xl px-3 py-2 text-sm transition", active === id ? "bg-surface font-medium shadow-soft" : "text-muted hover:text-ink")}
                  aria-current={active === id ? "true" : undefined}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-8">
          <AccountSection Section={Section} Row={Row} />
          <ProfileSection />
          <AppearanceSection />
          <ActivitiesSection />
          <PlannerSection />
          <SleepSection />
          <DataSection />
          <ResetSection />
        </div>
      </div>
    </PageContainer>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        {title}
      </h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="card mt-3 divide-y divide-line/60">{children}</div>
    </section>
  );
}

function Row({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Text input that saves on blur/Enter. */
function SavedInput({
  id,
  value,
  onSave,
  placeholder,
  allowEmpty,
}: {
  id: string;
  value: string;
  onSave(v: string): void;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      id={id}
      className="input w-full sm:w-64"
      value={v}
      maxLength={40}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => (v.trim() || allowEmpty) && v.trim() !== value && onSave(v.trim())}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

function ProfileSection() {
  const name = useApp((s) => s.profile.name);
  return (
    <Section id="profile" title="Profile">
      <Row label="Your name" hint="Used for greetings on the Today page. Leave empty for none." htmlFor="set-name">
        <SavedInput id="set-name" value={name} allowEmpty placeholder="Optional" onSave={(name) => useApp.getState().updateProfile({ name })} />
      </Row>
    </Section>
  );
}

const THEME_COPY: Record<ThemeSetting, string> = {
  auto: "Light during the day, dark in the evening, following your local time.",
  system: "Matches your device's light or dark setting.",
  light: "Always light.",
  dark: "Always dark.",
};

function AppearanceSection() {
  const { theme, lightTheme, darkTheme } = useApp((s) => s.settings);
  const update = useApp.getState().updateSettings;
  const showingDark = isDark(theme, minutesOfDay(new Date()), typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const showing = THEME_DEFS.find((d) => d.id === (showingDark ? darkTheme : lightTheme));
  return (
    <Section id="appearance" title="Appearance" description="Pick when to go dark, and which light and dark palettes to use.">
      <Row label="Mode" hint={`${THEME_COPY[theme]} Showing ${showing?.name ?? ""} now.`}>
        <Segmented
          label="Mode"
          value={theme}
          onChange={(t) => update({ theme: t })}
          options={[
            { value: "auto", label: "Time of day" },
            { value: "system", label: "Device" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </Row>
      <div className="px-5 py-4">
        <p className="mb-3 text-sm font-medium">Light theme</p>
        <ThemePicker
          label="Light theme"
          defs={LIGHT_DEFS}
          value={lightTheme}
          onChange={(id) => update({ lightTheme: id, ...(theme === "dark" ? { theme: "light" as const } : {}) })}
        />
      </div>
      <div className="px-5 py-4">
        <p className="mb-3 text-sm font-medium">Dark theme</p>
        <ThemePicker
          label="Dark theme"
          defs={DARK_DEFS}
          value={darkTheme}
          onChange={(id) => update({ darkTheme: id, ...(theme === "light" ? { theme: "dark" as const } : {}) })}
        />
      </div>
    </Section>
  );
}

function ActivitiesSection() {
  const activities = useApp((s) => s.activities);
  const sorted = [...activities].sort((a, b) => a.order - b.order);
  const [confirm, setConfirm] = useState<Activity | null>(null);
  return (
    <Section id="activities" title="Activities" description="What you plan and the color it shows up in, across the planner and calendar.">
      <ul className="divide-y divide-line/60">
        {sorted.map((a) => (
          <ActivityRow key={a.id} activity={a} canDelete={sorted.length > 1} onDelete={() => setConfirm(a)} />
        ))}
      </ul>
      <div className="px-5 py-3">
        <button className="btn-ghost text-accent" onClick={() => useApp.getState().addActivity({ name: "New activity", color: "#4fb3b0" })}>
          <Plus size={16} /> Add custom activity
        </button>
      </div>
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={`Delete “${confirm?.name}”?`}
        description="Blocks using it keep their time but lose the activity."
        confirmLabel="Delete activity"
        onConfirm={() => confirm && useApp.getState().removeActivity(confirm.id)}
      />
    </Section>
  );
}

function ActivityRow({ activity, canDelete, onDelete }: { activity: Activity; canDelete: boolean; onDelete(): void }) {
  const [open, setOpen] = useState(false);
  const save = (patch: Partial<Activity>) => useApp.getState().saveActivity({ ...activity, ...patch });
  return (
    <li className="px-5 py-3">
      <div className="flex items-center gap-3">
        <button
          className="h-7 w-7 shrink-0 rounded-full ring-2 ring-surface transition hover:scale-110"
          style={{ background: activity.color }}
          onClick={() => setOpen((o) => !o)}
          aria-label={`Change color of ${activity.name}`}
          aria-expanded={open}
        />
        <label className="sr-only" htmlFor={`act-name-${activity.id}`}>
          Activity name
        </label>
        <SavedInput id={`act-name-${activity.id}`} value={activity.name} onSave={(name) => save({ name })} />
        {canDelete && (
          <button className="btn-ghost ml-auto h-8 w-8 shrink-0 p-0 text-muted" onClick={onDelete} aria-label={`Delete ${activity.name}`}>
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3">
          <ColorSwatches value={activity.color} onChange={(c) => c && save({ color: c })} label={`${activity.name} color`} />
        </div>
      )}
    </li>
  );
}

function PlannerSection() {
  const s = useApp((st) => st.settings);
  const update = useApp.getState().updateSettings;
  const hours = Array.from({ length: 25 }, (_, i) => i);
  return (
    <Section id="planner" title="Planner">
      <Row label="Day starts at" htmlFor="set-start">
        <select id="set-start" className="input w-32" value={s.dayStartHour} onChange={(e) => update({ dayStartHour: Number(e.target.value) })}>
          {hours.slice(0, 24).filter((h) => h < s.dayEndHour).map((h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}:00
            </option>
          ))}
        </select>
      </Row>
      <Row label="Day ends at" htmlFor="set-end">
        <select id="set-end" className="input w-32" value={s.dayEndHour} onChange={(e) => update({ dayEndHour: Number(e.target.value) })}>
          {hours.filter((h) => h > s.dayStartHour).map((h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}:00
            </option>
          ))}
        </select>
      </Row>
      <Row label="Clock">
        <Segmented label="Clock format" value={s.clock} onChange={(clock) => update({ clock })} options={[{ value: "24h", label: "24h" }, { value: "12h", label: "12h" }]} />
      </Row>
      <Row label="Week starts on">
        <Segmented label="Week start" value={s.weekStart} onChange={(weekStart) => update({ weekStart })} options={[{ value: 1, label: "Monday" }, { value: 0, label: "Sunday" }]} />
      </Row>
      <Row label="Templates" hint="Reusable days and weeks you can edit, copy and apply.">
        <Link href="/templates" className="btn-soft">
          <LayoutTemplate size={16} aria-hidden /> Manage templates
        </Link>
      </Row>
      <Row label="Default block length" htmlFor="set-len">
        <select id="set-len" className="input w-32" value={s.defaultBlockMinutes} onChange={(e) => update({ defaultBlockMinutes: Number(e.target.value) })}>
          {[15, 30, 45, 60, 90, 120, 180].map((m) => (
            <option key={m} value={m}>
              {m < 60 ? `${m} min` : `${m / 60} h`}
            </option>
          ))}
        </select>
      </Row>
    </Section>
  );
}

function SleepSection() {
  const markers = useApp((s) => s.markers);
  const clock = useApp((s) => s.settings.clock);
  const [open, setOpen] = useState(false);
  const today = toDateKey(new Date());
  // Repeating lines first, then one-day lines from today on.
  const list = [...markers]
    .filter((m) => m.repeat || m.date >= today)
    .sort((a, b) => Number(!a.repeat) - Number(!b.repeat) || a.kind.localeCompare(b.kind) || a.date.localeCompare(b.date));
  return (
    <Section id="sleep" title="Sleep" description="Wake-up and bedtime lines in the planner and calendar. One-day lines override repeating ones; newer repeating lines win where they overlap.">
      {list.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">No sleep times yet.</p>
      ) : (
        <ul className="divide-y divide-line/60">
          {list.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-5 py-3">
              {m.kind === "wake" ? <Sun size={16} className="shrink-0 text-[#e0962e]" aria-hidden /> : <Moon size={16} className="shrink-0 text-[#7c8cf0]" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {m.kind === "wake" ? "Wake up" : "Bedtime"} {formatMinutes(m.time, clock)}
                </span>
                <span className="block text-xs text-muted">
                  {m.repeat ? `${describeRepeat(m.repeat, m.date)}, from ${formatDateShort(m.date)}` : `Only ${formatDateShort(m.date)}`}
                  {m.skip.length > 0 && ` · ${m.skip.length} day${m.skip.length === 1 ? "" : "s"} skipped`}
                </span>
              </span>
              <button
                className="btn-ghost h-8 w-8 shrink-0 p-0 text-muted"
                aria-label={`Delete ${m.kind === "wake" ? "wake-up" : "bedtime"} line at ${formatMinutes(m.time, clock)}`}
                onClick={() => {
                  useApp.getState().removeMarker(m.id);
                  toast("Line removed");
                }}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="px-5 py-3">
        <button className="btn-ghost text-accent" onClick={() => setOpen(true)}>
          <Plus size={16} /> Set sleep times
        </button>
      </div>
      <SleepDialog open={open} date={today} onClose={() => setOpen(false)} />
    </Section>
  );
}

function DataSection() {
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<unknown>(null);
  const exportData = async () => {
    const data = await useApp.getState().exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `driftsync-${toDateKey(new Date())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Exported", { tone: "success" });
  };
  return (
    <Section id="data" title="Data" description="Back up or move your data. Imports are validated, and anything unreadable is skipped safely.">
      <Row label="Export" hint="Download everything as a JSON file.">
        <button className="btn-soft" onClick={exportData}>
          <Download size={16} /> Export JSON
        </button>
      </Row>
      <Row label="Import" hint="Replaces all current data with the file's contents.">
        <>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Choose a Driftsync JSON file"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                setPending(JSON.parse(await f.text()));
              } catch {
                toast("That file isn't valid JSON", { tone: "danger" });
              }
            }}
          />
          <button className="btn-soft" onClick={() => file.current?.click()}>
            <Upload size={16} /> Import JSON
          </button>
        </>
      </Row>
      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Replace all data?"
        description="Your current plans, to-dos, goals and settings will be replaced by the imported file. Consider exporting first."
        confirmLabel="Import"
        onConfirm={async () => {
          await useApp.getState().importData(pending);
          toast("Import complete", { tone: "success" });
        }}
      />
    </Section>
  );
}

const RESETS: { scope: ResetScope; label: string; hint: string; confirm: string }[] = [
  { scope: "planner", label: "Planner", hint: "Removes all time blocks, repeats and sleep lines, and restores the default templates.", confirm: "Reset planner" },
  { scope: "tasks", label: "To-dos & goals", hint: "Removes all to-dos, lists and goals.", confirm: "Reset to-dos & goals" },
  { scope: "onboarding", label: "Replay onboarding", hint: "Walk through the welcome flow again. Nothing is deleted.", confirm: "Replay" },
  { scope: "all", label: "Everything", hint: "Start completely fresh.", confirm: "Reset everything" },
];

function ResetSection() {
  const [scope, setScope] = useState<(typeof RESETS)[number] | null>(null);
  return (
    <Section id="reset" title="Reset" description="Each reset asks first. Export a backup if you might want things back.">
      {RESETS.map((r) => (
        <Row key={r.scope} label={r.label} hint={r.hint}>
          <button className={r.scope === "all" ? "btn-danger" : r.scope === "onboarding" ? "btn-soft" : "btn-ghost text-danger"} onClick={() => setScope(r)}>
            <RotateCcw size={15} /> {r.scope === "onboarding" ? "Replay" : "Reset"}
          </button>
        </Row>
      ))}
      <ConfirmDialog
        open={!!scope}
        onClose={() => setScope(null)}
        title={scope?.scope === "onboarding" ? "Replay onboarding?" : `Reset ${scope?.label.toLowerCase()}?`}
        description={scope?.hint}
        confirmLabel={scope?.confirm}
        tone={scope?.scope === "onboarding" ? "default" : "danger"}
        onConfirm={async () => {
          if (!scope) return;
          await useApp.getState().reset(scope.scope);
          if (scope.scope !== "onboarding") toast(`${scope.label} reset`);
        }}
      />
    </Section>
  );
}
