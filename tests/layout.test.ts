import { describe, expect, it } from "vitest";
import { deal, placeTile, validSides, type BoardTile, type OpenEnds } from "../convex/lib/rules";
import { footprint, layoutBoard } from "../src/lib/boardLayout";

function randomBoard(seed: number) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pool = [...deal(4, rnd).hands.flat()];
  let board: BoardTile[] = [];
  let ends: OpenEnds = { left: null, right: null };
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (let i = 0; i < pool.length; i++) {
      const sides = validSides(pool[i], board, ends);
      if (sides.length) {
        ({ board, openEnds: ends } = placeTile(pool[i], sides[Math.floor(rnd() * sides.length)], board, ends));
        pool.splice(i, 1);
        progressed = true;
        break;
      }
    }
  }
  return board;
}

describe("board layout", () => {
  it.each([3.5, 5.5, 8])("never overlaps tiles (row limit %s)", (limit) => {
    for (let seed = 1; seed < 400; seed++) {
      const board = randomBoard(seed);
      const placed = layoutBoard(board, limit);
      expect(placed).toHaveLength(board.length);
      const fps = placed.map(footprint);
      for (let i = 0; i < fps.length; i++) {
        for (let j = i + 1; j < fps.length; j++) {
          const a = fps[i], b = fps[j];
          const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
          const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
          if (overlapX > 0.01 && overlapZ > 0.01) {
            throw new Error(`seed ${seed}: ${placed[i].id} overlaps ${placed[j].id}`);
          }
        }
      }
    }
  });

  it("draws the inner pip toward the chain", () => {
    const board = randomBoard(42);
    const placed = layoutBoard(board);
    const byId = new Map(placed.map((p) => [p.id, p]));
    const r = board.findIndex((t) => t.placedSide === "root");
    // Each right-branch tile's inner pip equals the previous tile's outer pip.
    for (let i = r + 2; i < board.length; i++) expect(byId.get(board[i].id)!.a).toBe(byId.get(board[i - 1].id)!.b);
    for (let i = r - 2; i >= 0; i--) expect(byId.get(board[i].id)!.a).toBe(byId.get(board[i + 1].id)!.b);
  });

  it("keeps rows a tile and a half apart, like iOS", () => {
    for (let seed = 1; seed < 200; seed++) {
      const placed = layoutBoard(randomBoard(seed), 3.5);
      // Non-double tiles lying along x are row tiles. Rows sit 3 units (1.5 tiles)
      // apart; each double in the corner run adds one unit.
      const rows = [...new Set(placed.filter((t) => !t.isDouble && Math.abs(Math.sin(t.rotY)) > 0.5).map((t) => t.z))].sort((a, b) => a - b);
      for (let i = 1; i < rows.length; i++) {
        const gap = rows[i] - rows[i - 1];
        if (rows[i - 1] < 0 && rows[i] > 0) continue; // different branches
        expect([3, 4, 5]).toContain(gap);
      }
    }
  });
});
