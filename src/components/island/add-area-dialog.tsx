"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { AREA_TYPES, type AreaType } from "@/data/schema";
import { AREA_BLURBS, AREA_LABELS } from "@/lib/activities";
import { MAX_AREAS } from "@/lib/island-layout";
import { useApp } from "@/store/app-store";
import { toast, useUi } from "@/store/ui-store";
import { Dialog } from "@/components/ui/dialog";
import { ColorSwatches } from "@/components/ui/controls";
import { BuildingPreview } from "./building-preview";
import { cn } from "@/lib/cn";

/** Two-step "Add area": pick a type, optionally personalize, then auto-place. */
export function AddAreaDialog() {
  const open = useUi((s) => s.addAreaOpen);
  const setOpen = useUi((s) => s.setAddAreaOpen);
  const selectArea = useUi((s) => s.selectArea);
  const addArea = useApp((s) => s.addArea);
  const count = useApp((s) => s.areas.length);
  const [type, setType] = useState<AreaType | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [variant, setVariant] = useState(0);

  useEffect(() => {
    if (open) {
      setType(null);
      setName("");
      setColor(null);
      setVariant(0);
    }
  }, [open]);

  const full = count >= MAX_AREAS;
  const place = () => {
    if (!type) return;
    const res = addArea(type, { name, color, variant });
    if (!res.ok) return toast(res.reason ?? "Couldn't place that area", { tone: "danger" });
    setOpen(false);
    selectArea(null);
    toast(`${res.area!.name} found a cozy spot`, {
      tone: "success",
      action: { label: "View", run: () => selectArea(res.area!.id) },
    });
  };

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title={type ? `New ${AREA_LABELS[type].toLowerCase()}` : "Add an area"}
      description={type ? "Make it yours, or just place it. You can change all of this later." : full ? "Your island is full — remove an area to make room." : "Pick a part of your life. It'll be placed automatically."}
      className="max-w-lg"
      footer={
        type ? (
          <>
            <button className="btn-ghost mr-auto" onClick={() => setType(null)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button className="btn-primary" onClick={place}>
              Place on island
            </button>
          </>
        ) : undefined
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {!type ? (
          <motion.ul
            key="grid"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
          >
            {AREA_TYPES.map((t) => (
              <li key={t}>
                <button
                  disabled={full}
                  onClick={() => setType(t)}
                  className="group flex w-full flex-col items-center rounded-2xl border border-line/70 bg-surface-2/40 p-3 text-center transition hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface-2 disabled:opacity-50"
                >
                  <BuildingPreview type={t} className="h-[72px] w-[60px] transition group-hover:scale-105" />
                  <span className="mt-1 text-sm font-medium">{AREA_LABELS[t]}</span>
                  <span className="text-[11px] leading-tight text-muted">{AREA_BLURBS[t]}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        ) : (
          <motion.div
            key="form"
            className="space-y-5"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
          >
            <div className="flex items-end justify-center gap-4 rounded-2xl bg-surface-2/60 py-3">
              {[0, 1, 2].map((v) => (
                <button
                  key={v}
                  onClick={() => setVariant(v)}
                  aria-pressed={variant === v}
                  aria-label={`Style ${v + 1}`}
                  className={cn(
                    "rounded-xl p-1 transition",
                    variant === v ? "bg-surface shadow-soft ring-2 ring-accent" : "opacity-70 hover:opacity-100",
                  )}
                >
                  <BuildingPreview type={type} variant={v} color={color} className="h-[92px] w-[76px]" />
                </button>
              ))}
            </div>
            <div>
              <label className="label" htmlFor="area-name">
                Name <span className="normal-case tracking-normal text-muted/70">(optional)</span>
              </label>
              <input
                id="area-name"
                data-autofocus
                className="input"
                placeholder={AREA_LABELS[type]}
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && place()}
              />
            </div>
            <div>
              <span className="label">Accent color</span>
              <ColorSwatches value={color} onChange={setColor} allowNone label="Accent color" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
