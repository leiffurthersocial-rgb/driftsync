"use client";

import { Footprints, Palette, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/store/app-store";
import { toast, useUi } from "@/store/ui-store";
import { Dialog } from "@/components/ui/dialog";
import { areaAccent } from "@/island/sprites/buildings";
import { CharacterPreview } from "./character-preview";
import type { AnimName } from "@/island/sprites/character";

export function CharacterCard({ status, anim }: { status: string; anim: AnimName }) {
  const open = useUi((s) => s.characterCardOpen);
  const setOpen = useUi((s) => s.setCharacterCardOpen);
  const profile = useApp((s) => s.profile);
  const areas = useApp((s) => s.areas);
  const setOverride = useApp((s) => s.setOverride);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={profile.characterName} description={status}>
      <div className="space-y-5">
        <div className="grid place-items-center rounded-2xl bg-surface-2/60 py-2">
          <CharacterPreview appearance={profile.appearance} anim={anim} scale={4} label={`${profile.characterName}: ${status}`} />
        </div>
        <div>
          <span className="label">Send to…</span>
          {areas.length ? (
            <div className="grid grid-cols-2 gap-2">
              {areas.map((a) => (
                <button
                  key={a.id}
                  className="btn-soft justify-start"
                  aria-pressed={profile.override?.areaId === a.id}
                  onClick={() => {
                    setOverride({ areaId: a.id, activityId: null });
                    toast(`${profile.characterName} is heading to ${a.name}`);
                    setOpen(false);
                  }}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: areaAccent(a.type, a.variant, a.color) }} />
                  <span className="truncate">{a.name}</span>
                  {profile.override?.areaId === a.id && <Footprints size={14} className="ml-auto text-accent" />}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Add an area to give {profile.characterName} somewhere to go.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line/60 pt-4">
          {profile.override && (
            <button
              className="btn-primary"
              onClick={() => {
                setOverride(null);
                setOpen(false);
                toast(`${profile.characterName} is back on your plan`);
              }}
            >
              <RotateCcw size={16} /> Follow my plan
            </button>
          )}
          <Link href="/settings#profile" className="btn-ghost" onClick={() => setOpen(false)}>
            <Palette size={16} /> Customize
          </Link>
        </div>
      </div>
    </Dialog>
  );
}
