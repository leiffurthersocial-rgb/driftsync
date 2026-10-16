import type { AreaType } from "@/data/schema";
import { FOOTPRINT, type Layout } from "@/lib/island-layout";
import { rng } from "@/lib/random";
import { mix } from "./color";
import { decorate, floatingRocks, type Decoration } from "./decor";
import { areaDepth, isoX, isoY, worldMetrics, HALF_H, HALF_W, TILE_W } from "./iso";
import { GOLDEN_TINT, NIGHT_TINT, SKY, TERRAIN } from "./palettes";
import { renderBuilding, type BuildingSprites, type Vitality } from "./sprites/buildings";
import { renderCloud } from "./sprites/clouds";
import { propArt, type PropArt } from "./sprites/props";
import { renderTerrain } from "./sprites/terrain";

export interface SceneArea {
  id: string;
  type: AreaType;
  name: string;
  color: string | null;
  variant: number;
  vitality: Vitality;
}

export interface SceneWorld {
  layout: Layout;
  areas: SceneArea[];
  palette: "base" | "retro";
}

/** Something that lives on the island and draws itself in depth order (e.g. the character). */
export interface Actor {
  update(dt: number, timeMs: number): void;
  /** Painter's-order key: tile x + y. */
  depth(): number;
  draw(ctx: CanvasRenderingContext2D, ox: number, oy: number, timeMs: number): void;
  /** World-space box relative to the grid origin, for hit testing. */
  bounds(): { x: number; y: number; w: number; h: number } | null;
  /** World point (relative to the grid origin) the camera follows. */
  focus?(): { x: number; y: number };
}

export type Hit = { kind: "area"; id: string } | { kind: "character" } | null;

interface Cloud {
  seed: number;
  x: number;
  y: number;
  speed: number;
  front: boolean;
  day?: HTMLCanvasElement;
  night?: HTMLCanvasElement;
}

interface PropSprite {
  art: PropArt;
  canvas: HTMLCanvasElement;
  glow?: HTMLCanvasElement;
}

const buildingCache = new Map<string, BuildingSprites>();
const propCanvasCache = new Map<string, PropSprite>();

function propSprite(d: Pick<Decoration, "prop" | "variant">, outline: string): PropSprite {
  const key = `${d.prop}|${d.variant}|${outline}`;
  let s = propCanvasCache.get(key);
  if (!s) {
    if (propCanvasCache.size > 800) propCanvasCache.clear();
    const art = propArt(d.prop, d.variant, outline);
    s = { art, canvas: art.buf.toCanvas(), glow: art.glow?.toCanvas() };
    propCanvasCache.set(key, s);
  }
  return s;
}

function buildingSprite(a: SceneArea, outline: string) {
  const key = `${a.type}|${a.variant}|${a.color}|${a.vitality}|${outline}`;
  let s = buildingCache.get(key);
  if (!s) {
    if (buildingCache.size > 120) buildingCache.clear();
    s = renderBuilding(a.type, a.variant, a.color, a.vitality, outline);
    buildingCache.set(key, s);
  }
  return s;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Canvas 2D island renderer with a camera. The visible part of the world is drawn at native
 * pixel-art resolution into a "view" canvas, tinted for the time of day, then scaled to the
 * screen. Zoom is in CSS px per world px; the camera can pan, zoom and follow the character.
 */
export class IslandScene {
  private ctx: CanvasRenderingContext2D;
  private view = document.createElement("canvas");
  private vctx = this.view.getContext("2d")!;
  private terrain: HTMLCanvasElement | null = null;
  private data: SceneWorld | null = null;
  private decor: Decoration[] = [];
  private rocks: ReturnType<typeof floatingRocks> = [];
  private waterPixels: [number, number][] = [];
  private clouds: Cloud[] = [];
  private stars: { x: number; y: number; p: number; s: number }[] = [];
  private raf = 0;
  private last = 0;
  private running = false;
  private metrics = worldMetrics(24);

  night = 0;
  golden = 0;
  reducedMotion = false;
  selectedId: string | null = null;
  hoveredId: string | null = null;
  actor: Actor | null = null;
  /** Called after every frame (for DOM overlays that follow the scene). */
  onFrame: ((t: number) => void) | null = null;

  /** CSS px per world px. */
  zoom = 1;
  minZoom = 0.3;
  maxZoom = 3;
  camX = 0;
  camY = 0;
  follow = false;
  private targetCam: { x: number; y: number } | null = null;
  private userMoved = false;
  bob = 0;
  private dpr = 1;
  private introStart = -1;
  private introDuration = 2800;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    const rand = rng(7);
    for (let i = 0; i < 9; i++)
      this.clouds.push({ seed: 100 + i, x: rand(), y: 0.05 + rand() * 0.8, speed: 0.004 + rand() * 0.006, front: i % 3 === 0 });
    for (let i = 0; i < 120; i++) this.stars.push({ x: rand(), y: rand() * 0.8, p: rand() * Math.PI * 2, s: rand() < 0.15 ? 2 : 1 });
    this.onVisibility = this.onVisibility.bind(this);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  /* ---------------- world ---------------- */

  setWorld(data: SceneWorld) {
    const prev = this.data;
    this.data = data;
    if (!prev || prev.layout !== data.layout || prev.palette !== data.palette) {
      const sizeChanged = !prev || prev.layout.size !== data.layout.size;
      this.metrics = worldMetrics(data.layout.size);
      this.terrain = renderTerrain(data.layout, TERRAIN[data.palette]).toCanvas();
      this.decor = decorate(data.layout);
      this.rocks = floatingRocks(data.layout);
      this.waterPixels = [];
      const { size, water } = data.layout;
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          if (water[y * size + x]) for (let k = 0; k < 3; k++) this.waterPixels.push([x + 0.2 + k * 0.3, y + 0.25 + ((k * 7) % 5) / 8]);
      this.resize(sizeChanged && !this.userMoved);
    }
  }

  get layout() {
    return this.data?.layout ?? null;
  }

  get worldOrigin() {
    return { ox: this.metrics.ox, oy: this.metrics.oy };
  }

  playIntro(duration = 2800) {
    this.introDuration = duration;
    this.introStart = performance.now();
  }

  get introProgress() {
    if (this.introStart < 0) return 1;
    return clamp01((performance.now() - this.introStart) / this.introDuration);
  }

  /* ---------------- camera ---------------- */

  private islandCenter() {
    const c = this.data?.layout.center ?? 12;
    return { x: this.metrics.ox + isoX(c, c), y: this.metrics.oy + isoY(c, c) + c * 6 };
  }

  /** Zoom that fits the whole island. */
  fitZoom() {
    const rect = this.canvas.getBoundingClientRect();
    const size = this.data?.layout.size ?? 24;
    const contentW = size * TILE_W * 0.82;
    // Grass diamond (~22px per tile of radius above/below center) plus the cone (~36px per tile).
    const contentH = (size / 2) * (22 + 28) * 0.9 + 140;
    const narrow = rect.width < 640;
    return Math.min((rect.width * (narrow ? 0.96 : 0.84)) / contentW, (rect.height * (narrow ? 0.5 : 0.82)) / contentH);
  }

  /** Default framing: the whole island, but never smaller than a comfortable pixel size. */
  resetView(animate = false) {
    const fit = this.fitZoom();
    const narrow = this.canvas.getBoundingClientRect().width < 640;
    const z = clamp(Math.max(fit, narrow ? 0.42 : 0.55), this.minZoom, this.maxZoom);
    const c = this.islandCenter();
    const rect = this.canvas.getBoundingClientRect();
    // On phones the HUD covers the lower part, so aim the island a bit higher.
    const yShift = narrow ? (rect.height * 0.12) / z : 0;
    if (animate) {
      this.targetCam = { x: c.x, y: c.y + yShift };
      this.zoomTo(z);
    } else {
      this.zoom = z;
      this.camX = c.x;
      this.camY = c.y + yShift;
    }
    this.userMoved = false;
  }

  private zoomAnim: { from: number; to: number; t0: number } | null = null;
  zoomTo(z: number) {
    this.zoomAnim = { from: this.zoom, to: clamp(z, this.minZoom, this.maxZoom), t0: performance.now() };
  }

  panBy(dxCss: number, dyCss: number) {
    this.camX -= dxCss / this.zoom;
    this.camY -= dyCss / this.zoom;
    this.targetCam = null;
    this.follow = false;
    this.userMoved = true;
    this.clampCam();
  }

  /** Zoom by `factor`, keeping the world point under (cssX, cssY) still. */
  zoomAt(factor: number, cssX: number, cssY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const before = this.zoom;
    const after = clamp(before * factor, this.minZoom, this.maxZoom);
    if (after === before) return;
    const wx = this.camX + (cssX - rect.width / 2) / before;
    const wy = this.camY + (cssY - rect.height / 2) / before;
    this.zoom = after;
    this.camX = wx - (cssX - rect.width / 2) / after;
    this.camY = wy - (cssY - rect.height / 2) / after;
    this.zoomAnim = null;
    this.userMoved = true;
    this.clampCam();
  }

  /** Smoothly bring an area into view (used when selecting from the list). */
  panToArea(id: string) {
    const a = this.layout?.areas.find((x) => x.id === id);
    if (!a) return;
    const h = FOOTPRINT / 2;
    this.targetCam = { x: this.metrics.ox + isoX(a.gx + h, a.gy + h), y: this.metrics.oy + isoY(a.gx + h, a.gy + h) - 30 };
    this.follow = false;
    if (this.zoom < 0.8) this.zoomTo(1);
  }

  private clampCam() {
    const { width, height } = this.metrics;
    this.camX = clamp(this.camX, width * 0.1, width * 0.9);
    this.camY = clamp(this.camY, height * 0.05, height * 0.9);
  }

  resize(reframe = false) {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(1, Math.round(rect.width * this.dpr));
    const h = Math.max(1, Math.round(rect.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.minZoom = Math.min(0.35, this.fitZoom() * 0.8);
    if (reframe || !this.userMoved) this.resetView();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      this.frame(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.stop();
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  private onVisibility() {
    if (document.hidden) this.stop();
    else this.start();
  }

  /* ---------------- coordinates ---------------- */

  private get zd() {
    return this.zoom * this.dpr;
  }

  /** Top-left of the view in absolute world px (fractional). */
  private viewOrigin() {
    return { x: this.camX - this.canvas.width / (2 * this.zd), y: this.camY - this.canvas.height / (2 * this.zd) - this.bob };
  }

  /** Client (CSS px, relative to canvas) → world px relative to grid origin. */
  clientToWorld(cx: number, cy: number) {
    const o = this.viewOrigin();
    return { x: o.x + cx / this.zoom - this.metrics.ox, y: o.y + cy / this.zoom - this.metrics.oy };
  }

  /** World px relative to grid origin → client CSS px relative to the canvas. */
  worldToClient(wx: number, wy: number) {
    const o = this.viewOrigin();
    return { x: (wx + this.metrics.ox - o.x) * this.zoom, y: (wy + this.metrics.oy - o.y) * this.zoom };
  }

  /** Client position of an area's label anchor (above its roof). */
  areaAnchor(id: string) {
    const a = this.layout?.areas.find((x) => x.id === id);
    if (!a) return null;
    const h = FOOTPRINT / 2;
    return this.worldToClient(isoX(a.gx + h, a.gy + h), isoY(a.gx + h, a.gy + h) - 90);
  }

  hitTest(cx: number, cy: number): Hit {
    const p = this.clientToWorld(cx, cy);
    const b = this.actor?.bounds();
    if (b && p.x >= b.x - 4 && p.x <= b.x + b.w + 4 && p.y >= b.y - 4 && p.y <= b.y + b.h + 4) return { kind: "character" };
    if (!this.data) return null;
    const placed = [...this.data.layout.areas].sort((a, b2) => b2.gx + b2.gy - (a.gx + a.gy));
    for (const pa of placed) {
      const area = this.data.areas.find((x) => x.id === pa.id);
      if (!area) continue;
      const s = buildingSprite(area, TERRAIN[this.data.palette].outline).base;
      const lx = Math.floor(p.x - (isoX(pa.gx, pa.gy) - s.ax));
      const ly = Math.floor(p.y - (isoY(pa.gx, pa.gy) - s.ay));
      if (s.buffer.alphaAt(lx, ly) > 0) return { kind: "area", id: pa.id };
    }
    return null;
  }

  /* ---------------- frame ---------------- */

  frame(t: number) {
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    if (!this.data || !this.terrain) return;
    this.actor?.update(dt, t);

    // Camera animation: zoom tween, pan target, follow.
    if (this.zoomAnim) {
      const k = clamp01((t - this.zoomAnim.t0) / 450);
      this.zoom = this.zoomAnim.from + (this.zoomAnim.to - this.zoomAnim.from) * easeOut(k);
      if (k >= 1) this.zoomAnim = null;
    }
    const focus = this.follow && this.actor?.focus ? this.actor.focus() : null;
    const target = focus ? { x: focus.x + this.metrics.ox, y: focus.y + this.metrics.oy - 20 } : this.targetCam;
    if (target) {
      const k = 1 - Math.pow(0.002, dt);
      this.camX += (target.x - this.camX) * k;
      this.camY += (target.y - this.camY) * k;
      if (!focus && Math.hypot(target.x - this.camX, target.y - this.camY) < 0.5) this.targetCam = null;
    }

    const { ctx } = this;
    const motion = this.reducedMotion ? 0 : 1;
    this.bob = Math.sin(t / 1700) * 3 * motion;

    this.drawSky(t);
    this.drawClouds(dt, false);
    this.drawView(t);
    const o = this.viewOrigin();
    const ox = Math.floor(o.x);
    const oy = Math.floor(o.y);
    ctx.imageSmoothingEnabled = this.zd < 1;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(this.view, (ox - o.x) * this.zd, (oy - o.y) * this.zd, this.view.width * this.zd, this.view.height * this.zd);
    ctx.imageSmoothingEnabled = false;
    this.drawClouds(0, true);
    this.onFrame?.(t);
  }

  private drawSky(t: number) {
    const { ctx, canvas } = this;
    const retro = this.data?.palette === "retro";
    const day = retro ? SKY.retroDay : SKY.day;
    const g = this.golden * (1 - this.night);
    const top = mix(mix(day.top, SKY.golden.top, g), SKY.night.top, this.night);
    const bottom = mix(mix(day.bottom, SKY.golden.bottom, g), SKY.night.bottom, this.night);
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (this.night > 0.05) {
      const px = Math.max(2, Math.round(this.dpr * 1.5));
      for (const s of this.stars) {
        const tw = this.reducedMotion ? 0.8 : 0.55 + 0.45 * Math.sin(t / 700 + s.p);
        ctx.globalAlpha = this.night * tw;
        ctx.fillStyle = "#fff7e0";
        ctx.fillRect(Math.round(s.x * canvas.width), Math.round(s.y * canvas.height), px * s.s, px * s.s);
      }
      ctx.globalAlpha = this.night;
      const m = Math.max(3, Math.round(this.dpr * 3));
      const mx = Math.round(canvas.width * 0.84);
      const my = Math.round(canvas.height * 0.1);
      ctx.fillStyle = "#fff3cf";
      for (let y = 0; y < 9; y++)
        for (let x = 0; x < 9; x++) {
          const inMoon = (x - 4) ** 2 + (y - 4) ** 2 <= 16;
          const inShadow = (x - 6.5) ** 2 + (y - 3) ** 2 <= 12;
          if (inMoon && !inShadow) ctx.fillRect(mx + x * m, my + y * m, m, m);
        }
      ctx.globalAlpha = 1;
    }
  }

  private drawClouds(dt: number, front: boolean) {
    const { ctx, canvas } = this;
    const speed = this.reducedMotion ? 0.15 : 1;
    const s = Math.max(2, Math.round(this.dpr * Math.max(1.4, this.zoom * 2)));
    const parallax = (this.camX / Math.max(1, this.metrics.width)) * 0.15;
    for (const c of this.clouds) {
      if (c.front !== front) continue;
      c.x += c.speed * dt * speed;
      if (c.x > 1.25) c.x = -0.3;
      if (!c.day) c.day = renderCloud(c.seed, false).toCanvas();
      if (!c.night && this.night > 0.02) c.night = renderCloud(c.seed, true).toCanvas();
      const x = Math.round((c.x - parallax) * canvas.width);
      const y = Math.round(c.y * canvas.height);
      const w = c.day.width * s;
      const h = c.day.height * s;
      const alpha = front ? 0.5 : 0.95;
      ctx.globalAlpha = alpha * (1 - this.night);
      ctx.drawImage(c.day, x, y, w, h);
      if (c.night && this.night > 0.02) {
        ctx.globalAlpha = alpha * this.night * 0.8;
        ctx.drawImage(c.night, x, y, w, h);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawView(t: number) {
    const { vctx: v, view, metrics } = this;
    const data = this.data!;
    const zd = this.zd;
    const vw = Math.ceil(this.canvas.width / zd) + 2;
    const vh = Math.ceil(this.canvas.height / zd) + 2;
    if (view.width !== vw || view.height !== vh) {
      view.width = vw;
      view.height = vh;
    }
    const o = this.viewOrigin();
    const ox0 = Math.floor(o.x);
    const oy0 = Math.floor(o.y);
    v.setTransform(1, 0, 0, 1, 0, 0);
    v.clearRect(0, 0, vw, vh);
    v.imageSmoothingEnabled = false;
    v.setTransform(1, 0, 0, 1, -ox0, -oy0);

    const { ox, oy } = metrics;
    const outline = TERRAIN[data.palette].outline;
    const intro = this.introProgress;
    const inView = (x: number, y: number, w: number, h: number) => x + w > ox0 && x < ox0 + vw && y + h > oy0 && y < oy0 + vh;
    const c = data.layout.center;
    const islandMidY = oy + isoY(c, c);

    // Floating rocks behind the island.
    const drawRock = (r: (typeof this.rocks)[number]) => {
      const s = propSprite({ prop: "floatRock", variant: r.variant }, outline);
      const by = this.reducedMotion ? 0 : Math.sin(t / 1300 + r.phase) * 5;
      const x = ox + isoX(r.x, r.y) - s.art.ax;
      const y = oy + isoY(r.x, r.y) - s.art.ay + 40 + by;
      if (inView(x, y, s.canvas.width, s.canvas.height)) v.drawImage(s.canvas, Math.round(x), Math.round(y));
    };
    for (const r of this.rocks) if (oy + isoY(r.x, r.y) < islandMidY) drawRock(r);

    // Terrain (revealed by a growing ellipse during the intro).
    const sx = Math.max(0, ox0);
    const sy = Math.max(0, oy0);
    const sw = Math.min(this.terrain!.width, ox0 + vw) - sx;
    const sh = Math.min(this.terrain!.height, oy0 + vh) - sy;
    if (intro < 1) {
      const r = easeOut(clamp01(intro / 0.45));
      v.save();
      v.beginPath();
      v.ellipse(ox, oy + data.layout.size * HALF_H, metrics.width * 0.62 * r + 1, metrics.height * 0.7 * r + 1, 0, 0, Math.PI * 2);
      v.clip();
      if (sw > 0 && sh > 0) v.drawImage(this.terrain!, sx, sy, sw, sh, sx, sy, sw, sh);
      v.restore();
    } else if (sw > 0 && sh > 0) v.drawImage(this.terrain!, sx, sy, sw, sh, sx, sy, sw, sh);

    // Pond sparkles.
    if (!this.reducedMotion)
      for (let i = 0; i < this.waterPixels.length; i++) {
        const [wx, wy] = this.waterPixels[i];
        const phase = Math.sin(t / 500 + i * 1.7);
        if (phase < 0.85) continue;
        v.fillStyle = "#e8f8ff";
        v.fillRect(Math.round(ox + isoX(wx, wy)), Math.round(oy + isoY(wx, wy)), 3, 1);
      }

    // Selection / hover ring around the footprint.
    for (const id of [this.hoveredId, this.selectedId]) {
      const a = id && data.layout.areas.find((x) => x.id === id);
      if (!a) continue;
      const pulse = id === this.selectedId ? 0.6 + 0.25 * Math.sin(t / 300) : 0.4;
      v.globalAlpha = pulse;
      v.strokeStyle = "#ffffff";
      v.lineWidth = 2;
      const corner = (u: number, w: number) => [ox + isoX(a.gx + u, a.gy + w), oy + isoY(a.gx + u, a.gy + w)] as const;
      const pts = [corner(-0.05, -0.05), corner(FOOTPRINT + 0.05, -0.05), corner(FOOTPRINT + 0.05, FOOTPRINT + 0.05), corner(-0.05, FOOTPRINT + 0.05)];
      v.beginPath();
      v.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) v.lineTo(p[0], p[1]);
      v.closePath();
      v.stroke();
      v.globalAlpha = 1;
    }

    // Depth-sorted drawables (culled to the view).
    type D = { depth: number; draw(): void };
    const items: D[] = [];
    const deco = intro < 1 ? clamp01((intro - 0.45) / 0.3) : 1;
    if (deco > 0)
      for (const d of this.decor) {
        const s = propSprite(d, outline);
        const x = Math.round(ox + isoX(d.x, d.y) - s.art.ax);
        const y = Math.round(oy + isoY(d.x, d.y) - s.art.ay);
        if (!inView(x, y, s.canvas.width, s.canvas.height)) continue;
        const flat = d.prop === "lily" || d.prop === "flowers" || d.prop === "tallGrass";
        items.push({
          depth: flat ? d.x + d.y - 1.5 : d.x + d.y - 0.5,
          draw: () => {
            v.globalAlpha = deco;
            v.drawImage(s.canvas, x, y);
            if (d.prop === "fountain" && !this.reducedMotion) this.drawSpray(v, x + s.art.ax, y + s.art.ay, t);
            v.globalAlpha = 1;
          },
        });
      }
    data.layout.areas.forEach((pa, i) => {
      const area = data.areas.find((x) => x.id === pa.id);
      if (!area) return;
      const sp = buildingSprite(area, outline);
      const q = intro < 1 ? clamp01((intro - 0.35 - i * 0.05) / 0.22) : 1;
      if (q <= 0) return;
      const drop = intro < 1 ? Math.round((1 - easeOutBack(q)) * -90) : 0;
      const x = ox + isoX(pa.gx, pa.gy) - sp.base.ax;
      const y = oy + isoY(pa.gx, pa.gy) - sp.base.ay + drop;
      if (!inView(x, y, sp.base.canvas.width, sp.base.canvas.height)) return;
      items.push({
        depth: areaDepth(pa.gx, pa.gy),
        draw: () => {
          v.globalAlpha = Math.min(1, q * 1.5);
          v.drawImage(sp.base.canvas, x, y);
          v.globalAlpha = 1;
        },
      });
    });
    if (this.actor && intro > 0.8) {
      const actor = this.actor;
      items.push({ depth: actor.depth(), draw: () => actor.draw(v, ox, oy, t) });
    }
    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) it.draw();

    for (const r of this.rocks) if (oy + isoY(r.x, r.y) >= islandMidY) drawRock(r);

    // Time-of-day tint over everything drawn so far.
    v.setTransform(1, 0, 0, 1, 0, 0);
    v.globalCompositeOperation = "source-atop";
    const g = this.golden * (1 - this.night);
    if (g > 0.01) {
      v.globalAlpha = g * 0.16;
      v.fillStyle = GOLDEN_TINT;
      v.fillRect(0, 0, vw, vh);
    }
    if (this.night > 0.01) {
      v.globalAlpha = this.night * 0.52;
      v.fillStyle = NIGHT_TINT;
      v.fillRect(0, 0, vw, vh);
    }

    // Lit windows, lamps and halos glow through the night tint.
    if (this.night > 0.05) {
      v.setTransform(1, 0, 0, 1, -ox0, -oy0);
      v.globalCompositeOperation = "lighter";
      v.globalAlpha = Math.min(1, this.night * 1.1);
      for (const pa of data.layout.areas) {
        const area = data.areas.find((x) => x.id === pa.id);
        if (!area) continue;
        const sp = buildingSprite(area, outline);
        v.drawImage(sp.glow.canvas, ox + isoX(pa.gx, pa.gy) - sp.glow.ax, oy + isoY(pa.gx, pa.gy) - sp.glow.ay);
      }
      for (const d of this.decor) {
        if (d.prop !== "lamp" && d.prop !== "fountain") continue;
        const s = propSprite(d, outline);
        const bx = ox + isoX(d.x, d.y);
        const by = oy + isoY(d.x, d.y);
        if (!inView(bx - 60, by - 120, 120, 160)) continue;
        if (s.glow) v.drawImage(s.glow, Math.round(bx - s.art.ax), Math.round(by - s.art.ay));
        const ly = d.prop === "lamp" ? by - 42 : by - 20;
        const r = d.prop === "lamp" ? 44 : 70;
        const halo = v.createRadialGradient(bx, ly, 0, bx, ly, r);
        halo.addColorStop(0, d.prop === "lamp" ? "rgba(255,210,122,0.5)" : "rgba(150,210,255,0.25)");
        halo.addColorStop(1, "rgba(255,210,122,0)");
        v.fillStyle = halo;
        v.fillRect(bx - r, ly - r, r * 2, r * 2);
      }
    }
    v.globalCompositeOperation = "source-over";
    v.globalAlpha = 1;
    v.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Animated fountain spray. */
  private drawSpray(v: CanvasRenderingContext2D, cx: number, cy: number, t: number) {
    v.fillStyle = "#d8f2ff";
    for (let i = 0; i < 14; i++) {
      const life = ((t / 900 + i / 14) % 1 + 1) % 1;
      const a = (i / 14) * Math.PI * 2;
      const r = life * 16;
      const x = cx + Math.cos(a) * r;
      const y = cy - 44 - Math.sin(life * Math.PI) * 12 + life * 14 + Math.sin(a) * r * 0.4;
      v.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
    v.fillRect(cx - 1, cy - 50 - Math.round(Math.sin(t / 200) * 2), 2, 8);
  }
}

export { HALF_W };
