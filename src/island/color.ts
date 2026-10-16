/** Color helpers. Colors are "#rrggbb" strings or packed ABGR uint32 (canvas ImageData byte order). */

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgbToHex = ([r, g, b]: RGB) =>
  "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)]);
}

/** Positive amount lightens toward white, negative darkens toward a cool shadow. */
export function shade(hex: string, amount: number): string {
  return amount >= 0 ? mix(hex, "#ffffff", amount) : mix(hex, "#2a2140", -amount);
}

export function desaturate(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  return rgbToHex([lerp(r, l, amount), lerp(g, l, amount), lerp(b, l, amount)]);
}

export function pack(hex: string, alpha = 255): number {
  const [r, g, b] = hexToRgb(hex);
  return ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function unpack(c: number): { r: number; g: number; b: number; a: number } {
  return { r: c & 255, g: (c >>> 8) & 255, b: (c >>> 16) & 255, a: c >>> 24 };
}
