"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  CheckSquare,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Footprints,
  Target,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/store/app-store";
import { toast, useUi } from "@/store/ui-store";
import { fuzzyScore } from "@/lib/fuzzy";
import { parseQuickAdd } from "@/lib/quick-add";
import { cn } from "@/lib/cn";

interface Command {
  id: string;
  label: string;
  group: string;
  icon: LucideIcon;
  hint?: string;
  run(): void;
}

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const areas = useApp((s) => s.areas);
  const name = useApp((s) => s.profile.characterName);
  const theme = useApp((s) => s.settings.theme);

  // Global Cmd/Ctrl+K and number-key navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUi.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setTimeout(() => input.current?.focus(), 20);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    const st = () => useApp.getState();
    const list: Command[] = [
      { id: "nav-island", label: "Go to island", group: "Navigate", icon: Sparkles, run: go("/") },
      { id: "nav-planner", label: "Plan tomorrow", group: "Navigate", icon: CalendarDays, run: go("/planner") },
      { id: "nav-today", label: "Plan today", group: "Navigate", icon: CalendarDays, run: go("/planner?day=today") },
      { id: "nav-todos", label: "Open to-dos", group: "Navigate", icon: CheckSquare, run: go("/todos") },
      { id: "nav-goals", label: "Open goals", group: "Navigate", icon: Target, run: go("/todos#goals") },
      { id: "nav-settings", label: "Open settings", group: "Navigate", icon: Settings, run: go("/settings") },
      {
        id: "add-area",
        label: "Add an area to the island",
        group: "Island",
        icon: Plus,
        run: () => {
          router.push("/");
          useUi.getState().setAddAreaOpen(true);
        },
      },
      {
        id: "theme",
        label: theme === "dusk" ? "Switch to automatic day/night" : "Switch to dusk theme",
        group: "Appearance",
        icon: theme === "dusk" ? Sun : Moon,
        run: () => st().updateSettings({ theme: theme === "dusk" ? "auto" : "dusk" }),
      },
    ];
    for (const a of areas) {
      list.push({
        id: `send-${a.id}`,
        label: `Send ${name || "character"} to ${a.name}`,
        group: "Character",
        icon: Footprints,
        run: () => {
          st().setOverride({ areaId: a.id, activityId: null });
          toast(`${name} is heading to ${a.name}`);
          router.push("/");
        },
      });
    }
    if (st().profile.override)
      list.push({
        id: "clear-send",
        label: `Let ${name} follow the plan again`,
        group: "Character",
        icon: Footprints,
        run: () => st().setOverride(null),
      });
    return list;
  }, [areas, name, theme, router]);

  const results = useMemo(() => {
    const q = query.trim();
    const scored = commands
      .map((c) => ({ c, s: q ? fuzzyScore(q, c.label) : 0 }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
    if (q) {
      const parsed = parseQuickAdd(q, useApp.getState().lists);
      scored.splice(Math.min(scored.length, scored.length && fuzzyScore(q, scored[0].label) > 500 ? 1 : 0), 0, {
        id: "quick-todo",
        label: `Add to-do: “${parsed.title}”`,
        hint: parsed.due ? `due ${parsed.due}` : undefined,
        group: "Create",
        icon: Plus,
        run: () => {
          if (!parsed.title) return;
          useApp.getState().addTodo(parsed);
          toast("To-do added", { tone: "success" });
        },
      });
    }
    return scored;
  }, [commands, query]);

  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const runAt = (i: number) => {
    const cmd = results[i];
    if (!cmd) return;
    setOpen(false);
    cmd.run();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[55] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div
            className="absolute inset-0 bg-[rgb(20_14_40/0.35)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-line/70 bg-surface shadow-float"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ type: "spring", stiffness: 500, damping: 36 }}
          >
            <div className="flex items-center gap-3 border-b border-line/60 px-4">
              <Search size={18} className="text-muted" aria-hidden />
              <input
                ref={input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setIndex((i) => Math.min(results.length - 1, i + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setIndex((i) => Math.max(0, i - 1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    runAt(index);
                  } else if (e.key === "Escape") {
                    setOpen(false);
                  }
                }}
                placeholder="Jump somewhere, or type a to-do…"
                className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted/70"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={results[index] ? `cmd-${results[index].id}` : undefined}
              />
              <kbd className="kbd">esc</kbd>
            </div>
            <ul id="palette-list" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
              {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nothing matches.</li>}
              {results.map((c, i) => (
                <li
                  key={c.id}
                  id={`cmd-${c.id}`}
                  role="option"
                  aria-selected={i === index}
                  data-index={i}
                  onMouseMove={() => setIndex(i)}
                  onClick={() => runAt(i)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                    i === index ? "bg-surface-2 text-ink" : "text-ink/90",
                  )}
                >
                  <c.icon size={16} className="text-muted" aria-hidden />
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="text-xs text-muted">{c.hint}</span>}
                  <span className="text-[11px] text-muted/80">{c.group}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
