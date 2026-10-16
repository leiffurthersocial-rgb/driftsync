"use client";

import { MotionConfig } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { useApp } from "@/store/app-store";
import { useNow } from "@/hooks/use-now";
import { lightFor } from "@/lib/daycycle";
import { minutesOfDay } from "@/lib/time";

/** Hydrates the store and keeps the light/dark UI theme in step with the island's day/night. */
export function Providers({ children }: { children: ReactNode }) {
  const hydrate = useApp((s) => s.hydrate);
  const ready = useApp((s) => s.ready);
  const theme = useApp((s) => s.settings.theme);
  const now = useNow(60_000);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!ready) return;
    const { night } = lightFor(theme, minutesOfDay(now));
    document.documentElement.dataset.theme = night > 0.5 ? "dark" : "light";
  }, [ready, theme, now]);

  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
