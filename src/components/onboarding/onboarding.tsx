"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AREA_TYPES, type Appearance, type AreaType } from "@/data/schema";
import { useApp } from "@/store/app-store";
import { toast, useUi } from "@/store/ui-store";
import { AREA_BLURBS, AREA_LABELS } from "@/lib/activities";
import { buildLayout, placeWithGrowth, sizeForTier, type AreaPos } from "@/lib/island-layout";
import { lightFor } from "@/lib/daycycle";
import { minutesOfDay } from "@/lib/time";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { IslandCanvas } from "@/components/island/island-canvas";
import { BuildingPreview } from "@/components/island/building-preview";
import { CharacterCreator } from "@/components/character/character-creator";
import { CharacterController } from "@/island/character/controller";
import type { SceneWorld } from "@/island/scene";
import { Logo } from "@/components/shell/logo";
import { cn } from "@/lib/cn";

const DEFAULT_AREAS: AreaType[] = ["gym", "study", "library", "track"];
const STEPS = ["Welcome", "Character", "Areas"] as const;

/** First-run flow: name → character → starter areas → island assembles. Every step is skippable. */
export function Onboarding() {
  const profile = useApp((s) => s.profile);
  const island = useApp((s) => s.island);
  const theme = useApp((s) => s.settings.theme);
  const complete = useApp((s) => s.completeOnboarding);
  const reduced = usePrefersReducedMotion();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.characterName === "Pip" ? "" : profile.characterName);
  const [islandName, setIslandName] = useState(island.name === "Driftsync" ? "" : island.name);
  const [appearance, setAppearance] = useState<Appearance>(profile.appearance);
  const existingAreas = useApp((s) => s.areas);
  const [areas, setAreas] = useState<AreaType[]>(() =>
    existingAreas.length ? [...new Set(existingAreas.map((a) => a.type))] : DEFAULT_AREAS,
  );

  // Live preview island built exactly as the real placement will build it.
  const world = useMemo<SceneWorld>(() => {
    let tier = 0;
    const pos: AreaPos[] = [];
    areas.forEach((t, i) => {
      const r = placeWithGrowth(tier, island.seed, pos);
      if (!r) return;
      tier = r.tier;
      pos.push({ id: `${t}-${i}`, x: r.x, y: r.y });
    });
    return {
      layout: buildLayout(sizeForTier(tier), island.seed, pos),
      palette: theme === "retro" ? "retro" : "base",
      areas: pos.map((p) => ({ id: p.id, type: p.id.split("-")[0] as AreaType, name: "", color: null, variant: 0, vitality: "neutral" })),
    };
  }, [areas, island.seed, theme]);

  const [character] = useState(() => new CharacterController(appearance, name));
  character.appearance = appearance;
  useEffect(() => {
    character.setAreas(world.areas.map((a) => ({ id: a.id, type: a.type, variant: a.variant, name: a.name })));
    character.setLayout(world.layout);
    character.setIntent({ source: "none", areaId: null, areaType: null, animation: "generic", label: "", until: null, key: "none", style: "auto" });
  }, [character, world.layout, world.areas]);

  const light = lightFor(theme, minutesOfDay(new Date()));

  const finish = (skipAll = false) => {
    useUi.getState().setIntroPending(true);
    const finalName = (skipAll ? "" : name).trim() || "Pip";
    complete({
      characterName: finalName,
      islandName: (skipAll ? "" : islandName).trim() || "Driftsync",
      appearance,
      areaTypes: skipAll ? DEFAULT_AREAS : areas,
    });
    setTimeout(() => toast(`Welcome home, ${finalName}`, { tone: "success" }), 2600);
  };

  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish());

  return (
    <main className="fixed inset-0 overflow-hidden" aria-label="Welcome to Driftsync">
      <motion.div
        className="absolute inset-0 md:left-[440px]"
        initial={reduced ? false : { y: 220, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        aria-hidden
      >
        <IslandCanvas
          className="h-full w-full"
          world={world}
          night={light.night}
          golden={light.golden}
          reducedMotion={reduced}
          actor={character}
          interactive={false}
          label="Preview of your island"
        />
      </motion.div>
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[460px] bg-gradient-to-r from-bg via-bg/70 to-transparent md:block" />

      <div className="absolute left-4 top-4 sm:left-6 sm:top-5">
        <Logo />
      </div>

      <div className="absolute inset-x-0 bottom-0 max-h-[72dvh] md:inset-y-0 md:left-6 md:right-auto md:flex md:max-h-none md:w-[400px] md:items-center">
        <motion.section
          aria-label={`Setup step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
          className="card flex max-h-[72dvh] w-full flex-col overflow-hidden rounded-b-none bg-surface/95 backdrop-blur-md md:max-h-[86dvh] md:rounded-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 28 }}
        >
          <div className="flex items-center justify-between px-6 pt-5">
            <ol className="flex gap-1.5" aria-label="Progress">
              {STEPS.map((s, i) => (
                <li key={s} aria-current={i === step ? "step" : undefined}>
                  <span className={cn("block h-1.5 rounded-full transition-all", i === step ? "w-6 bg-accent" : i < step ? "w-3 bg-accent/50" : "w-3 bg-line")} />
                  <span className="sr-only">{s}</span>
                </li>
              ))}
            </ol>
            <button className="text-sm text-muted hover:text-ink" onClick={() => (step === 0 ? finish(true) : next())}>
              {step === 0 ? "Skip setup" : "Skip"}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2 pt-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                {step === 0 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      next();
                    }}
                    className="space-y-5"
                  >
                    <div>
                      <h1 className="font-pixel text-3xl leading-tight">Welcome to Driftsync</h1>
                      <p className="mt-2 text-sm text-muted">A calm little island for your days. Someone small lives here — what should we call them?</p>
                    </div>
                    <div>
                      <label htmlFor="ob-name" className="label">
                        Character name
                      </label>
                      <input id="ob-name" autoFocus className="input" placeholder="Pip" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="ob-island" className="label">
                        Island name <span className="normal-case tracking-normal text-muted/70">(optional)</span>
                      </label>
                      <input id="ob-island" className="input" placeholder="Driftsync" maxLength={40} value={islandName} onChange={(e) => setIslandName(e.target.value)} />
                    </div>
                    <button type="submit" className="hidden" />
                  </form>
                )}

                {step === 1 && (
                  <CharacterCreator appearance={appearance} onChange={setAppearance} name={name.trim() || "Pip"} />
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="font-pixel text-2xl">Pick your places</h2>
                      <p className="mt-1 text-sm text-muted">These become buildings on your island. Add or change them any time.</p>
                    </div>
                    <ul className="grid grid-cols-2 gap-2">
                      {AREA_TYPES.map((t) => {
                        const on = areas.includes(t);
                        return (
                          <li key={t}>
                            <button
                              aria-pressed={on}
                              onClick={() => setAreas(on ? areas.filter((a) => a !== t) : [...areas, t])}
                              className={cn(
                                "relative flex w-full items-center gap-2 rounded-2xl border p-2 text-left transition",
                                on ? "border-accent/60 bg-accent/10" : "border-line/70 hover:bg-surface-2",
                              )}
                            >
                              <BuildingPreview type={t} className="h-[44px] w-[52px] shrink-0" />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium">{AREA_LABELS[t]}</span>
                                <span className="block truncate text-[11px] text-muted">{AREA_BLURBS[t]}</span>
                              </span>
                              {on && (
                                <span className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-accent text-accent-ink">
                                  <Check size={11} strokeWidth={3} />
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 border-t border-line/60 px-6 py-4">
            {step > 0 && (
              <button className="btn-ghost" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={16} /> Back
              </button>
            )}
            <button className="btn-primary ml-auto" onClick={next}>
              {step === STEPS.length - 1 ? "Build my island" : "Continue"} <ArrowRight size={16} />
            </button>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
