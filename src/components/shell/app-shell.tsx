"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useApp } from "@/store/app-store";
import { BottomNav, TopNav } from "./nav";
import { CommandPalette } from "./command-palette";
import { Toaster } from "@/components/ui/toaster";
import { Onboarding } from "@/components/onboarding/onboarding";
import { Logo } from "./logo";
import { CloudSync } from "@/components/account/cloud-sync";

/** Sign-in pages render on their own (no nav, no onboarding gate). */
const AUTH_ROUTES = ["/login", "/auth"];

export function AppShell({ children }: { children: ReactNode }) {
  const ready = useApp((s) => s.ready);
  const onboarded = useApp((s) => s.profile.onboarded);
  const pathname = usePathname();

  // CloudSync stays mounted in the same spot whichever screen shows, so sync keeps running.
  const sync = ready ? <CloudSync /> : null;
  if (!ready) return <LoadingScreen />;
  if (AUTH_ROUTES.some((r) => pathname.startsWith(r)))
    return (
      <>
        {sync}
        {children}
        <Toaster />
      </>
    );
  if (!onboarded)
    return (
      <>
        {sync}
        <Onboarding />
        <Toaster />
      </>
    );

  return (
    <>
      {sync}
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <TopNav />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          id="main"
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="min-h-dvh"
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <BottomNav />
      <CommandPalette />
      <Toaster />
    </>
  );
}

function LoadingScreen() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="Loading Driftsync">
      <div className="flex flex-col items-center gap-4">
        <Logo className="animate-pulse" />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full w-full animate-shimmer bg-[linear-gradient(90deg,transparent,rgb(var(--accent)/0.5),transparent)] bg-[length:200%_100%]" />
        </div>
      </div>
    </div>
  );
}
