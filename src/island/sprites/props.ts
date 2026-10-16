/**
 * Small decoration sprites as palette-indexed matrices.
 * Anchor is bottom-center of the matrix (where it touches the ground).
 */
export interface MatrixSprite {
  rows: readonly string[];
  palette: Record<string, string>;
}

const LEAF = { l: "#b7e39a", g: "#86c46f", G: "#5f9e52", t: "#9a6b4a", T: "#7a5038" };

export const PROPS = {
  treeRound: {
    rows: [
      "....lllg.....",
      "..llllgggg...",
      ".lllggggggG..",
      ".llgggggggGG.",
      "lggggggggggGG",
      "lgggggggggGGG",
      "gggggggggGGGG",
      ".gggggggGGGG.",
      ".GgggggGGGGG.",
      "..GGGGGGGGG..",
      "....GGtGG....",
      ".....tT......",
      ".....tT......",
      "....ttTT.....",
    ],
    palette: LEAF,
  },
  treePine: {
    rows: [
      "....l....",
      "...lgg...",
      "...lgG...",
      "..lggGG..",
      "..lggGG..",
      ".lgggGGG.",
      "..lggGG..",
      ".lggggGG.",
      "lggggGGGG",
      ".lgggGGG.",
      "lggggGGGG",
      "GGGGGGGGG",
      "....tT...",
      "...ttTT..",
    ],
    palette: { ...LEAF, g: "#6fb26a", G: "#4d8a52", l: "#94d18a" },
  },
  bush: {
    rows: ["..lgg..", ".lggggG", "lgggGGG", "gggGGGG", ".GGGGG."],
    palette: LEAF,
  },
  flowers: {
    rows: ["p...y.", ".g.p.w", "y.g.g.", ".gg.g."],
    palette: { p: "#ff8fab", y: "#ffd166", w: "#ffffff", g: "#5f9e4c" },
  },
  rock: {
    rows: ["..rrr..", ".rrrrR.", "rrrrRRR", ".RRRRR."],
    palette: { r: "#b9b2c6", R: "#8f88a0" },
  },
  lamp: {
    rows: [".kkk.", "kLLLk", "kLLLk", ".kkk.", "..k..", "..k..", "..k..", "..k..", "..k..", "..k..", ".kkk."],
    palette: { k: "#4b4458", L: "#ffe7a3" },
  },
  bench: {
    rows: ["wwwwwwww", "WWWWWWWW", "wwwwwwww", "k......k", "k......k"],
    palette: { w: "#c99a62", W: "#a97c4a", k: "#4b4458" },
  },
} satisfies Record<string, MatrixSprite>;

export type PropName = keyof typeof PROPS;
