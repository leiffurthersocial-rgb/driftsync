import { describe, expect, it } from "vitest";
import { findPath, findPathTo, reachable, type Grid } from "../pathfinding";

function gridFrom(rows: string[]): Grid {
  return {
    width: rows[0].length,
    height: rows.length,
    walkable: (x, y) => rows[y][x] !== "#",
  };
}

describe("findPath", () => {
  it("finds a straight path", () => {
    const g = gridFrom(["....."]);
    const p = findPath(g, [0, 0], [4, 0]);
    expect(p).toHaveLength(5);
    expect(p?.[4]).toEqual([4, 0]);
  });

  it("routes around walls with an optimal length", () => {
    const g = gridFrom([
      ".....",
      ".###.",
      ".#...",
      ".#.#.",
      "...#.",
    ]);
    const p = findPath(g, [0, 0], [2, 3])!;
    expect(p[0]).toEqual([0, 0]);
    expect(p[p.length - 1]).toEqual([2, 3]);
    // every step is 4-connected and walkable
    for (let i = 1; i < p.length; i++) {
      const [ax, ay] = p[i - 1];
      const [bx, by] = p[i];
      expect(Math.abs(ax - bx) + Math.abs(ay - by)).toBe(1);
      expect(g.walkable(bx, by)).toBe(true);
    }
    expect(p.length - 1).toBe(7);
  });

  it("returns null when unreachable", () => {
    const g = gridFrom(["..#..", "..#..", "..#.."]);
    expect(findPath(g, [0, 0], [4, 2])).toBeNull();
  });

  it("respects tile costs", () => {
    const g: Grid = {
      width: 3,
      height: 3,
      walkable: () => true,
      cost: (x, y) => (x === 1 && y === 1 ? 50 : 1),
    };
    const p = findPath(g, [0, 1], [2, 1])!;
    expect(p.some(([x, y]) => x === 1 && y === 1)).toBe(false);
  });

  it("supports multi-goal search", () => {
    const g = gridFrom(["......"]);
    const p = findPathTo(g, [0, 0], (x) => x >= 3)!;
    expect(p[p.length - 1]).toEqual([3, 0]);
  });
});

describe("reachable", () => {
  it("flood-fills connected tiles only", () => {
    const g = gridFrom(["..#.", "..#."]);
    const seen = reachable(g, [0, 0]);
    expect(Array.from(seen)).toEqual([1, 1, 0, 0, 1, 1, 0, 0]);
  });
});
