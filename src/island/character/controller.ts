import type { Appearance, AreaType } from "@/data/schema";
import { FOOTPRINT, type Layout } from "@/lib/island-layout";
import { findPath, type Grid, type Point } from "@/lib/pathfinding";
import type { Intent } from "@/lib/character-intent";
import { formatDuration, minutesOfDay } from "@/lib/time";
import { areaDepth, isoX, isoY } from "../iso";
import type { Actor } from "../scene";
import { characterSprite, frameAt, type AnimName, type Outfit } from "../sprites/character";
import { designFor, type Design } from "../sprites/designs";
import { selectRoutine, type Routine } from "./routines";

const WALK_SPEED = 2.0; // tiles / second
const RUN_SPEED = 2.6;
const CHANGE_SECONDS = 1.1;

const IDLE_ACTIONS: { anim: AnimName; text: string }[] = [
  { anim: "idle", text: "Enjoying the breeze" },
  { anim: "look", text: "Looking around" },
  { anim: "sit", text: "Sitting for a bit" },
  { anim: "stretch", text: "Stretching" },
  { anim: "wave", text: "Waving hello" },
];

type Mode = "walk" | "approach" | "change" | "act" | "loop" | "idle";

interface AreaInfo {
  id: string;
  type: AreaType;
  variant: number;
  name: string;
}

/**
 * Drives the mini-me: walks the path network with A*, changes into gym clothes for sporty
 * routines, performs the chosen routine (at the door, at a spot inside an outdoor area, around a
 * running loop, or a lap of the whole island), and wanders when nothing is planned.
 */
export class CharacterController implements Actor {
  x = 0;
  y = 0;
  private path: Point[] = [];
  private mode: Mode = "idle";
  private anim: AnimName = "idle";
  private animStart = 0;
  private flip = false;
  private back = false;
  private intent: Intent | null = null;
  private planKey = "";
  private routine: Routine | null = null;
  private idleUntil = 0;
  private idleText = IDLE_ACTIONS[0].text;
  private layout: Layout | null = null;
  private areas = new Map<string, AreaInfo>();
  private walkable = new Uint8Array(0);
  private time = 0;
  private dropY = 0;
  private placed = false;
  private outfit: Outfit = "casual";
  private changeUntil = 0;
  private afterChange: (() => void) | null = null;
  private approachTo: { x: number; y: number; then: () => void } | null = null;
  private loopPts: { x: number; y: number }[] = [];
  private loopLen: number[] = [];
  private loopDist = 0;
  private insideArea: { gx: number; gy: number } | null = null;
  private lastMinuteCheck = -1;
  /** 0 = day, 1 = night (stargazing only after dusk). */
  night = 0;

  constructor(
    public appearance: Appearance,
    public name: string,
  ) {}

  setAreas(list: AreaInfo[]) {
    this.areas = new Map(list.map((a) => [a.id, a]));
  }

  setLayout(layout: Layout) {
    if (this.layout === layout) return;
    this.layout = layout;
    const { size, path, trail, areas } = layout;
    this.walkable = new Uint8Array(size * size);
    for (let i = 0; i < path.length; i++) if (path[i] || trail[i]) this.walkable[i] = 1;
    for (const a of areas) this.walkable[a.entrance[1] * size + a.entrance[0]] = 1;
    if (!this.placed || !this.onWalkable()) {
      const [px, py] = layout.plaza[layout.plaza.length - 1];
      this.x = px + 0.5;
      this.y = py + 0.5;
      this.placed = true;
    }
    this.planKey = "";
    this.path = [];
    this.insideArea = null;
  }

  setIntent(intent: Intent) {
    this.intent = intent;
  }

  /** Small drop-in from the sky (used by the onboarding finish). */
  land() {
    this.dropY = -120;
  }

  get currentAnim(): AnimName {
    return this.anim;
  }

  get currentOutfit(): Outfit {
    return this.outfit;
  }

  private onWalkable() {
    if (!this.layout) return false;
    const tx = Math.floor(this.x);
    const ty = Math.floor(this.y);
    const s = this.layout.size;
    return tx >= 0 && ty >= 0 && tx < s && ty < s && this.walkable[ty * s + tx] === 1;
  }

  private grid(): Grid {
    const s = this.layout!.size;
    return { width: s, height: s, walkable: (x, y) => this.walkable[y * s + x] === 1 };
  }

  private setAnim(anim: AnimName) {
    if (this.anim !== anim) {
      this.anim = anim;
      this.animStart = this.time;
    }
  }

  private goTo(tile: Point) {
    const from: Point = [Math.floor(this.x), Math.floor(this.y)];
    const route = findPath(this.grid(), from, tile);
    this.path = route ? route.slice(1) : [];
    this.mode = "walk";
  }

  private design(): { info: AreaInfo; design: Design; gx: number; gy: number; entrance: Point } | null {
    const id = this.intent?.areaId;
    if (!id || !this.layout) return null;
    const pa = this.layout.areas.find((a) => a.id === id);
    const info = this.areas.get(id);
    if (!pa || !info) return null;
    return { info, design: designFor(info.type, info.variant), gx: pa.gx, gy: pa.gy, entrance: pa.entrance };
  }

  /** Re-plan when the intent or the chosen routine changes. */
  private plan() {
    const L = this.layout!;
    const i = this.intent;
    this.insideArea = null;
    this.approachTo = null;
    if (!i || i.source === "none") {
      this.routine = null;
      if (this.outfit === "sport") this.startChange("casual", () => this.wander());
      else {
        this.mode = "idle";
        this.idleUntil = this.time + 1.5;
      }
      return;
    }
    const d = this.design();
    this.routine = selectRoutine({
      activity: i.animation,
      design: d?.design ?? null,
      style: i.style ?? "auto",
      seed: i.key,
      minute: minutesOfDay(new Date()),
      night: this.night > 0.5,
    });
    if (this.routine.where.kind === "trail") {
      // Walk to the nearest point of the island loop.
      let best = 0;
      let bestD = Infinity;
      L.trailLoop.forEach((p, k) => {
        const dd = Math.hypot(p.x - this.x, p.y - this.y);
        if (dd < bestD) {
          bestD = dd;
          best = k;
        }
      });
      const p = L.trailLoop[best];
      let tx = Math.floor(p.x);
      let ty = Math.floor(p.y);
      if (!this.walkable[ty * L.size + tx]) {
        // Snap to the closest walkable trail tile.
        let bd = Infinity;
        for (let y = 0; y < L.size; y++)
          for (let x = 0; x < L.size; x++)
            if (L.trail[y * L.size + x] && Math.hypot(x - p.x, y - p.y) < bd) {
              bd = Math.hypot(x - p.x, y - p.y);
              tx = x;
              ty = y;
            }
      }
      this.goTo([tx, ty]);
      return;
    }
    this.goTo(d ? d.entrance : L.plaza[Math.floor(L.plaza.length / 2)]);
  }

  private startChange(to: Outfit, then: () => void) {
    if (this.outfit === to) return then();
    this.mode = "change";
    this.setAnim("change");
    this.changeUntil = this.time + CHANGE_SECONDS;
    this.afterChange = () => {
      this.outfit = to;
      then();
    };
  }

  private arrive() {
    const r = this.routine;
    if (!r) {
      const pick = IDLE_ACTIONS[Math.floor(Math.random() * IDLE_ACTIONS.length)];
      this.mode = "idle";
      this.idleText = pick.text;
      this.setAnim(pick.anim);
      this.idleUntil = this.time + 4 + Math.random() * 5;
      this.back = false;
      return;
    }
    const want: Outfit = r.sport && this.appearance.sportSwitch ? "sport" : "casual";
    this.startChange(want, () => this.perform(r));
  }

  private perform(r: Routine) {
    const d = this.design();
    this.back = false;
    this.flip = false;
    if (r.where.kind === "spot" && d) {
      const [su, sv] = d.design.spots[r.where.spot];
      this.insideArea = { gx: d.gx, gy: d.gy };
      this.approachTo = { x: d.gx + su, y: d.gy + sv, then: () => this.act(r) };
      this.mode = "approach";
      return;
    }
    if (r.where.kind === "loop" && d?.design.loop) {
      this.insideArea = { gx: d.gx, gy: d.gy };
      this.setLoop(d.design.loop.map(([u, v]) => ({ x: d.gx + u, y: d.gy + v })), true);
      const start = this.loopPts[0];
      this.approachTo = { x: start.x, y: start.y, then: () => this.startLoop() };
      this.mode = "approach";
      return;
    }
    if (r.where.kind === "trail" && this.layout) {
      this.setLoop(this.layout.trailLoop, false);
      this.startLoop();
      return;
    }
    this.act(r);
  }

  private act(r: Routine) {
    this.mode = "act";
    this.back = false;
    this.flip = false;
    this.setAnim(r.anim);
  }

  private setLoop(pts: { x: number; y: number }[], closed: boolean) {
    this.loopPts = pts;
    this.loopLen = [0];
    for (let k = 1; k <= pts.length; k++) {
      const a = pts[k - 1];
      const b = pts[k % pts.length];
      this.loopLen.push(this.loopLen[k - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    // Start from the point nearest to where we are.
    let best = 0;
    let bd = Infinity;
    pts.forEach((p, k) => {
      const dd = Math.hypot(p.x - this.x, p.y - this.y);
      if (dd < bd) {
        bd = dd;
        best = k;
      }
    });
    this.loopDist = this.loopLen[best];
    void closed;
  }

  private startLoop() {
    this.mode = "loop";
    this.setAnim("run");
  }

  private loopPoint(dist: number) {
    const total = this.loopLen[this.loopLen.length - 1];
    let d = ((dist % total) + total) % total;
    let k = 1;
    while (k < this.loopLen.length - 1 && this.loopLen[k] < d) k++;
    const a = this.loopPts[k - 1];
    const b = this.loopPts[k % this.loopPts.length];
    const seg = this.loopLen[k] - this.loopLen[k - 1] || 1;
    d = (d - this.loopLen[k - 1]) / seg;
    return { x: a.x + (b.x - a.x) * d, y: a.y + (b.y - a.y) * d };
  }

  update(dt: number, timeMs: number) {
    this.time = timeMs / 1000;
    if (this.dropY < 0) this.dropY = Math.min(0, this.dropY + dt * 200);
    if (!this.layout) return;

    // Re-plan on a new intent, or when the routine rotates (checked once a minute).
    const minute = Math.floor(this.time / 60);
    let key = this.intent?.key ?? "none";
    if (this.intent && this.intent.source !== "none" && minute !== this.lastMinuteCheck) {
      this.lastMinuteCheck = minute;
      const d = this.design();
      const r = selectRoutine({
        activity: this.intent.animation,
        design: d?.design ?? null,
        style: this.intent.style ?? "auto",
        seed: this.intent.key,
        minute: minutesOfDay(new Date()),
        night: this.night > 0.5,
      });
      key += `|${r.id}`;
    } else if (this.routine) key += `|${this.routine.id}`;
    if (key !== this.planKey && this.mode !== "change") {
      this.planKey = key;
      this.plan();
    }

    switch (this.mode) {
      case "walk":
        this.setAnim("walk");
        this.step(dt, WALK_SPEED);
        if (!this.path.length) this.arrive();
        return;
      case "approach": {
        const t = this.approachTo;
        if (!t) return;
        this.setAnim("walk");
        const dx = t.x - this.x;
        const dy = t.y - this.y;
        const d = Math.hypot(dx, dy);
        const s = WALK_SPEED * dt;
        this.face(dx, dy);
        if (d <= s) {
          this.x = t.x;
          this.y = t.y;
          this.approachTo = null;
          t.then();
        } else {
          this.x += (dx / d) * s;
          this.y += (dy / d) * s;
        }
        return;
      }
      case "change":
        if (this.time >= this.changeUntil) {
          const f = this.afterChange;
          this.afterChange = null;
          f?.();
        }
        return;
      case "loop": {
        this.setAnim("run");
        const prev = this.loopPoint(this.loopDist);
        this.loopDist += RUN_SPEED * dt * (this.insideArea ? 0.7 : 1);
        const p = this.loopPoint(this.loopDist);
        this.x = p.x;
        this.y = p.y;
        this.face(p.x - prev.x, p.y - prev.y);
        return;
      }
      case "idle":
        if (this.time > this.idleUntil) this.wander();
        return;
      default:
    }
  }

  private wander() {
    const L = this.layout!;
    this.insideArea = null;
    if (this.outfit === "sport") return this.startChange("casual", () => this.wander());
    const tiles: Point[] = [];
    for (let y = 0; y < L.size; y++)
      for (let x = 0; x < L.size; x++)
        if (this.walkable[y * L.size + x] && Math.abs(x - this.x) + Math.abs(y - this.y) < 14) tiles.push([x, y]);
    if (!tiles.length) return;
    this.goTo(tiles[Math.floor(Math.random() * tiles.length)]);
    if (!this.path.length) this.arrive();
  }

  private step(dt: number, speed: number) {
    let budget = speed * dt;
    while (budget > 0 && this.path.length) {
      const [tx, ty] = this.path[0];
      const gx = tx + 0.5;
      const gy = ty + 0.5;
      const dx = gx - this.x;
      const dy = gy - this.y;
      const d = Math.hypot(dx, dy);
      this.face(dx, dy);
      if (d <= budget) {
        this.x = gx;
        this.y = gy;
        budget -= d;
        this.path.shift();
      } else {
        this.x += (dx / d) * budget;
        this.y += (dy / d) * budget;
        budget = 0;
      }
    }
  }

  private face(dx: number, dy: number) {
    const sx = dx - dy;
    const sy = dx + dy;
    if (Math.abs(sx) > 1e-4) this.flip = sx < 0;
    if (Math.abs(sy) > 1e-4) this.back = sy < 0;
  }

  private get lift() {
    return this.mode === "act" && this.routine?.lift ? this.routine.lift : 0;
  }

  depth() {
    // Inside an outdoor area (on a bar, mat or track) we draw just above that area.
    if (this.insideArea && (this.mode === "act" || this.mode === "loop" || this.mode === "approach"))
      return areaDepth(this.insideArea.gx, this.insideArea.gy, FOOTPRINT) + 0.05;
    return this.x + this.y - 0.5;
  }

  draw(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    const pose = { ...frameAt(this.anim, this.time - this.animStart) };
    const moving = this.mode === "walk" || this.mode === "loop" || this.mode === "approach";
    if (this.back && moving) pose.back = true;
    const sprite = characterSprite(this.appearance, pose, moving ? this.flip : false, this.outfit);
    const gx = Math.round(ox + isoX(this.x, this.y));
    const gy = Math.round(oy + isoY(this.x, this.y));
    // Soft shadow (shrinks while dropping in or lifted on a bar).
    const sh = Math.max(0.3, 1 + this.dropY / 160 - this.lift / 30);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#2b1f3e";
    ctx.beginPath();
    ctx.ellipse(gx, gy, 9 * sh, 3.5 * sh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.drawImage(sprite.canvas, gx - sprite.ax, Math.round(gy - sprite.ay + this.dropY - this.lift));
  }

  bounds() {
    const x = isoX(this.x, this.y);
    const y = isoY(this.x, this.y) + this.dropY - this.lift;
    return { x: x - 12, y: y - 46, w: 24, h: 48 };
  }

  focus() {
    return { x: isoX(this.x, this.y), y: isoY(this.x, this.y) - 24 };
  }

  /** World point above the head (relative to grid origin) for the speech bubble. */
  headAnchor() {
    return { x: isoX(this.x, this.y), y: isoY(this.x, this.y) + this.dropY - this.lift - 50 };
  }

  /** Short status line for the bubble and card. */
  status(nowMinute: number, areaName: (id: string | null) => string | null): string {
    const i = this.intent;
    if (this.mode === "change") return this.outfit === "casual" ? "Changing into gym clothes" : "Changing back";
    if (this.mode === "walk") {
      if (i && i.source !== "none") {
        if (this.routine?.where.kind === "trail") return "Heading to the island trail";
        return `Heading to ${areaName(i.areaId) ?? "the plaza"}`;
      }
      return "Taking a stroll";
    }
    if (!i || i.source === "none" || !this.routine) return this.idleText;
    const verb = this.routine.label;
    const label = i.source === "block" && i.label && i.label !== verb ? `${i.label} · ${verb.toLowerCase()}` : verb;
    if (i.until !== null) return `${label} · ${formatDuration(i.until - nowMinute)} left`;
    return label;
  }
}
