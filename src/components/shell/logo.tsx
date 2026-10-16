import { cn } from "@/lib/cn";

/** Tiny pixel-art island mark rendered from a palette-indexed matrix. */
const MARK = [
  "...cccc.....",
  "..cccccc....",
  ".......rr...",
  "......rbbr..",
  "..ggggggggg.",
  ".GGGGGGGGGGG",
  "..dddddddd..",
  "...ssssss...",
  ".....ss.....",
];
const COLORS: Record<string, string> = {
  c: "#ffffff",
  r: "#e7795f",
  b: "#6e5ee6",
  g: "#8fd07a",
  G: "#6aa857",
  d: "#9a6b4a",
  s: "#7a7488",
};

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox={`0 0 ${MARK[0].length} ${MARK.length}`} className="h-6 w-8" shapeRendering="crispEdges" aria-hidden>
        {MARK.flatMap((row, y) =>
          [...row].map((ch, x) => (COLORS[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={COLORS[ch]} /> : null)),
        )}
      </svg>
      {withText && <span className="font-pixel text-lg leading-none tracking-wide">Driftsync</span>}
    </span>
  );
}
