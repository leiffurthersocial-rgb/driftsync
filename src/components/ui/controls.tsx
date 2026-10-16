"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const SWATCHES = [
  "#e7795f",
  "#eea54b",
  "#e9c95b",
  "#7fbf6a",
  "#5fae84",
  "#4fb3b0",
  "#4f9cc4",
  "#7c8cf0",
  "#a888de",
  "#d77fb4",
  "#c98a6a",
  "#93a6bd",
];

export function ColorSwatches({
  value,
  onChange,
  colors = SWATCHES,
  label = "Color",
  allowNone,
}: {
  value: string | null;
  onChange(c: string | null): void;
  colors?: string[];
  label?: string;
  allowNone?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {allowNone && (
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          aria-label="Default color"
          onClick={() => onChange(null)}
          className={cn(
            "grid h-8 w-8 place-items-center rounded-full border-2 border-dashed border-line text-[10px] text-muted transition",
            value === null && "border-ink",
          )}
        >
          auto
        </button>
      )}
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value?.toLowerCase() === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className="grid h-8 w-8 place-items-center rounded-full ring-offset-2 ring-offset-surface transition hover:scale-110"
          style={{ background: c, boxShadow: value?.toLowerCase() === c ? `0 0 0 2px rgb(var(--surface)), 0 0 0 4px ${c}` : undefined }}
        >
          {value?.toLowerCase() === c && <Check size={14} className="text-white drop-shadow" />}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange(v: T): void;
  options: { value: T; label: ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-xl bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition",
            o.value === value ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 rounded-full transition", checked ? "bg-accent" : "bg-line")}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
          checked ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="mb-1 grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-muted">{icon}</div>
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-xs text-sm text-muted">{children}</div>}
    </div>
  );
}
