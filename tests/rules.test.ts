import { describe, expect, it } from "vitest";
import {
  blockedWinner,
  deal,
  findStartingPlayer,
  generateDoubleSixSet,
  isBlocked,
  placeTile,
  displayedPips,
  roundPoints,
  validSides,
  generateRoomCode,
  type BoardTile,
  type OpenEnds,
  type Tile,
} from "../convex/lib/rules";

const t = (a: number, b: number): Tile => ({ id: `${a}-${b}`, a, b });

describe("tile set and dealing", () => {
  it("has 28 unique tiles 0-0..6-6", () => {
    const set = generateDoubleSixSet();
    expect(set).toHaveLength(28);
    expect(new Set(set.map((x) => x.id)).size).toBe(28);
    expect(set.filter((x) => x.a === x.b)).toHaveLength(7);
  });

  it.each([2, 3, 4])("deals 7 each to %i players, rest to the boneyard", (n) => {
    const { hands, boneyard } = deal(n);
    expect(hands).toHaveLength(n);
    hands.forEach((h) => expect(h).toHaveLength(7));
    expect(boneyard).toHaveLength(28 - 7 * n);
    const all = [...hands.flat(), ...boneyard].map((x) => x.id);
    expect(new Set(all).size).toBe(28);
  });

  it("rejects bad player counts", () => {
    expect(() => deal(1)).toThrow();
    expect(() => deal(5)).toThrow();
  });

  it("generates 6-letter uppercase codes", () => {
    for (let i = 0; i < 50; i++) expect(generateRoomCode()).toMatch(/^[A-Z]{6}$/);
  });
});

describe("starting player", () => {
  it("picks the highest double", () => {
    expect(findStartingPlayer([[t(1, 1), t(5, 6)], [t(4, 4)], [t(2, 2)]])).toBe(1);
  });
  it("falls back to highest tile sum", () => {
    expect(findStartingPlayer([[t(1, 2), t(3, 4)], [t(5, 6)], [t(0, 6)]])).toBe(1);
  });
});

describe("placing tiles", () => {
  it("roots the first tile and sets both ends", () => {
    const r = placeTile(t(3, 5), "root", [], { left: null, right: null });
    expect(r.openEnds).toEqual({ left: 3, right: 5 });
    expect(r.board[0]).toMatchObject({ placedSide: "root", flipped: false, isDouble: false });
  });

  it("orients right plays so the matching pip faces inward", () => {
    const start = placeTile(t(3, 5), "root", [], { left: null, right: null });
    const r1 = placeTile(t(5, 2), "right", start.board, start.openEnds);
    expect(r1.openEnds.right).toBe(2);
    expect(r1.board[1].flipped).toBe(false);
    expect(displayedPips(r1.board[1])).toEqual([5, 2]);
    const r2 = placeTile(t(0, 2), "right", r1.board, r1.openEnds);
    expect(r2.board[2].flipped).toBe(true);
    expect(displayedPips(r2.board[2])).toEqual([2, 0]);
    expect(r2.openEnds.right).toBe(0);
  });

  it("orients left plays and prepends", () => {
    const start = placeTile(t(3, 5), "root", [], { left: null, right: null });
    const r1 = placeTile(t(1, 3), "left", start.board, start.openEnds);
    expect(r1.board[0].id).toBe("1-3");
    expect(displayedPips(r1.board[0])).toEqual([1, 3]);
    expect(r1.openEnds.left).toBe(1);
    const r2 = placeTile(t(1, 6), "left", r1.board, r1.openEnds);
    expect(displayedPips(r2.board[0])).toEqual([6, 1]);
    expect(r2.board[0].flipped).toBe(true);
    expect(r2.openEnds).toEqual({ left: 6, right: 5 });
  });

  it("keeps the chain consistent: adjacent displayed pips always match", () => {
    for (let game = 0; game < 200; game++) {
      const { hands } = deal(4);
      const pool = hands.flat();
      let board: BoardTile[] = [];
      let ends: OpenEnds = { left: null, right: null };
      let progressed = true;
      while (progressed) {
        progressed = false;
        for (let i = 0; i < pool.length; i++) {
          const sides = validSides(pool[i], board, ends);
          if (sides.length) {
            const side = sides[Math.floor(Math.random() * sides.length)];
            ({ board, openEnds: ends } = placeTile(pool[i], side, board, ends));
            pool.splice(i, 1);
            progressed = true;
            break;
          }
        }
      }
      for (let i = 0; i + 1 < board.length; i++) {
        expect(displayedPips(board[i])[1]).toBe(displayedPips(board[i + 1])[0]);
      }
      expect(displayedPips(board[0])[0]).toBe(ends.left);
      expect(displayedPips(board[board.length - 1])[1]).toBe(ends.right);
    }
  });

  it("rejects mismatched tiles", () => {
    const start = placeTile(t(3, 5), "root", [], { left: null, right: null });
    expect(() => placeTile(t(1, 1), "right", start.board, start.openEnds)).toThrow();
    expect(() => placeTile(t(1, 1), "left", start.board, start.openEnds)).toThrow();
    expect(() => placeTile(t(3, 3), "root", start.board, start.openEnds)).toThrow();
  });
});

describe("blocked games and scoring", () => {
  const board = placeTile(t(6, 6), "root", [], { left: null, right: null });
  it("is blocked only when nobody can move and nobody can draw", () => {
    const hands = [[t(0, 1)], [t(2, 3)]];
    expect(isBlocked(hands, board.board, board.openEnds, 0, "draw")).toBe(true);
    expect(isBlocked(hands, board.board, board.openEnds, 3, "draw")).toBe(false);
    expect(isBlocked(hands, board.board, board.openEnds, 3, "block")).toBe(true);
    expect(isBlocked([[t(0, 6)], [t(2, 3)]], board.board, board.openEnds, 0, "block")).toBe(false);
  });
  it("lowest pip total wins a block; ties have no winner", () => {
    expect(blockedWinner([[t(5, 5)], [t(0, 1)], [t(3, 3)]])).toBe(1);
    expect(blockedWinner([[t(0, 2)], [t(1, 1)]])).toBeNull();
  });
  it("winner scores every pip left on the table, own and partner's included", () => {
    expect(roundPoints([[], [t(1, 2)], [t(6, 6)]])).toBe(15);
    // Blocked 2v2: winner (seat 0) still holds 1 pip, partner (seat 2) holds 4.
    expect(roundPoints([[t(0, 1)], [t(5, 5)], [t(2, 2)], [t(6, 3)]])).toBe(1 + 10 + 4 + 9);
  });
  it("a match opens with the highest double, or the heaviest tile when nobody has a double", async () => {
    const { findOpening, chooseOpeningTile } = await import("../convex/lib/rules");
    expect(findOpening([[t(1, 1), t(5, 6)], [t(4, 4)], [t(2, 2)]])).toEqual({ seat: 1, tileId: "4-4" });
    expect(findOpening([[t(1, 2), t(3, 4)], [t(5, 6)], [t(0, 6)]])).toEqual({ seat: 1, tileId: "5-6" });
    expect(validSides(t(5, 6), [], { left: null, right: null }, "4-4")).toEqual([]);
    expect(validSides(t(4, 4), [], { left: null, right: null }, "4-4")).toEqual(["root"]);
    expect(validSides(t(5, 6), [], { left: null, right: null })).toEqual(["root"]);
    expect(chooseOpeningTile([t(6, 6), t(4, 4)], "4-4").id).toBe("4-4");
    expect(chooseOpeningTile([t(6, 6), t(4, 4)]).id).toBe("6-6");
  });
});

describe("redeal", () => {
  it("throws in a deal where a hand holds five or more doubles", async () => {
    const { needsRedeal, dealFair } = await import("../convex/lib/rules");
    expect(needsRedeal([[t(0, 0), t(1, 1), t(2, 2), t(3, 3), t(4, 5)], [t(5, 5)]])).toBe(false);
    expect(needsRedeal([[t(0, 0), t(1, 1), t(2, 2), t(3, 3), t(4, 4)], [t(5, 6)]])).toBe(true);
    for (let i = 0; i < 200; i++) expect(needsRedeal(dealFair(4).hands)).toBe(false);
  });
});

describe("bonuses and CPU levels", () => {
  it("recognises a capicúa", async () => {
    const { isCapicua } = await import("../convex/lib/rules");
    expect(isCapicua({ id: "2-5", a: 2, b: 5 }, { left: 5, right: 2 })).toBe(true);
    expect(isCapicua({ id: "2-5", a: 2, b: 5 }, { left: 5, right: 3 })).toBe(false);
    expect(isCapicua({ id: "4-4", a: 4, b: 4 }, { left: 4, right: 4 })).toBe(false);
  });

  it("every level returns a legal move, and hard blocks a number the opponent lacks", async () => {
    const { chooseCpuMoveForLevel, validSides, placeTile } = await import("../convex/lib/rules");
    const board = placeTile({ id: "3-4", a: 3, b: 4 }, "root", [], { left: null, right: null });
    const hand = [
      { id: "4-6", a: 4, b: 6 },
      { id: "1-4", a: 1, b: 4 },
      { id: "0-2", a: 0, b: 2 },
    ];
    for (const level of ["easy", "normal", "hard"] as const) {
      const m = chooseCpuMoveForLevel(level, hand, board.board, board.openEnds)!;
      expect(validSides(hand.find((x) => x.id === m.tileId)!, board.board, board.openEnds)).toContain(m.side);
    }
    expect(chooseCpuMoveForLevel("hard", hand, board.board, board.openEnds, [1])!.tileId).toBe("1-4");
    expect(chooseCpuMoveForLevel("easy", [{ id: "0-0", a: 0, b: 0 }], board.board, board.openEnds)).toBeNull();
  });
});
