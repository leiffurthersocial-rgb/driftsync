/**
 * 7x7 sign icons, palette-indexed: k = ink, w = white, a = accent, . = transparent.
 * Add a new icon here and reference it from a building spec.
 */
export const ICONS = {
  dumbbell: [".......", "k.....k", "kk...kk", "kkkkkkk", "kk...kk", "k.....k", "......."],
  pencil: [".....kk", "....kak", "...kak.", "..kak..", ".kak...", "kwk....", "kk....."],
  book: ["kk...kk", "kwk.kwk", "kwwkwwk", "kwwkwwk", "kwwkwwk", "kkkkkkk", "......."],
  camera: ["..kk...", "kkkkkkk", "kwkkkwk", "kkwakkk", "kkaakkk", "kkkkkkk", "......."],
  wrench: [".k...k.", ".kk.kk.", "..kkk..", "...k...", "...k...", "...k...", "..kkk.."],
  star: ["...k...", "..kak..", "kkaaakk", ".kaaak.", ".kakak.", "kk...kk", "......."],
  flag: ["kaaaa..", "kaaaaa.", "kaaaa..", "k......", "k......", "k......", "k......"],
} as const;

export type IconName = keyof typeof ICONS;
