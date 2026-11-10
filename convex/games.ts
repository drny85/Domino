import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { cpuLevelValidator, matchTypeValidator, modeValidator, targetScoreValidator, turnSecondsValidator } from "./schema";
import {
  AVATARS,
  BONUS_POINTS,
  REACTIONS,
  blockedWinner,
  chooseCpuMove,
  chooseCpuMoveForLevel,
  isCapicua,
  chooseOpeningTile,
  deal,
  findStartingPlayer,
  generateRoomCode,
  hasPlayableTile,
  isBlocked,
  pipTotal,
  placeTile,
  roundPoints,
  seatsFor,
  teamsFor,
  validSides,
  type Side,
} from "./lib/rules";

/** A player counts as connected if they sent a heartbeat this recently. */
const CONNECTED_WINDOW_MS = 30_000;
const MAX_NAME_LENGTH = 24;
/** Delay before the CPU acts, so humans can follow what happened. */
const CPU_THINK_MS = 900;
export const DEFAULT_TARGET_SCORE = 200;
/** A human who has been silent this long gets their turn played for them. */
const AWAY_MS = 40_000;
/** How often an open human turn is re-checked for a timeout or an absent player. */
const AWAY_CHECK_MS = 15_000;
/** Pause before the server plays for someone who is already away. */
const STAND_IN_DELAY_MS = 2_500;
const REACTION_COOLDOWN_MS = 1_200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cleanName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
  return trimmed || "Guest";
}

function cleanAvatar(avatar: string | undefined): string | undefined {
  return avatar !== undefined && (AVATARS as readonly string[]).includes(avatar) ? avatar : undefined;
}

function assertSessionId(sessionId: string) {
  if (sessionId.length < 8 || sessionId.length > 128 || sessionId.startsWith("cpu:")) {
    throw new Error("Invalid session");
  }
}

async function getRoomOrThrow(ctx: QueryCtx, roomId: Id<"rooms">) {
  const room = await ctx.db.get(roomId);
  if (!room) throw new Error("Room not found");
  return room;
}

async function getPlayers(ctx: QueryCtx, roomId: Id<"rooms">) {
  const players = await ctx.db
    .query("players")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  return players.sort((a, b) => a.seatIndex - b.seatIndex);
}

async function getPlayer(ctx: QueryCtx, roomId: Id<"rooms">, sessionId: string) {
  return await ctx.db
    .query("players")
    .withIndex("by_room_session", (q) => q.eq("roomId", roomId).eq("sessionId", sessionId))
    .unique();
}

async function requireTurn(ctx: MutationCtx, roomId: Id<"rooms">, sessionId: string) {
  const room = await getRoomOrThrow(ctx, roomId);
  if (room.status !== "playing") throw new Error("The game is not in progress");
  const players = await getPlayers(ctx, roomId);
  const me = players.find((p) => p.sessionId === sessionId);
  if (!me) throw new Error("You are not seated in this room");
  if (me.seatIndex !== room.currentTurnSeat) throw new Error("It is not your turn");
  return { room, players, me };
}

const teamsOf = (room: Doc<"rooms">, players: Doc<"players">[]) => teamsFor(room.matchType, players.length);

/** Ends the round, awards points and records the winner. */
async function finishRound(
  ctx: MutationCtx,
  room: Doc<"rooms">,
  players: Doc<"players">[],
  winnerIdx: number | null,
  winReason: "domino" | "blocked" | "blocked-tie",
  bonus: { points: number; kind: string } | null = null,
) {
  const hands = players.map((p) => p.hand);
  const teams = teamsOf(room, players);
  const scores = players.map((p) => p.score);
  let points = 0;
  if (winnerIdx !== null) {
    const winner = players[winnerIdx];
    points = roundPoints(hands, winnerIdx, teams) + (bonus?.points ?? 0);
    scores[winnerIdx] += points;
    await ctx.db.patch(winner._id, { score: scores[winnerIdx] });
  }

  // Match over once a player (or team) reaches the target score.
  const target = room.targetScore ?? DEFAULT_TARGET_SCORE;
  const teamTotals = new Map<number, number>();
  scores.forEach((sc, i) => teamTotals.set(teams[i], (teamTotals.get(teams[i]) ?? 0) + sc));
  const leader = [...teamTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  const matchOver = !!leader && leader[1] >= target;

  await ctx.db.patch(room._id, {
    status: "finished",
    winnerSessionId: winnerIdx !== null ? players[winnerIdx].sessionId : undefined,
    winReason,
    matchOver,
    matchWinnerTeam: matchOver ? leader[0] : undefined,
    lastRound: { points, bonus: bonus?.points ?? 0, bonusKind: bonus?.kind },
    turnDeadline: undefined,
  });
}

async function endIfBlocked(
  ctx: MutationCtx,
  room: Doc<"rooms">,
  players: Doc<"players">[],
  boneyardSize: number,
): Promise<boolean> {
  const hands = players.map((p) => p.hand);
  if (!isBlocked(hands, room.board, room.openEnds, boneyardSize, room.mode)) return false;
  const winner = blockedWinner(hands, teamsOf(room, players));
  await finishRound(ctx, room, players, winner, winner === null ? "blocked-tie" : "blocked");
  return true;
}

/**
 * Sets up whatever has to happen next without a player acting: a CPU move, or
 * the clock on a human turn (turn timer, and a stand-in for an absent player).
 */
async function scheduleNext(ctx: MutationCtx, roomId: Id<"rooms">) {
  const room = await ctx.db.get(roomId);
  if (!room || room.status !== "playing") return;
  const players = await getPlayers(ctx, roomId);
  const current = players.find((p) => p.seatIndex === room.currentTurnSeat);
  if (!current) return;
  if (current.isBot) {
    await ctx.scheduler.runAfter(CPU_THINK_MS, internal.games.cpuTurn, {
      roomId,
      expectedSeat: room.currentTurnSeat,
      expectedBoardLength: room.board.length,
      expectedHandSize: current.hand.length,
    });
    return;
  }

  const turnId = room.turnId ?? 0;
  if (room.timerTurnId === turnId) return; // this turn's clock is already running
  const now = Date.now();
  const seconds = room.turnSeconds ?? 0;
  const deadline = seconds > 0 ? now + seconds * 1000 : undefined;
  await ctx.db.patch(roomId, { timerTurnId: turnId, turnDeadline: deadline });
  // Solo games against the CPU wait for the player unless a timer is set.
  const watchAway = room.matchType !== "cpu";
  if (deadline === undefined && !watchAway) return;
  const away = watchAway && now - (current.lastSeen ?? 0) > AWAY_MS;
  const delay = away ? STAND_IN_DELAY_MS : Math.min(deadline !== undefined ? deadline - now : Infinity, AWAY_CHECK_MS);
  await ctx.scheduler.runAfter(delay, internal.games.turnTick, { roomId, turnId });
}

async function applyPlay(
  ctx: MutationCtx,
  room: Doc<"rooms">,
  players: Doc<"players">[],
  me: Doc<"players">,
  tileId: string,
  targetSide: Side,
  auto = false,
) {
  const tile = me.hand.find((t) => t.id === tileId);
  if (!tile) throw new Error("That tile is not in your hand");
  if (!validSides(tile, room.board, room.openEnds).includes(targetSide)) {
    throw new Error("That tile can't be played there");
  }

  const { board, openEnds } = placeTile(tile, targetSide, room.board, room.openEnds);
  const hand = me.hand.filter((t) => t.id !== tileId);
  await ctx.db.patch(me._id, { hand, lastSeen: Date.now() });

  const updatedPlayers = players.map((p) => (p._id === me._id ? { ...p, hand } : p));
  const lastAction = { seatIndex: me.seatIndex, kind: "play", tileId, at: Date.now(), ...(auto ? { auto } : {}) };
  await ctx.db.patch(room._id, { board, openEnds, consecutivePasses: 0, lastAction });
  const updatedRoom = { ...room, board, openEnds };

  if (hand.length === 0) {
    const capicua = !!room.bonuses && room.board.length > 0 && isCapicua(tile, room.openEnds);
    await finishRound(ctx, updatedRoom, updatedPlayers, me.seatIndex, "domino", capicua ? { points: BONUS_POINTS, kind: "capicua" } : null);
    return "won" as const;
  }
  if (await endIfBlocked(ctx, updatedRoom, updatedPlayers, room.boneyard.length)) return "blocked" as const;

  await ctx.db.patch(room._id, {
    currentTurnSeat: (room.currentTurnSeat + 1) % players.length,
    turnId: (room.turnId ?? 0) + 1,
  });
  return "played" as const;
}

async function applyDrawOrPass(
  ctx: MutationCtx,
  room: Doc<"rooms">,
  players: Doc<"players">[],
  me: Doc<"players">,
  auto = false,
) {
  if (room.board.length === 0 || hasPlayableTile(me.hand, room.board, room.openEnds)) {
    throw new Error("You have a playable tile");
  }

  // Everyone saw this player fail to match the open ends.
  const voids = players.map((_, i) => [...(room.voids?.[i] ?? [])]);
  for (const n of [room.openEnds.left, room.openEnds.right]) {
    if (n !== null && voids[me.seatIndex] && !voids[me.seatIndex].includes(n)) voids[me.seatIndex].push(n);
  }
  const flag = auto ? { auto } : {};

  if (room.mode === "draw" && room.boneyard.length > 0) {
    const boneyard = [...room.boneyard];
    const drawn = boneyard.pop()!;
    await ctx.db.patch(me._id, { hand: [...me.hand, drawn], lastSeen: Date.now() });
    await ctx.db.patch(room._id, {
      boneyard,
      voids,
      lastAction: { seatIndex: me.seatIndex, kind: "draw", at: Date.now(), ...flag },
    });
    return "drew" as const;
  }

  if (await endIfBlocked(ctx, room, players, room.boneyard.length)) return "blocked" as const;

  const passes = (room.consecutivePasses ?? 0) + 1;
  const nextSeat = (room.currentTurnSeat + 1) % players.length;
  // Pase corrido (four players): the whole table passed on one player's tile.
  let bonusEvent: Doc<"rooms">["bonusEvent"] = undefined;
  if (room.bonuses && players.length === 4 && passes === 3) {
    const lucky = players.find((p) => p.seatIndex === nextSeat);
    if (lucky) {
      await ctx.db.patch(lucky._id, { score: lucky.score + BONUS_POINTS });
      bonusEvent = { seatIndex: nextSeat, kind: "pase", points: BONUS_POINTS, at: Date.now() };
    }
  }
  await ctx.db.patch(room._id, {
    currentTurnSeat: nextSeat,
    turnId: (room.turnId ?? 0) + 1,
    consecutivePasses: passes,
    voids,
    lastAction: { seatIndex: me.seatIndex, kind: "pass", at: Date.now(), ...flag },
    ...(bonusEvent ? { bonusEvent } : {}),
  });
  return "passed" as const;
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

export const createRoom = mutation({
  args: {
    sessionId: v.string(),
    playerName: v.string(),
    mode: modeValidator,
    matchType: v.optional(matchTypeValidator),
    targetScore: v.optional(targetScoreValidator),
    avatar: v.optional(v.string()),
    cpuLevel: v.optional(cpuLevelValidator),
  },
  handler: async (
    ctx,
    { sessionId, playerName, mode, matchType = "1v1", targetScore = DEFAULT_TARGET_SCORE, avatar, cpuLevel = "normal" },
  ) => {
    assertSessionId(sessionId);
    let code = generateRoomCode();
    for (let attempt = 0; attempt < 10; attempt++) {
      const clash = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!clash) break;
      code = generateRoomCode();
    }

    const roomId = await ctx.db.insert("rooms", {
      code,
      status: "waiting",
      hostSessionId: sessionId,
      mode,
      matchType,
      targetScore,
      currentTurnSeat: 0,
      openEnds: { left: null, right: null },
      board: [],
      boneyard: [],
      round: 0,
      consecutivePasses: 0,
      turnSeconds: 0,
      bonuses: false,
      cpuLevel,
    });
    await ctx.db.insert("players", {
      roomId,
      sessionId,
      name: cleanName(playerName),
      seatIndex: 0,
      hand: [],
      score: 0,
      lastSeen: Date.now(),
      avatar: cleanAvatar(avatar),
    });
    if (matchType === "cpu") {
      await ctx.db.insert("players", {
        roomId,
        sessionId: `cpu:${roomId}`,
        name: "CPU",
        seatIndex: 1,
        hand: [],
        score: 0,
        isBot: true,
        avatar: "🤖",
      });
    }
    return { roomId, code };
  },
});

export const joinRoom = mutation({
  args: { code: v.string(), sessionId: v.string(), playerName: v.string(), avatar: v.optional(v.string()) },
  handler: async (ctx, { code, sessionId, playerName, avatar }) => {
    assertSessionId(sessionId);
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
      .first();
    if (!room) throw new Error("No room with that code");

    const existing = await getPlayer(ctx, room._id, sessionId);
    if (existing) {
      // Re-joining (e.g. after a refresh) just refreshes name and presence.
      await ctx.db.patch(existing._id, {
        name: cleanName(playerName),
        lastSeen: Date.now(),
        ...(cleanAvatar(avatar) ? { avatar: cleanAvatar(avatar) } : {}),
      });
      return { roomId: room._id, code: room.code, seatIndex: existing.seatIndex };
    }

    if (room.status !== "waiting") throw new Error("This game has already started");
    if (room.matchType === "cpu") throw new Error("This is a private game against the CPU");
    const players = await getPlayers(ctx, room._id);
    if (players.length >= seatsFor(room.matchType)) throw new Error("This room is full");

    const taken = new Set(players.map((p) => p.seatIndex));
    let seatIndex = 0;
    while (taken.has(seatIndex)) seatIndex++;

    await ctx.db.insert("players", {
      roomId: room._id,
      sessionId,
      name: cleanName(playerName),
      seatIndex,
      hand: [],
      score: 0,
      lastSeen: Date.now(),
      avatar: cleanAvatar(avatar),
    });
    return { roomId: room._id, code: room.code, seatIndex };
  },
});

export const leaveRoom = mutation({
  args: { roomId: v.id("rooms"), sessionId: v.string() },
  handler: async (ctx, { roomId, sessionId }) => {
    const room = await getRoomOrThrow(ctx, roomId);
    const me = await getPlayer(ctx, roomId, sessionId);
    if (!me) return;
    if (room.status === "playing") throw new Error("You can't leave mid-round");

    await ctx.db.delete(me._id);
    const remaining = (await getPlayers(ctx, roomId)).filter((p) => !p.isBot);
    if (remaining.length === 0) {
      for (const p of await getPlayers(ctx, roomId)) await ctx.db.delete(p._id);
      await ctx.db.delete(roomId);
      return;
    }
    if (room.hostSessionId === sessionId) {
      await ctx.db.patch(roomId, { hostSessionId: remaining[0].sessionId });
    }
  },
});

/** 2v2 lobby: move yourself to an empty seat to pick a partner. */
export const switchSeat = mutation({
  args: { roomId: v.id("rooms"), sessionId: v.string(), seatIndex: v.number() },
  handler: async (ctx, { roomId, sessionId, seatIndex }) => {
    const room = await getRoomOrThrow(ctx, roomId);
    if (room.status !== "waiting") throw new Error("Seats are locked once the game starts");
    if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= seatsFor(room.matchType)) {
      throw new Error("Invalid seat");
    }
    const players = await getPlayers(ctx, roomId);
    const me = players.find((p) => p.sessionId === sessionId);
    if (!me) throw new Error("You are not in this room");
    if (players.some((p) => p.seatIndex === seatIndex)) throw new Error("That seat is taken");
    await ctx.db.patch(me._id, { seatIndex });
  },
});

/** Host changes the points needed to win. Not allowed mid-round. */
export const setTargetScore = mutation({
  args: { roomId: v.id("rooms"), sessionId: v.string(), targetScore: targetScoreValidator },
  handler: async (ctx, { roomId, sessionId, targetScore }) => {
    const room = await getRoomOrThrow(ctx, roomId);
    if (room.hostSessionId !== sessionId) throw new Error("Only the host can change the target");
    if (room.status === "playing") throw new Error("Change the target between rounds");
    await ctx.db.patch(roomId, { targetScore });
  },
});

/** Host changes the house rules. Not allowed mid-round. */
export const setRoomOptions = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
    turnSeconds: v.optional(turnSecondsValidator),
    bonuses: v.optional(v.boolean()),
    cpuLevel: v.optional(cpuLevelValidator),
  },
  handler: async (ctx, { roomId, sessionId, turnSeconds, bonuses, cpuLevel }) => {
    const room = await getRoomOrThrow(ctx, roomId);
    if (room.hostSessionId !== sessionId) throw new Error("Only the host can change the rules");
    if (room.status === "playing") throw new Error("Change the rules between rounds");
    await ctx.db.patch(roomId, {
      ...(turnSeconds !== undefined ? { turnSeconds } : {}),
      ...(bonuses !== undefined ? { bonuses } : {}),
      ...(cpuLevel !== undefined ? { cpuLevel } : {}),
    });
  },
});

/** A one-tap reaction shown over the sender's seat. Only the fixed list is accepted. */
export const sendReaction = mutation({
  args: { roomId: v.id("rooms"), sessionId: v.string(), reaction: v.string() },
  handler: async (ctx, { roomId, sessionId, reaction }) => {
    if (!(REACTIONS as readonly string[]).includes(reaction)) throw new Error("Unknown reaction");
    const me = await getPlayer(ctx, roomId, sessionId);
    if (!me) throw new Error("You are not seated in this room");
    const now = Date.now();
    if (me.reaction && now - me.reaction.at < REACTION_COOLDOWN_MS) return;
    await ctx.db.patch(me._id, { reaction: { text: reaction, at: now }, lastSeen: now });
  },
});

export const setAvatar = mutation({
  args: { roomId: v.id("rooms"), sessionId: v.string(), avatar: v.string() },
  handler: async (ctx, { roomId, sessionId, avatar }) => {
    const me = await getPlayer(ctx, roomId, sessionId);
    const clean = cleanAvatar(avatar);
    if (me && clean) await ctx.db.patch(me._id, { avatar: clean });
  },
});

/** Presence ping; clients call this every ~10s while the room is open. */
export const heartbeat = mutation({
  args: { roomId: v.id("rooms"), sessionId: v.string() },
  handler: async (ctx, { roomId, sessionId }) => {
    const me = await getPlayer(ctx, roomId, sessionId);
    if (me) await ctx.db.patch(me._id, { lastSeen: Date.now() });
  },
});

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

/** Starts the first round, or the next round once a round has finished. */
export const startGame = mutation({
  args: { roomId: v.id("rooms"), sessionId: v.string() },
  handler: async (ctx, { roomId, sessionId }) => {
    const room = await getRoomOrThrow(ctx, roomId);
    if (room.status === "playing") throw new Error("The game is already in progress");
    const players = await getPlayers(ctx, roomId);
    if (room.hostSessionId !== sessionId) {
      // Anyone seated may deal the next round when the host has gone away.
      const host = players.find((p) => p.sessionId === room.hostSessionId);
      const hostAway = !host || Date.now() - (host.lastSeen ?? 0) > AWAY_MS;
      const seated = players.some((p) => p.sessionId === sessionId);
      if (!(room.status === "finished" && hostAway && seated)) throw new Error("Only the host can start the game");
    }

    const needed = seatsFor(room.matchType);
    if (players.length !== needed) {
      throw new Error(`This match needs ${needed} players (${players.length} seated)`);
    }

    // A finished match starts over: scores back to zero, round 1.
    const newMatch = !!room.matchOver;
    const { hands, boneyard } = deal(players.length);
    // Seats are re-packed to 0..n-1 so `(seat + 1) % playerCount` always works.
    // In 2v2 the lobby already fills seats 0-3, so partners stay across.
    for (let i = 0; i < players.length; i++) {
      await ctx.db.patch(players[i]._id, { seatIndex: i, hand: hands[i], ...(newMatch ? { score: 0 } : {}) });
    }

    // The winner of the last round opens the next one. A new match, or a round
    // nobody won (a tied block), is opened by whoever holds the highest double.
    const lastWinner = newMatch ? -1 : players.findIndex((p) => p.sessionId === room.winnerSessionId);
    const starter = lastWinner >= 0 ? lastWinner : findStartingPlayer(hands);

    await ctx.db.patch(roomId, {
      status: "playing",
      currentTurnSeat: starter,
      openEnds: { left: null, right: null },
      board: [],
      boneyard,
      winnerSessionId: undefined,
      winReason: undefined,
      round: newMatch ? 1 : (room.round ?? 0) + 1,
      consecutivePasses: 0,
      lastAction: undefined,
      matchOver: false,
      matchWinnerTeam: undefined,
      turnId: (room.turnId ?? 0) + 1,
      turnDeadline: undefined,
      voids: players.map(() => []),
      bonusEvent: undefined,
    });
    await scheduleNext(ctx, roomId);
  },
});

export const playTile = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
    tileId: v.string(),
    targetSide: v.union(v.literal("left"), v.literal("right"), v.literal("root")),
  },
  handler: async (ctx, { roomId, sessionId, tileId, targetSide }) => {
    const { room, players, me } = await requireTurn(ctx, roomId, sessionId);
    const result = await applyPlay(ctx, room, players, me, tileId, targetSide);
    await scheduleNext(ctx, roomId);
    return { result };
  },
});

/**
 * Called when the player has no legal move. In draw mode this draws one tile
 * from the boneyard (the turn stays with the player); with an empty boneyard,
 * or in block mode, it passes the turn.
 */
export const drawOrPass = mutation({
  args: { roomId: v.id("rooms"), sessionId: v.string() },
  handler: async (ctx, { roomId, sessionId }) => {
    const { room, players, me } = await requireTurn(ctx, roomId, sessionId);
    const result = await applyDrawOrPass(ctx, room, players, me);
    await scheduleNext(ctx, roomId);
    return { result };
  },
});

/** One CPU action (play, draw or pass). Re-schedules itself while it's still the CPU's turn. */
export const cpuTurn = internalMutation({
  args: {
    roomId: v.id("rooms"),
    expectedSeat: v.number(),
    expectedBoardLength: v.number(),
    expectedHandSize: v.number(),
  },
  handler: async (ctx, { roomId, expectedSeat, expectedBoardLength, expectedHandSize }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "playing" || room.currentTurnSeat !== expectedSeat) return;
    const players = await getPlayers(ctx, roomId);
    const me = players.find((p) => p.seatIndex === expectedSeat);
    if (!me?.isBot) return;
    // Ignore stale duplicates (state moved on since this was scheduled).
    if (room.board.length !== expectedBoardLength || me.hand.length !== expectedHandSize) return;

    const move =
      room.board.length === 0
        ? { tileId: chooseOpeningTile(me.hand).id, side: "root" as const }
        : chooseCpuMoveForLevel(room.cpuLevel ?? "normal", me.hand, room.board, room.openEnds, opponentVoids(room, players, me));

    if (move) await applyPlay(ctx, room, players, me, move.tileId, move.side);
    else await applyDrawOrPass(ctx, room, players, me);
    await scheduleNext(ctx, roomId);
  },
});

/** Numbers the players on the other side have failed to match this round. */
function opponentVoids(room: Doc<"rooms">, players: Doc<"players">[], me: Doc<"players">): number[] {
  const teams = teamsOf(room, players);
  return players.flatMap((p, i) => (teams[i] === teams[players.indexOf(me)] ? [] : (room.voids?.[p.seatIndex] ?? [])));
}

/**
 * Clock for a human turn. Plays the turn for them when their time is up or
 * they have dropped off; otherwise looks again a little later.
 */
export const turnTick = internalMutation({
  args: { roomId: v.id("rooms"), turnId: v.number() },
  handler: async (ctx, { roomId, turnId }) => {
    let room = await ctx.db.get(roomId);
    if (!room || room.status !== "playing" || (room.turnId ?? 0) !== turnId) return;
    let players = await getPlayers(ctx, roomId);
    const seat = room.currentTurnSeat;
    let me = players.find((p) => p.seatIndex === seat);
    if (!me || me.isBot) return;

    const now = Date.now();
    const timedOut = room.turnDeadline !== undefined && now >= room.turnDeadline;
    const away = room.matchType !== "cpu" && now - (me.lastSeen ?? 0) > AWAY_MS;
    if (!timedOut && !away) {
      const wait = Math.min(room.turnDeadline !== undefined ? room.turnDeadline - now : Infinity, AWAY_CHECK_MS);
      await ctx.scheduler.runAfter(Math.max(wait, 250), internal.games.turnTick, { roomId, turnId });
      return;
    }

    // Play one whole turn: draw until something fits, then play it (or pass).
    for (let step = 0; step < 30; step++) {
      const lastSeen = me.lastSeen;
      const move =
        room.board.length === 0
          ? { tileId: chooseOpeningTile(me.hand).id, side: "root" as const }
          : chooseCpuMove(me.hand, room.board, room.openEnds);
      const result = move
        ? await applyPlay(ctx, room, players, me, move.tileId, move.side, true)
        : await applyDrawOrPass(ctx, room, players, me, true);
      // The stand-in must not make an absent player look present.
      await ctx.db.patch(me._id, { lastSeen });
      if (result !== "drew") break;
      room = (await ctx.db.get(roomId))!;
      players = await getPlayers(ctx, roomId);
      me = players.find((p) => p.seatIndex === seat)!;
    }
    await scheduleNext(ctx, roomId);
  },
});

// ---------------------------------------------------------------------------
// Queries (sanitized: never leak the boneyard, other hands, or session ids)
// ---------------------------------------------------------------------------

/** Public lookup used by the /room/[code] page before the caller has joined. */
export const getRoomByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
      .first();
    if (!room) return null;
    const players = await getPlayers(ctx, room._id);
    return {
      roomId: room._id,
      code: room.code,
      status: room.status,
      matchType: room.matchType,
      playerCount: players.length,
      seats: seatsFor(room.matchType),
    };
  },
});

export const getGameState = query({
  args: { roomId: v.id("rooms"), sessionId: v.string() },
  handler: async (ctx, { roomId, sessionId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return null;
    const players = await getPlayers(ctx, roomId);
    const me = players.find((p) => p.sessionId === sessionId) ?? null;
    const now = Date.now();
    const isConnected = (p: Doc<"players">) => !!p.isBot || now - (p.lastSeen ?? 0) < CONNECTED_WINDOW_MS;
    const seatOf = (sid: string | undefined) =>
      sid === undefined ? null : (players.find((p) => p.sessionId === sid)?.seatIndex ?? null);
    const teamOf = (seat: number) => (room.matchType === "2v2" ? seat % 2 : seat);
    const finished = room.status === "finished";
    const host = players.find((p) => p.sessionId === room.hostSessionId);
    const hostAway = !host || now - (host.lastSeen ?? 0) > AWAY_MS;

    const hand = me?.hand ?? [];
    const isMyTurn = !!me && room.status === "playing" && room.currentTurnSeat === me.seatIndex;
    const playable = isMyTurn
      ? hand
          .map((t) => ({ tileId: t.id, sides: validSides(t, room.board, room.openEnds) }))
          .filter((p) => p.sides.length > 0)
      : [];

    return {
      room: {
        id: room._id,
        code: room.code,
        status: room.status,
        mode: room.mode,
        matchType: room.matchType,
        seats: seatsFor(room.matchType),
        round: room.round ?? 0,
        targetScore: room.targetScore ?? DEFAULT_TARGET_SCORE,
        matchOver: !!room.matchOver,
        matchWinnerTeam: room.matchWinnerTeam ?? null,
        currentTurnSeat: room.currentTurnSeat,
        openEnds: room.openEnds,
        board: room.board,
        boneyardCount: room.boneyard.length,
        hostSeat: seatOf(room.hostSessionId),
        winnerSeat: seatOf(room.winnerSessionId),
        winReason: room.winReason ?? null,
        lastAction: room.lastAction ?? null,
        turnSeconds: room.turnSeconds ?? 0,
        turnDeadline: room.status === "playing" ? (room.turnDeadline ?? null) : null,
        bonuses: !!room.bonuses,
        cpuLevel: room.cpuLevel ?? "normal",
        lastRound: finished ? (room.lastRound ?? null) : null,
        bonusEvent: room.bonusEvent ?? null,
      },
      me: me
        ? {
            id: me._id,
            name: me.name,
            seatIndex: me.seatIndex,
            team: teamOf(me.seatIndex),
            score: me.score,
            hand,
            isHost: room.hostSessionId === sessionId,
            // The host deals; anyone may once the host has gone away.
            canStart: room.hostSessionId === sessionId || (finished && hostAway),
            avatar: me.avatar ?? null,
            reaction: me.reaction ?? null,
            isMyTurn,
            playable,
            canDrawOrPass: isMyTurn && room.board.length > 0 && playable.length === 0,
            willDraw: room.mode === "draw" && room.boneyard.length > 0,
            finalPips: finished ? pipTotal(hand) : null,
          }
        : null,
      opponents: players
        .filter((p) => p.sessionId !== sessionId)
        .map((p) => ({
          id: p._id,
          name: p.name,
          seatIndex: p.seatIndex,
          tileCount: p.hand.length,
          score: p.score,
          isConnected: isConnected(p),
          // Extras (no hidden info): team, bot flag, and a pip *total* only
          // once the round is over (to explain blocked results).
          team: teamOf(p.seatIndex),
          isBot: !!p.isBot,
          avatar: p.avatar ?? null,
          reaction: p.reaction ?? null,
          finalPips: finished ? pipTotal(p.hand) : null,
        })),
    };
  },
});
