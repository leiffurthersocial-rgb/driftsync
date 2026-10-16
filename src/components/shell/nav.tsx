"use client";

import { CalendarDays, CheckSquare, Command, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "./logo";
import { useUi } from "@/store/ui-store";
import { cn } from "@/lib/cn";

export const NAV_ITEMS = [
  { href: "/", label: "Island", icon: Sparkles, key: "1" },
  { href: "/planner", label: "Planner", icon: CalendarDays, key: "2" },
  { href: "/todos", label: "To-dos", icon: CheckSquare, key: "3" },
  { href: "/settings", label: "Settings", icon: Settings, key: "4" },
] as const;

export function TopNav() {
  const pathname = usePathname();
  const openPalette = useUi((s) => s.setPaletteOpen);
  const onIsland = pathname === "/";
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between gap-4 px-4 sm:px-6",
        !onIsland && "border-b border-line/60 bg-bg/80 backdrop-blur-md",
      )}
    >
      <Link href="/" className="rounded-lg" aria-label="Driftsync home">
        <Logo />
      </Link>
      <nav aria-label="Main" className="absolute left-1/2 hidden -translate-x-1/2 md:block">
        <ul className={cn("flex gap-1 rounded-2xl p-1", onIsland ? "bg-surface/80 shadow-soft backdrop-blur-md" : "bg-surface-2/70")}>
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <li key={item.href} className="relative">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative z-10 flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-medium transition",
                    active ? "text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  <item.icon size={16} aria-hidden />
                  {item.label}
                </Link>
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl bg-surface shadow-soft"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <button
        onClick={() => openPalette(true)}
        className={cn(
          "btn h-9 gap-2 rounded-xl border border-line/70 px-3 text-muted hover:text-ink",
          onIsland ? "bg-surface/80 shadow-soft backdrop-blur-md" : "bg-surface",
        )}
        aria-label="Open command palette"
      >
        <Command size={15} aria-hidden />
        <span className="hidden text-sm sm:inline">Search</span>
        <kbd className="kbd hidden sm:inline">⌘K</kbd>
      </button>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <item.icon size={20} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
