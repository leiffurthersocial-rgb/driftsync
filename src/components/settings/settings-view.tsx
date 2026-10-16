"use client";

import { Download, Pencil, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ANIMATIONS, type Activity, type AnimationKind, type ThemeSetting } from "@/data/schema";
import type { ResetScope } from "@/data/reset";
import { useApp } from "@/store/app-store";
import { toast, useUi } from "@/store/ui-store";
import { AREA_LABELS } from "@/lib/activities";
import { ANIMATION_VERB } from "@/lib/character-intent";
import { toDateKey } from "@/lib/time";
import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { ColorSwatches, Segmented } from "@/components/ui/controls";
import { ConfirmDialog } from "@/components/ui/dialog";
import { CharacterCreator } from "@/components/onboarding/onboarding";
import { BuildingPreview } from "@/components/island/building-preview";
import { AreaSheet } from "@/components/island/area-sheet";
import { AddAreaDialog } from "@/components/island/add-area-dialog";
import { cn } from "@/lib/cn";

const SECTIONS = [
  ["profile", "Profile"],
  ["island", "Island"],
  ["activities", "Activities"],
  ["planner", "Planner"],
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
          <ProfileSection />
          <IslandSection />
          <ActivitiesSection />
          <PlannerSection />
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
function SavedInput({ id, value, onSave, placeholder }: { id: string; value: string; onSave(v: string): void; placeholder?: string }) {
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
      onBlur={() => v.trim() && v.trim() !== value && onSave(v.trim())}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

function ProfileSection() {
  const profile = useApp((s) => s.profile);
  const islandName = useApp((s) => s.island.name);
  const { updateProfile, updateIsland, updateAppearance } = useApp.getState();
  return (
    <Section id="profile" title="Profile" description="Your character and your island.">
      <Row label="Character name" htmlFor="set-name">
        <SavedInput id="set-name" value={profile.characterName} onSave={(characterName) => updateProfile({ characterName })} />
      </Row>
      <Row label="Island name" htmlFor="set-island">
        <SavedInput id="set-island" value={islandName} onSave={(name) => updateIsland({ name })} />
      </Row>
      <div className="px-5 py-4">
        <p className="mb-3 text-sm font-medium">Appearance</p>
        <CharacterCreator compact appearance={profile.appearance} name={profile.characterName} onChange={(a) => updateAppearance(a)} />
      </div>
    </Section>
  );
}

const THEME_COPY: Record<ThemeSetting, string> = {
  auto: "Follows your local time: pastel days, lofi dusk evenings.",
  day: "Always sunny and pastel.",
  dusk: "Always the cozy purple evening.",
  retro: "Bright, saturated retro palette.",
};

function IslandSection() {
  const areas = useApp((s) => s.areas);
  const theme = useApp((s) => s.settings.theme);
  const selectArea = useUi((s) => s.selectArea);
  const openAdd = useUi((s) => s.setAddAreaOpen);
  return (
    <Section id="island" title="Island" description="Areas and how your island looks.">
      <Row label="Theme" hint={THEME_COPY[theme]}>
        <Segmented
          label="Theme"
          value={theme}
          onChange={(t) => useApp.getState().updateSettings({ theme: t })}
          options={[
            { value: "auto", label: "Auto" },
            { value: "day", label: "Day" },
            { value: "dusk", label: "Dusk" },
            { value: "retro", label: "Retro" },
          ]}
        />
      </Row>
      <div className="px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Areas</p>
          <button className="btn-soft h-8 px-3" onClick={() => openAdd(true)}>
            <Plus size={15} /> Add area
          </button>
        </div>
        {areas.length === 0 ? (
          <p className="text-sm text-muted">No areas yet. Add one to give your island some life.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {areas.map((a) => (
              <li key={a.id}>
                <button onClick={() => selectArea(a.id)} className="flex w-full items-center gap-3 rounded-2xl border border-line/60 p-2 pr-3 text-left transition hover:bg-surface-2">
                  <BuildingPreview type={a.type} variant={a.variant} color={a.color} className="h-[46px] w-[38px] shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.name}</span>
                    <span className="block text-xs text-muted">{AREA_LABELS[a.type]}</span>
                  </span>
                  <Pencil size={14} className="text-muted" aria-hidden />
                  <span className="sr-only">Edit {a.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <AreaSheet vitality={{}} />
      <AddAreaDialog />
    </Section>
  );
}

function ActivitiesSection() {
  const activities = useApp((s) => s.activities);
  const sorted = [...activities].sort((a, b) => a.order - b.order);
  const [confirm, setConfirm] = useState<Activity | null>(null);
  return (
    <Section id="activities" title="Activities" description="What you plan, its color, where it happens on the island, and how your character acts it out.">
      <ul className="divide-y divide-line/60">
        {sorted.map((a) => (
          <ActivityRow key={a.id} activity={a} onDelete={() => setConfirm(a)} />
        ))}
      </ul>
      <div className="px-5 py-3">
        <button
          className="btn-ghost text-accent"
          onClick={() => useApp.getState().addActivity({ name: "New activity", color: "#4fb3b0", animation: "generic", areaId: null, areaType: null })}
        >
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

function ActivityRow({ activity, onDelete }: { activity: Activity; onDelete(): void }) {
  const areas = useApp((s) => s.areas);
  const [open, setOpen] = useState(false);
  const save = (patch: Partial<Activity>) => useApp.getState().saveActivity({ ...activity, ...patch });
  const linkValue = activity.areaId ? `area:${activity.areaId}` : activity.areaType ? `type:${activity.areaType}` : "none";
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
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <ActivitySelects activity={activity} areas={areas} linkValue={linkValue} save={save} />
        </div>
        {!activity.preset && (
          <button className="btn-ghost h-8 w-8 shrink-0 p-0 text-muted" onClick={onDelete} aria-label={`Delete ${activity.name}`}>
            <Trash2 size={15} />
          </button>
        )}
      </div>
      <div className="mt-2 flex gap-2 md:hidden">
        <ActivitySelects activity={activity} areas={areas} linkValue={linkValue} save={save} />
      </div>
      {open && (
        <div className="mt-3">
          <ColorSwatches value={activity.color} onChange={(c) => c && save({ color: c })} label={`${activity.name} color`} />
        </div>
      )}
    </li>
  );
}

function ActivitySelects({
  activity,
  areas,
  linkValue,
  save,
}: {
  activity: Activity;
  areas: ReturnType<typeof useApp.getState>["areas"];
  linkValue: string;
  save(p: Partial<Activity>): void;
}) {
  return (
    <>
      <label className="sr-only" htmlFor={`act-area-${activity.id}`}>
        Island area for {activity.name}
      </label>
      <select
        id={`act-area-${activity.id}`}
        className="input h-9 w-full py-1 md:w-44"
        value={linkValue}
        onChange={(e) => {
          const [kind, val] = e.target.value.split(":");
          if (kind === "area") save({ areaId: val });
          else if (kind === "type") save({ areaId: null, areaType: val as Activity["areaType"] });
          else save({ areaId: null, areaType: null });
        }}
      >
        <option value="none">Plaza (no area)</option>
        {activity.areaType && <option value={`type:${activity.areaType}`}>Any {AREA_LABELS[activity.areaType].toLowerCase()}</option>}
        {areas.map((a) => (
          <option key={a.id} value={`area:${a.id}`}>
            {a.name}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`act-anim-${activity.id}`}>
        Animation for {activity.name}
      </label>
      <select
        id={`act-anim-${activity.id}`}
        className="input h-9 w-full py-1 md:w-36"
        value={activity.animation}
        onChange={(e) => save({ animation: e.target.value as AnimationKind })}
      >
        {ANIMATIONS.map((k) => (
          <option key={k} value={k}>
            {k === "generic" ? "Generic" : ANIMATION_VERB[k]}
          </option>
        ))}
      </select>
    </>
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
        description="Your current island, plans, to-dos and goals will be replaced by the imported file. Consider exporting first."
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
  { scope: "planner", label: "Planner", hint: "Removes all time blocks and restores the default template.", confirm: "Reset planner" },
  { scope: "island", label: "Island", hint: "Removes all areas. Your character stays.", confirm: "Reset island" },
  { scope: "character", label: "Character", hint: "Restores the default name and look.", confirm: "Reset character" },
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
          useUi.getState().selectArea(null);
          if (scope.scope !== "onboarding") toast(`${scope.label} reset`);
        }}
      />
    </Section>
  );
}
