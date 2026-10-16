"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onSelect(): void;
  danger?: boolean;
  disabled?: boolean;
  hint?: ReactNode;
}

/** Small dropdown menu: keyboard navigable, closes on Esc / outside click. */
export function Menu({
  trigger,
  items,
  label,
  align = "end",
  className,
}: {
  trigger: ReactNode;
  items: (MenuItem | "divider" | { heading: string })[];
  label: string;
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    setTimeout(() => list.current?.querySelector<HTMLElement>("[role=menuitem]:not([disabled])")?.focus(), 10);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const els = Array.from(list.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (i + 1) % els.length : (i - 1 + els.length) % els.length;
    els[next]?.focus();
  };

  return (
    <div ref={root} className={cn("relative", className)}>
      <div onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        {trigger}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={list}
            role="menu"
            aria-label={label}
            onKeyDown={onListKey}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className={cn(
              "absolute z-40 mt-2 min-w-[220px] overflow-hidden rounded-2xl border border-line/70 bg-surface p-1.5 shadow-float",
              align === "end" ? "right-0" : "left-0",
            )}
          >
            {items.map((it, i) => {
              if (it === "divider") return <div key={i} className="my-1 h-px bg-line/60" />;
              if ("heading" in it)
                return (
                  <p key={i} className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {it.heading}
                  </p>
                );
              return (
                <button
                  key={i}
                  role="menuitem"
                  disabled={it.disabled}
                  onClick={() => {
                    setOpen(false);
                    it.onSelect();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm outline-none transition hover:bg-surface-2 focus:bg-surface-2 disabled:opacity-40",
                    it.danger && "text-danger",
                  )}
                >
                  {it.icon && <span className="text-muted">{it.icon}</span>}
                  <span className="flex-1">{it.label}</span>
                  {it.hint && <span className="text-xs text-muted">{it.hint}</span>}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
