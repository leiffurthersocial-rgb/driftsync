"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/store/app-store";
import { toast } from "@/store/ui-store";
import { Logo } from "@/components/shell/logo";
import { Segmented } from "@/components/ui/controls";
import { cn } from "@/lib/cn";

const STEPS = ["Welcome", "Activities"] as const;

/** First-run flow: your name → what you do (and theme) → Today. Every step is skippable. */
export function Onboarding() {
  const profile = useApp((s) => s.profile);
  const activities = useApp((s) => s.activities);
  const theme = useApp((s) => s.settings.theme);
  const complete = useApp((s) => s.completeOnboarding);

  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.name);
  const sorted = [...activities].sort((a, b) => a.order - b.order);
  const [picked, setPicked] = useState<string[]>(() => sorted.map((a) => a.id));

  const finish = (skipAll = false) => {
    const finalName = skipAll ? profile.name : name.trim();
    complete({ name: finalName, activityIds: skipAll || !picked.length ? undefined : picked });
    toast(finalName ? `Welcome, ${finalName}` : "Welcome to Driftsync", { tone: "success" });
  };
  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish());

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10" aria-label="Welcome to Driftsync">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute -bottom-32 right-[-6rem] h-96 w-96 rounded-full bg-peach/15 blur-3xl" />
      </div>

      <motion.section
        aria-label={`Setup step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
        className="card relative flex w-full max-w-md flex-col overflow-hidden"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
      >
        <div className="flex items-center justify-between px-6 pt-5">
          <Logo />
          <button className="text-sm text-muted hover:text-ink" onClick={() => (step === 0 ? finish(true) : next())}>
            {step === 0 ? "Skip setup" : "Skip"}
          </button>
        </div>

        <div className="px-6 pb-2 pt-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
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
                    <p className="mt-2 text-sm text-muted">A calm place to plan your days, keep your to-dos and goals, and see it all on a calendar.</p>
                  </div>
                  <div>
                    <label htmlFor="ob-name" className="label">
                      What should we call you? <span className="normal-case tracking-normal">(optional)</span>
                    </label>
                    <input id="ob-name" autoFocus className="input" placeholder="Your name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <p className="label">Theme</p>
                    <Segmented
                      label="Theme"
                      value={theme}
                      onChange={(t) => useApp.getState().updateSettings({ theme: t })}
                      options={[
                        { value: "auto", label: "Time of day" },
                        { value: "system", label: "Device" },
                        { value: "light", label: "Light" },
                        { value: "dark", label: "Dark" },
                      ]}
                    />
                  </div>
                  <button type="submit" className="hidden" />
                </form>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-pixel text-2xl">What fills your days?</h2>
                    <p className="mt-1 text-sm text-muted">These become your planner activities. Rename, recolor or add more in Settings any time.</p>
                  </div>
                  <ul className="grid grid-cols-2 gap-2">
                    {sorted.map((a) => {
                      const on = picked.includes(a.id);
                      return (
                        <li key={a.id}>
                          <button
                            aria-pressed={on}
                            onClick={() => setPicked(on ? picked.filter((x) => x !== a.id) : [...picked, a.id])}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left text-sm transition",
                              on ? "border-accent/60 bg-accent/10" : "border-line/70 hover:bg-surface-2",
                            )}
                          >
                            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: a.color }} />
                            <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                            {on && <Check size={14} strokeWidth={3} className="text-accent" aria-hidden />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {!picked.length && <p className="text-xs text-muted">Pick at least one, or skip to keep them all.</p>}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-line/60 px-6 py-4">
          <ol className="flex gap-1.5" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li key={s} aria-current={i === step ? "step" : undefined}>
                <span className={cn("block h-1.5 rounded-full transition-all", i === step ? "w-6 bg-accent" : i < step ? "w-3 bg-accent/50" : "w-3 bg-line")} />
                <span className="sr-only">{s}</span>
              </li>
            ))}
          </ol>
          {step > 0 && (
            <button className="btn-ghost ml-auto" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={16} /> Back
            </button>
          )}
          <button className={cn("btn-primary", step === 0 && "ml-auto")} onClick={next}>
            {step === STEPS.length - 1 ? "Start" : "Continue"} <ArrowRight size={16} />
          </button>
        </div>
      </motion.section>
    </main>
  );
}
