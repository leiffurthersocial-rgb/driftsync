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

/** Hydrates the store and keeps the palette in step with the theme setting, the clock and the OS. */
export function Providers({ children }: { children: ReactNode }) {
  const hydrate = useApp((s) => s.hydrate);
  const ready = useApp((s) => s.ready);
  const theme = useApp((s) => s.settings.theme);
  const lightTheme = useApp((s) => s.settings.lightTheme);
  const darkTheme = useApp((s) => s.settings.darkTheme);
  const now = useNow(60_000);
  const systemDark = useSyncExternalStore(subscribe, () => window.matchMedia(DARK_QUERY).matches, () => false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!ready) return;
    const dark = isDark(theme, minutesOfDay(now), systemDark);
    const el = document.documentElement;
    el.dataset.mode = dark ? "dark" : "light";
    el.dataset.theme = dark ? darkTheme : lightTheme;
  }, [ready, theme, lightTheme, darkTheme, now, systemDark]);

  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
