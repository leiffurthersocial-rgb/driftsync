import { stamp } from "@/lib/id";
import {
  CURRENT_VERSION,
  type Activity,
  type AppData,
  type Profile,
  type Settings,
  type Template,
} from "./schema";

interface PresetDef {
  key: string;
  name: string;
  color: string;
}

/** Built-in activities. Names and colors are editable in Settings; keys are stable. */
export const PRESET_ACTIVITIES: PresetDef[] = [
  { key: "studying", name: "Studying", color: "#7c8cf0" },
  { key: "workout", name: "Working out", color: "#e7795f" },
  { key: "jogging", name: "Jogging", color: "#eea54b" },
  { key: "photography", name: "Photography", color: "#d77fb4" },
  { key: "reading", name: "Reading", color: "#5fae84" },
  { key: "work", name: "Work", color: "#4f9cc4" },
  { key: "hobby", name: "Hobby", color: "#a888de" },
  { key: "rest", name: "Rest", color: "#93a6bd" },
];

export function defaultActivities(): Activity[] {
  return PRESET_ACTIVITIES.map((p, i) => ({ ...stamp(), ...p, preset: true, order: i }));
}

export function defaultProfile(): Profile {
  return { name: "", onboarded: false, updatedAt: new Date().toISOString() };
}

export function defaultSettings(): Settings {
  return {
    theme: "auto",
    dayStartHour: 6,
    dayEndHour: 24,
    clock: "24h",
    weekStart: 1,
    defaultBlockMinutes: 60,
    updatedAt: new Date().toISOString(),
  };
}

export function defaultTemplates(activities: Activity[]): Template[] {
  const id = (key: string) => activities.find((a) => a.key === key)?.id ?? null;
  const h = (hh: number, mm = 0) => hh * 60 + mm;
  return [
    {
      ...stamp(),
      name: "My usual weekday",
      blocks: [
        { start: h(7, 30), end: h(8, 15), title: "Morning jog", activityId: id("jogging"), color: null, notes: "" },
        { start: h(9), end: h(12), title: "Deep work", activityId: id("work"), color: null, notes: "" },
        { start: h(13), end: h(16), title: "Work", activityId: id("work"), color: null, notes: "" },
        { start: h(17, 30), end: h(18, 30), title: "Gym", activityId: id("workout"), color: null, notes: "" },
        { start: h(21), end: h(22), title: "Reading", activityId: id("reading"), color: null, notes: "" },
      ],
    },
  ];
}

export function createDefaultData(): AppData {
  const activities = defaultActivities();
  return {
    version: CURRENT_VERSION,
    profile: defaultProfile(),
    settings: defaultSettings(),
    activities,
    blocks: [],
    todos: [],
    lists: [],
    goals: [],
    templates: defaultTemplates(activities),
  };
}
