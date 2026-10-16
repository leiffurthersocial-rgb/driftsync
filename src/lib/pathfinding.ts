/** Grid A* (4-neighbour). Pure and allocation-light; grids here are small (≤ 24x24). */

export type Point = readonly [number, number];

export interface Grid {
  width: number;
  height: number;
  walkable(x: number, y: number): boolean;
  /** Cost of entering (x, y). Defaults to 1. Must be > 0. */
  cost?(x: number, y: number): number;
}

class MinHeap {
  private items: { k: number; f: number }[] = [];
  get size() {
    return this.items.length;
  }
  push(k: number, f: number) {
    const a = this.items;
    a.push({ k, f });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top.k;
  }
}

const DIRS: Point[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/**
 * Shortest path from `start` to any tile satisfying `isGoal`.
 * `heuristic` must be admissible (0 gives Dijkstra). Start tile need not be walkable.
 * Returns the tile list including start and goal, or null.
 */
export function findPathTo(
  grid: Grid,
  start: Point,
  isGoal: (x: number, y: number) => boolean,
  heuristic: (x: number, y: number) => number = () => 0,
): Point[] | null {
  const { width, height } = grid;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  if (!inside(start[0], start[1])) return null;
  const n = width * height;
  const g = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const s = start[1] * width + start[0];
  g[s] = 0;
  const open = new MinHeap();
  open.push(s, heuristic(start[0], start[1]));

  while (open.size) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % width;
    const cy = (cur - cx) / width;
    if (isGoal(cx, cy)) {
      const path: Point[] = [];
      for (let k = cur; k !== -1; k = came[k]) path.push([k % width, Math.floor(k / width)]);
      return path.reverse();
    }
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inside(nx, ny) || !grid.walkable(nx, ny)) continue;
      const ni = ny * width + nx;
      if (closed[ni]) continue;
      const ng = g[cur] + (grid.cost ? grid.cost(nx, ny) : 1);
      if (ng < g[ni]) {
        g[ni] = ng;
        came[ni] = cur;
        open.push(ni, ng + heuristic(nx, ny));
      }
    }
  }
  return null;
}

/** A* between two points with a Manhattan heuristic. */
export function findPath(grid: Grid, start: Point, goal: Point): Point[] | null {
  const minCost = 1;
  return findPathTo(
    grid,
    start,
    (x, y) => x === goal[0] && y === goal[1],
    (x, y) => (Math.abs(x - goal[0]) + Math.abs(y - goal[1])) * minCost,
  );
}

/** Flood fill from `start`; returns a visited mask (row-major). */
export function reachable(grid: Grid, start: Point): Uint8Array {
  const { width, height } = grid;
  const seen = new Uint8Array(width * height);
  const stack: number[] = [start[1] * width + start[0]];
  seen[stack[0]] = 1;
  while (stack.length) {
    const cur = stack.pop()!;
    const cx = cur % width;
    const cy = (cur - cx) / width;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (seen[ni] || !grid.walkable(nx, ny)) continue;
      seen[ni] = 1;
      stack.push(ni);
    }
  }
  return seen;
}
