/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const S = (n: number) => `soak-${n}-xxxxxxxxxx`;

type T = ReturnType<typeof convexTest>;

/** Everything on the table and in every hand must always be the 28 tiles, once each. */
async function checkTiles(t: T) {
  const { room, players } = await t.run(async (ctx) => ({
    room: (await ctx.db.query("rooms").collect())[0],
    players: await ctx.db.query("players").collect(),
  }));
  const ids = [...room.board, ...room.boneyard, ...players.flatMap((p) => p.hand)].map((x) => x.id);
  expect(ids).toHaveLength(28);
  expect(new Set(ids).size).toBe(28);
  return { room, players };
}

describe("soak: whole matches with every option", () => {
  it.each([
    ["1v1", "draw", 2],
    ["1v1", "block", 2],
    ["2v2", "draw", 4],
    ["2v2", "block", 4],
  ] as const)("%s %s matches run to a winner with tiles and scores intact", async (matchType, mode, n) => {
    vi.useFakeTimers();
    for (let match = 0; match < 3; match++) {
      const t = convexTest(schema, modules);
      const { roomId, code } = await t.mutation(api.games.createRoom, { sessionId: S(0), playerName: "H", mode, matchType, targetScore: 100 });
      for (let i = 1; i < n; i++) await t.mutation(api.games.joinRoom, { code, sessionId: S(i), playerName: `P${i}` });
      await t.mutation(api.games.setRoomOptions, { roomId, sessionId: S(0), bonuses: true, turnSeconds: match % 2 ? 20 : 0 });

      let over = false;
      let lastTotal = 0;
      for (let round = 1; round <= 60 && !over; round++) {
        await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
        // Seats 0 and 1 play by hand; the others never act, so the server plays for them.
        for (let step = 0; step < 400; step++) {
          const state = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
          if (state.room.status !== "playing") break;
          const seat = state.room.currentTurnSeat;
          if (seat > 1) {
            await t.finishInProgressScheduledFunctions();
            vi.advanceTimersByTime(21_000);
            await t.finishInProgressScheduledFunctions();
            continue;
          }
          const mine = (await t.query(api.games.getGameState, { roomId, sessionId: S(seat) }))!.me!;
          // Keep the hand players "present" so only seats 2 and 3 are stood in for.
          await t.mutation(api.games.heartbeat, { roomId, sessionId: S(0) });
          await t.mutation(api.games.heartbeat, { roomId, sessionId: S(1) });
          if (!mine.isMyTurn) continue; // a stand-in or the timer got there first
          if (state.room.board.length === 0) {
            await t.mutation(api.games.playTile, { roomId, sessionId: S(seat), tileId: mine.playable[0].tileId, targetSide: "root" });
          } else if (mine.playable.length) {
            const p = mine.playable[step % mine.playable.length];
            await t.mutation(api.games.playTile, { roomId, sessionId: S(seat), tileId: p.tileId, targetSide: p.sides[step % p.sides.length] });
          } else {
            await t.mutation(api.games.drawOrPass, { roomId, sessionId: S(seat) });
          }
          if (step % 7 === 0) await checkTiles(t);
        }
        const { room, players } = await checkTiles(t);
        expect(room.status).toBe("finished");
        const total = players.reduce((a, p) => a + p.score, 0);
        expect(total).toBeGreaterThanOrEqual(lastTotal); // points are only ever added
        lastTotal = total;
        const teamScore = (team: number) =>
          players.filter((p) => (matchType === "2v2" ? p.seatIndex % 2 : p.seatIndex) === team).reduce((a, p) => a + p.score, 0);
        const best = Math.max(...[0, 1].map(teamScore));
        expect(!!room.matchOver).toBe(best >= 100);
        if (room.matchOver) {
          expect(teamScore(room.matchWinnerTeam!)).toBe(best);
          over = true;
        }
      }
      expect(over).toBe(true);
      // A rematch starts clean.
      await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
      const fresh = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
      expect(fresh.room.round).toBe(1);
      expect(fresh.me!.score + fresh.opponents.reduce((a, o) => a + o.score, 0)).toBe(0);
      await checkTiles(t);
    }
    vi.useRealTimers();
  }, 120_000);

  it.each(["easy", "normal", "hard"] as const)("a %s CPU always finishes its matches", async (cpuLevel) => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const { roomId } = await t.mutation(api.games.createRoom, { sessionId: S(0), playerName: "Me", mode: "draw", matchType: "cpu", targetScore: 100, cpuLevel });
    await t.mutation(api.games.setRoomOptions, { roomId, sessionId: S(0), bonuses: true });
    let wins = 0;
    for (let round = 0; round < 12; round++) {
      await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
      for (let step = 0; step < 300; step++) {
        await t.finishAllScheduledFunctions(vi.runAllTimers);
        const s = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
        if (s.room.status === "finished") {
          if (s.room.winnerSeat === 1) wins++;
          break;
        }
        expect(s.me!.isMyTurn).toBe(true);
        if (s.room.board.length === 0) await t.mutation(api.games.playTile, { roomId, sessionId: S(0), tileId: s.me!.playable[0].tileId, targetSide: "root" });
        else if (s.me!.playable.length) await t.mutation(api.games.playTile, { roomId, sessionId: S(0), tileId: s.me!.playable[0].tileId, targetSide: s.me!.playable[0].sides[0] });
        else await t.mutation(api.games.drawOrPass, { roomId, sessionId: S(0) });
      }
      await checkTiles(t);
      expect((await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!.room.status).toBe("finished");
    }
    expect(wins).toBeGreaterThanOrEqual(0);
    vi.useRealTimers();
  }, 120_000);
});
