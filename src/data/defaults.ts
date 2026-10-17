import { stamp, uuid } from "@/lib/id";
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
  { key: "work", name: "Work", color: "#4f9cc4" },
  { key: "school", name: "School", color: "#d77fb4" },
  { key: "studying", name: "Studying", color: "#7c8cf0" },
  { key: "workout", name: "Working out", color: "#e7795f" },
  { key: "jogging", name: "Jogging", color: "#eea54b" },
  { key: "reading", name: "Reading", color: "#5fae84" },
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
    lightTheme: "paper",
    darkTheme: "dusk",
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
  const b = (day: number, start: number, end: number, title: string, key: string) => ({
    id: uuid(),
    day,
    start,
    end,
    title,
    activityId: id(key),
    color: null,
    notes: "",
  });
  const weekdays = [1, 2, 3, 4, 5];
  return [
    {
      ...stamp(),
      name: "My usual weekday",
      kind: "day",
      blocks: [
        b(0, h(7, 30), h(8, 15), "Morning jog", "jogging"),
        b(0, h(9), h(12), "Deep work", "work"),
        b(0, h(13), h(16), "Work", "work"),
        b(0, h(17, 30), h(18, 30), "Gym", "workout"),
        b(0, h(21), h(22), "Reading", "reading"),
      ],
    },
    {
      ...stamp(),
      name: "My usual week",
      kind: "week",
      blocks: [
        ...weekdays.map((d) => b(d, h(9), h(12), "Work", "work")),
        ...weekdays.map((d) => b(d, h(13), h(17), "Work", "work")),
        ...[1, 3, 5].map((d) => b(d, h(17, 30), h(18, 30), "Gym", "workout")),
        ...[2, 4].map((d) => b(d, h(18), h(19, 30), "Evening class", "school")),
        ...weekdays.map((d) => b(d, h(21), h(21, 45), "Reading", "reading")),
        b(6, h(9), h(10), "Long run", "jogging"),
        b(6, h(14), h(16), "Hobby time", "hobby"),
        b(0, h(10), h(12), "Slow morning", "rest"),
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
    series: [],
    markers: [],
    todos: [],
    lists: [],
    goals: [],
    templates: defaultTemplates(activities),
  };
}
