import type { DarkTheme, LightTheme, ThemeId } from "@/data/schema";

/** Design tokens as "r g b" triplets so Tailwind opacity modifiers work. */
export interface ThemeTokens {
  bg: string;
  surface: string;
  "surface-2": string;
  line: string;
  ink: string;
  muted: string;
  accent: string;
  "accent-ink": string;
  sage: string;
  peach: string;
  danger: string;
  shadow: string;
}

export interface ThemeDef {
  id: ThemeId;
  name: string;
  blurb: string;
  mode: "light" | "dark";
  tokens: ThemeTokens;
}

const t = (mode: "light" | "dark", id: ThemeId, name: string, blurb: string, tokens: ThemeTokens): ThemeDef => ({ id, name, blurb, mode, tokens });

/** Every palette. Each pairing is checked for WCAG AA contrast in the axe audit. */
export const THEME_DEFS: ThemeDef[] = [
  t("light", "paper", "Paper", "Warm cream, soft violet", {
    bg: "246 241 233", surface: "255 252 247", "surface-2": "240 234 224", line: "226 218 205",
    ink: "43 37 64", muted: "98 90 118", accent: "110 94 230", "accent-ink": "255 255 255",
    sage: "110 168 120", peach: "176 92 56", danger: "182 60 60", shadow: "60 40 90",
  }),
  t("light", "cloud", "Cloud", "Crisp white, calm blue", {
    bg: "241 244 248", surface: "255 255 255", "surface-2": "231 236 243", line: "216 223 233",
    ink: "22 30 46", muted: "82 94 114", accent: "37 99 235", "accent-ink": "255 255 255",
    sage: "40 140 90", peach: "176 80 20", danger: "190 30 30", shadow: "30 40 70",
  }),
  t("light", "sakura", "Sakura", "Blush pink, rose", {
    bg: "251 240 243", surface: "255 250 251", "surface-2": "246 229 235", line: "237 212 221",
    ink: "58 28 44", muted: "116 80 97", accent: "184 44 102", "accent-ink": "255 255 255",
    sage: "80 140 100", peach: "168 78 40", danger: "180 40 50", shadow: "90 30 60",
  }),
  t("light", "mint", "Mint", "Fresh green, teal", {
    bg: "236 245 241", surface: "250 254 252", "surface-2": "223 238 231", line: "204 226 216",
    ink: "20 46 38", muted: "70 99 89", accent: "13 122 104", "accent-ink": "255 255 255",
    sage: "50 130 80", peach: "168 82 36", danger: "180 50 50", shadow: "20 60 50",
  }),
  t("dark", "dusk", "Dusk", "Cozy purple evening", {
    bg: "22 19 38", surface: "33 29 55", "surface-2": "44 39 72", line: "60 54 94",
    ink: "238 234 255", muted: "166 158 200", accent: "170 155 255", "accent-ink": "24 18 48",
    sage: "140 200 150", peach: "245 170 135", danger: "240 120 120", shadow: "0 0 0",
  }),
  t("dark", "midnight", "Midnight", "True black, great on OLED", {
    bg: "0 0 0", surface: "17 17 19", "surface-2": "30 30 34", line: "48 48 54",
    ink: "236 236 240", muted: "160 160 170", accent: "140 150 250", "accent-ink": "8 8 20",
    sage: "120 200 140", peach: "250 170 120", danger: "248 113 113", shadow: "0 0 0",
  }),
  t("dark", "dim", "Dim", "Soft slate blue", {
    bg: "21 32 43", surface: "30 41 54", "surface-2": "39 52 68", line: "58 72 90",
    ink: "231 236 240", muted: "164 176 189", accent: "56 170 245", "accent-ink": "6 18 30",
    sage: "60 200 140", peach: "250 175 110", danger: "249 112 120", shadow: "0 0 0",
  }),
  t("dark", "forest", "Forest", "Deep green, mint", {
    bg: "15 25 21", surface: "23 37 31", "surface-2": "32 50 42", line: "50 72 62",
    ink: "226 240 232", muted: "150 176 162", accent: "110 210 160", "accent-ink": "8 28 18",
    sage: "140 210 160", peach: "240 170 120", danger: "240 120 120", shadow: "0 0 0",
  }),
  t("dark", "ember", "Ember", "Warm coffee, amber", {
    bg: "27 21 19", surface: "39 31 28", "surface-2": "52 42 38", line: "74 62 56",
    ink: "245 236 228", muted: "182 164 152", accent: "245 160 92", "accent-ink": "32 18 8",
    sage: "150 200 140", peach: "250 178 132", danger: "245 122 112", shadow: "0 0 0",
  }),
];

export const themeDef = (id: ThemeId) => THEME_DEFS.find((d) => d.id === id) ?? THEME_DEFS[0];
export const LIGHT_DEFS = THEME_DEFS.filter((d) => d.mode === "light") as (ThemeDef & { id: LightTheme })[];
export const DARK_DEFS = THEME_DEFS.filter((d) => d.mode === "dark") as (ThemeDef & { id: DarkTheme })[];

const vars = (tokens: ThemeTokens) =>
  Object.entries(tokens)
    .map(([k, v]) => `--${k}:${v};`)
    .join("");

/** CSS for every palette, keyed by `data-theme` on <html>. Paper is the fallback before the theme script runs. */
export function themeCss(): string {
  const rules = THEME_DEFS.map((d) => `[data-theme="${d.id}"]{${vars(d.tokens)}color-scheme:${d.mode};}`);
  return `:root{${vars(THEME_DEFS[0].tokens)}color-scheme:light;}${rules.join("")}`;
}
