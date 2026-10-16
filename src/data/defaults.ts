import { stamp } from "@/lib/id";
import {
  CURRENT_VERSION,
  type Activity,
  type AnimationKind,
  type AppData,
  type AreaType,
  type IslandMeta,
  type Profile,
  type Settings,
  type Template,
} from "./schema";

interface PresetDef {
  key: string;
  name: string;
  color: string;
  animation: AnimationKind;
  areaType: AreaType | null;
}

/** Built-in activities. Names and colors are editable in Settings; keys are stable. */
export const PRESET_ACTIVITIES: PresetDef[] = [
  { key: "studying", name: "Studying", color: "#7c8cf0", animation: "study", areaType: "study" },
  { key: "workout", name: "Working out", color: "#e7795f", animation: "workout", areaType: "gym" },
  { key: "jogging", name: "Jogging", color: "#eea54b", animation: "jog", areaType: "track" },
  { key: "photography", name: "Photography", color: "#d77fb4", animation: "photo", areaType: "photo" },
  { key: "reading", name: "Reading", color: "#5fae84", animation: "read", areaType: "library" },
  { key: "work", name: "Work", color: "#4f9cc4", animation: "work", areaType: "workshop" },
  { key: "hobby", name: "Hobby", color: "#a888de", animation: "hobby", areaType: "hobby" },
  { key: "rest", name: "Rest", color: "#93a6bd", animation: "rest", areaType: null },
];

export function defaultActivities(): Activity[] {
  return PRESET_ACTIVITIES.map((p, i) => ({ ...stamp(), ...p, areaId: null, preset: true, order: i }));
}

export function defaultProfile(): Profile {
  return {
    characterName: "Pip",
    appearance: { skin: 1, hairStyle: "short", hairColor: "#4a3426", outfitColor: "#6e5ee6", accessory: "none" },
    onboarded: false,
    override: null,
    updatedAt: new Date().toISOString(),
  };
}

export function defaultIsland(): IslandMeta {
  return { name: "Driftsync", seed: Math.floor(Math.random() * 1_000_000), tier: 0, updatedAt: new Date().toISOString() };
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
    island: defaultIsland(),
    settings: defaultSettings(),
    areas: [],
    activities,
    blocks: [],
    todos: [],
    lists: [],
    goals: [],
    templates: defaultTemplates(activities),
  };
}
