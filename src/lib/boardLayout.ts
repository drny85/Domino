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
  let afterCorner = false;

  for (const t of tiles) {
    const horizontal = dir.z === 0;
    const crosswise = t.isDouble && !afterCorner;
    const extent = crosswise ? 1 : 2;

    if (horizontal && !t.isDouble && Math.abs(px + dir.x * extent) > limit) {
      // Corner tile: runs along ±z just past the end of the row.
      const cdir: Dir = { x: 0, z: sign };
      const cx = px + dir.x * 0.5;
      const cz = pz + sign * 0.5;
      out.push({ id: t.id, a: t.inner, b: t.outer, x: cx, z: cz, rotY: angleFor(cdir), isDouble: false });
      // Next row starts at the corner's outer edge and runs back the other way.
      px = px + dir.x * 1;
      pz = pz + sign * 2;
      dir = { x: -dir.x, z: 0 };
      afterCorner = true;
      continue;
    }

    const cx = px + dir.x * (extent / 2);
    const cz = pz + dir.z * (extent / 2);
    const rot = angleFor(dir) + (crosswise ? Math.PI / 2 : 0);
    out.push({ id: t.id, a: t.inner, b: t.outer, x: cx, z: cz, rotY: rot, isDouble: t.isDouble });
    px += dir.x * extent;
    pz += dir.z * extent;
    afterCorner = false;
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

/** Axis-aligned footprint of a placed tile, for overlap checks. */
export function footprint(t: PlacedTile) {
  const alongX = Math.abs(Math.sin(t.rotY)) > 0.5;
  const hx = alongX ? 1 : 0.5;
  const hz = alongX ? 0.5 : 1;
  return { minX: t.x - hx, maxX: t.x + hx, minZ: t.z - hz, maxZ: t.z + hz };
}
