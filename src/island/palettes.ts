/**
 * All island colors live here so the look can be restyled in one place.
 * "base" is the cozy pastel palette; "retro" is the optional bright palette.
 */
export interface TerrainPalette {
  grass: string;
  grassLight: string;
  grassDark: string;
  cliffTop: string;
  dirt: string;
  dirtDark: string;
  rock: string;
  rockDark: string;
  rockDeep: string;
  path: string;
  pathDark: string;
  plaza: string;
  plazaDark: string;
  outline: string;
}

export const TERRAIN: Record<"base" | "retro", TerrainPalette> = {
  base: {
    grass: "#9ad582",
    grassLight: "#b0e294",
    grassDark: "#86c46f",
    cliffTop: "#6fae5b",
    dirt: "#b07e58",
    dirtDark: "#936446",
    rock: "#9a92a8",
    rockDark: "#7d7590",
    rockDeep: "#625a78",
    path: "#efdcb2",
    pathDark: "#dcc394",
    plaza: "#e3ddd3",
    plazaDark: "#c9c0b3",
    outline: "#3d3352",
  },
  retro: {
    grass: "#5ed45e",
    grassLight: "#8af08a",
    grassDark: "#3fb84a",
    cliffTop: "#2e9c3e",
    dirt: "#d0783c",
    dirtDark: "#a8542a",
    rock: "#8484c8",
    rockDark: "#6060a8",
    rockDeep: "#48408c",
    path: "#ffe08a",
    pathDark: "#f0c050",
    plaza: "#f0f0f0",
    plazaDark: "#c8c8d8",
    outline: "#202040",
  },
};

export interface SkyStop {
  top: string;
  bottom: string;
}

export const SKY = {
  day: { top: "#a8daf2", bottom: "#fdf2e4" },
  golden: { top: "#f2a6a6", bottom: "#ffd8a3" },
  night: { top: "#120f2c", bottom: "#4a3770" },
  retroDay: { top: "#4cc2ff", bottom: "#c8f3ff" },
} satisfies Record<string, SkyStop>;

/** Overlay applied to the island at night (lofi purple) and in golden hour (warm). */
export const NIGHT_TINT = "#2b1f5e";
export const GOLDEN_TINT = "#ff9a5c";
export const WINDOW_GLOW = "#ffd27a";
