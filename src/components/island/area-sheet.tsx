"use client";

import { Dices, Footprints, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/store/app-store";
import { toast, useUi } from "@/store/ui-store";
import { AREA_LABELS, activitiesForArea } from "@/lib/activities";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { ColorSwatches } from "@/components/ui/controls";
import { BuildingPreview } from "./building-preview";
import { designFor } from "@/island/sprites/designs";
import type { Vitality } from "@/island/sprites/buildings";
import { cn } from "@/lib/cn";

const VITALITY_COPY: Record<Vitality, string> = {
  lived: "Feels lived in — flowers are blooming.",
  neutral: "Calm and ready whenever you are.",
  dusty: "A little quiet lately. It'll brighten up when you visit.",
};

/** Edit panel for a selected area: rename, recolor, restyle, move, remove, send character. */
export function AreaSheet({ vitality }: { vitality: Record<string, Vitality> }) {
  const selectedId = useUi((s) => s.selectedAreaId);
  const selectArea = useUi((s) => s.selectArea);
  const area = useApp((s) => s.areas.find((a) => a.id === selectedId) ?? null);
  const activities = useApp((s) => s.activities);
  const areas = useApp((s) => s.areas);
  const name = useApp((s) => s.profile.characterName);
  const { updateArea, removeArea, rerollArea, setOverride } = useApp.getState();
  const [draftName, setDraftName] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [lastArea, setLastArea] = useState(area);

  useEffect(() => {
    if (area) {
      setLastArea(area);
      setDraftName(area.name);
    }
  }, [area]);

  const shown = area ?? lastArea;
  if (!shown) return null;
  const linked = activitiesForArea(shown, activities, areas);
  const v = vitality[shown.id] ?? "neutral";

  const commitName = () => {
    const n = draftName.trim();
    if (n && n !== shown.name) updateArea(shown.id, { name: n });
    else setDraftName(shown.name);
  };

  return (
    <>
      <Dialog
        open={!!area}
        onClose={() => {
          commitName();
          selectArea(null);
        }}
        variant="sheet"
        title={shown.name}
        description={`${AREA_LABELS[shown.type]} · ${designFor(shown.type, shown.variant).name}`}
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 rounded-2xl bg-surface-2/60 p-3">
            <BuildingPreview type={shown.type} variant={shown.variant} color={shown.color} vitality={v} className="h-28 w-36 shrink-0" />
            <p className="text-sm text-muted">{VITALITY_COPY[v]}</p>
          </div>

          <button
            className="btn-primary w-full"
            onClick={() => {
              setOverride({ areaId: shown.id, activityId: null });
              toast(`${name} is heading to ${shown.name}`);
              selectArea(null);
            }}
          >
            <Footprints size={16} /> Send {name} here
          </button>

          <div>
            <label htmlFor="area-rename" className="label">
              Name
            </label>
            <input
              id="area-rename"
              className="input"
              value={draftName}
              maxLength={40}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            />
          </div>

          <div>
            <span className="label">Style</span>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((variant) => (
                <button
                  key={variant}
                  onClick={() => updateArea(shown.id, { variant })}
                  aria-pressed={shown.variant === variant}
                  aria-label={designFor(shown.type, variant).name}
                  title={designFor(shown.type, variant).blurb}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl p-1.5 text-center transition",
                    shown.variant === variant ? "bg-surface-2 ring-2 ring-accent" : "opacity-75 hover:bg-surface-2 hover:opacity-100",
                  )}
                >
                  <BuildingPreview type={shown.type} variant={variant} color={shown.color} className="h-16 w-full" />
                  <span className="text-[11px] font-medium leading-tight">{designFor(shown.type, variant).name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">Accent color</span>
            <ColorSwatches value={shown.color} onChange={(color) => updateArea(shown.id, { color })} allowNone label="Accent color" />
          </div>

          <div>
            <span className="label">Activities here</span>
            {linked.length ? (
              <div className="flex flex-wrap gap-2">
                {linked.map((a) => (
                  <span key={a.id} className="chip">
                    <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                    {a.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No activities point here yet. Link one in Settings → Activities.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-line/60 pt-5">
            <button
              className="btn-soft"
              onClick={() => {
                if (rerollArea(shown.id)) toast("Found a new spot");
                else toast("No other spot fits right now", { tone: "danger" });
              }}
            >
              <Dices size={16} /> New spot
            </button>
            <button className="btn-ghost text-danger" onClick={() => setConfirm(true)}>
              <Trash2 size={16} /> Remove
            </button>
          </div>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Remove ${shown.name}?`}
        description="The building leaves the island. Your plans and activities stay as they are."
        confirmLabel="Remove area"
        onConfirm={() => {
          removeArea(shown.id);
          selectArea(null);
          toast(`${shown.name} removed`);
        }}
      />
    </>
  );
}
