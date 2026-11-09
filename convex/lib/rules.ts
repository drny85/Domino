/**
 * Pure Double-Six domino rules. No Convex imports here so this module can be
 * unit-tested directly and shared (types only) with the client.
 */

export type Tile = { id: string; a: number; b: number };
export type Side = "left" | "right" | "root";
export type BoardTile = Tile & {
  isDouble: boolean;
  placedSide: Side;
  flipped: boolean;
};
export type OpenEnds = { left: number | null; right: number | null };

export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;
export const HAND_SIZE = 7;

/** All 28 Double-Six tiles, 0-0 through 6-6. */
export function generateDoubleSixSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      tiles.push({ id: `${a}-${b}`, a, b });
    }
  }
  return tiles;
}

/** In-place Fisher-Yates shuffle. `random` is injectable for tests. */
export function fisherYates<T>(items: T[], random: () => number = Math.random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function deal(
  playerCount: number,
  random: () => number = Math.random,
): { hands: Tile[][]; boneyard: Tile[] } {
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new Error(`Dominoes needs ${MIN_PLAYERS}-${MAX_PLAYERS} players`);
  }
  const deck = fisherYates(generateDoubleSixSet(), random);
  const hands: Tile[][] = [];
  for (let p = 0; p < playerCount; p++) {
    hands.push(deck.splice(0, HAND_SIZE));
  }
  return { hands, boneyard: deck };
}

/**
 * Index (into `hands`) of the player who leads: highest double, otherwise
 * highest single tile sum (ties broken by highest single pip, then lowest index).
 */
export function findStartingPlayer(hands: Tile[][]): number {
  let bestDouble = -1;
  let bestDoubleIdx = -1;
  hands.forEach((hand, idx) => {
    for (const t of hand) {
      if (t.a === t.b && t.a > bestDouble) {
        bestDouble = t.a;
        bestDoubleIdx = idx;
      }
    }
  });
  if (bestDoubleIdx >= 0) return bestDoubleIdx;

  let bestSum = -1;
  let bestHigh = -1;
  let bestIdx = 0;
  hands.forEach((hand, idx) => {
    for (const t of hand) {
      const sum = t.a + t.b;
      const high = Math.max(t.a, t.b);
      if (sum > bestSum || (sum === bestSum && high > bestHigh)) {
        bestSum = sum;
        bestHigh = high;
        bestIdx = idx;
      }
    }
  });
  return bestIdx;
}

export function pipTotal(hand: Tile[]): number {
  return hand.reduce((sum, t) => sum + t.a + t.b, 0);
}

/** Sides on which `tile` can legally be played right now. */
export function validSides(tile: Tile, board: BoardTile[], ends: OpenEnds): Side[] {
  if (board.length === 0) return ["root"];
  const sides: Side[] = [];
  if (ends.left !== null && (tile.a === ends.left || tile.b === ends.left)) sides.push("left");
  if (ends.right !== null && (tile.a === ends.right || tile.b === ends.right)) sides.push("right");
  return sides;
}

export function hasPlayableTile(hand: Tile[], board: BoardTile[], ends: OpenEnds): boolean {
  return hand.some((t) => validSides(t, board, ends).length > 0);
}

/**
 * Places a tile and returns the new board and open ends.
 *
 * Orientation convention: the board array is read left-to-right. A tile's
 * displayed order is `[a, b]` when `flipped` is false and `[b, a]` when true.
 * So for a right-side play the displayed-left (inner) pip must equal the old
 * right end, and for a left-side play the displayed-right (inner) pip must
 * equal the old left end.
 */
export function placeTile(
  tile: Tile,
  side: Side,
  board: BoardTile[],
  ends: OpenEnds,
): { board: BoardTile[]; openEnds: OpenEnds } {
  const isDouble = tile.a === tile.b;

  if (board.length === 0) {
    if (side !== "root") throw new Error("The first tile must be played as the root");
    return {
      board: [{ ...tile, isDouble, placedSide: "root", flipped: false }],
      openEnds: { left: tile.a, right: tile.b },
    };
  }
  if (side === "root") throw new Error("The board already has a root tile");

  if (side === "right") {
    const end = ends.right;
    if (end === null || (tile.a !== end && tile.b !== end)) {
      throw new Error("Tile does not match the right end");
    }
    const flipped = tile.a !== end; // inner (displayed-left) must equal `end`
    const outward = flipped ? tile.a : tile.b;
    return {
      board: [...board, { ...tile, isDouble, placedSide: "right", flipped }],
      openEnds: { left: ends.left, right: outward },
    };
  }

  const end = ends.left;
  if (end === null || (tile.a !== end && tile.b !== end)) {
    throw new Error("Tile does not match the left end");
  }
  const flipped = tile.b !== end; // inner (displayed-right) must equal `end`
  const outward = flipped ? tile.b : tile.a;
  return {
    board: [{ ...tile, isDouble, placedSide: "left", flipped }, ...board],
    openEnds: { left: outward, right: ends.right },
  };
}

/** Displayed [left, right] pip values of a board tile. */
export function displayedPips(t: BoardTile): [number, number] {
  return t.flipped ? [t.b, t.a] : [t.a, t.b];
}

/** True when nobody can move and nobody can draw. */
export function isBlocked(
  hands: Tile[][],
  board: BoardTile[],
  ends: OpenEnds,
  boneyardSize: number,
  mode: "draw" | "block",
): boolean {
  if (board.length === 0) return false;
  if (mode === "draw" && boneyardSize > 0) return false;
  return !hands.some((h) => hasPlayableTile(h, board, ends));
}

export type MatchType = "1v1" | "2v2" | "cpu";

/** Seats a match type needs before it can start. */
export function seatsFor(matchType: MatchType): number {
  return matchType === "2v2" ? 4 : 2;
}

/** Team id per seat: partners in 2v2 sit across (0 & 2 vs 1 & 3). */
export function teamsFor(matchType: MatchType, playerCount: number): number[] {
  return Array.from({ length: playerCount }, (_, seat) => (matchType === "2v2" ? seat % 2 : seat));
}

/**
 * Blocked-game winner. The team (or player, outside 2v2) with the lowest pip
 * total wins; within that team the member holding fewer pips is credited.
 * Returns `null` on a tie for lowest (no one scores that round).
 */
export function blockedWinner(hands: Tile[][], teams: number[] = hands.map((_, i) => i)): number | null {
  const teamTotals = new Map<number, number>();
  hands.forEach((h, i) => teamTotals.set(teams[i], (teamTotals.get(teams[i]) ?? 0) + pipTotal(h)));
  const min = Math.min(...teamTotals.values());
  const lowTeams = [...teamTotals.entries()].filter(([, total]) => total === min);
  if (lowTeams.length !== 1) return null;
  const team = lowTeams[0][0];
  let best = -1;
  hands.forEach((h, i) => {
    if (teams[i] === team && (best === -1 || pipTotal(h) < pipTotal(hands[best]))) best = i;
  });
  return best;
}

/** Points the winner earns: every opposing player's remaining pips. */
export function roundPoints(hands: Tile[][], winnerIdx: number, teams: number[] = hands.map((_, i) => i)): number {
  return hands.reduce((sum, h, i) => (teams[i] === teams[winnerIdx] ? sum : sum + pipTotal(h)), 0);
}

/** Opening tile for the CPU: highest double, else heaviest tile. */
export function chooseOpeningTile(hand: Tile[]): Tile {
  const doubles = hand.filter((t) => t.a === t.b);
  const pool = doubles.length ? doubles : hand;
  return pool.reduce((best, t) => (t.a + t.b > best.a + best.b ? t : best));
}

/**
 * CPU move choice: the heaviest playable tile (dump points early), preferring
 * doubles on ties. Returns null if nothing is playable.
 */
export function chooseCpuMove(hand: Tile[], board: BoardTile[], ends: OpenEnds): { tileId: string; side: Side } | null {
  let best: { tile: Tile; side: Side } | null = null;
  const weight = (t: Tile) => (t.a + t.b) * 2 + (t.a === t.b ? 1 : 0);
  for (const tile of hand) {
    const sides = validSides(tile, board, ends);
    if (sides.length === 0) continue;
    if (!best || weight(tile) > weight(best.tile)) {
      // Prefer the side that leaves an end we still hold tiles for.
      const rest = hand.filter((t) => t.id !== tile.id);
      const scored = sides.map((side) => {
        const next = placeTile(tile, side, board, ends).openEnds;
        const follow = rest.filter((t) => validSides(t, [...board, { ...tile, isDouble: false, placedSide: side, flipped: false }], next).length > 0).length;
        return { side, follow };
      });
      scored.sort((x, y) => y.follow - x.follow);
      best = { tile, side: scored[0].side };
    }
  }
  return best ? { tileId: best.tile.id, side: best.side } : null;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // uppercase, no I or O

export function generateRoomCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}
