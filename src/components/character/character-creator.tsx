"use client";

import { Dices } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  BOTTOMS,
  EYE_STYLES,
  EYEWEAR,
  FACIAL_HAIR,
  HAIR_STYLES,
  HEADWEAR,
  NECKWEAR,
  TOP_PATTERNS,
  TOPS,
  type Appearance,
} from "@/data/schema";
import { ColorSwatches, Switch, SWATCHES } from "@/components/ui/controls";
import { EYE_COLORS, HAIR_COLORS, SKIN_TONES, type AnimName } from "@/island/sprites/character";
import { CharacterPreview } from "./character-preview";
import { cn } from "@/lib/cn";

const LABELS: Record<string, string> = {
  // hair
  short: "Short",
  buzz: "Buzz",
  long: "Long",
  bob: "Bob",
  ponytail: "Ponytail",
  bun: "Bun",
  pigtails: "Pigtails",
  curly: "Curly",
  afro: "Afro",
  spiky: "Spiky",
  mohawk: "Mohawk",
  wavy: "Wavy",
  bald: "Bald",
  // eyes
  dot: "Dot",
  round: "Round",
  sparkle: "Sparkle",
  sleepy: "Sleepy",
  lashes: "Lashes",
  // facial hair & generic
  none: "None",
  stubble: "Stubble",
  mustache: "Mustache",
  beard: "Beard",
  // tops
  tee: "T-shirt",
  hoodie: "Hoodie",
  sweater: "Sweater",
  shirt: "Shirt",
  tank: "Tank top",
  dress: "Dress",
  overalls: "Overalls",
  solid: "Solid",
  stripes: "Stripes",
  dots: "Dots",
  pants: "Pants",
  shorts: "Shorts",
  skirt: "Skirt",
  // headwear
  cap: "Cap",
  beanie: "Beanie",
  bucket: "Bucket hat",
  headband: "Headband",
  headphones: "Headphones",
  flower: "Flower",
  bow: "Bow",
  // eyewear
  square: "Square glasses",
  sunglasses: "Sunglasses",
  // neck
  scarf: "Scarf",
  necklace: "Necklace",
};
LABELS.round = "Round";

const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

export function randomAppearance(prev?: Appearance): Appearance {
  const top = pick(TOPS);
  return {
    skin: Math.floor(Math.random() * SKIN_TONES.length),
    hairStyle: pick(HAIR_STYLES),
    hairColor: pick(HAIR_COLORS),
    eyeStyle: pick(EYE_STYLES),
    eyeColor: pick(EYE_COLORS),
    blush: Math.random() < 0.7,
    freckles: Math.random() < 0.25,
    facialHair: Math.random() < 0.75 ? "none" : pick(FACIAL_HAIR),
    top,
    outfitColor: pick(SWATCHES),
    topPattern: Math.random() < 0.6 ? "solid" : pick(TOP_PATTERNS),
    bottom: pick(BOTTOMS),
    bottomColor: pick(["#3d3a5c", "#4f6a8f", "#6b4f3f", "#2f2a3a", "#8f8a99", "#5f7a52"]),
    shoesColor: pick(["#4b4458", "#f4f1ea", "#7a4f3a", "#2f2a3a", "#c4553a"]),
    headwear: Math.random() < 0.5 ? "none" : pick(HEADWEAR),
    headwearColor: pick(SWATCHES),
    eyewear: Math.random() < 0.7 ? "none" : pick(EYEWEAR),
    neckwear: Math.random() < 0.8 ? "none" : pick(NECKWEAR),
    neckwearColor: pick(SWATCHES),
    backpack: Math.random() < 0.15,
    sportColor: prev?.sportColor ?? pick(SWATCHES),
    sportSwitch: prev?.sportSwitch ?? true,
  };
}

const TABS = ["Face", "Hair", "Outfit", "Extras", "Sport"] as const;
type Tab = (typeof TABS)[number];

export function CharacterCreator({
  appearance,
  onChange,
  name,
  compact,
}: {
  appearance: Appearance;
  onChange(a: Appearance): void;
  name: string;
  compact?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Face");
  const [pose, setPose] = useState<AnimName>("idle");
  const set = (patch: Partial<Appearance>) => onChange({ ...appearance, ...patch });

  return (
    <div className="space-y-4">
      {!compact && <h2 className="font-pixel text-2xl">Make {name} yours</h2>}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2/60 p-3">
        <div className="flex items-end gap-1">
          <CharacterPreview appearance={appearance} anim={pose} scale={3} label={`Preview of ${name}`} className="h-[168px] w-[120px]" />
          <CharacterPreview appearance={appearance} anim={pose === "idle" ? "jacks" : "run"} outfit="sport" scale={2} label={`${name} in gym clothes`} className="h-[112px] w-20 opacity-90" />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-xs text-muted">Live preview — casual look and gym look.</p>
          <div role="radiogroup" aria-label="Preview pose" className="flex gap-1">
            {(
              [
                ["idle", "Still"],
                ["walk", "Walk"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={pose === v}
                onClick={() => setPose(v)}
                className={cn("chip", pose === v ? "border-accent bg-accent/10 text-ink" : "text-muted")}
              >
                {l}
              </button>
            ))}
          </div>
          <button type="button" className="btn-soft self-start" onClick={() => onChange(randomAppearance(appearance))}>
            <Dices size={16} /> Randomize
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="Customize" className="flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1 [scrollbar-width:none]">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition", tab === t ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink")}
          >
            {t}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={tab} className="space-y-4">
        {tab === "Face" && (
          <>
            <Field label="Skin">
              <ColorSwatches label="Skin tone" colors={SKIN_TONES} value={SKIN_TONES[appearance.skin]} onChange={(c) => set({ skin: Math.max(0, SKIN_TONES.indexOf(c ?? "")) })} />
            </Field>
            <Field label="Eyes">
              <Chips options={EYE_STYLES} value={appearance.eyeStyle} onChange={(eyeStyle) => set({ eyeStyle })} label="Eye style" />
            </Field>
            <Field label="Eye color">
              <ColorSwatches label="Eye color" colors={EYE_COLORS} value={appearance.eyeColor} onChange={(c) => c && set({ eyeColor: c })} />
            </Field>
            <Field label="Facial hair">
              <Chips options={FACIAL_HAIR} value={appearance.facialHair} onChange={(facialHair) => set({ facialHair })} label="Facial hair" />
            </Field>
            <div className="flex flex-wrap gap-6">
              <Toggle label="Blush" checked={appearance.blush} onChange={(blush) => set({ blush })} />
              <Toggle label="Freckles" checked={appearance.freckles} onChange={(freckles) => set({ freckles })} />
            </div>
          </>
        )}
        {tab === "Hair" && (
          <>
            <Field label="Style">
              <Chips options={HAIR_STYLES} value={appearance.hairStyle} onChange={(hairStyle) => set({ hairStyle })} label="Hair style" />
            </Field>
            <Field label="Color">
              <ColorSwatches label="Hair color" colors={HAIR_COLORS} value={appearance.hairColor} onChange={(c) => c && set({ hairColor: c })} />
            </Field>
          </>
        )}
        {tab === "Outfit" && (
          <>
            <Field label="Top">
              <Chips options={TOPS} value={appearance.top} onChange={(top) => set({ top })} label="Top" />
            </Field>
            <Field label="Top color">
              <ColorSwatches label="Top color" value={appearance.outfitColor} onChange={(c) => c && set({ outfitColor: c })} />
            </Field>
            <Field label="Pattern">
              <Chips options={TOP_PATTERNS} value={appearance.topPattern} onChange={(topPattern) => set({ topPattern })} label="Pattern" />
            </Field>
            {appearance.top !== "dress" && (
              <Field label={appearance.top === "overalls" ? "Overalls" : "Bottoms"}>
                {appearance.top !== "overalls" && <Chips options={BOTTOMS} value={appearance.bottom} onChange={(bottom) => set({ bottom })} label="Bottoms" />}
                <div className="mt-2">
                  <ColorSwatches
                    label="Bottoms color"
                    colors={["#3d3a5c", "#4f6a8f", "#6b4f3f", "#2f2a3a", "#8f8a99", "#5f7a52", "#c98a6a", "#e9c95b", "#d77fb4", "#f4f1ea"]}
                    value={appearance.bottomColor}
                    onChange={(c) => c && set({ bottomColor: c })}
                  />
                </div>
              </Field>
            )}
            <Field label="Shoes">
              <ColorSwatches label="Shoe color" colors={["#4b4458", "#f4f1ea", "#7a4f3a", "#2f2a3a", "#c4553a", "#4f9cc4", "#5fae84", "#e9c95b"]} value={appearance.shoesColor} onChange={(c) => c && set({ shoesColor: c })} />
            </Field>
          </>
        )}
        {tab === "Extras" && (
          <>
            <Field label="Headwear">
              <Chips options={HEADWEAR} value={appearance.headwear} onChange={(headwear) => set({ headwear })} label="Headwear" />
              {appearance.headwear !== "none" && (
                <div className="mt-2">
                  <ColorSwatches label="Headwear color" value={appearance.headwearColor} onChange={(c) => c && set({ headwearColor: c })} />
                </div>
              )}
            </Field>
            <Field label="Glasses">
              <Chips options={EYEWEAR} value={appearance.eyewear} onChange={(eyewear) => set({ eyewear })} label="Glasses" />
            </Field>
            <Field label="Neck">
              <Chips options={NECKWEAR} value={appearance.neckwear} onChange={(neckwear) => set({ neckwear })} label="Neckwear" />
              {appearance.neckwear !== "none" && (
                <div className="mt-2">
                  <ColorSwatches label="Neckwear color" value={appearance.neckwearColor} onChange={(c) => c && set({ neckwearColor: c })} />
                </div>
              )}
            </Field>
            <Toggle label="Backpack" checked={appearance.backpack} onChange={(backpack) => set({ backpack })} />
          </>
        )}
        {tab === "Sport" && (
          <>
            <Toggle
              label="Change into gym clothes for sports"
              hint="Workouts and runs switch to a tank top, shorts and sneakers."
              checked={appearance.sportSwitch}
              onChange={(sportSwitch) => set({ sportSwitch })}
            />
            <Field label="Gym clothes color">
              <ColorSwatches label="Gym clothes color" value={appearance.sportColor} onChange={(c) => c && set({ sportColor: c })} />
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

function Chips<T extends string>({ options, value, onChange, label }: { options: readonly T[]; value: T; onChange(v: T): void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn("chip transition", value === o ? "border-accent bg-accent/10 text-ink" : "text-muted hover:text-ink")}
        >
          {LABELS[o] ?? o}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
