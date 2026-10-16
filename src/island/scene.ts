import type { AreaType } from "@/data/schema";
import type { Layout } from "@/lib/island-layout";
import { rng } from "@/lib/random";
import { mix } from "./color";
import { decorate, type Decoration } from "./decor";
import { isoX, isoY, worldMetrics, HALF_H } from "./iso";
import { GOLDEN_TINT, NIGHT_TINT, SKY, TERRAIN } from "./palettes";
import { PixelBuffer, toSprite, type Sprite } from "./pixel-buffer";
import { renderBuilding, type BuildingSprites, type Vitality } from "./sprites/buildings";
import { renderCloud } from "./sprites/clouds";
import { PROPS, type PropName } from "./sprites/props";
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

const buildingCache = new Map<string, BuildingSprites>();
const propCache = new Map<string, Sprite>();

function propSprite(name: PropName, flip: boolean, outline: string): Sprite {
  const key = `${name}|${flip}|${outline}`;
  let s = propCache.get(key);
  if (!s) {
    const p = PROPS[name];
    const w = p.rows[0].length + 2;
    const h = p.rows.length + 2;
    const buf = new PixelBuffer(w, h);
    buf.matrix(p.rows, p.palette, 1, 1, flip);
    buf.outline(outline);
    s = toSprite(buf, Math.floor(w / 2), h - 1);
    propCache.set(key, s);
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

/**
 * Canvas 2D island renderer. Everything is drawn at native pixel-art resolution into an
 * offscreen "world" canvas, tinted for the time of day, then scaled up by an integer factor.
 */
export class IslandScene {
  private ctx: CanvasRenderingContext2D;
  private world = document.createElement("canvas");
  private wctx = this.world.getContext("2d")!;
  private terrain: HTMLCanvasElement | null = null;
  private data: SceneWorld | null = null;
  private decor: Decoration[] = [];
  private clouds: Cloud[] = [];
  private stars: { x: number; y: number; p: number; s: number }[] = [];
  private raf = 0;
  private last = 0;
  private running = false;
  private metrics = worldMetrics(12);

  night = 0;
  golden = 0;
  reducedMotion = false;
  selectedId: string | null = null;
  hoveredId: string | null = null;
  actor: Actor | null = null;
  /** Called after every frame (for DOM overlays that follow the scene). */
  onFrame: ((t: number) => void) | null = null;

  scale = 2;
  offX = 0;
  offY = 0;
  bob = 0;
  private dpr = 1;
  private introStart = -1;
  private introDuration = 2600;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    const rand = rng(7);
    for (let i = 0; i < 7; i++)
      this.clouds.push({ seed: 100 + i, x: rand(), y: 0.08 + rand() * 0.7, speed: 0.004 + rand() * 0.006, front: i % 3 === 0 });
    for (let i = 0; i < 90; i++) this.stars.push({ x: rand(), y: rand() * 0.75, p: rand() * Math.PI * 2, s: rand() < 0.15 ? 2 : 1 });
    this.onVisibility = this.onVisibility.bind(this);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  setWorld(data: SceneWorld) {
    const prev = this.data;
    this.data = data;
    if (!prev || prev.layout !== data.layout || prev.palette !== data.palette) {
      const pal = TERRAIN[data.palette];
      this.metrics = worldMetrics(data.layout.size);
      this.world.width = this.metrics.width;
      this.world.height = this.metrics.height;
      this.terrain = renderTerrain(data.layout, pal).toCanvas();
      this.decor = decorate(data.layout);
      this.resize();
    }
  }

  get layout() {
    return this.data?.layout ?? null;
  }

  get worldOrigin() {
    return { ox: this.metrics.ox, oy: this.metrics.oy };
  }

  playIntro(duration = 2600) {
    this.introDuration = duration;
    this.introStart = performance.now();
  }

  get introProgress() {
    if (this.introStart < 0) return 1;
    return clamp01((performance.now() - this.introStart) / this.introDuration);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(1, Math.round(rect.width * this.dpr));
    const h = Math.max(1, Math.round(rect.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const { width, height } = this.metrics;
    const narrow = rect.width < 640;
    const fit = Math.min((w * (narrow ? 0.98 : 0.86)) / width, (h * (narrow ? 0.6 : 0.86)) / height);
    // Integer scaling keeps pixels perfectly square; below 2x allow half steps so small screens still fill.
    this.scale = fit >= 2 ? Math.floor(fit) : fit >= 1 ? Math.floor(fit * 2) / 2 : fit;
    this.offX = Math.round((w - width * this.scale) / 2);
    this.offY = Math.round((h - height * this.scale) / 2 - h * (narrow ? 0.06 : 0.01));
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

  /** Client (CSS px, relative to canvas) → world px relative to grid origin. */
  clientToWorld(cx: number, cy: number) {
    const dx = cx * this.dpr;
    const dy = cy * this.dpr;
    return {
      x: (dx - this.offX) / this.scale - this.metrics.ox,
      y: (dy - this.offY - this.bob) / this.scale - this.metrics.oy,
    };
  }

  /** World px relative to grid origin → client CSS px relative to the canvas. */
  worldToClient(wx: number, wy: number) {
    return {
      x: ((wx + this.metrics.ox) * this.scale + this.offX) / this.dpr,
      y: ((wy + this.metrics.oy) * this.scale + this.offY + this.bob) / this.dpr,
    };
  }

  /** Client position of an area's label anchor (above its roof). */
  areaAnchor(id: string) {
    const a = this.layout?.areas.find((x) => x.id === id);
    if (!a) return null;
    return this.worldToClient(isoX(a.gx + 1, a.gy + 1), isoY(a.gx + 1, a.gy + 1) - 50);
  }

  hitTest(cx: number, cy: number): Hit {
    const p = this.clientToWorld(cx, cy);
    const b = this.actor?.bounds();
    if (b && p.x >= b.x - 3 && p.x <= b.x + b.w + 3 && p.y >= b.y - 3 && p.y <= b.y + b.h + 3) return { kind: "character" };
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

  /** Render one frame. Public so tests/screenshots can force a draw. */
  frame(t: number) {
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    if (!this.data || !this.terrain) return;
    this.actor?.update(dt, t);

    const { ctx, canvas } = this;
    const motion = this.reducedMotion ? 0 : 1;
    this.bob = Math.round(Math.sin(t / 1600) * 3 * this.scale * motion);
    ctx.imageSmoothingEnabled = false;

    this.drawSky(t);
    this.drawClouds(dt, false);
    this.drawWorld(t);
    ctx.drawImage(this.world, this.offX, this.offY + this.bob, this.world.width * this.scale, this.world.height * this.scale);
    this.drawClouds(0, true);
    void canvas;
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
      const px = Math.max(2, Math.round(this.scale));
      for (const s of this.stars) {
        const tw = this.reducedMotion ? 0.8 : 0.55 + 0.45 * Math.sin(t / 700 + s.p);
        ctx.globalAlpha = this.night * tw;
        ctx.fillStyle = "#fff7e0";
        ctx.fillRect(Math.round(s.x * canvas.width), Math.round(s.y * canvas.height), px * s.s, px * s.s);
      }
      // Pixel crescent moon.
      ctx.globalAlpha = this.night;
      const m = px * 2;
      const mx = Math.round(canvas.width * 0.82);
      const my = Math.round(canvas.height * 0.12);
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
    const s = Math.max(2, Math.round(this.scale));
    for (const c of this.clouds) {
      if (c.front !== front) continue;
      if (!front) c.x += c.speed * dt * speed;
      if (c.x > 1.15) c.x = -0.25;
      if (!c.day) c.day = renderCloud(c.seed, false).toCanvas();
      if (!c.night && this.night > 0.02) c.night = renderCloud(c.seed, true).toCanvas();
      const x = Math.round(c.x * canvas.width);
      const y = Math.round(c.y * canvas.height);
      const w = c.day.width * s;
      const h = c.day.height * s;
      const alpha = front ? 0.55 : 0.95;
      ctx.globalAlpha = alpha * (1 - this.night);
      ctx.drawImage(c.day, x, y, w, h);
      if (c.night && this.night > 0.02) {
        ctx.globalAlpha = alpha * this.night * 0.8;
        ctx.drawImage(c.night, x, y, w, h);
      }
    }
    if (front) for (const c of this.clouds) if (c.front) c.x += c.speed * dt * speed;
    ctx.globalAlpha = 1;
  }

  private drawWorld(t: number) {
    const { wctx: w, world, metrics } = this;
    const data = this.data!;
    const { ox, oy } = metrics;
    const outline = TERRAIN[data.palette].outline;
    const intro = this.introProgress;
    w.imageSmoothingEnabled = false;
    w.clearRect(0, 0, world.width, world.height);

    // Terrain (revealed by a growing ellipse during the intro).
    if (intro < 1) {
      const r = easeOut(clamp01(intro / 0.45));
      w.save();
      w.beginPath();
      w.ellipse(ox, oy + data.layout.size * HALF_H, world.width * 0.62 * r + 1, world.height * 0.7 * r + 1, 0, 0, Math.PI * 2);
      w.clip();
      w.drawImage(this.terrain!, 0, 0);
      w.restore();
    } else w.drawImage(this.terrain!, 0, 0);

    // Selection / hover ring under the footprint.
    for (const id of [this.hoveredId, this.selectedId]) {
      const a = id && data.layout.areas.find((x) => x.id === id);
      if (!a) continue;
      const pulse = id === this.selectedId ? 0.55 + 0.25 * Math.sin(t / 300) : 0.35;
      w.globalAlpha = pulse;
      w.strokeStyle = "#ffffff";
      w.lineWidth = 1;
      const x0 = ox + isoX(a.gx, a.gy);
      const y0 = oy + isoY(a.gx, a.gy);
      w.beginPath();
      w.moveTo(x0 + 0.5, y0 - 1.5);
      w.lineTo(x0 + 34.5, y0 + 16.5);
      w.lineTo(x0 + 0.5, y0 + 33.5);
      w.lineTo(x0 - 33.5, y0 + 16.5);
      w.closePath();
      w.stroke();
      w.globalAlpha = 1;
    }

    // Depth-sorted drawables.
    type D = { depth: number; draw(): void };
    const items: D[] = [];
    const deco = intro < 1 ? clamp01((intro - 0.45) / 0.3) : 1;
    if (deco > 0)
      for (const d of this.decor) {
        const s = propSprite(d.prop, d.flip, outline);
        items.push({
          depth: d.x + d.y + 0.5,
          draw: () => {
            w.globalAlpha = deco;
            w.drawImage(s.canvas, ox + isoX(d.x + 0.5, d.y + 0.5) - s.ax, oy + isoY(d.x + 0.5, d.y + 0.5) - s.ay + 1);
            w.globalAlpha = 1;
          },
        });
      }
    data.layout.areas.forEach((pa, i) => {
      const area = data.areas.find((x) => x.id === pa.id);
      if (!area) return;
      const sp = buildingSprite(area, outline);
      const q = intro < 1 ? clamp01((intro - 0.35 - i * 0.05) / 0.22) : 1;
      if (q <= 0) return;
      const drop = intro < 1 ? Math.round((1 - easeOutBack(q)) * -70) : 0;
      items.push({
        depth: pa.gx + pa.gy + 2.25,
        draw: () => {
          w.globalAlpha = Math.min(1, q * 1.5);
          w.drawImage(sp.base.canvas, ox + isoX(pa.gx, pa.gy) - sp.base.ax, oy + isoY(pa.gx, pa.gy) - sp.base.ay + drop);
          w.globalAlpha = 1;
        },
      });
    });
    if (this.actor && intro > 0.8) {
      const actor = this.actor;
      items.push({ depth: actor.depth(), draw: () => actor.draw(w, ox, oy, t) });
    }
    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) it.draw();

    // Time-of-day tint over everything that's been drawn.
    w.globalCompositeOperation = "source-atop";
    const g = this.golden * (1 - this.night);
    if (g > 0.01) {
      w.globalAlpha = g * 0.16;
      w.fillStyle = GOLDEN_TINT;
      w.fillRect(0, 0, world.width, world.height);
    }
    if (this.night > 0.01) {
      w.globalAlpha = this.night * 0.52;
      w.fillStyle = NIGHT_TINT;
      w.fillRect(0, 0, world.width, world.height);
    }

    // Lit windows and lamps glow through the night tint.
    if (this.night > 0.05) {
      w.globalCompositeOperation = "lighter";
      w.globalAlpha = Math.min(1, this.night * 1.1);
      for (const pa of data.layout.areas) {
        const area = data.areas.find((x) => x.id === pa.id);
        if (!area) continue;
        const sp = buildingSprite(area, outline);
        w.drawImage(sp.glow.canvas, ox + isoX(pa.gx, pa.gy) - sp.glow.ax, oy + isoY(pa.gx, pa.gy) - sp.glow.ay);
      }
      for (const d of this.decor) {
        if (d.prop !== "lamp") continue;
        const lx = ox + isoX(d.x + 0.5, d.y + 0.5);
        const ly = oy + isoY(d.x + 0.5, d.y + 0.5) - 9;
        const halo = w.createRadialGradient(lx, ly, 0, lx, ly, 22);
        halo.addColorStop(0, "rgba(255,210,122,0.55)");
        halo.addColorStop(1, "rgba(255,210,122,0)");
        w.fillStyle = halo;
        w.fillRect(lx - 22, ly - 22, 44, 44);
      }
    }
    w.globalCompositeOperation = "source-over";
    w.globalAlpha = 1;
  }
}
