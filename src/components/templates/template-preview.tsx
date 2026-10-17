import type { Activity, Template } from "@/data/schema";
import { blockColor } from "@/lib/activities";
import { weekdayLabels } from "@/lib/calendar";

const FROM = 5 * 60;
const TO = 24 * 60;
const pct = (m: number) => `${((Math.min(TO, Math.max(FROM, m)) - FROM) / (TO - FROM)) * 100}%`;

function Bar({ blocks, activities }: { blocks: Template["blocks"]; activities: Map<string, Activity> }) {
  return (
    <span className="relative block h-2.5 overflow-hidden rounded-full bg-surface-2">
      {blocks.map((b) => (
        <span
          key={b.id}
          className="absolute inset-y-0 rounded-full"
          style={{ left: pct(b.start), width: `calc(${pct(b.end)} - ${pct(b.start)})`, background: blockColor(b, activities.get(b.activityId ?? "")) }}
        />
      ))}
    </span>
  );
}

/** A tiny 5:00–24:00 strip per day showing when the template's blocks happen. */
export function TemplatePreview({ template, activities, weekStart }: { template: Template; activities: Map<string, Activity>; weekStart: 0 | 1 }) {
  if (template.kind === "day") return <Bar blocks={template.blocks} activities={activities} />;
  const labels = weekdayLabels(weekStart, "narrow");
  return (
    <span className="grid gap-1" aria-hidden>
      {labels.map((l, i) => {
        const day = (i + weekStart) % 7;
        return (
          <span key={i} className="flex items-center gap-2">
            <span className="w-3 text-[10px] font-semibold text-muted">{l}</span>
            <span className="flex-1">
              <Bar blocks={template.blocks.filter((b) => b.day === day)} activities={activities} />
            </span>
          </span>
        );
      })}
    </span>
  );
}
