/**
 * Routines: the different ways the character can do an activity. Each routine names an
 * animation, where it happens, and what the place needs (a pull-up bar spot, a running loop…).
 * Pure and deterministic so it can be unit-tested.
 */
import type { AnimationKind } from "@/data/schema";
import { hash01 } from "@/lib/random";
import type { AnimName } from "../sprites/character";
import type { Design } from "../sprites/designs";

export type Where =
  | { kind: "door" }
  | { kind: "spot"; spot: string }
  | { kind: "loop" }
  | { kind: "trail" };

export interface Routine {
  id: string;
  label: string;
  activity: AnimationKind;
  anim: AnimName;
  where: Where;
  /** Gym clothes. */
  sport?: boolean;
  /** Lift the sprite (px) — for hanging from bars. */
  lift?: number;
  /** Only available after dusk. */
  night?: boolean;
  /** Only in these designs (ids). */
  designs?: string[];
}

const door: Where = { kind: "door" };

export const ROUTINES: Routine[] = [
  // Studying
  { id: "study-desk", label: "Studying at a desk", activity: "study", anim: "study", where: door },
  { id: "study-laptop", label: "Studying on a laptop", activity: "study", anim: "studyLaptop", where: door },
  { id: "study-table", label: "Studying at the picnic table", activity: "study", anim: "studyLaptop", where: { kind: "spot", spot: "table" } },
  { id: "study-cards", label: "Reviewing flashcards", activity: "study", anim: "studyCards", where: door },
  // Working out
  { id: "workout-curls", label: "Doing curls", activity: "workout", anim: "curls", where: door, sport: true },
  { id: "workout-press", label: "Overhead presses", activity: "workout", anim: "press", where: door, sport: true },
  { id: "workout-squats", label: "Doing squats", activity: "workout", anim: "squats", where: door, sport: true },
  { id: "workout-jacks", label: "Jumping jacks", activity: "workout", anim: "jacks", where: door, sport: true },
  { id: "workout-pullups", label: "Doing pull-ups", activity: "workout", anim: "pullups", where: { kind: "spot", spot: "bar" }, sport: true, lift: 8 },
  { id: "workout-dips", label: "Doing dips", activity: "workout", anim: "dips", where: { kind: "spot", spot: "dip" }, sport: true, lift: 6 },
  { id: "workout-yoga", label: "Flowing through yoga", activity: "workout", anim: "yoga", where: { kind: "spot", spot: "mat" }, sport: true },
  // Jogging
  { id: "jog-laps", label: "Running laps", activity: "jog", anim: "run", where: { kind: "loop" }, sport: true },
  { id: "jog-island", label: "Running around the island", activity: "jog", anim: "run", where: { kind: "trail" }, sport: true },
  // Photography
  { id: "photo-handheld", label: "Taking photos", activity: "photo", anim: "photo", where: door },
  { id: "photo-tripod", label: "Shooting on a tripod", activity: "photo", anim: "photoTripod", where: door },
  { id: "photo-lookout", label: "Shooting the view", activity: "photo", anim: "photoTripod", where: { kind: "spot", spot: "tripod" } },
  { id: "photo-macro", label: "Photographing flowers", activity: "photo", anim: "photoCrouch", where: door },
  // Reading
  { id: "read-sit", label: "Reading", activity: "read", anim: "read", where: door },
  { id: "read-bench", label: "Reading on a bench", activity: "read", anim: "readBench", where: door },
  { id: "read-garden", label: "Reading in the garden", activity: "read", anim: "readBench", where: { kind: "spot", spot: "bench" } },
  { id: "read-cafe", label: "Reading at the café", activity: "read", anim: "readBench", where: { kind: "spot", spot: "table" } },
  { id: "read-lying", label: "Reading in the grass", activity: "read", anim: "readLying", where: door },
  // Work
  { id: "work-laptop", label: "Working on a laptop", activity: "work", anim: "workLaptop", where: door },
  { id: "work-table", label: "Working at a café table", activity: "work", anim: "workLaptop", where: { kind: "spot", spot: "table" } },
  { id: "work-bench", label: "Working on the bench", activity: "work", anim: "workLaptop", where: { kind: "spot", spot: "bench" } },
  { id: "work-forge", label: "Hammering at the anvil", activity: "work", anim: "work", where: door, designs: ["work-barn"] },
  { id: "work-saw", label: "Sawing wood", activity: "work", anim: "workSaw", where: door, designs: ["work-barn", "study-cabin"] },
  // Hobby
  { id: "hobby-paint", label: "Painting", activity: "hobby", anim: "paint", where: door },
  { id: "hobby-easel", label: "Painting at the easel", activity: "hobby", anim: "paint", where: { kind: "spot", spot: "easel" } },
  { id: "hobby-guitar", label: "Playing guitar", activity: "hobby", anim: "guitar", where: door },
  { id: "hobby-stage", label: "Playing on the stage", activity: "hobby", anim: "guitar", where: { kind: "spot", spot: "stage" } },
  { id: "hobby-garden", label: "Gardening", activity: "hobby", anim: "garden", where: door },
  { id: "hobby-beds", label: "Tending the veggie beds", activity: "hobby", anim: "garden", where: { kind: "spot", spot: "bed" } },
  // Rest
  { id: "rest-sit", label: "Resting", activity: "rest", anim: "rest", where: door },
  { id: "rest-nap", label: "Napping", activity: "rest", anim: "nap", where: door },
  { id: "rest-stars", label: "Stargazing", activity: "rest", anim: "stargaze", where: door, night: true },
  // Generic
  { id: "generic", label: "Busy", activity: "generic", anim: "generic", where: door },
];

/** Routines that need something this design (or the island) doesn't have are skipped. */
export function isAvailable(r: Routine, design: Design | null, night: boolean): boolean {
  if (r.night && !night) return false;
  if (r.designs && (!design || !r.designs.includes(design.id))) return false;
  if (r.where.kind === "spot") return !!design && r.where.spot in design.spots;
  if (r.where.kind === "loop") return !!design?.loop;
  return true;
}

export const routinesFor = (activity: AnimationKind) => ROUTINES.filter((r) => r.activity === activity);

/**
 * Pick a routine. A pinned `style` wins when available; otherwise rotate every 20 minutes,
 * favouring routines that use something special about the place (bars, mats, loops…).
 */
export function selectRoutine(input: {
  activity: AnimationKind;
  design: Design | null;
  style: string;
  seed: string;
  minute: number;
  night: boolean;
}): Routine {
  const { activity, design, style, seed, minute, night } = input;
  const all = routinesFor(activity).filter((r) => isAvailable(r, design, night));
  if (!all.length) return ROUTINES.find((r) => r.id === "generic")!;
  const pinned = all.find((r) => r.id === style);
  if (pinned) return pinned;
  const special = all.filter((r) => r.where.kind !== "door" || r.designs);
  // Special places get a double share of the rotation.
  const pool = [...all, ...special];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const slot = Math.floor(minute / 20);
  return pool[Math.floor(hash01(h, slot, 17) * pool.length)];
}
