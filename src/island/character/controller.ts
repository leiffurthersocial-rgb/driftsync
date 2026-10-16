import type { Appearance, AnimationKind } from "@/data/schema";
import type { Layout } from "@/lib/island-layout";
import { findPath, type Grid, type Point } from "@/lib/pathfinding";
import { ANIMATION_VERB, type Intent } from "@/lib/character-intent";
import { formatDuration } from "@/lib/time";
import { isoX, isoY } from "../iso";
import type { Actor } from "../scene";
import { characterSprite, frameAt, type AnimName } from "../sprites/character";
import { TRACK_LOOP } from "../sprites/buildings";

const WALK_SPEED = 1.9; // tiles / second
const JOG_SPEED = 0.95; // radians / second around the track

const ANIM_FOR: Record<AnimationKind, AnimName> = {
  study: "study",
  workout: "workout",
  jog: "jog",
  photo: "photo",
  read: "read",
  work: "work",
  hobby: "hobby",
  rest: "rest",
  generic: "generic",
};

const IDLE_ACTIONS: { anim: AnimName; text: string }[] = [
  { anim: "idle", text: "Enjoying the breeze" },
  { anim: "look", text: "Looking around" },
  { anim: "sit", text: "Sitting for a bit" },
  { anim: "stretch", text: "Stretching" },
];

type Mode = "walk" | "act" | "idle" | "jog";

/**
 * Drives the mini-me: walks the path network with A*, performs the activity at the target
 * area (laps around the track when jogging), or idles and wanders when nothing is planned.
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
  private targetKey = "";
  private idleUntil = 0;
  private idleText = IDLE_ACTIONS[0].text;
  private trackAngle = Math.PI / 2;
  private trackCenter: { x: number; y: number } | null = null;
  private layout: Layout | null = null;
  private walkable = new Uint8Array(0);
  private time = 0;
  private dropY = 0;
  private placed = false;

  constructor(
    public appearance: Appearance,
    public name: string,
  ) {}

  setLayout(layout: Layout) {
    if (this.layout === layout) return;
    this.layout = layout;
    const { size, path, areas } = layout;
    this.walkable = new Uint8Array(size * size);
    for (let i = 0; i < path.length; i++) if (path[i]) this.walkable[i] = 1;
    for (const a of areas) this.walkable[a.entrance[1] * size + a.entrance[0]] = 1;
    if (!this.placed || !this.onWalkable()) {
      const [px, py] = layout.plaza[3];
      this.x = px + 0.5;
      this.y = py + 0.5;
      this.placed = true;
    }
    this.targetKey = ""; // re-route on next update
    this.path = [];
  }

  setIntent(intent: Intent) {
    this.intent = intent;
  }

  /** Small drop-in from the sky (used by the onboarding finish). */
  land() {
    this.dropY = -90;
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
    this.mode = this.path.length ? "walk" : "act";
  }

  private destination(): Point | null {
    const L = this.layout!;
    const i = this.intent;
    if (!i || i.source === "none") return null;
    const area = i.areaId ? L.areas.find((a) => a.id === i.areaId) : null;
    return area ? area.entrance : L.plaza[2];
  }

  update(dt: number, timeMs: number) {
    this.time = timeMs / 1000;
    if (this.dropY < 0) this.dropY = Math.min(0, this.dropY + dt * 160);
    if (!this.layout) return;
    const key = this.intent?.key ?? "none";

    if (key !== this.targetKey) {
      this.targetKey = key;
      this.trackCenter = null;
      const dest = this.destination();
      if (dest) this.goTo(dest);
      else {
        this.mode = "idle";
        this.idleUntil = this.time + 1.5;
        this.path = [];
      }
    }

    if (this.mode === "walk") {
      this.setAnim("walk");
      this.step(dt);
      if (!this.path.length) this.arrive();
      return;
    }

    if (this.mode === "jog" && this.trackCenter) {
      this.setAnim("jog");
      const prevX = this.x;
      const prevY = this.y;
      this.trackAngle += JOG_SPEED * dt;
      this.x = this.trackCenter.x + Math.cos(this.trackAngle) * TRACK_LOOP.r;
      this.y = this.trackCenter.y + Math.sin(this.trackAngle) * TRACK_LOOP.r;
      this.face(this.x - prevX, this.y - prevY);
      return;
    }

    if (this.mode === "idle" && this.time > this.idleUntil) this.wander();
  }

  private arrive() {
    const i = this.intent;
    if (!i || i.source === "none") {
      const pick = IDLE_ACTIONS[Math.floor(Math.random() * IDLE_ACTIONS.length)];
      this.mode = "idle";
      this.idleText = pick.text;
      this.setAnim(pick.anim);
      this.idleUntil = this.time + 4 + Math.random() * 5;
      this.back = false;
      return;
    }
    const area = i.areaId ? this.layout!.areas.find((a) => a.id === i.areaId) : null;
    const isTrack = i.animation === "jog" && i.areaType === "track";
    if (isTrack && area) {
      this.mode = "jog";
      this.trackCenter = { x: area.gx + TRACK_LOOP.cx, y: area.gy + TRACK_LOOP.cy };
      this.trackAngle = Math.atan2(this.y - this.trackCenter.y, this.x - this.trackCenter.x);
      return;
    }
    this.mode = "act";
    this.back = false;
    this.flip = false;
    this.setAnim(ANIM_FOR[i.animation]);
  }

  private wander() {
    const L = this.layout!;
    const tiles: Point[] = [];
    for (let y = 0; y < L.size; y++) for (let x = 0; x < L.size; x++) if (this.walkable[y * L.size + x]) tiles.push([x, y]);
    if (!tiles.length) return;
    const pick = tiles[Math.floor(Math.random() * tiles.length)];
    this.goTo(pick);
    if (this.mode === "act") this.arrive();
  }

  private step(dt: number) {
    let budget = WALK_SPEED * dt;
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

  get currentAnim(): AnimName {
    return this.anim;
  }

  depth() {
    return this.x + this.y - 0.5;
  }

  private screen(ox: number, oy: number) {
    return { sx: Math.round(ox + isoX(this.x, this.y)), sy: Math.round(oy + isoY(this.x, this.y) + this.dropY) };
  }

  draw(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    const pose = { ...frameAt(this.anim, this.time - this.animStart) };
    if (this.back && (this.mode === "walk" || this.mode === "jog")) pose.back = true;
    const sprite = characterSprite(this.appearance, pose, this.flip);
    const { sx, sy } = this.screen(ox, oy);
    // Soft shadow (shrinks while dropping in).
    const sh = Math.max(0.3, 1 + this.dropY / 120);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#2b1f3e";
    ctx.fillRect(sx - Math.round(4 * sh), Math.round(oy + isoY(this.x, this.y)) - 1, Math.round(8 * sh), 2);
    ctx.globalAlpha = 1;
    ctx.drawImage(sprite.canvas, sx - sprite.ax, sy - sprite.ay);
  }

  bounds() {
    const x = isoX(this.x, this.y);
    const y = isoY(this.x, this.y) + this.dropY;
    return { x: x - 7, y: y - 24, w: 14, h: 25 };
  }

  /** World point above the head (relative to grid origin) for the speech bubble. */
  headAnchor() {
    return { x: isoX(this.x, this.y), y: isoY(this.x, this.y) + this.dropY - 26 };
  }

  /** Short status line for the bubble and card. */
  status(nowMinute: number, areaName: (id: string | null) => string | null): string {
    const i = this.intent;
    if (this.mode === "walk") {
      if (i && i.source !== "none") return `Heading to ${areaName(i.areaId) ?? "the plaza"}`;
      return "Taking a stroll";
    }
    if (!i || i.source === "none") return this.idleText;
    const verb = i.label || ANIMATION_VERB[i.animation];
    if (i.until !== null) return `${verb} · ${formatDuration(i.until - nowMinute)} left`;
    return verb;
  }
}
