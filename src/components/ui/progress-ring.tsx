"use client";

import { motion } from "framer-motion";

export function ProgressRing({ ratio, color, size = 44, stroke = 5, label }: { ratio: number; color: string; size?: number; stroke?: number; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - ratio) }}
        transition={{ type: "spring", stiffness: 80, damping: 18 }}
      />
    </svg>
  );
}

export function ProgressBar({ ratio, color, label }: { ratio: number; color: string; label: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${ratio * 100}%` }} transition={{ type: "spring", stiffness: 90, damping: 20 }} />
    </div>
  );
}
