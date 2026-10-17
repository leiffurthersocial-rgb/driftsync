"use client";

import { Check } from "lucide-react";
import type { ThemeDef } from "@/lib/themes";
import { cn } from "@/lib/cn";

const c = (v: string, a = 1) => `rgb(${v} / ${a})`;

/** A miniature of the app drawn in the palette's own colors. */
function Preview({ def }: { def: ThemeDef }) {
  const k = def.tokens;
  return (
    <span className="block overflow-hidden rounded-xl border" style={{ background: c(k.bg), borderColor: c(k.line) }} aria-hidden>
      <span className="flex gap-1.5 p-2">
        <span className="flex-1 space-y-1 rounded-lg p-1.5" style={{ background: c(k.surface), boxShadow: `0 1px 2px ${c(k.shadow, 0.12)}` }}>
          <span className="block h-1.5 w-3/4 rounded-full" style={{ background: c(k.ink) }} />
          <span className="block h-1.5 w-1/2 rounded-full" style={{ background: c(k.muted, 0.7) }} />
          <span className="mt-1.5 flex gap-1">
            <span className="block h-2.5 w-6 rounded" style={{ background: c(k.accent) }} />
            <span className="block h-2.5 w-4 rounded" style={{ background: c(k["surface-2"]) }} />
          </span>
        </span>
        <span className="w-6 space-y-1 rounded-lg p-1" style={{ background: c(k["surface-2"]) }}>
          <span className="block h-3 rounded-sm" style={{ background: "#4f9cc4" }} />
          <span className="block h-2 rounded-sm" style={{ background: "#e7795f" }} />
        </span>
      </span>
    </span>
  );
}

export function ThemePicker<T extends string>({
  label,
  defs,
  value,
  onChange,
}: {
  label: string;
  defs: (ThemeDef & { id: T })[];
  value: T;
  onChange(id: T): void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
      {defs.map((d) => {
        const on = d.id === value;
        return (
          <button
            key={d.id}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(d.id)}
            className={cn(
              "group relative rounded-2xl border p-1.5 text-left transition hover:-translate-y-0.5",
              on ? "border-accent bg-accent/10 shadow-soft" : "border-line/70 hover:border-muted/50",
            )}
          >
            <Preview def={d} />
            <span className="flex items-center gap-1 px-1 pb-0.5 pt-1.5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{d.name}</span>
                <span className="block truncate text-[11px] text-muted">{d.blurb}</span>
              </span>
              {on && <Check size={14} strokeWidth={3} className="shrink-0 text-accent" aria-hidden />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
