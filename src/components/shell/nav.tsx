"use client";

import { CalendarClock, CalendarDays, CheckSquare, Command, Home, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "./logo";
import { useUi } from "@/store/ui-store";
import { cn } from "@/lib/cn";

export const NAV_ITEMS = [
  { href: "/", label: "Today", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/planner", label: "Planner", icon: CalendarClock },
  { href: "/todos", label: "To-dos", icon: CheckSquare },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function TopNav() {
  const pathname = usePathname();
  const openPalette = useUi((s) => s.setPaletteOpen);
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-line/60 bg-bg/80 px-4 backdrop-blur-md sm:px-6">
      <Link href="/" className="rounded-lg" aria-label="Driftsync home">
        <Logo />
      </Link>
      <nav aria-label="Main" className="absolute left-1/2 hidden -translate-x-1/2 md:block">
        <ul className="flex gap-1 rounded-2xl bg-surface-2/70 p-1">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <li key={item.href} className="relative">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative z-10 flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium transition",
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
        className="btn h-9 gap-2 rounded-xl border border-line/70 bg-surface px-3 text-muted hover:text-ink"
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
      <ul className="grid grid-cols-5">
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
