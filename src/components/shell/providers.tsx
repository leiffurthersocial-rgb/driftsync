"use client";

import { MotionConfig } from "framer-motion";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useApp } from "@/store/app-store";
import { useNow } from "@/hooks/use-now";
import { isDark } from "@/lib/daycycle";
import { minutesOfDay } from "@/lib/time";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Hydrates the store and keeps the light/dark theme in step with the setting, the clock and the OS. */
export function Providers({ children }: { children: ReactNode }) {
  const hydrate = useApp((s) => s.hydrate);
  const ready = useApp((s) => s.ready);
  const theme = useApp((s) => s.settings.theme);
  const now = useNow(60_000);
  const systemDark = useSyncExternalStore(subscribe, () => window.matchMedia(DARK_QUERY).matches, () => false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = isDark(theme, minutesOfDay(now), systemDark) ? "dark" : "light";
  }, [ready, theme, now, systemDark]);

  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
