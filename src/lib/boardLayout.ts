import type { BoardTile } from "../../convex/lib/rules";
import { displayedPips } from "../../convex/lib/rules";

/**
 * Lays the chain out on the table as a "snake".
 *
 * The root sits at the origin. The right branch runs toward +x and the left
 * branch toward -x; when a branch would leave the table it turns a corner
 * (right branch toward +z, left branch toward -z) and doubles back.
 *
 * Tile-local convention (see DominoTile): the tile is 1 wide (x) and 2 long
 * (z), value `a` is drawn on the -z half and `b` on the +z half. We pass the
 * chain's inner pip as `a` and the outer pip as `b`, then rotate the tile so
 * its +z axis points outward along the branch.
 */

export type PlacedTile = {
  id: string;
  /** Pip value drawn on the inner (-z) half. */
  a: number;
  /** Pip value drawn on the outer (+z) half. */
  b: number;
  x: number;
  z: number;
  rotY: number;
  isDouble: boolean;
};

export const ROW_LIMIT = 8;


type Dir = { x: number; z: number };

const angleFor = (d: Dir) => Math.atan2(d.x, d.z);

/**
 * Tiles a corner runs down before the chain turns back. The next row starts
 * beside the last one, so rows end up a tile and a half apart (same as iOS).
 */
export const CORNER_RUN = 2;

function walkBranch(
  tiles: { id: string; inner: number; outer: number; isDouble: boolean }[],
  start: number,
  sign: 1 | -1,
  limit: number,
) {
  const out: PlacedTile[] = [];
  let px = start;
  let pz = 0;
  let dir: Dir = { x: sign, z: 0 };
  // Inside a corner: straight tiles left to run down before turning, and
  // which way the row was heading before the corner.
  let downLeft = 0;
  let rowDirX: number = sign;
  let afterCorner = false;

  for (const t of tiles) {
    const horizontal = dir.z === 0;
    if (horizontal && !t.isDouble && Math.abs(px + dir.x * 2) > limit) {
      // Start the corner: run along ±z from just past the row's end,
      // overlapping the last row tile's width.
      rowDirX = dir.x;
      px += dir.x * 0.5;
      pz -= sign * 0.5;
      dir = { x: 0, z: sign };
      downLeft = CORNER_RUN;
    }
    const crosswise = t.isDouble && !afterCorner;
    const extent = crosswise ? 1 : 2;
    const rot = angleFor(dir) + (crosswise ? Math.PI / 2 : 0);
    out.push({ id: t.id, a: t.inner, b: t.outer, x: px + (dir.x * extent) / 2, z: pz + (dir.z * extent) / 2, rotY: rot, isDouble: t.isDouble });
    px += dir.x * extent;
    pz += dir.z * extent;
    afterCorner = false;
    if (dir.z !== 0 && !t.isDouble) {
      downLeft -= 1;
      if (downLeft <= 0) {
        // Turn back: the new row tucks in beside the last tile of the run,
        // so rows sit a tile and a half apart (center to center).
        pz -= sign * 0.5;
        px -= rowDirX * 0.5;
        dir = { x: -rowDirX, z: 0 };
        afterCorner = true;
      }
    }
  }
  return out;
}

/** `rowLimit` is how far (in x) a row may run from the center: narrow on phones. */
export function layoutBoard(board: BoardTile[], rowLimit = ROW_LIMIT): PlacedTile[] {
  if (board.length === 0) return [];
  const r = Math.max(0, board.findIndex((t) => t.placedSide === "root"));
  const root = board[r];
  const [rl, rr] = displayedPips(root);
  const rootHalf = root.isDouble ? 0.5 : 1;

  const placed: PlacedTile[] = [
    {
      id: root.id,
      a: rl,
      b: rr,
      x: 0,
      z: 0,
      rotY: angleFor({ x: 1, z: 0 }) + (root.isDouble ? Math.PI / 2 : 0),
      isDouble: root.isDouble,
    },
  ];

  const right = board.slice(r + 1).map((t) => {
    const [l, rgt] = displayedPips(t);
    return { id: t.id, inner: l, outer: rgt, isDouble: t.isDouble };
  });
  const left = board
    .slice(0, r)
    .reverse()
    .map((t) => {
      const [l, rgt] = displayedPips(t);
      return { id: t.id, inner: rgt, outer: l, isDouble: t.isDouble };
    });

  placed.push(...walkBranch(right, rootHalf, 1, rowLimit));
  placed.push(...walkBranch(left, -rootHalf, -1, rowLimit));
  return placed;
}

/**
 * The same spot turned a quarter turn, so the chain runs down the screen
 * instead of across it (upright phone, like iOS).
 */
export function upright(t: PlacedTile): PlacedTile {
  return { ...t, x: -t.z, z: t.x, rotY: t.rotY - Math.PI / 2 };
}

/** Upright phones: the chain runs top to bottom, snaking in columns (same as iOS). */
export const UPRIGHT_ROW_LIMIT = 6;

/** Lays the board out upright (chain down the screen) or across it with this row limit. */
export function layoutFor(board: BoardTile[], isUpright: boolean, rowLimit: number): PlacedTile[] {
  return isUpright ? layoutBoard(board, UPRIGHT_ROW_LIMIT).map(upright) : layoutBoard(board, rowLimit);
}

/** Axis-aligned footprint of a placed tile, for overlap checks. */
export function footprint(t: PlacedTile) {
  const alongX = Math.abs(Math.sin(t.rotY)) > 0.5;
  const hx = alongX ? 1 : 0.5;
  const hz = alongX ? 0.5 : 1;
  return { minX: t.x - hx, maxX: t.x + hx, minZ: t.z - hz, maxZ: t.z + hz };
}
