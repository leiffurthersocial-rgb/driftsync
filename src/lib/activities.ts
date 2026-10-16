import type { Activity, Area, AreaType, Block } from "@/data/schema";

export const AREA_LABELS: Record<AreaType, string> = {
  gym: "Gym",
  study: "Study hall",
  library: "Library",
  photo: "Photo studio",
  track: "Running track",
  workshop: "Workshop",
  hobby: "Hobby nook",
};

export const AREA_BLURBS: Record<AreaType, string> = {
  gym: "Lifting, stretching, training",
  study: "Classes, homework, learning",
  library: "Books and quiet reading",
  photo: "Shoots, editing, creative eye",
  track: "Runs and laps",
  workshop: "Work and projects",
  hobby: "Anything you love doing",
};

/** Resolve which island area an activity happens at (explicit link first, then by type). */
export function areaForActivity(activity: Activity | null | undefined, areas: Area[]): Area | null {
  if (!activity) return null;
  if (activity.areaId) {
    const linked = areas.find((a) => a.id === activity.areaId);
    if (linked) return linked;
  }
  if (activity.areaType) return areas.find((a) => a.type === activity.areaType) ?? null;
  return null;
}

/** Activities that happen at a given area. */
export function activitiesForArea(area: Area, activities: Activity[], areas: Area[]): Activity[] {
  return activities.filter((a) => areaForActivity(a, areas)?.id === area.id);
}

export const blockColor = (block: Block, activity: Activity | null | undefined) =>
  block.color ?? activity?.color ?? "#93a6bd";
