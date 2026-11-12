/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { validSides } from "../convex/lib/rules";

const modules = import.meta.glob("../convex/**/*.ts");
const S = (n: number) => `session-${n}-xxxxxxxx`;

async function setupRoom(playerCount: number, mode: "draw" | "block" = "draw") {
  const t = convexTest(schema, modules);
  const matchType = playerCount === 4 ? "2v2" : "1v1";
  const { roomId, code } = await t.mutation(api.games.createRoom, { sessionId: S(0), playerName: "Host", mode, matchType });
  for (let i = 1; i < playerCount; i++) {
    await t.mutation(api.games.joinRoom, { code, sessionId: S(i), playerName: `P${i}` });
  }
  return { t, roomId, code };
}

describe("lobby", () => {
  it("creates a room with a 6-letter code and seats the host at 0", async () => {
    const { t, roomId, code } = await setupRoom(1);
    expect(code).toMatch(/^[A-Z]{6}$/);
    const s = await t.query(api.games.getGameState, { roomId, sessionId: S(0) });
    expect(s?.me?.seatIndex).toBe(0);
    expect(s?.me?.isHost).toBe(true);
  });

  it("seats four in 2v2 and rejects a fifth", async () => {
    const { t, code } = await setupRoom(4);
    await expect(
      t.mutation(api.games.joinRoom, { code, sessionId: S(9), playerName: "Late" }),
    ).rejects.toThrow(/full/);
  });

  it("rejoining is idempotent", async () => {
    const { t, code } = await setupRoom(2);
    const r = await t.mutation(api.games.joinRoom, { code: code.toLowerCase(), sessionId: S(1), playerName: "Again" });
    expect(r.seatIndex).toBe(1);
  });

  it("only the host can start, and needs two players", async () => {
    const solo = await setupRoom(1);
    await expect(solo.t.mutation(api.games.startGame, { roomId: solo.roomId, sessionId: S(0) })).rejects.toThrow();
    const { t, roomId } = await setupRoom(2);
    await expect(t.mutation(api.games.startGame, { roomId, sessionId: S(1) })).rejects.toThrow(/host/);
  });
});

describe("information hiding", () => {
  it("never returns the boneyard, other hands, or session ids", async () => {
    const { t, roomId } = await setupRoom(4);
    await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
    const s = await t.query(api.games.getGameState, { roomId, sessionId: S(1) });
    const json = JSON.stringify(s);
    expect(json).not.toContain("boneyard\"");
    expect(json).not.toContain(S(0));
    expect(json).not.toContain(S(2));
    expect(s!.me!.hand).toHaveLength(7);
    expect(s!.room.boneyardCount).toBe(0);
    for (const o of s!.opponents) {
      expect(Object.keys(o).sort()).toEqual(
        ["avatar", "drink", "finalPips", "id", "isBot", "name", "reaction", "score", "seatIndex", "team", "tileCount"].sort(),
      );
      expect(o.tileCount).toBe(7);
    }
  });
});

describe("turn validation", () => {
  it("rejects out-of-turn plays and tiles not in hand", async () => {
    const { t, roomId } = await setupRoom(2);
    await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
    const s = await t.query(api.games.getGameState, { roomId, sessionId: S(0) });
    const turn = s!.room.currentTurnSeat;
    const other = S(turn === 0 ? 1 : 0);
    const otherState = await t.query(api.games.getGameState, { roomId, sessionId: other });
    await expect(
      t.mutation(api.games.playTile, { roomId, sessionId: other, tileId: otherState!.me!.hand[0].id, targetSide: "root" }),
    ).rejects.toThrow(/turn/);
    const mine = await t.query(api.games.getGameState, { roomId, sessionId: S(turn) });
    const notMine = ["0-0", "0-1", "0-2", "1-1", "6-6", "5-6"].find((id) => !mine!.me!.hand.some((h) => h.id === id))!;
    await expect(
      t.mutation(api.games.playTile, { roomId, sessionId: S(turn), tileId: notMine, targetSide: "root" }),
    ).rejects.toThrow(/not in your hand/);
  });

  it("refuses draw/pass when a playable tile exists", async () => {
    const { t, roomId } = await setupRoom(2);
    await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
    const s = await t.query(api.games.getGameState, { roomId, sessionId: S(0) });
    const turn = s!.room.currentTurnSeat;
    const me = await t.query(api.games.getGameState, { roomId, sessionId: S(turn) });
    await t.mutation(api.games.playTile, { roomId, sessionId: S(turn), tileId: me!.me!.playable[0].tileId, targetSide: "root" });
    const next = (turn + 1) % 2;
    const n = await t.query(api.games.getGameState, { roomId, sessionId: S(next) });
    if (n!.me!.playable.length > 0) {
      await expect(t.mutation(api.games.drawOrPass, { roomId, sessionId: S(next) })).rejects.toThrow(/playable/);
    } else {
      await t.mutation(api.games.drawOrPass, { roomId, sessionId: S(next) });
    }
  });
});

/** Plays full games with a bot that only uses what getGameState exposes. */
async function playOut(playerCount: number, mode: "draw" | "block") {
  const { t, roomId } = await setupRoom(playerCount, mode);
  await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
  for (let step = 0; step < 500; step++) {
    const pub = await t.query(api.games.getGameState, { roomId, sessionId: S(0) });
    if (pub!.room.status === "finished") return { t, roomId };
    const sid = S(pub!.room.currentTurnSeat);
    const s = (await t.query(api.games.getGameState, { roomId, sessionId: sid }))!;
    expect(s.me!.isMyTurn).toBe(true);
    if (s.room.board.length === 0) {
      await t.mutation(api.games.playTile, { roomId, sessionId: sid, tileId: s.me!.playable[0].tileId, targetSide: "root" });
    } else if (s.me!.playable.length) {
      const p = s.me!.playable[0];
      const tile = s.me!.hand.find((h) => h.id === p.tileId)!;
      expect(validSides(tile, s.room.board, s.room.openEnds)).toEqual(p.sides);
      await t.mutation(api.games.playTile, { roomId, sessionId: sid, tileId: p.tileId, targetSide: p.sides[0] });
    } else {
      expect(s.me!.canDrawOrPass).toBe(true);
      await t.mutation(api.games.drawOrPass, { roomId, sessionId: sid });
    }
  }
  throw new Error("Game did not finish");
}

describe("full games", () => {
  it.each([
    [2, "draw"],
    [4, "draw"],
    [2, "block"],
    [4, "block"],
  ] as const)("%i players in %s mode reach a finished state with consistent scoring", async (n, mode) => {
    for (let g = 0; g < 8; g++) {
      const { t, roomId } = await playOut(n, mode);
      const s = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
      expect(s.room.status).toBe("finished");
      expect(["domino", "blocked", "blocked-tie"]).toContain(s.room.winReason);
      const everyone = [{ seatIndex: s.me!.seatIndex, team: s.me!.team, score: s.me!.score, pips: s.me!.finalPips!, tiles: s.me!.hand.length },
        ...s.opponents.map((o) => ({ seatIndex: o.seatIndex, team: o.team, score: o.score, pips: o.finalPips!, tiles: o.tileCount }))];
      if (s.room.winReason === "blocked-tie") {
        expect(s.room.winnerSeat).toBeNull();
        everyone.forEach((p) => expect(p.score).toBe(0));
      } else {
        const w = everyone.find((p) => p.seatIndex === s.room.winnerSeat)!;
        if (s.room.winReason === "domino") expect(w.tiles).toBe(0);
        // The winner takes every pip left on the table, partner's and own included.
        const onTable = everyone.reduce((a, p) => a + p.pips, 0);
        expect(w.score).toBe(onTable);
        if (s.room.winReason === "blocked") {
          const teamPips = (team: number) => everyone.filter((p) => p.team === team).reduce((a, p) => a + p.pips, 0);
          for (const p of everyone) if (p.team !== w.team) expect(teamPips(w.team)).toBeLessThan(teamPips(p.team));
        }
      }
      // Chain integrity
      const board = s.room.board;
      const disp = (x: (typeof board)[number]) => (x.flipped ? [x.b, x.a] : [x.a, x.b]);
      for (let i = 0; i + 1 < board.length; i++) expect(disp(board[i])[1]).toBe(disp(board[i + 1])[0]);
      // Next round can start and keeps scores
      await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
      const r2 = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
      expect(r2.room.round).toBe(2);
      expect(r2.me!.score).toBe(s.me!.score);
      expect(r2.room.board).toHaveLength(0);
    }
  });
});

describe("match types", () => {
  it("1v1 needs exactly two players; 2v2 needs four", async () => {
    const t = convexTest(schema, modules);
    const r = await t.mutation(api.games.createRoom, { sessionId: S(0), playerName: "H", mode: "draw", matchType: "2v2" });
    await t.mutation(api.games.joinRoom, { code: r.code, sessionId: S(1), playerName: "A" });
    await expect(t.mutation(api.games.startGame, { roomId: r.roomId, sessionId: S(0) })).rejects.toThrow(/needs 4/);
    const one = await t.mutation(api.games.createRoom, { sessionId: S(5), playerName: "H", mode: "draw", matchType: "1v1" });
    await t.mutation(api.games.joinRoom, { code: one.code, sessionId: S(6), playerName: "A" });
    await expect(t.mutation(api.games.joinRoom, { code: one.code, sessionId: S(7), playerName: "B" })).rejects.toThrow(/full/);
  });

  it("2v2 partners are seats 0&2 vs 1&3 and players can switch to an empty seat", async () => {
    const t = convexTest(schema, modules);
    const r = await t.mutation(api.games.createRoom, { sessionId: S(0), playerName: "H", mode: "block", matchType: "2v2" });
    await t.mutation(api.games.joinRoom, { code: r.code, sessionId: S(1), playerName: "A" });
    await t.mutation(api.games.switchSeat, { roomId: r.roomId, sessionId: S(1), seatIndex: 2 });
    const s = (await t.query(api.games.getGameState, { roomId: r.roomId, sessionId: S(1) }))!;
    expect(s.me!.seatIndex).toBe(2);
    expect(s.me!.team).toBe(0);
    await expect(t.mutation(api.games.switchSeat, { roomId: r.roomId, sessionId: S(1), seatIndex: 0 })).rejects.toThrow(/taken/);
  });

  it("CPU games start immediately and the CPU plays its turns", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const r = await t.mutation(api.games.createRoom, { sessionId: S(0), playerName: "Me", mode: "draw", matchType: "cpu" });
    await expect(t.mutation(api.games.joinRoom, { code: r.code, sessionId: S(1), playerName: "X" })).rejects.toThrow();
    for (let game = 0; game < 5; game++) {
      await t.mutation(api.games.startGame, { roomId: r.roomId, sessionId: S(0) });
      for (let step = 0; step < 300; step++) {
        await t.finishAllScheduledFunctions(vi.runAllTimers);
        const s = (await t.query(api.games.getGameState, { roomId: r.roomId, sessionId: S(0) }))!;
        if (s.room.status === "finished") break;
        expect(s.me!.isMyTurn).toBe(true); // CPU never leaves the turn hanging
        if (s.room.board.length === 0) {
          await t.mutation(api.games.playTile, { roomId: r.roomId, sessionId: S(0), tileId: s.me!.playable[0].tileId, targetSide: "root" });
        } else if (s.me!.playable.length) {
          const p = s.me!.playable[0];
          await t.mutation(api.games.playTile, { roomId: r.roomId, sessionId: S(0), tileId: p.tileId, targetSide: p.sides[0] });
        } else {
          await t.mutation(api.games.drawOrPass, { roomId: r.roomId, sessionId: S(0) });
        }
      }
      const end = (await t.query(api.games.getGameState, { roomId: r.roomId, sessionId: S(0) }))!;
      expect(end.room.status).toBe("finished");
      expect(end.opponents[0].isBot).toBe(true);
    }
    vi.useRealTimers();
  });
});

describe("points to win", () => {
  it("defaults to 200 and only the host can change it between rounds", async () => {
    const { t, roomId } = await setupRoom(2);
    let s = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
    expect(s.room.targetScore).toBe(200);
    await expect(t.mutation(api.games.setTargetScore, { roomId, sessionId: S(1), targetScore: 100 })).rejects.toThrow(/host/);
    await t.mutation(api.games.setTargetScore, { roomId, sessionId: S(0), targetScore: 100 });
    s = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
    expect(s.room.targetScore).toBe(100);
    await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
    await expect(t.mutation(api.games.setTargetScore, { roomId, sessionId: S(0), targetScore: 200 })).rejects.toThrow(/between rounds/);
  });

  it.each([["1v1", 2], ["2v2", 4]] as const)("%s match ends when a side reaches 100, then a new match resets", async (_, n) => {
    const t = convexTest(schema, modules);
    const { roomId, code } = await t.mutation(api.games.createRoom, {
      sessionId: S(0), playerName: "H", mode: "block", matchType: n === 4 ? "2v2" : "1v1", targetScore: 100,
    });
    for (let i = 1; i < n; i++) await t.mutation(api.games.joinRoom, { code, sessionId: S(i), playerName: `P${i}` });
    await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
    let rounds = 0;
    for (let step = 0; step < 20000; step++) {
      const pub = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
      if (pub.room.status === "finished") {
        rounds++;
        const all = [{ team: pub.me!.team, score: pub.me!.score }, ...pub.opponents];
        const totals = new Map<number, number>();
        all.forEach((p) => totals.set(p.team, (totals.get(p.team) ?? 0) + p.score));
        const best = Math.max(...totals.values());
        expect(pub.room.matchOver).toBe(best >= 100);
        if (pub.room.matchOver) {
          expect(totals.get(pub.room.matchWinnerTeam!)).toBe(best);
          await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
          const fresh = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
          expect(fresh.room.round).toBe(1);
          expect(fresh.room.matchOver).toBe(false);
          expect([fresh.me!.score, ...fresh.opponents.map((o) => o.score)].every((x) => x === 0)).toBe(true);
          return;
        }
        await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
        continue;
      }
      const sid = S(pub.room.currentTurnSeat);
      const s = (await t.query(api.games.getGameState, { roomId, sessionId: sid }))!;
      if (s.room.board.length === 0) {
        await t.mutation(api.games.playTile, { roomId, sessionId: sid, tileId: s.me!.playable[0].tileId, targetSide: "root" });
      } else if (s.me!.playable.length) {
        const p = s.me!.playable[0];
        await t.mutation(api.games.playTile, { roomId, sessionId: sid, tileId: p.tileId, targetSide: p.sides[0] });
      } else {
        await t.mutation(api.games.drawOrPass, { roomId, sessionId: sid });
      }
    }
    throw new Error(`match did not finish after ${rounds} rounds`);
  }, 60000);
});

describe("house rules and table extras", () => {
  it("only the host changes the rules, and they show in the state", async () => {
    const { t, roomId } = await setupRoom(2);
    await expect(t.mutation(api.games.setRoomOptions, { roomId, sessionId: S(1), bonuses: true })).rejects.toThrow(/host/);
    await t.mutation(api.games.setRoomOptions, { roomId, sessionId: S(0), bonuses: true, turnSeconds: 20, cpuLevel: "hard" });
    const s = (await t.query(api.games.getGameState, { roomId, sessionId: S(1) }))!;
    expect(s.room.bonuses).toBe(true);
    expect(s.room.turnSeconds).toBe(20);
    expect(s.room.cpuLevel).toBe("hard");
    expect(s.room.bonusPoints).toBe(25);
    await t.mutation(api.games.setRoomOptions, { roomId, sessionId: S(0), bonusPoints: 30 });
    expect((await t.query(api.games.getGameState, { roomId, sessionId: S(1) }))!.room.bonusPoints).toBe(30);
  });

  it("accepts listed reactions and avatars only", async () => {
    const { t, roomId, code } = await setupRoom(1);
    await t.mutation(api.games.joinRoom, { code, sessionId: S(1), playerName: "P1", avatar: "🦁" });
    await expect(t.mutation(api.games.sendReaction, { roomId, sessionId: S(1), reaction: "<b>hi</b>" })).rejects.toThrow(/Unknown/);
    await t.mutation(api.games.sendReaction, { roomId, sessionId: S(1), reaction: "¡Capicúa!" });
    await t.mutation(api.games.setAvatar, { roomId, sessionId: S(0), avatar: "not-an-avatar" });
    const s = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
    expect(s.opponents[0].reaction?.text).toBe("¡Capicúa!");
    expect(s.opponents[0].avatar).toBe("🦁");
    expect(s.me!.avatar).toBeNull();
    // A drink stays at the seat once asked for; hurrying needs a game with someone else on the move.
    expect(s.opponents[0].drink).toBe(false);
    await expect(t.mutation(api.games.sendReaction, { roomId, sessionId: S(0), reaction: "¡Dale!" })).rejects.toThrow(/someone else/);
    await t.mutation(api.games.sendReaction, { roomId, sessionId: S(0), reaction: "Bring me a drink!" });
    await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
    const g = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
    expect(g.me!.drink).toBe(true);
    const mover = g.me!.isMyTurn ? S(0) : S(1);
    const waiter = g.me!.isMyTurn ? S(1) : S(0);
    await expect(t.mutation(api.games.sendReaction, { roomId, sessionId: mover, reaction: "¡Dale!" })).rejects.toThrow(/someone else/);
    await t.mutation(api.games.sendReaction, { roomId, sessionId: waiter, reaction: "¡Dale!" });
  });

  it.each([20, 0] as const)("plays for players who run out of time or drop off (timer %i)", async (turnSeconds) => {
    vi.useFakeTimers();
    const { t, roomId } = await setupRoom(2);
    await t.mutation(api.games.setRoomOptions, { roomId, sessionId: S(0), turnSeconds });
    await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
    const first = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
    expect(first.room.turnDeadline === null).toBe(turnSeconds === 0);
    // Nobody touches the game: the server finishes the round on its own.
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const s = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
    expect(s.room.status).toBe("finished");
    expect(s.room.lastAction?.auto).toBe(true);
    expect(s.room.lastRound).not.toBeNull();
    // With the host gone, another player may deal the next round.
    await t.mutation(api.games.startGame, { roomId, sessionId: S(1) });
    vi.useRealTimers();
  });
});

describe("who opens", () => {
  it("the round winner opens the next round, and the highest double opens a new match", async () => {
    vi.useFakeTimers();
    const { t, roomId } = await setupRoom(2, "block");
    await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
    const holdsHighestDouble = async () => {
      const hands = await t.run(async (ctx) => (await ctx.db.query("players").collect()).sort((a, b) => a.seatIndex - b.seatIndex).map((p) => p.hand));
      const best = (h: typeof hands[number]) => Math.max(-1, ...h.filter((x) => x.a === x.b).map((x) => x.a));
      return best(hands[0]) === best(hands[1]) ? null : best(hands[0]) > best(hands[1]) ? 0 : 1;
    };
    const first = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
    const expected = await holdsHighestDouble();
    if (expected !== null) expect(first.room.currentTurnSeat).toBe(expected);

    for (let round = 0; round < 12; round++) {
      await t.finishAllScheduledFunctions(vi.runAllTimers); // the server plays the round out
      const end = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
      expect(end.room.status).toBe("finished");
      await t.mutation(api.games.startGame, { roomId, sessionId: S(1) });
      const next = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
      if (end.room.matchOver) {
        expect(next.room.round).toBe(1);
        const dbl = await holdsHighestDouble();
        if (dbl !== null) expect(next.room.currentTurnSeat).toBe(dbl);
      } else if (end.room.winnerSeat !== null) {
        expect(next.room.currentTurnSeat).toBe(end.room.winnerSeat);
      }
    }
    vi.useRealTimers();
  });
});

describe("opening play", () => {

  it("the first round of a match must open with the highest double; later rounds open with any tile", async () => {
    for (let g = 0; g < 6; g++) {
      const { t, roomId } = await setupRoom(4, "block");
      await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
      const hands = await t.run(async (ctx) => (await ctx.db.query("players").collect()).sort((a, b) => a.seatIndex - b.seatIndex).map((p) => p.hand));
      // Four players hold all 28 tiles, so the 6-6 is always out.
      const opener = hands.findIndex((h) => h.some((x) => x.id === "6-6"));
      const s = (await t.query(api.games.getGameState, { roomId, sessionId: S(opener) }))!;
      expect(s.room.currentTurnSeat).toBe(opener);
      expect(s.me!.mustOpenWith).toBe("6-6");
      expect(s.me!.playable).toEqual([{ tileId: "6-6", sides: ["root"] }]);
      const other = hands[opener].find((x) => x.id !== "6-6")!;
      await expect(
        t.mutation(api.games.playTile, { roomId, sessionId: S(opener), tileId: other.id, targetSide: "root" }),
      ).rejects.toThrow(/highest double/);
      // Nobody else is told what to open with.
      const watcher = (await t.query(api.games.getGameState, { roomId, sessionId: S((opener + 1) % 4) }))!;
      expect(watcher.me!.mustOpenWith).toBeNull();
      await t.mutation(api.games.playTile, { roomId, sessionId: S(opener), tileId: "6-6", targetSide: "root" });

      // Play the round out, then the next round's opener may lead with anything.
      for (let step = 0; step < 200; step++) {
        const pub = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
        if (pub.room.status === "finished") break;
        const sid = S(pub.room.currentTurnSeat);
        const me = (await t.query(api.games.getGameState, { roomId, sessionId: sid }))!.me!;
        if (me.playable.length) await t.mutation(api.games.playTile, { roomId, sessionId: sid, tileId: me.playable[0].tileId, targetSide: me.playable[0].sides[0] });
        else await t.mutation(api.games.drawOrPass, { roomId, sessionId: sid });
      }
      await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
      const r2 = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
      const lead = (await t.query(api.games.getGameState, { roomId, sessionId: S(r2.room.currentTurnSeat) }))!.me!;
      expect(lead.mustOpenWith).toBeNull();
      expect(lead.playable).toHaveLength(7);
    }
  });
});

describe("round points", () => {
  it("a 2v2 winner scores every pip left on the table, the partner's included", async () => {
    const { t, roomId } = await setupRoom(4, "block");
    await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
    const players = await t.run(async (ctx) => (await ctx.db.query("players").collect()).sort((a, b) => a.seatIndex - b.seatIndex));
    const room = await t.run(async (ctx) => (await ctx.db.query("rooms").collect())[0]);
    // Seat 0 is about to domino with the 2-3 on a 3 end. Partner (seat 2) holds 10 pips.
    await t.run(async (ctx) => {
      await ctx.db.patch(room._id, {
        currentTurnSeat: 0,
        openingTileId: undefined,
        board: [{ id: "3-3", a: 3, b: 3, isDouble: true, placedSide: "root", flipped: false }],
        openEnds: { left: 3, right: 3 },
      });
      await ctx.db.patch(players[0]._id, { hand: [{ id: "2-3", a: 2, b: 3 }] });
      await ctx.db.patch(players[1]._id, { hand: [{ id: "6-6", a: 6, b: 6 }] });
      await ctx.db.patch(players[2]._id, { hand: [{ id: "4-6", a: 4, b: 6 }] });
      await ctx.db.patch(players[3]._id, { hand: [{ id: "0-1", a: 0, b: 1 }] });
    });
    await t.mutation(api.games.playTile, { roomId, sessionId: S(0), tileId: "2-3", targetSide: "right" });
    const s = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
    expect(s.room.winReason).toBe("domino");
    expect(s.room.lastRound?.points).toBe(12 + 10 + 1);
    expect(s.me!.score).toBe(23);
  });
});

describe("bonuses", () => {
  /** Two players; seat 0 has just opened with the 6-6 and seat 1 is to move. */
  async function afterOpening(mode: "draw" | "block", seat1: { id: string; a: number; b: number }[], bonusPoints?: 25 | 30, bonuses = true) {
    const { t, roomId } = await setupRoom(2, mode);
    await t.mutation(api.games.setRoomOptions, { roomId, sessionId: S(0), bonuses, ...(bonusPoints ? { bonusPoints } : {}) });
    await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
    await t.run(async (ctx) => {
      const room = (await ctx.db.query("rooms").collect())[0];
      const players = (await ctx.db.query("players").collect()).sort((a, b) => a.seatIndex - b.seatIndex);
      await ctx.db.patch(room._id, { currentTurnSeat: 0, openingTileId: "6-6" });
      await ctx.db.patch(players[0]._id, { hand: [{ id: "6-6", a: 6, b: 6 }, { id: "0-0", a: 0, b: 0 }, { id: "6-3", a: 6, b: 3 }] });
      await ctx.db.patch(players[1]._id, { hand: seat1 });
    });
    await t.mutation(api.games.playTile, { roomId, sessionId: S(0), tileId: "6-6", targetSide: "root" });
    return { t, roomId };
  }
  const score = async (t: Awaited<ReturnType<typeof afterOpening>>["t"], roomId: Awaited<ReturnType<typeof afterOpening>>["roomId"], seat: number) =>
    (await t.query(api.games.getGameState, { roomId, sessionId: S(seat) }))!.me!.score;

  it("pase de salida: the opener scores when the next player has to pass", async () => {
    const { t, roomId } = await afterOpening("block", [{ id: "0-1", a: 0, b: 1 }, { id: "2-3", a: 2, b: 3 }]);
    await t.mutation(api.games.drawOrPass, { roomId, sessionId: S(1) });
    expect(await score(t, roomId, 0)).toBe(25);
    expect(await score(t, roomId, 1)).toBe(0);
    const s = (await t.query(api.games.getGameState, { roomId, sessionId: S(1) }))!;
    expect(s.room.bonusEvent).toMatchObject({ seatIndex: 0, kind: "salida", points: 25 });
  });

  it("in draw mode, drawing after the opening tile pays nothing; a real pass (empty boneyard) pays the bonus value", async () => {
    const drew = await afterOpening("draw", [{ id: "0-1", a: 0, b: 1 }], 30);
    await drew.t.mutation(api.games.drawOrPass, { roomId: drew.roomId, sessionId: S(1) });
    expect(await score(drew.t, drew.roomId, 0)).toBe(0);

    const passed = await afterOpening("draw", [{ id: "0-1", a: 0, b: 1 }], 30);
    await passed.t.run(async (ctx) => ctx.db.patch(passed.roomId, { boneyard: [] }));
    await passed.t.mutation(api.games.drawOrPass, { roomId: passed.roomId, sessionId: S(1) });
    expect(await score(passed.t, passed.roomId, 0)).toBe(30);
  });

  it("no pase de salida when the next player answers, or when bonuses are off", async () => {
    const answered = await afterOpening("block", [{ id: "6-1", a: 6, b: 1 }, { id: "2-3", a: 2, b: 3 }]);
    await answered.t.mutation(api.games.playTile, { roomId: answered.roomId, sessionId: S(1), tileId: "6-1", targetSide: "right" });
    expect(await score(answered.t, answered.roomId, 0)).toBe(0);
    const off = await afterOpening("block", [{ id: "0-1", a: 0, b: 1 }, { id: "2-3", a: 2, b: 3 }], undefined, false);
    await off.t.mutation(api.games.drawOrPass, { roomId: off.roomId, sessionId: S(1) });
    expect(await score(off.t, off.roomId, 0)).toBe(0);
  });

  it("a capicúa pays the room's bonus value", async () => {
    const { t, roomId } = await setupRoom(2, "block");
    await t.mutation(api.games.setRoomOptions, { roomId, sessionId: S(0), bonuses: true, bonusPoints: 30 });
    await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
    await t.run(async (ctx) => {
      const room = (await ctx.db.query("rooms").collect())[0];
      const players = (await ctx.db.query("players").collect()).sort((a, b) => a.seatIndex - b.seatIndex);
      await ctx.db.patch(room._id, {
        currentTurnSeat: 0,
        openingTileId: undefined,
        board: [
          { id: "2-4", a: 2, b: 4, isDouble: false, placedSide: "root", flipped: false },
          { id: "4-5", a: 4, b: 5, isDouble: false, placedSide: "right", flipped: false },
        ],
        openEnds: { left: 2, right: 5 },
      });
      await ctx.db.patch(players[0]._id, { hand: [{ id: "2-5", a: 2, b: 5 }] });
      await ctx.db.patch(players[1]._id, { hand: [{ id: "6-6", a: 6, b: 6 }] });
    });
    await t.mutation(api.games.playTile, { roomId, sessionId: S(0), tileId: "2-5", targetSide: "right" });
    const s = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
    expect(s.room.lastRound).toMatchObject({ points: 12 + 30, bonus: 30, bonusKind: "capicua" });
  });
});

describe("watching a CPU match", () => {
  it("four CPUs play a whole match to 100 on their own while the creator watches", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const { roomId, code } = await t.mutation(api.games.createRoom, { sessionId: S(0), playerName: "Me", mode: "draw", matchType: "watch", targetScore: 100 });
    await expect(t.mutation(api.games.joinRoom, { code, sessionId: S(1), playerName: "X" })).rejects.toThrow(/watching/);
    const start = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
    expect(start.me).toBeNull();
    expect(start.spectator?.isHost).toBe(true);
    expect(start.spectator?.hand).toHaveLength(7);
    expect(start.opponents).toHaveLength(4);
    expect(start.opponents.every((o) => o.isBot)).toBe(true);
    expect(start.room.status).toBe("playing");

    // The viewer stays: their pings keep the match dealing round after round.
    for (let i = 0; i < 20_000; i++) {
      if (i % 30 === 0) {
        await t.mutation(api.games.heartbeat, { roomId, sessionId: S(0) });
        if ((await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!.room.matchOver) break;
      }
      vi.advanceTimersByTime(1000);
      await t.finishInProgressScheduledFunctions();
    }
    const end = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
    expect(end.room.matchOver).toBe(true);
    expect(end.room.round).toBeGreaterThan(1);
    const team = (n: number) => end.opponents.filter((o) => o.team === n).reduce((a, o) => a + o.score, 0);
    expect(Math.max(team(0), team(1))).toBeGreaterThanOrEqual(100);
    // The creator can ask for a rematch; a stranger cannot.
    await expect(t.mutation(api.games.startGame, { roomId, sessionId: S(5) })).rejects.toThrow(/host/);
    await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
    vi.useRealTimers();
  });
});

describe("load and housekeeping", () => {
  it("a watched match stops dealing when the viewer leaves and resumes when they return", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const { roomId } = await t.mutation(api.games.createRoom, { sessionId: S(0), playerName: "Me", mode: "draw", matchType: "watch", targetScore: 200 });
    // Nobody pings: play goes on for two minutes, then nothing more is dealt.
    await t.finishAllScheduledFunctions(vi.runAllTimers, 20_000);
    const idle = (await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!;
    expect(idle.room.status).toBe("finished");
    expect(idle.room.matchOver).toBe(false);
    expect(idle.room.round).toBeLessThan(9);
    // The viewer comes back.
    await t.mutation(api.games.heartbeat, { roomId, sessionId: S(0) });
    vi.advanceTimersByTime(7000);
    await t.finishInProgressScheduledFunctions();
    expect((await t.query(api.games.getGameState, { roomId, sessionId: S(0) }))!.room.round).toBe(idle.room.round! + 1);
    vi.useRealTimers();
  });

  it("pings are kept apart from the game, and show who is online", async () => {
    const { t, roomId } = await setupRoom(2);
    const before = await t.run(async (ctx) => (await ctx.db.query("players").collect()).map((p) => p.lastSeen));
    await t.mutation(api.games.heartbeat, { roomId, sessionId: S(1) });
    const after = await t.run(async (ctx) => (await ctx.db.query("players").collect()).map((p) => p.lastSeen));
    expect(after).toEqual(before);
    const presence = await t.query(api.games.getPresence, { roomId });
    expect(presence.seats.map((s) => s.seatIndex).sort()).toEqual([0, 1]);
    expect(presence.seats.every((s) => presence.now - s.lastSeen < 5000)).toBe(true);
    // A stranger's ping is ignored.
    await t.mutation(api.games.heartbeat, { roomId, sessionId: S(7) });
    expect(await t.run(async (ctx) => (await ctx.db.query("presence").collect()).length)).toBe(1);
  });

  it("limits how fast one device can open rooms", async () => {
    const t = convexTest(schema, modules);
    const open = () => t.mutation(api.games.createRoom, { sessionId: S(0), playerName: "Me", mode: "draw" });
    for (let i = 0; i < 5; i++) await open();
    await expect(open()).rejects.toThrow(/Too many new rooms/);
    // Another device is not affected.
    await t.mutation(api.games.createRoom, { sessionId: S(1), playerName: "Other", mode: "draw" });
  });

  it("removes rooms left idle for a day, with their players and pings", async () => {
    vi.useFakeTimers();
    const { t, roomId } = await setupRoom(2);
    await t.mutation(api.games.heartbeat, { roomId, sessionId: S(0) });
    vi.advanceTimersByTime(23 * 60 * 60 * 1000);
    expect(await t.mutation(internal.games.cleanupRooms, {})).toBe(0);
    const fresh = await t.mutation(api.games.createRoom, { sessionId: S(3), playerName: "New", mode: "draw" });
    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    expect(await t.mutation(internal.games.cleanupRooms, {})).toBe(1);
    const left = await t.run(async (ctx) => ({
      rooms: (await ctx.db.query("rooms").collect()).map((r) => r._id),
      players: (await ctx.db.query("players").collect()).length,
      pings: (await ctx.db.query("presence").collect()).length,
    }));
    expect(left).toEqual({ rooms: [fresh.roomId], players: 1, pings: 0 });
    vi.useRealTimers();
  });
});

describe("rule changes during a match", () => {
  it("are recorded for every player and repeated when the next round is dealt", async () => {
    vi.useFakeTimers();
    const { t, roomId } = await setupRoom(2);
    // Before the first deal nothing is announced.
    await t.mutation(api.games.setRoomOptions, { roomId, sessionId: S(0), bonuses: true });
    await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
    expect((await t.query(api.games.getGameState, { roomId, sessionId: S(1) }))!.room.rulesChange).toBeNull();
    await t.finishAllScheduledFunctions(vi.runAllTimers); // the round plays itself out

    await t.mutation(api.games.setTargetScore, { roomId, sessionId: S(0), targetScore: 100 });
    await t.mutation(api.games.setRoomOptions, { roomId, sessionId: S(0), turnSeconds: 30, bonuses: true });
    const guest = (await t.query(api.games.getGameState, { roomId, sessionId: S(1) }))!;
    expect(guest.room.rulesChange?.changes).toEqual([
      { key: "target", value: "100", from: "200" },
      { key: "timer", value: "30", from: "0" },
    ]);
    expect(guest.room.rulesChange?.applied).toBeUndefined();
    // Putting a rule back to what it was drops it from the announcement.
    await t.mutation(api.games.setRoomOptions, { roomId, sessionId: S(0), turnSeconds: 0 });
    expect((await t.query(api.games.getGameState, { roomId, sessionId: S(1) }))!.room.rulesChange?.changes).toEqual([
      { key: "target", value: "100", from: "200" },
    ]);
    await t.mutation(api.games.setRoomOptions, { roomId, sessionId: S(0), turnSeconds: 30 });
    const at = guest.room.rulesChange!.at;
    vi.advanceTimersByTime(1000);
    await t.mutation(api.games.startGame, { roomId, sessionId: S(0) });
    const next = (await t.query(api.games.getGameState, { roomId, sessionId: S(1) }))!;
    expect(next.room.rulesChange?.applied).toBe(true);
    expect(next.room.rulesChange!.at).toBeGreaterThan(at);
    vi.useRealTimers();
  });
});
